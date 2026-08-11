import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { sha256Hex } from "../../shared/tokens.js";
import { getEventOrThrow } from "../events/events.service.js";
import * as terminalsService from "./terminals.service.js";
import {
  activateTerminalSchema,
  createTerminalSchema,
  eventTerminalIdParamsSchema,
  eventTerminalParamsSchema,
  terminalParamsSchema,
} from "./terminals.schema.js";

// Token do terminal não expira em poucas horas como o do admin: o
// equipamento fica ativado durante todo o ciclo de vida do evento.
// Revogação é feita mudando o status do terminal (ver middleware/auth.ts),
// não por expiração de token.
const TERMINAL_TOKEN_EXPIRES_IN = "365d";

export async function terminalsRoutes(app: FastifyInstance) {
  app.post("/events/:eventId/terminals", { preHandler: requireAdmin }, async (request, reply) => {
    const { eventId } = eventTerminalParamsSchema.parse(request.params);
    const { name } = createTerminalSchema.parse(request.body);
    const terminal = await terminalsService.createTerminal(eventId, name);
    return reply.status(201).send(ok(terminal));
  });

  app.get("/events/:eventId/terminals", { preHandler: requireAdmin }, async (request) => {
    const { eventId } = eventTerminalParamsSchema.parse(request.params);
    const terminals = await terminalsService.listTerminals(eventId);
    return ok(terminals);
  });

  app.get("/terminals/:terminalId/status", { preHandler: requireAdmin }, async (request) => {
    const { terminalId } = terminalParamsSchema.parse(request.params);
    const terminal = await terminalsService.getTerminalStatus(terminalId);
    return ok(terminal);
  });

  app.delete("/events/:eventId/terminals/:terminalId", { preHandler: requireAdmin }, async (request, reply) => {
    const { eventId, terminalId } = eventTerminalIdParamsSchema.parse(request.params);
    await terminalsService.deleteTerminal(eventId, terminalId);
    return reply.status(204).send();
  });

  // Endpoint público: a própria posse do código de ativação (curto,
  // expirável, uso único) é a credencial neste momento do fluxo.
  app.post("/terminals/activate", async (request, reply) => {
    const { activationCode } = activateTerminalSchema.parse(request.body);
    const terminal = await terminalsService.validateActivationCode(activationCode);

    const token = await reply.jwtSign(
      { sub: terminal.id, eventId: terminal.eventId, type: "terminal" as const },
      { expiresIn: TERMINAL_TOKEN_EXPIRES_IN }
    );

    await terminalsService.finalizeActivation(terminal.id, sha256Hex(token));
    const event = await getEventOrThrow(terminal.eventId);

    return ok({
      token,
      terminal: { id: terminal.id, name: terminal.name, identifier: terminal.identifier },
      event: { id: event.id, name: event.name, status: event.status },
    });
  });
}
