import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { BadRequestError, NotFoundError } from "../../shared/errors.js";
import { mercadoPagoClient } from "../../lib/mercadopago/mercadopago.client.js";
import { recordAudit } from "../audit/audit.service.js";
import * as inscriptionsService from "./inscriptions.service.js";
import {
  createInscriptionSchema,
  eventInscriptionParamsSchema,
  inscriptionEventParamsSchema,
  picPayWebhookSchema,
} from "./inscriptions.schema.js";

const eventIdParams = z.object({ eventId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });

export async function inscriptionsRoutes(app: FastifyInstance) {
  // Público — criar inscrição (site pré-copol)
  app.post("/events/:eventId/inscriptions", async (request, reply) => {
    const { eventId } = inscriptionEventParamsSchema.parse(request.params);
    const input = createInscriptionSchema.parse(request.body);

    // request.ip ja considera o X-Forwarded-For quando o Fastify esta
    // com trustProxy — que e' o caso atras do nginx. Sem isso, todas as
    // inscricoes ficariam registradas com o IP do proprio container.
    const inscription = await inscriptionsService.createInscription(eventId, input, request.ip);
    return reply.status(201).send(ok(inscription));
  });

  // Público — consultar detalhes da inscrição
  app.get("/inscriptions/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const inscription = await inscriptionsService.getInscription(id);
    return ok(inscription);
  });

  // Público — polling do status do pagamento na tela de confirmação
  app.get("/inscriptions/:id/payment-status", async (request) => {
    const { id } = idParams.parse(request.params);
    const status = await inscriptionsService.getInscriptionPaymentStatus(id);
    return ok(status);
  });

  // Webhook do PicPay (recebe notificação de pagamento)
  app.post("/inscriptions/picpay/webhook", async (request, reply) => {
    const xSellerToken = request.headers["x-seller-token"] as string | undefined;
    const body = picPayWebhookSchema.parse(request.body);

    const result = await inscriptionsService.handlePicPayWebhook(xSellerToken, body);
    return reply.status(200).send(ok(result));
  });

  // Webhook do Mercado Pago (recebe notificação de pagamento).
  //
  // Sem schema do Zod no corpo de propósito: o Mercado Pago manda formatos
  // diferentes conforme o evento, e recusar por formato faria o reenvio
  // continuar para sempre. Quem valida de verdade é a assinatura, e depois
  // a consulta do pagamento na API deles.
  app.post("/inscriptions/mercadopago/webhook", async (request, reply) => {
    const header = (nome: string) => {
      const valor = request.headers[nome];
      if (Array.isArray(valor)) return valor[0] ?? null;
      return (valor as string | undefined) ?? null;
    };

    const query = (request.query ?? {}) as { "data.id"?: string; type?: string };

    const resultado = await inscriptionsService.handleMercadoPagoWebhook(
      { xSignature: header("x-signature"), xRequestId: header("x-request-id") },
      { dataId: query["data.id"] ?? null, type: query.type ?? null },
      (request.body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } }
    );

    // Corpo sem o envelope ok(): o Mercado Pago lê o código HTTP, e o corpo
    // aparece no painel de notificações deles — é onde a explicação ajuda.
    return reply.status(resultado.httpStatus).send(resultado.body);
  });

  // Admin — Relatório completo de inscritos (Nome, E-mail, Telefone, CPF, Lote, Status)
  app.get(
    "/events/:eventId/inscriptions/report",
    { preHandler: requirePermission("participants.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const report = await inscriptionsService.getInscriptionsReport(eventId);
      return ok(report);
    }
  );

  // Admin — Confirmar pagamento manualmente
  app.post(
    "/events/:eventId/inscriptions/:id/confirm",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId, id } = eventInscriptionParamsSchema.parse(request.params);
      const current = await inscriptionsService.getInscription(id);
      if (current.eventId !== eventId) {
        throw new NotFoundError("Inscrição não encontrada");
      }
      if (Number(current.amount) > 0 && mercadoPagoClient.configurado) {
        throw new BadRequestError(
          "Inscrições pagas vinculadas ao Mercado Pago não podem ser liberadas manualmente pelo painel. A confirmação ocorre exclusivamente de forma automática após a liquidação do Pix ou Cartão."
        );
      }
      const inscription = await inscriptionsService.confirmInscriptionPayment(id);
      await recordAudit(request, "inscription.confirm", "Inscription", id, { eventId });
      return ok({ success: true, inscription });
    }
  );

  // Admin — Cancelar inscrição
  app.post(
    "/events/:eventId/inscriptions/:id/cancel",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId, id } = eventInscriptionParamsSchema.parse(request.params);
      const inscription = await inscriptionsService.cancelInscription(eventId, id);
      await recordAudit(request, "inscription.cancel", "Inscription", id, { eventId });
      return ok({ success: true, inscription });
    }
  );

  // Admin — Excluir fisicamente inscrição e participante
  app.delete(
    "/events/:eventId/inscriptions/:id",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId, id } = eventInscriptionParamsSchema.parse(request.params);
      const result = await inscriptionsService.deleteInscription(eventId, id);
      await recordAudit(request, "inscription.delete", "Inscription", id, { eventId });
      return ok(result);
    }
  );

  // Admin — Sortear equipes para quem se inscreveu sozinho (evento com
  // inscrição em equipe — ver Event.siteContent.equipe)
  app.post(
    "/events/:eventId/inscriptions/sortear-equipes",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const resultado = await inscriptionsService.sortearEquipes(eventId);
      await recordAudit(request, "inscription.sortear_equipes", "Event", eventId, resultado);
      return ok(resultado);
    }
  );
}

