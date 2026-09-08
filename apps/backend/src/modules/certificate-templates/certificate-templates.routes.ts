import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import * as service from "./certificate-templates.service.js";
import {
  atualizarModeloSchema,
  criarModeloSchema,
  modeloIdParamsSchema,
} from "./certificate-templates.schema.js";

/**
 * Biblioteca de modelos de certificado.
 *
 * Exige `certificates.issue` — mexer no modelo muda o documento oficial de
 * todo participante do evento que o usa, o que é bem mais que consultar.
 */
export async function certificateTemplatesRoutes(app: FastifyInstance) {
  app.get("/certificate-templates", { preHandler: requirePermission("certificates.view") }, async () => {
    return ok(await service.listarModelos());
  });

  app.post(
    "/certificate-templates",
    // O limite de corpo do Fastify é 1 MiB por padrão, e uma arte de
    // certificado em base64 passa disso com folga (um PNG de 1,5 MB vira
    // ~2 MB). Sem isto, o upload falha com 500 e a mensagem não diz o
    // motivo. 12 MB cobre o teto de 8 MB do arquivo mais a folga do
    // base64 e do JSON. Por rota, e não global: o resto do sistema não
    // recebe corpo grande e não deve passar a aceitar.
    { preHandler: requirePermission("certificates.issue"), bodyLimit: 12 * 1024 * 1024 },
    async (request) => {
      const input = criarModeloSchema.parse(request.body);
      const modelo = await service.criarModelo(input, request.admin?.userId ?? null);
      await recordAudit(request, "certificate_template.created", "CertificateTemplate", modelo.id, {
        name: modelo.name,
        dimensoes: `${modelo.imageWidth}x${modelo.imageHeight}`,
      });
      return ok(modelo);
    },
  );

  app.patch(
    "/certificate-templates/:templateId",
    { preHandler: requirePermission("certificates.issue"), bodyLimit: 12 * 1024 * 1024 },
    async (request) => {
      const { templateId } = modeloIdParamsSchema.parse(request.params);
      const input = atualizarModeloSchema.parse(request.body);
      const modelo = await service.atualizarModelo(templateId, input);
      await recordAudit(request, "certificate_template.updated", "CertificateTemplate", templateId, {
        trocouArte: Boolean(input.dataBase64),
      });
      return ok(modelo);
    },
  );

  app.delete(
    "/certificate-templates/:templateId",
    { preHandler: requirePermission("certificates.issue") },
    async (request) => {
      const { templateId } = modeloIdParamsSchema.parse(request.params);
      await service.apagarModelo(templateId);
      await recordAudit(request, "certificate_template.deleted", "CertificateTemplate", templateId);
      return ok({ ok: true });
    },
  );

  /**
   * A arte, para o painel mostrar a prévia.
   *
   * Autenticação por query string, e não por header: um `<img src>` não
   * manda `Authorization`. Mesmo padrão já usado em `/signatures/:filename`
   * e no SSE do monitor.
   */
  app.get("/certificate-templates/:templateId/image", async (request, reply) => {
    const { templateId } = modeloIdParamsSchema.parse(request.params);
    const { token } = request.query as { token?: string };
    if (!token) return reply.code(401).send({ error: "token_ausente" });
    try {
      app.jwt.verify(token);
    } catch {
      return reply.code(401).send({ error: "token_invalido" });
    }

    const arte = await service.lerArte(templateId);
    return reply.type("image/png").send(arte);
  });
}
