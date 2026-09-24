import type { FastifyInstance } from "fastify";
import { requireAnyPermission, requirePermission, requireTerminal, userCanAccessEvent, userHasPermission } from "../../middleware/auth.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";
import * as checkinsService from "./checkins.service.js";
import * as checkinsRepository from "./checkins.repository.js";
import { checkinEventParamsSchema, createCheckInSchema } from "./checkins.schema.js";
import { adminCheckInBus } from "../admin/adminMonitor.events.js";

function cleanQrToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/evt_[A-Za-z0-9_-]+/);
  if (match) return match[0];
  try {
    const url = new URL(trimmed);
    const tokenParam = url.searchParams.get("token") || url.searchParams.get("qrToken");
    if (tokenParam) return tokenParam.trim();
  } catch {
    // URL inválida, mantém string
  }
  return trimmed;
}

export async function checkinsRoutes(app: FastifyInstance) {
  // Check-in via terminal físico / APK com requireTerminal
  app.post("/events/:eventId/checkins", { preHandler: requireTerminal }, async (request, reply) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);
    if (request.terminal?.eventId !== eventId) {
      throw new ForbiddenError("Este terminal não pertence a este evento");
    }
    const { qrToken: rawQrToken } = createCheckInSchema.parse(request.body);
    const qrToken = cleanQrToken(rawQrToken);

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
        // Idem checkins.service.ts: grava em checkin_attempts pra rejeição
        // não sumir se o admin não estiver com o monitor aberto agora.
        void checkinsRepository.createCheckInAttempt({
          eventId,
          terminalId: request.terminal!.terminalId,
          terminalName: request.terminal!.name,
          status: "REJECTED",
          source: "ONLINE",
          errorMessage: error.message,
        });
      }
      throw error;
    }
  });

  // Check-in via navegador web no Painel Admin (sem necessidade de terminal físico ou APK)
  app.post(
    "/events/:eventId/checkins/admin",
    { preHandler: requireAnyPermission("participants.edit", "participants.view") },
    async (request, reply) => {
      const { eventId } = checkinEventParamsSchema.parse(request.params);

      // Conta restrita a eventos é conta de ACOMPANHAMENTO (ex.: organizador
      // externo que só vê inscritos/participantes/trabalhos): registrar
      // presença exige participants.edit explícito. Contas sem restrição
      // seguem a regra acima, de propósito — é a da equipe da porta.
      const admin = request.admin!;
      if (
        admin.allowedEventIds.length > 0 &&
        !admin.isSystem &&
        !admin.permissions.has("participants.edit")
      ) {
        throw new ForbiddenError("Sua conta é só de acompanhamento — não registra presença.");
      }

      const { qrToken: rawQrToken } = createCheckInSchema.parse(request.body);
      const qrToken = cleanQrToken(rawQrToken);

      const operatorName = request.admin?.email ? `Web (${request.admin.email})` : "Painel Web";

      try {
        const outcome = await checkinsService.performCheckIn({
          eventId,
          qrToken,
          terminalId: null,
          terminalName: operatorName,
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
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
          adminCheckInBus.publish(eventId, {
            type: "check_in",
            eventId,
            participantId: "",
            participantName: "—",
            status: "REJECTED",
            checkedInAt: new Date().toISOString(),
            terminalName: operatorName,
            terminalId: null,
            source: "ONLINE",
            errorMessage: error.message,
          });
          void checkinsRepository.createCheckInAttempt({
            eventId,
            terminalId: null,
            terminalName: operatorName,
            status: "REJECTED",
            source: "ONLINE",
            errorMessage: error.message,
          });
        }
        throw error;
      }
    }
  );

  app.get(
    "/events/:eventId/statistics",
    { preHandler: requirePermission("statistics.view") },
    async (request) => {
      const { eventId } = checkinEventParamsSchema.parse(request.params);
      const stats = await checkinsService.getEventStatistics(eventId);
      return ok(stats);
    }
  );

  app.get("/events/:eventId/report", { preHandler: requirePermission("reports.view") }, async (request) => {
    const { eventId } = checkinEventParamsSchema.parse(request.params);
    const report = await checkinsService.getEventReport(eventId);
    return ok(report);
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
    const hasAccess =
      ((await userHasPermission(payload.sub, "monitor.view")) ||
        (await userHasPermission(payload.sub, "participants.view")) ||
        (await userHasPermission(payload.sub, "events.view"))) &&
      (await userCanAccessEvent(payload.sub, eventId));
    if (!hasAccess) {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Acesso negado" } });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
      "X-Accel-Buffering": "no",
    });
    reply.hijack();

    reply.raw.write(`data: ${JSON.stringify({ type: "connected", eventId })}\n\n`);

    // Preenche com o histórico recente antes de assinar eventos ao vivo —
    // sem isso, check-ins que já tinham acontecido (ou aconteceram enquanto
    // o admin estava em outra aba, já que adminCheckInBus é só em memória
    // e sem replay) nunca apareciam no monitor. Ver getRecentCheckInsForMonitor.
    try {
      const recent = await checkinsService.getRecentCheckInsForMonitor(eventId);
      for (const event of recent) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      // Histórico é só um bônus de UX — uma falha aqui não pode derrubar a
      // conexão SSE, que continua funcionando pros eventos ao vivo.
    }

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
