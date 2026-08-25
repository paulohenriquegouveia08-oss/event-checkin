import type { FastifyInstance } from "fastify";
import { requireAttendee, requirePermission } from "../../middleware/auth.js";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";
import { recordAudit, recordParticipantAudit } from "../audit/audit.service.js";
import * as certificatesService from "./certificates.service.js";
import {
  certificateIdParamsSchema,
  certificatePreviewQuerySchema,
  eventIdParamsSchema,
  eventParticipantParamsSchema,
  signatureImageParamsSchema,
  signatureImageQuerySchema,
  uploadSignatureImageSchema,
  verificationCodeParamsSchema,
} from "./certificates.schema.js";

/** Garante que o :eventId da URL bate com o evento do token do attendee —
 * defesa em profundidade: o participantId já vem 100% do token (nunca de
 * input), mas isso evita respostas confusas (404 de outro evento) caso o
 * front peça o eventId errado. */
function assertEventMatchesToken(request: { attendee?: { eventId: string } }, eventId: string) {
  if (!request.attendee || request.attendee.eventId !== eventId) {
    throw new ForbiddenError("Este documento não pertence ao evento da sua sessão");
  }
}

export async function certificatesRoutes(app: FastifyInstance) {
  // --- Área do participante (attendee) ---

  app.get("/events/:eventId/my-documents", { preHandler: requireAttendee }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    assertEventMatchesToken(request, eventId);
    const data = await certificatesService.getMyDocuments(eventId, request.attendee!.participantId);
    return ok(data);
  });

  app.get("/events/:eventId/certificates/download", { preHandler: requireAttendee }, async (request, reply) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    assertEventMatchesToken(request, eventId);
    const participantId = request.attendee!.participantId;

    const { buffer, certificateId, regenerated } = await certificatesService.getOrGenerateCertificatePdf(eventId, participantId);

    const actorEmail = await certificatesService.resolveParticipantActorEmail(eventId, participantId);
    if (regenerated) {
      await recordParticipantAudit(request, "certificate.generated", "Certificate", certificateId, actorEmail, { eventId });
    }
    await recordParticipantAudit(request, "certificate.downloaded", "Certificate", certificateId, actorEmail, { eventId });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", "attachment; filename=certificado.pdf");
    return reply.send(buffer);
  });

  app.get("/events/:eventId/attendance-proof/download", { preHandler: requireAttendee }, async (request, reply) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    assertEventMatchesToken(request, eventId);
    const participantId = request.attendee!.participantId;

    const { buffer, regenerated } = await certificatesService.getOrGenerateAttendanceProofPdf(eventId, participantId);

    const actorEmail = await certificatesService.resolveParticipantActorEmail(eventId, participantId);
    if (regenerated) {
      await recordParticipantAudit(request, "attendance_proof.generated", "AttendanceProof", null, actorEmail, { eventId });
    }
    await recordParticipantAudit(request, "attendance_proof.downloaded", "AttendanceProof", null, actorEmail, { eventId });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", "attachment; filename=comprovante-presenca.pdf");
    return reply.send(buffer);
  });

  // --- Validação pública (QR Code do certificado) ---

  app.get("/public/certificates/:code", async (request) => {
    const { code } = verificationCodeParamsSchema.parse(request.params);
    const data = await certificatesService.getPublicCertificate(code);
    return ok(data);
  });

  // --- Administração ---

  // Gera um PDF de teste (nunca persiste nada — ver generateTestCertificatePdf)
  // pra quem tem acesso à aba de certificados conferir o template sem
  // precisar esperar o evento terminar nem ter um participante presente.
  app.get(
    "/events/:eventId/certificates/preview",
    { preHandler: requirePermission("certificates.view") },
    async (request, reply) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const { name } = certificatePreviewQuerySchema.parse(request.query);
      const buffer = await certificatesService.generateTestCertificatePdf(eventId, name || "Participante de Teste");

      await recordAudit(request, "certificate.preview_generated", "Event", eventId);

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", "attachment; filename=certificado-teste.pdf");
      return reply.send(buffer);
    }
  );

  // Upload de imagem de assinatura pra um signatário (ver
  // certificate-settings.ts). O admin manda base64 em vez de multipart —
  // simples o bastante pra não precisar de uma dependência nova só pra
  // isso, e o arquivo é pequeno (assinatura, não foto). Mesma permissão
  // que já protege salvar as configurações do certificado.
  app.post(
    "/certificates/signature-image",
    { preHandler: requirePermission("events.edit"), bodyLimit: 4 * 1024 * 1024 },
    async (request) => {
      const { mimeType, dataBase64 } = uploadSignatureImageSchema.parse(request.body);
      const result = await certificatesService.uploadSignatureImage(mimeType, dataBase64);
      await recordAudit(request, "certificate.signature_image_uploaded", "Event", null);
      return ok(result);
    }
  );

  // Serve a imagem de volta pro <img> do admin mostrar o preview — token
  // via query string porque um <img src> não manda header Authorization
  // (mesmo padrão do SSE de monitor em checkins.routes.ts).
  app.get("/signatures/:filename", async (request, reply) => {
    const { filename } = signatureImageParamsSchema.parse(request.params);
    const { token } = signatureImageQuerySchema.parse(request.query);

    let payload: { sub: string; type: string };
    try {
      payload = app.jwt.verify(token);
    } catch {
      throw new UnauthorizedError("Token inválido ou expirado");
    }
    if (payload.type !== "admin") {
      throw new ForbiddenError("Acesso negado");
    }

    const { buffer, mimeType } = await certificatesService.getSignatureImage(filename);
    reply.header("Content-Type", mimeType);
    reply.header("Cache-Control", "private, max-age=3600");
    return reply.send(buffer);
  });

  app.get("/events/:eventId/certificates/stats", { preHandler: requirePermission("certificates.view") }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const stats = await certificatesService.getCertificateStats(eventId);
    return ok(stats);
  });

  app.get("/events/:eventId/certificates", { preHandler: requirePermission("certificates.view") }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const list = await certificatesService.listCertificates(eventId);
    return ok(list);
  });

  app.post(
    "/events/:eventId/certificates/release",
    { preHandler: requirePermission("certificates.issue") },
    async (request) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const result = await certificatesService.releaseEligibleCertificates(eventId);
      await recordAudit(request, "certificate.released", "Event", eventId, result);
      return ok(result);
    }
  );

  // --- Certificado de um participante específico (painel do admin) ---
  //
  // Complementam o release em lote acima, que só alcança quem tem
  // check-in e só depois do evento encerrar. Estas rotas são a saída
  // para os casos que a regra automática não cobre.

  app.get(
    "/events/:eventId/participants/certificates",
    { preHandler: requirePermission("certificates.view") },
    async (request) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const rows = await certificatesService.listParticipantsCertificateStatus(eventId);
      return ok(rows);
    }
  );

  app.post(
    "/events/:eventId/participants/:participantId/certificate/release",
    { preHandler: requirePermission("certificates.issue") },
    async (request) => {
      const { eventId, participantId } = eventParticipantParamsSchema.parse(request.params);
      const certificate = await certificatesService.manuallyReleaseCertificate(
        eventId,
        participantId,
        request.admin!.userId
      );
      await recordAudit(request, "certificate.manually_released", "Certificate", certificate.id, {
        eventId,
        participantId,
      });
      return ok(certificate);
    }
  );

  app.delete(
    "/events/:eventId/participants/:participantId/certificate/release",
    { preHandler: requirePermission("certificates.issue") },
    async (request) => {
      const { eventId, participantId } = eventParticipantParamsSchema.parse(request.params);
      const certificate = await certificatesService.undoManualCertificateRelease(eventId, participantId);
      await recordAudit(request, "certificate.manual_release_undone", "Certificate", certificate.id, {
        eventId,
        participantId,
      });
      return ok(certificate);
    }
  );

  // Baixa o PDF do participante pelo painel — para o admin reenviar
  // quando a pessoa não consegue baixar sozinha. Gera na hora se ainda
  // não existir (mesmo caminho do download do participante), por isso
  // exige certificates.issue e não apenas .view.
  app.get(
    "/events/:eventId/participants/:participantId/certificate/download",
    { preHandler: requirePermission("certificates.issue") },
    async (request, reply) => {
      const { eventId, participantId } = eventParticipantParamsSchema.parse(request.params);
      const { buffer, certificateId, regenerated, participantName } =
        await certificatesService.getCertificatePdfForAdmin(eventId, participantId);

      if (regenerated) {
        await recordAudit(request, "certificate.generated", "Certificate", certificateId, { eventId, participantId });
      }
      await recordAudit(request, "certificate.downloaded_by_admin", "Certificate", certificateId, {
        eventId,
        participantId,
      });

      // Nome do arquivo com o nome da pessoa: o admin costuma baixar
      // vários seguidos para reenviar, e "certificado.pdf (1)(2)(3)" na
      // pasta de downloads seria impossível de distinguir.
      // NFD separa "e-acento" em "e" + marca combinante; a marca vira
      // nao-ASCII e o filtro abaixo a remove, sobrando o "e" puro. Se a
      // ordem fosse invertida, a marca viraria "-" e "Jose" sairia
      // "jos-e". Regex so com ASCII de proposito: combinantes literais
      // no fonte sao invisiveis no editor e faceis de corromper.
      const safeName = participantName
        .normalize("NFD")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename=certificado-${safeName || "participante"}.pdf`);
      return reply.send(buffer);
    }
  );

  app.post(
    "/certificates/:certificateId/revoke",
    { preHandler: requirePermission("certificates.issue") },
    async (request) => {
      const { certificateId } = certificateIdParamsSchema.parse(request.params);
      const certificate = await certificatesService.revokeCertificate(certificateId);
      await recordAudit(request, "certificate.revoked", "Certificate", certificateId);
      return ok(certificate);
    }
  );

  app.post(
    "/certificates/:certificateId/reinstate",
    { preHandler: requirePermission("certificates.issue") },
    async (request) => {
      const { certificateId } = certificateIdParamsSchema.parse(request.params);
      const certificate = await certificatesService.reinstateCertificate(certificateId);
      await recordAudit(request, "certificate.reinstated", "Certificate", certificateId);
      return ok(certificate);
    }
  );
}
