import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createActiveTerminalWithToken, createTestEvent, createTestParticipant, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /terminals/sync/participants", () => {
  it("devolve o roster do evento do terminal, com qrToken, para cache offline", async () => {
    const event = await createTestEvent({ name: "Congresso Offline" });
    const otherEvent = await createTestEvent({ name: "Outro Evento" });
    await createTestParticipant(event.id, { name: "Ana" });
    await createTestParticipant(event.id, { name: "Bruno" });
    await createTestParticipant(otherEvent.id, { name: "Não deve aparecer" });
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "GET",
      url: "/terminals/sync/participants",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.event.id).toBe(event.id);
    expect(body.participants).toHaveLength(2);
    expect(body.participants.map((p: { name: string }) => p.name).sort()).toEqual(["Ana", "Bruno"]);
    expect(body.participants[0].qrToken).toMatch(/^evt_/);
  });

  it("exige autenticação de terminal", async () => {
    const response = await app.inject({ method: "GET", url: "/terminals/sync/participants" });
    expect(response.statusCode).toBe(401);
  });
});

describe("POST /terminals/sync", () => {
  it("sincroniza check-ins feitos offline (source OFFLINE_SYNC)", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const { token, terminal } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "POST",
      url: "/terminals/sync",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        checkIns: [
          {
            localCheckInId: "local-001",
            qrToken: participant.qrToken,
            checkedInAt: new Date("2026-09-01T10:00:00Z").toISOString(),
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const [result] = response.json().data.results;
    expect(result.status).toBe("CONFIRMED");

    const stored = await prisma.checkIn.findFirst({ where: { participantId: participant.id } });
    expect(stored?.source).toBe("OFFLINE_SYNC");
    expect(stored?.terminalId).toBe(terminal.id);
  });

  it("retorna ALREADY_CHECKED_IN quando outro terminal já confirmou o mesmo participante online", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const terminalOnline = await createActiveTerminalWithToken(app, event.id);
    const terminalOffline = await createActiveTerminalWithToken(app, event.id);

    // Terminal B fez o check-in online enquanto o terminal A estava offline.
    await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${terminalOnline.token}` },
      payload: { qrToken: participant.qrToken },
    });

    // Terminal A reconecta e sincroniza o registro que fez localmente.
    const response = await app.inject({
      method: "POST",
      url: "/terminals/sync",
      headers: { authorization: `Bearer ${terminalOffline.token}` },
      payload: {
        checkIns: [
          {
            localCheckInId: "local-777",
            qrToken: participant.qrToken,
            checkedInAt: new Date("2026-09-01T10:05:00Z").toISOString(),
          },
        ],
      },
    });

    const [result] = response.json().data.results;
    expect(result.status).toBe("ALREADY_CHECKED_IN");

    const count = await prisma.checkIn.count({ where: { eventId: event.id, participantId: participant.id } });
    expect(count).toBe(1);
  });

  it("reenviar o mesmo localCheckInId é idempotente (não duplica nem falha)", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const payload = {
      checkIns: [
        {
          localCheckInId: "local-retry",
          qrToken: participant.qrToken,
          checkedInAt: new Date("2026-09-01T10:00:00Z").toISOString(),
        },
      ],
    };

    const first = await app.inject({
      method: "POST",
      url: "/terminals/sync",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/terminals/sync",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(first.json().data.results[0].status).toBe("CONFIRMED");
    expect(second.json().data.results[0].status).toBe("CONFIRMED");

    const count = await prisma.checkIn.count({ where: { eventId: event.id, participantId: participant.id } });
    expect(count).toBe(1);
  });

  it("um item inválido no lote não impede o processamento dos demais", async () => {
    const event = await createTestEvent();
    const validParticipant = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "POST",
      url: "/terminals/sync",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        checkIns: [
          {
            localCheckInId: "local-invalido",
            qrToken: "evt_token-inexistente",
            checkedInAt: new Date().toISOString(),
          },
          {
            localCheckInId: "local-valido",
            qrToken: validParticipant.qrToken,
            checkedInAt: new Date().toISOString(),
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const results = response.json().data.results;
    expect(results.find((r: { localCheckInId: string }) => r.localCheckInId === "local-invalido").status).toBe(
      "REJECTED"
    );
    expect(results.find((r: { localCheckInId: string }) => r.localCheckInId === "local-valido").status).toBe(
      "CONFIRMED"
    );
  });
});
