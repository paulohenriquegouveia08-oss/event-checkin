import type { FastifyInstance } from "fastify";
import { requireTerminal } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { getEventOrThrow } from "../events/events.service.js";
import * as participantsService from "../participants/participants.service.js";
import * as synchronizationService from "./synchronization.service.js";
import { syncRequestSchema } from "./synchronization.schema.js";
import { adminCheckInBus } from "../admin/adminMonitor.events.js";

export async function synchronizationRoutes(app: FastifyInstance) {
  // Puxado pelo terminal antes/durante o evento para cachear localmente
  // (SQLite) e continuar validando QR Codes mesmo sem internet — seção 13
  // da especificação do produto.
  app.get("/terminals/sync/participants", { preHandler: requireTerminal }, async (request) => {
    const eventId = request.terminal!.eventId;
    const [event, participants] = await Promise.all([
      getEventOrThrow(eventId),
      participantsService.listParticipantsForOfflineSync(eventId),
    ]);
    return ok({
      event: { id: event.id, name: event.name, status: event.status },
      participants,
    });
  });

  app.post("/terminals/sync", { preHandler: requireTerminal }, async (request) => {
    const input = syncRequestSchema.parse(request.body);
    const results = await synchronizationService.syncCheckIns(
      request.terminal!.eventId,
      request.terminal!.terminalId,
      request.terminal!.name,
      input
    );

    // Publish rejected sync items to admin monitor
    for (const result of results) {
      if (result.status === "REJECTED") {
        adminCheckInBus.publish(request.terminal!.eventId, {
          type: "check_in",
          eventId: request.terminal!.eventId,
          participantId: "",
          participantName: result.participant?.name ?? "—",
          status: "REJECTED",
          checkedInAt: new Date().toISOString(),
          terminalName: request.terminal!.name,
          terminalId: request.terminal!.terminalId,
          source: "OFFLINE_SYNC",
          errorMessage: result.message,
        });
      }
    }

    return ok({ results });
  });
}
