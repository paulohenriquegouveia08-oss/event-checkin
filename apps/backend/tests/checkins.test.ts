import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createActiveTerminalWithToken,
  createTestEvent,
  createTestParticipant,
  resetDatabase,
} from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /events/:eventId/checkins", () => {
  it("confirma presença com um QR válido", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.participant.name).toBe(participant.name);
  });

  it("rejeita QR inexistente", async () => {
    const event = await createTestEvent();
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: "evt_este-token-nao-existe" },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("rejeita participante cancelado", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id, { status: "CANCELLED" });
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  it("identifica check-in duplicado sem criar um segundo registro", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const first = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().data.status).toBe("CONFIRMED");

    const second = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.status).toBe("ALREADY_CHECKED_IN");

    const count = await prisma.checkIn.count({ where: { eventId: event.id, participantId: participant.id } });
    expect(count).toBe(1);
  });

  it("sob concorrência real (2 terminais, mesmo participante), só 1 check-in é criado", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const terminalA = await createActiveTerminalWithToken(app, event.id);
    const terminalB = await createActiveTerminalWithToken(app, event.id);

    const [responseA, responseB] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${terminalA.token}` },
        payload: { qrToken: participant.qrToken },
      }),
      app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${terminalB.token}` },
        payload: { qrToken: participant.qrToken },
      }),
    ]);

    const statuses = [responseA.json().data.status, responseB.json().data.status].sort();
    expect(statuses).toEqual(["ALREADY_CHECKED_IN", "CONFIRMED"]);

    const count = await prisma.checkIn.count({ where: { eventId: event.id, participantId: participant.id } });
    expect(count).toBe(1);
  });

  it("rejeita um terminal tentando fazer check-in em outro evento", async () => {
    const event = await createTestEvent({ name: "Evento A" });
    const otherEvent = await createTestEvent({ name: "Evento B" });
    const participant = await createTestParticipant(otherEvent.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const response = await app.inject({
      method: "POST",
      url: `/events/${otherEvent.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });

    expect(response.statusCode).toBe(403);
  });
});
