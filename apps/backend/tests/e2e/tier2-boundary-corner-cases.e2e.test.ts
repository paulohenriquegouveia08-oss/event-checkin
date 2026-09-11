import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";
import {
  createActiveTerminalWithToken,
  createTestEvent,
  createTestParticipant,
  resetDatabase,
} from "../helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Tier 2: Boundary & Corner Cases (Opaque-Box E2E)", () => {
  // --------------------------------------------------------------------------
  // Corner Case 1: Zero Tickets Remaining in Batch
  // --------------------------------------------------------------------------
  describe("T2.1 — Zero Tickets Remaining & Sold-out Batch Boundary", () => {
    it("rejeita imediatamente inscrição quando lote é configurado com zero vagas (maxQuantity: 0)", async () => {
      const event = await createTestEvent({ name: "Evento Zero Vagas" });
      await prisma.eventBatch.create({
        data: {
          eventId: event.id,
          batchNumber: 1,
          name: "Lote Esgotado Desde a Criação",
          price: 150,
          maxQuantity: 0,
          isActive: true,
        },
      });

      const res = await app.inject({
        method: "POST",
        url: `/events/${event.id}/inscriptions`,
        payload: {
          name: "Tentativa Sem Vaga",
          email: "semvaga@teste.com",
          document: "111.222.333-00",
          phone: "(43) 99999-0000",
          consentVersion: "1.0",
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("LOTE_ESGOTADO");
      expect(res.json().error.message).toMatch(/esgotou/i);

      const count = await prisma.inscription.count({ where: { eventId: event.id } });
      expect(count).toBe(0);
    });

    it("rejeita nova inscrição imediatamente após o lote atingir sua capacidade máxima", async () => {
      const event = await createTestEvent({ name: "Evento 1 Vaga" });
      const lote = await prisma.eventBatch.create({
        data: {
          eventId: event.id,
          batchNumber: 1,
          name: "Lote com 1 Vaga",
          price: 100,
          maxQuantity: 1,
          isActive: true,
        },
      });

      // 1. Primeira inscrição ocupa a única vaga disponível
      const res1 = await app.inject({
        method: "POST",
        url: `/events/${event.id}/inscriptions`,
        payload: {
          name: "Primeiro Inscrito",
          email: "primeiro@teste.com",
          document: "111.111.111-11",
          consentVersion: "1.0",
        },
      });
      expect(res1.statusCode).toBe(201);

      // 2. Segunda inscrição deve ser recusada com 409
      const res2 = await app.inject({
        method: "POST",
        url: `/events/${event.id}/inscriptions`,
        payload: {
          name: "Segundo Inscrito (Excedente)",
          email: "segundo@teste.com",
          document: "222.222.222-22",
          consentVersion: "1.0",
        },
      });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error.code).toBe("LOTE_ESGOTADO");

      const totalInscritos = await prisma.inscription.count({ where: { batchId: lote.id } });
      expect(totalInscritos).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Corner Case 2: Concurrent Duplicate QR Check-in Attempt
  // --------------------------------------------------------------------------
  describe("T2.2 — Concurrent Duplicate QR Check-in", () => {
    it("resolve determinística e seguramente check-ins simultâneos do mesmo QR em terminais concorrentes", async () => {
      const event = await createTestEvent();
      const participant = await createTestParticipant(event.id);
      const terminalA = await createActiveTerminalWithToken(app, event.id);
      const terminalB = await createActiveTerminalWithToken(app, event.id);

      // Dispara check-in ao mesmo tempo em dois terminais distintos
      const [resA, resB] = await Promise.all([
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

      const statuses = [resA.json().data.status, resB.json().data.status].sort();
      expect(statuses).toEqual(["ALREADY_CHECKED_IN", "CONFIRMED"]);

      // Garante que o banco de dados tem exatamente 1 registro
      const checkInRecords = await prisma.checkIn.count({
        where: { eventId: event.id, participantId: participant.id },
      });
      expect(checkInRecords).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Corner Case 3: Concurrent Duplicate PicPay Webhooks
  // --------------------------------------------------------------------------
  describe("T2.3 — Concurrent Duplicate Webhooks Delivery", () => {
    it("processa 5 webhooks de confirmação simultâneos criando exatamente 1 participante e 1 ingresso", async () => {
      const event = await createTestEvent();

      // Cria inscrição pendente
      const created = await app.inject({
        method: "POST",
        url: `/events/${event.id}/inscriptions`,
        payload: {
          name: "Ana Concorrência",
          email: "ana.concorrente@picpay.com",
          document: "888.777.666-55",
          phone: "(43) 98888-0000",
          consentVersion: "1.0",
        },
      });
      expect(created.statusCode).toBe(201);
      const inscriptionId = created.json().data.id;

      // Dispara 5 webhooks em paralelo com o mesmo authorizationId
      const webhookPayload = {
        referenceId: inscriptionId,
        authorizationId: "AUTH-CONCURRENT-BURST-99",
      };

      const webhookResponses = await Promise.all(
        Array.from({ length: 5 }, () =>
          app.inject({
            method: "POST",
            url: "/inscriptions/picpay/webhook",
            payload: webhookPayload,
          })
        )
      );

      for (const res of webhookResponses) {
        expect(res.statusCode).toBe(200);
        expect(res.json().success).toBe(true);
      }

      // Garante atomicidade e ausência de duplicações no banco de dados
      const participants = await prisma.participant.count({
        where: { eventId: event.id, email: "ana.concorrente@picpay.com" },
      });
      expect(participants).toBe(1);

      const inscription = await prisma.inscription.findUniqueOrThrow({
        where: { id: inscriptionId },
      });
      expect(inscription.status).toBe("CONFIRMED");
      expect(inscription.paymentId).toBe("AUTH-CONCURRENT-BURST-99");
      expect(inscription.participantId).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Corner Case 4: Cross-Event QR Presentation Rejection
  // --------------------------------------------------------------------------
  describe("T2.4 — Cross-Event Presentation & Security Boundary", () => {
    it("rejeita com 404 NOT_FOUND a apresentação de QR Code do Evento A em terminal do Evento B", async () => {
      const eventA = await createTestEvent({ name: "COPOL 2026" });
      const eventB = await createTestEvent({ name: "Semantix 2026" });

      const participantA = await createTestParticipant(eventA.id, { name: "Congressista COPOL" });
      const terminalB = await createActiveTerminalWithToken(app, eventB.id);

      // Terminal do Evento B lê o QR Code do Evento A
      const response = await app.inject({
        method: "POST",
        url: `/events/${eventB.id}/checkins`,
        headers: { authorization: `Bearer ${terminalB.token}` },
        payload: { qrToken: participantA.qrToken },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().success).toBe(false);
      expect(response.json().error.code).toBe("NOT_FOUND");

      // Nenhum check-in registrado no Evento B nem no Evento A
      const checkInsB = await prisma.checkIn.count({ where: { eventId: eventB.id } });
      const checkInsA = await prisma.checkIn.count({ where: { eventId: eventA.id } });
      expect(checkInsB).toBe(0);
      expect(checkInsA).toBe(0);
    });

    it("rejeita com 403 FORBIDDEN terminal autenticado no Evento A tentando operar rota de check-in do Evento B", async () => {
      const eventA = await createTestEvent({ name: "Evento Alpha" });
      const eventB = await createTestEvent({ name: "Evento Beta" });

      const participantB = await createTestParticipant(eventB.id);
      const terminalA = await createActiveTerminalWithToken(app, eventA.id);

      // Terminal do Evento A tenta enviar check-in para a URL do Evento B
      const response = await app.inject({
        method: "POST",
        url: `/events/${eventB.id}/checkins`,
        headers: { authorization: `Bearer ${terminalA.token}` },
        payload: { qrToken: participantB.qrToken },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });
  });

  // --------------------------------------------------------------------------
  // Corner Case 5: Cancelled Participant QR Code Rejection
  // --------------------------------------------------------------------------
  describe("T2.5 — Cancelled Participant Status", () => {
    it("rejeita com 403 FORBIDDEN a apresentação de QR Code de participante com status CANCELLED", async () => {
      const event = await createTestEvent();
      const cancelledParticipant = await createTestParticipant(event.id, {
        name: "Inscrito Cancelado",
        status: "CANCELLED",
      });
      const { token } = await createActiveTerminalWithToken(app, event.id);

      const res = await app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${token}` },
        payload: { qrToken: cancelledParticipant.qrToken },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");

      const count = await prisma.checkIn.count({
        where: { eventId: event.id, participantId: cancelledParticipant.id },
      });
      expect(count).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Corner Case 6: Malformed or Non-Existent QR Code
  // --------------------------------------------------------------------------
  describe("T2.6 — Non-Existent QR Code Rejection", () => {
    it("rejeita com 404 NOT_FOUND QR Code falso ou inexistente", async () => {
      const event = await createTestEvent();
      const { token } = await createActiveTerminalWithToken(app, event.id);

      const res = await app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${token}` },
        payload: { qrToken: "qr_fake_non_existent_token_9999" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("NOT_FOUND");
    });
  });
});
