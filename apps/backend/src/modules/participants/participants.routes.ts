import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import { eventIdParamsSchema } from "../events/events.schema.js";
import * as participantsService from "./participants.service.js";
import {
  createParticipantSchema,
  importParticipantsSchema,
  participantParamsSchema,
  updateParticipantSchema,
} from "./participants.schema.js";

export async function participantsRoutes(app: FastifyInstance) {
  app.post(
    "/events/:eventId/participants",
    { preHandler: requirePermission("participants.create") },
    async (request, reply) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const input = createParticipantSchema.parse(request.body);
      const participant = await participantsService.createParticipant(eventId, input);
      await recordAudit(request, "participant.create", "Participant", participant.id, { eventId });
      return reply.status(201).send(ok(participant));
    }
  );

  app.get(
    "/events/:eventId/participants",
    { preHandler: requirePermission("participants.view") },
    async (request) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const participants = await participantsService.listParticipants(eventId);
      return ok(participants);
    }
  );

  app.post(
    "/events/:eventId/participants/import",
    { preHandler: requirePermission("participants.create") },
    async (request) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const { csv, confirm } = importParticipantsSchema.parse(request.body);
      const report = await participantsService.importParticipants(eventId, csv, confirm);
      await recordAudit(request, "participant.import", "Participant", null, { eventId, ...report });
      return ok(report);
    }
  );

  app.patch(
    "/events/:eventId/participants/:participantId",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId, participantId } = participantParamsSchema.parse(request.params);
      const input = updateParticipantSchema.parse(request.body);
      const participant = await participantsService.updateParticipant(eventId, participantId, input);
      await recordAudit(request, "participant.update", "Participant", participantId);
      return ok(participant);
    }
  );

  app.post(
    "/events/:eventId/participants/:participantId/rotate-qr-token",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId, participantId } = participantParamsSchema.parse(request.params);
      const participant = await participantsService.rotateQrToken(eventId, participantId);
      await recordAudit(request, "participant.rotate_qr_token", "Participant", participantId);
      return ok(participant);
    }
  );

  app.delete(
    "/events/:eventId/participants/:participantId",
    { preHandler: requirePermission("participants.delete") },
    async (request, reply) => {
      const { eventId, participantId } = participantParamsSchema.parse(request.params);
      await participantsService.deleteParticipant(eventId, participantId);
      await recordAudit(request, "participant.delete", "Participant", participantId);
      return reply.status(204).send();
    }
  );
}
