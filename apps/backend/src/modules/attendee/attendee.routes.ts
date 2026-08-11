import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { attendeeLoginSchema } from "./attendee.schema.js";
import { attendeeRepository } from "./attendee.repository.js";
import { ok, fail } from "../../shared/response.js";
import { attendeeEventBus, type CheckInEvent } from "./attendee.events.js";

const selectEventSchema = z.object({
  participantId: z.string().uuid(),
});

export async function attendeeRoutes(app: FastifyInstance) {
  /**
   * POST /attendee/login
   * Public — participant logs in with email only.
   * If found in 1 active event → returns JWT + participant data.
   * If found in multiple events → returns list for selection.
   */
  app.post("/attendee/login", async (request, reply) => {
    const { email } = attendeeLoginSchema.parse(request.body);

    const participants = await attendeeRepository.findParticipantByEmail(email);

    if (participants.length === 0) {
      return reply.status(404).send(
        fail("NOT_FOUND", "Nenhum evento encontrado para este e-mail")
      );
    }

    // If only one event, auto-select and login
    if (participants.length === 1) {
      const participant = participants[0];
      const token = await reply.jwtSign(
        {
          sub: participant.id,
          eventId: participant.eventId,
          type: "attendee" as const,
        },
        { expiresIn: "24h" }
      );

      return reply.send(
        ok({
          token,
          participant: {
            id: participant.id,
            name: participant.name,
            email: participant.email,
            qrToken: participant.qrToken,
            status: participant.status,
            event: participant.event,
            lastCheckIn: participant.checkIns[0] ?? null,
            checkedIn: participant.checkIns.length > 0,
          },
        })
      );
    }

    // Multiple events — return list for selection
    return reply.send(
      ok({
        requiresEventSelection: true,
        events: participants.map((p) => ({
          participantId: p.id,
          name: p.name,
          email: p.email,
          qrToken: p.qrToken,
          status: p.status,
          event: p.event,
          lastCheckIn: p.checkIns[0] ?? null,
          checkedIn: p.checkIns.length > 0,
        })),
      })
    );
  });

  /**
   * POST /attendee/select-event
   * Public — after email lookup found multiple events, participant picks one.
   */
  app.post("/attendee/select-event", async (request, reply) => {
    const { participantId } = selectEventSchema.parse(request.body);

    const participant = await attendeeRepository.getParticipantById(participantId);

    if (!participant || participant.status !== "ACTIVE") {
      return reply.status(404).send(
        fail("NOT_FOUND", "Participante não encontrado")
      );
    }

    const token = await reply.jwtSign(
      {
        sub: participant.id,
        eventId: participant.eventId,
        type: "attendee" as const,
      },
      { expiresIn: "24h" }
    );

    return reply.send(
      ok({
        token,
        participant: {
          id: participant.id,
          name: participant.name,
          email: participant.email,
          qrToken: participant.qrToken,
          status: participant.status,
          event: participant.event,
          lastCheckIn: participant.checkIns[0] ?? null,
          checkedIn: participant.checkIns.length > 0,
        },
      })
    );
  });

  /**
   * GET /attendee/me
   * Authenticated (attendee JWT) — returns current participant data.
   */
  app.get("/attendee/me", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send(fail("UNAUTHORIZED", "Token não fornecido"));
    }

    try {
      const decoded = app.jwt.verify<{ sub: string; type: string }>(
        authHeader.slice(7)
      );

      if (decoded.type !== "attendee") {
        return reply.status(403).send(fail("FORBIDDEN", "Token inválido"));
      }

      const participant = await attendeeRepository.getParticipantById(decoded.sub);

      if (!participant) {
        return reply.status(404).send(fail("NOT_FOUND", "Participante não encontrado"));
      }

      return reply.send(
        ok({
          id: participant.id,
          name: participant.name,
          email: participant.email,
          qrToken: participant.qrToken,
          status: participant.status,
          event: participant.event,
          lastCheckIn: participant.checkIns[0] ?? null,
          checkedIn: participant.checkIns.length > 0,
        })
      );
    } catch {
      return reply.status(401).send(fail("UNAUTHORIZED", "Token inválido ou expirado"));
    }
  });

  /**
   * GET /attendee/checkin-status
   * SSE endpoint — streams real-time check-in events to the attendee.
   */
  app.get("/attendee/checkin-status", async (request, reply) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      return reply.status(401).send(fail("UNAUTHORIZED", "Token é obrigatório"));
    }

    let participantId: string;
    try {
      const decoded = app.jwt.verify<{ sub: string; type: string }>(token);
      if (decoded.type !== "attendee") {
        return reply.status(403).send(fail("FORBIDDEN", "Token inválido"));
      }
      participantId = decoded.sub;
    } catch {
      return reply.status(401).send(fail("UNAUTHORIZED", "Token inválido ou expirado"));
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", participantId })}\n\n`
    );

    const unsubscribe = attendeeEventBus.subscribe(participantId, (event: CheckInEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 30000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    reply.hijack();
  });

  /**
   * GET /attendee/events/:eventId/stats
   * Public — event statistics (for the attendee portal header).
   */
  app.get("/attendee/events/:eventId/stats", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const stats = await attendeeRepository.getEventStats(eventId);
    return reply.send(ok(stats));
  });
}
