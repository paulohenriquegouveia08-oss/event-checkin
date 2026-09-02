import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import * as inscriptionsService from "./inscriptions.service.js";
import {
  createInscriptionSchema,
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

    const inscription = await inscriptionsService.createInscription(eventId, input);
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
}
