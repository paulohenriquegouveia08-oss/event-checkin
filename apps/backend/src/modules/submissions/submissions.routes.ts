import type { FastifyInstance } from "fastify";

import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import * as service from "./submissions.service.js";
import {
  catalogIdParams,
  createModalitySchema,
  createSubmissionSchema,
  createTopicSchema,
  decideSubmissionSchema,
  eventIdParams,
  listSubmissionsQuery,
  submissionIdParams,
  submissionSettingsSchema,
  uploadFileSchema,
} from "./submissions.schema.js";

export async function submissionsRoutes(app: FastifyInstance) {
  // ── configuração da chamada ──────────────────────────────────────────
  app.get(
    "/events/:eventId/submissions/settings",
    { preHandler: requirePermission("submissions.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      return ok(await service.getSettings(eventId));
    }
  );

  app.patch(
    "/events/:eventId/submissions/settings",
    { preHandler: requirePermission("submissions.configure") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = submissionSettingsSchema.parse(request.body);
      const settings = await service.updateSettings(eventId, input);
      await recordAudit(request, "submissions.settings_update", "Event", eventId, input);
      return ok(settings);
    }
  );

  // ── catálogo ─────────────────────────────────────────────────────────
  app.get(
    "/events/:eventId/submissions/modalities",
    { preHandler: requirePermission("submissions.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      return ok(await service.listModalities(eventId));
    }
  );

  app.post(
    "/events/:eventId/submissions/modalities",
    { preHandler: requirePermission("submissions.configure") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = createModalitySchema.parse(request.body);
      const m = await service.createModality(eventId, input);
      await recordAudit(request, "submissions.modality_create", "Event", eventId, {
        name: m.name,
      });
      return reply.status(201).send(ok(m));
    }
  );

  app.delete(
    "/events/:eventId/submissions/modalities/:id",
    { preHandler: requirePermission("submissions.configure") },
    async (request) => {
      const { eventId, id } = catalogIdParams.parse(request.params);
      await service.deleteModality(eventId, id);
      await recordAudit(request, "submissions.modality_delete", "Event", eventId, { id });
      return ok({ deleted: true });
    }
  );

  app.get(
    "/events/:eventId/submissions/topics",
    { preHandler: requirePermission("submissions.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      return ok(await service.listTopics(eventId));
    }
  );

  app.post(
    "/events/:eventId/submissions/topics",
    { preHandler: requirePermission("submissions.configure") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = createTopicSchema.parse(request.body);
      const t = await service.createTopic(eventId, input);
      await recordAudit(request, "submissions.topic_create", "Event", eventId, {
        name: t.name,
      });
      return reply.status(201).send(ok(t));
    }
  );

  app.delete(
    "/events/:eventId/submissions/topics/:id",
    { preHandler: requirePermission("submissions.configure") },
    async (request) => {
      const { eventId, id } = catalogIdParams.parse(request.params);
      await service.deleteTopic(eventId, id);
      await recordAudit(request, "submissions.topic_delete", "Event", eventId, { id });
      return ok({ deleted: true });
    }
  );

  // ── trabalhos ────────────────────────────────────────────────────────
  app.get(
    "/events/:eventId/submissions",
    { preHandler: requirePermission("submissions.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const q = listSubmissionsQuery.parse(request.query);
      return ok(await service.listSubmissions(eventId, q));
    }
  );

  app.get(
    "/events/:eventId/submissions/:submissionId",
    { preHandler: requirePermission("submissions.view") },
    async (request) => {
      const { eventId, submissionId } = submissionIdParams.parse(request.params);
      return ok(await service.getSubmission(eventId, submissionId));
    }
  );

  // Criado pelo organizador em nome do autor. A rota pública, usada pelo
  // próprio autor, entra junto com o portal do participante — por isso esta
  // exige permissão de gestão.
  app.post(
    "/events/:eventId/submissions",
    { preHandler: requirePermission("submissions.manage") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = createSubmissionSchema.parse(request.body);
      const s = await service.createSubmission(eventId, input);
      await recordAudit(request, "submissions.create", "Submission", s.id, {
        code: s.code,
      });
      return reply.status(201).send(ok(s));
    }
  );

  app.post(
    "/events/:eventId/submissions/:submissionId/file",
    {
      preHandler: requirePermission("submissions.manage"),
      // 10 MB de PDF viram ~13,4 MB em base64. O teto de 20 MB dá folga
      // para o limite configurável do evento (padrão 10 MB) sem que o
      // Fastify corte a requisição antes de a nossa mensagem de erro,
      // que explica o limite, chegar a ser gerada.
      bodyLimit: 20 * 1024 * 1024,
    },
    async (request) => {
      const { eventId, submissionId } = submissionIdParams.parse(request.params);
      const { fileName, dataBase64 } = uploadFileSchema.parse(request.body);
      const r = await service.uploadFile(eventId, submissionId, fileName, dataBase64);
      await recordAudit(request, "submissions.file_upload", "Submission", submissionId, {
        fileName,
      });
      return ok(r);
    }
  );

  app.get(
    "/events/:eventId/submissions/:submissionId/file",
    { preHandler: requirePermission("submissions.view") },
    async (request, reply) => {
      const { eventId, submissionId } = submissionIdParams.parse(request.params);
      const { buffer, fileName } = await service.readFile(eventId, submissionId);
      return reply
        .header("Content-Type", "application/pdf")
        // `inline` para abrir no navegador — a comissão lê muitos trabalhos
        // seguidos e baixar cada um seria trabalhoso à toa.
        .header("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`)
        .send(buffer);
    }
  );

  app.post(
    "/events/:eventId/submissions/:submissionId/submit",
    { preHandler: requirePermission("submissions.manage") },
    async (request) => {
      const { eventId, submissionId } = submissionIdParams.parse(request.params);
      const s = await service.submitSubmission(eventId, submissionId);
      await recordAudit(request, "submissions.submit", "Submission", submissionId);
      return ok(s);
    }
  );

  app.post(
    "/events/:eventId/submissions/:submissionId/withdraw",
    { preHandler: requirePermission("submissions.manage") },
    async (request) => {
      const { eventId, submissionId } = submissionIdParams.parse(request.params);
      const s = await service.withdrawSubmission(eventId, submissionId);
      await recordAudit(request, "submissions.withdraw", "Submission", submissionId);
      return ok(s);
    }
  );

  app.post(
    "/events/:eventId/submissions/:submissionId/decide",
    { preHandler: requirePermission("submissions.manage") },
    async (request) => {
      const { eventId, submissionId } = submissionIdParams.parse(request.params);
      const { decision, reason } = decideSubmissionSchema.parse(request.body);
      const s = await service.decideSubmission(eventId, submissionId, decision);
      // A decisão entra na auditoria com o motivo: "por que este trabalho
      // foi reprovado" é a pergunta que chega meses depois, do autor.
      await recordAudit(request, "submissions.decide", "Submission", submissionId, {
        decision,
        reason,
      });
      return ok(s);
    }
  );
}
