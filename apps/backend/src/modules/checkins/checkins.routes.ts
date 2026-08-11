import type { FastifyInstance } from "fastify";
import { requireAdmin, requireTerminal } from "../../middleware/auth.js";
import { ForbiddenError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";
import * as checkinsService from "./checkins.service.js";
import { checkinEventParamsSchema, createCheckInSchema } from "./checkins.schema.js";

export async function checkinsRoutes(app: FastifyInstance) {
  app.post("/events/:eventId/checkins", { preHandler: requireTerminal }, async (request, reply) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);
    if (request.terminal?.eventId !== eventId) {
      throw new ForbiddenError("Este terminal não pertence a este evento");
    }
    const { qrToken } = createCheckInSchema.parse(request.body);

    const outcome = await checkinsService.performCheckIn({
      eventId,
      qrToken,
      terminalId: request.terminal!.terminalId,
      source: "ONLINE",
    });

    return reply.status(outcome.status === "CONFIRMED" ? 201 : 200).send(
      ok({
        status: outcome.status,
        participant: outcome.participant,
        checkedInAt: outcome.checkIn.checkedInAt,
      })
    );
  });

  app.get("/events/:eventId/statistics", { preHandler: requireAdmin }, async (request) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);
    const stats = await checkinsService.getEventStatistics(eventId);
    return ok(stats);
  });
}
