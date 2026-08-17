import type { FastifyInstance } from "fastify";
import { requireAttendee, requirePermission } from "../../middleware/auth.js";
import { ForbiddenError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";
import { recordAudit, recordParticipantAudit } from "../audit/audit.service.js";
import * as certificatesService from "./certificates.service.js";
import { certificateIdParamsSchema, eventIdParamsSchema, verificationCodeParamsSchema } from "./certificates.schema.js";

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
