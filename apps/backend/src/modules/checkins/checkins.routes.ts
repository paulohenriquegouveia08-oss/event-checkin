import type { FastifyInstance } from "fastify";
import { requireAdmin, requireTerminal } from "../../middleware/auth.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";
import * as checkinsService from "./checkins.service.js";
import { checkinEventParamsSchema, createCheckInSchema } from "./checkins.schema.js";
import { adminCheckInBus } from "../admin/adminMonitor.events.js";

export async function checkinsRoutes(app: FastifyInstance) {
  app.post("/events/:eventId/checkins", { preHandler: requireTerminal }, async (request, reply) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);
    if (request.terminal?.eventId !== eventId) {
      throw new ForbiddenError("Este terminal não pertence a este evento");
    }
    const { qrToken } = createCheckInSchema.parse(request.body);

    try {
      const outcome = await checkinsService.performCheckIn({
        eventId,
        qrToken,
        terminalId: request.terminal!.terminalId,
        terminalName: request.terminal!.name,
        source: "ONLINE",
      });

      return reply.status(outcome.status === "CONFIRMED" ? 201 : 200).send(
        ok({
          status: outcome.status,
          participant: outcome.participant,
          checkedInAt: outcome.checkIn.checkedInAt,
        })
      );
    } catch (error) {
      // Publish rejected check-ins to admin monitor
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        adminCheckInBus.publish(eventId, {
          type: "check_in",
          eventId,
          participantId: "",
          participantName: "—",
          status: "REJECTED",
          checkedInAt: new Date().toISOString(),
          terminalName: request.terminal!.name,
          terminalId: request.terminal!.terminalId,
          source: "ONLINE",
          errorMessage: error.message,
        });
      }
      throw error;
    }
  });

  app.get("/events/:eventId/statistics", { preHandler: requireAdmin }, async (request) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);
    const stats = await checkinsService.getEventStatistics(eventId);
    return ok(stats);
  });

  // SSE endpoint for real-time admin monitoring
  app.get("/events/:eventId/monitor", async (request, reply) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);

    // Accept token via query param (EventSource can't send headers)
    const token = (request.query as Record<string, string>).token;
    if (!token) {
      return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Token ausente" } });
    }

    let payload: { sub: string; role: string; type: string };
    try {
      payload = app.jwt.verify(token);
    } catch {
      return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Token inválido" } });
    }

    if (payload.type !== "admin") {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Acesso negado" } });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.hijack();

    reply.raw.write(`data: ${JSON.stringify({ type: "connected", eventId })}\n\n`);

    const unsubscribe = adminCheckInBus.subscribe(eventId, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 30_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
