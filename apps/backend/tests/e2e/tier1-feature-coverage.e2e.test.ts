import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";
import {
  createActiveTerminalWithToken,
  createAttendeeToken,
  createEndedTestEvent,
  createTestCheckIn,
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

describe("Tier 1: Feature Coverage (Opaque-Box E2E)", () => {
  // --------------------------------------------------------------------------
  // Feature 1: Multi-Tenancy Isolation by Subdomain & Custom Headers
  // --------------------------------------------------------------------------
  describe("T1.1 — Multi-Tenancy Subdomain & Header Resolution", () => {
    it("isola login do participante pelo subdomínio extraído do header Host", async () => {
      const eventA = await createTestEvent({ name: "Congresso de Odonto Alpha" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "evento-alpha" } });

      const eventB = await createTestEvent({ name: "Simpósio de Saúde Beta" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "evento-beta" } });

      const participantA = await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Alice Alpha",
          email: "alice_t1_unique@multitenant.com",
          qrToken: "qr_alice_alpha_unique_token_123",
          status: "ACTIVE",
        },
      });

      const participantB = await prisma.participant.create({
        data: {
          eventId: eventB.id,
          name: "Bob Beta",
          email: "bob_t1_unique@multitenant.com",
          qrToken: "qr_bob_beta_unique_token_456",
          status: "ACTIVE",
        },
      });

      // 1. Host header apontando para evento-alpha.lspkeventos.com.br
      const loginAliceAlpha = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "evento-alpha.lspkeventos.com.br" },
        payload: { email: "alice_t1_unique@multitenant.com" },
      });

      expect(loginAliceAlpha.statusCode).toBe(200);
      const dataA = loginAliceAlpha.json().data;
      expect(dataA.participant.id).toBe(participantA.id);
      expect(dataA.participant.event.id).toBe(eventA.id);
      expect(dataA.token).toBeTruthy();

      // 2. Bob (que só existe no Evento B) tenta logar sob o host do Evento A -> 404 NOT_FOUND
      const loginBobOnAlpha = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "evento-alpha.lspkeventos.com.br" },
        payload: { email: "bob_t1_unique@multitenant.com" },
      });

      expect(loginBobOnAlpha.statusCode).toBe(404);
      expect(loginBobOnAlpha.json().error.code).toBe("NOT_FOUND");

      // 3. Fallback header x-event-slug
      const loginBobViaSlugHeader = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { "x-event-slug": "evento-beta" },
        payload: { email: "bob_t1_unique@multitenant.com" },
      });

      expect(loginBobViaSlugHeader.statusCode).toBe(200);
      expect(loginBobViaSlugHeader.json().data.participant.id).toBe(participantB.id);

      // 4. Fallback header x-event-id
      const loginAliceViaIdHeader = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { "x-event-id": eventA.id },
        payload: { email: "alice_t1_unique@multitenant.com" },
      });

      expect(loginAliceViaIdHeader.statusCode).toBe(200);
      expect(loginAliceViaIdHeader.json().data.participant.id).toBe(participantA.id);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Independent Participant per Event (Same Email Across Events)
  // --------------------------------------------------------------------------
  describe("T1.2 — Independent Participant per Event", () => {
    it("permite o mesmo e-mail participar de eventos distintos com credenciais e tokens isolados", async () => {
      const event1 = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({ where: { id: event1.id }, data: { slug: "copol-2026" } });

      const event2 = await createTestEvent({ name: "Workshop de Odonto" });
      await prisma.event.update({ where: { id: event2.id }, data: { slug: "workshop-odonto" } });

      const sharedEmail = "dr.silva_t1@clinica.com";

      const part1 = await prisma.participant.create({
        data: {
          eventId: event1.id,
          name: "Dr. Silva — COPOL",
          email: sharedEmail,
          qrToken: "qr_token_silva_copol_unique",
          status: "ACTIVE",
        },
      });

      const part2 = await prisma.participant.create({
        data: {
          eventId: event2.id,
          name: "Dr. Silva — Workshop",
          email: sharedEmail,
          qrToken: "qr_token_silva_workshop_unique",
          status: "ACTIVE",
        },
      });

      // Login no COPOL (via subdomain)
      const resCopol = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "copol-2026.lspkeventos.com.br" },
        payload: { email: sharedEmail },
      });

      expect(resCopol.statusCode).toBe(200);
      const dataCopol = resCopol.json().data;
      expect(dataCopol.participant.id).toBe(part1.id);
      expect(dataCopol.participant.name).toBe("Dr. Silva — COPOL");
      expect(dataCopol.participant.qrToken).toBe("qr_token_silva_copol_unique");

      // Login no Workshop (via x-event-slug)
      const resWorkshop = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { "x-event-slug": "workshop-odonto" },
        payload: { email: sharedEmail },
      });

      expect(resWorkshop.statusCode).toBe(200);
      const dataWorkshop = resWorkshop.json().data;
      expect(dataWorkshop.participant.id).toBe(part2.id);
      expect(dataWorkshop.participant.name).toBe("Dr. Silva — Workshop");
      expect(dataWorkshop.participant.qrToken).toBe("qr_token_silva_workshop_unique");

      // Confirma que os tokens JWT são diferentes e não se cruzam
      expect(dataCopol.token).not.toBe(dataWorkshop.token);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Batch Overselling Protection (Concurrency Limit)
  // --------------------------------------------------------------------------
  describe("T1.3 — Batch Overselling Protection", () => {
    it("rejeita com 409 LOTE_ESGOTADO quando requisições concorrentes excedem a capacidade do lote", async () => {
      const event = await createTestEvent();
      const lote = await prisma.eventBatch.create({
        data: {
          eventId: event.id,
          batchNumber: 1,
          name: "Lote E2E Limitado",
          price: 100,
          maxQuantity: 2, // Apenas 2 vagas disponíveis
          isActive: true,
        },
      });

      const inscricoes = Array.from({ length: 5 }, (_, i) => ({
        name: `Candidato ${i + 1}`,
        email: `candidato_t1_${i + 1}@teste.com`,
        document: `111.222.333-${String(i + 1).padStart(2, "0")}`,
        consentVersion: "1.0",
      }));

      // Dispara 5 requisições em paralelo estrito
      const responses = await Promise.all(
        inscricoes.map((payload) =>
          app.inject({
            method: "POST",
            url: `/events/${event.id}/inscriptions`,
            payload,
          })
        )
      );

      const status201 = responses.filter((r) => r.statusCode === 201);
      const status409 = responses.filter((r) => r.statusCode === 409);

      expect(status201).toHaveLength(2);
      expect(status409).toHaveLength(3);

      for (const r409 of status409) {
        expect(r409.json().error.code).toBe("LOTE_ESGOTADO");
      }

      // No banco de dados, o lote tem exatamente 2 inscrições
      const count = await prisma.inscription.count({
        where: { batchId: lote.id },
      });
      expect(count).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Check-in QR Anti-Replay
  // --------------------------------------------------------------------------
  describe("T1.4 — Check-in QR Anti-Replay", () => {
    it("confirma o primeiro check-in e marca tentativas subsequentes como ALREADY_CHECKED_IN sem duplicar registro", async () => {
      const event = await createTestEvent();
      const participant = await createTestParticipant(event.id);
      const { token: terminalToken } = await createActiveTerminalWithToken(app, event.id);

      // 1º Check-in: CONFIRMED (201 Created)
      const firstCheckIn = await app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${terminalToken}` },
        payload: { qrToken: participant.qrToken },
      });

      expect(firstCheckIn.statusCode).toBe(201);
      const body1 = firstCheckIn.json();
      expect(body1.success).toBe(true);
      expect(body1.data.status).toBe("CONFIRMED");
      expect(body1.data.participant.name).toBe(participant.name);

      // 2º Check-in (Replay): ALREADY_CHECKED_IN (200 OK)
      const secondCheckIn = await app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${terminalToken}` },
        payload: { qrToken: participant.qrToken },
      });

      expect(secondCheckIn.statusCode).toBe(200);
      const body2 = secondCheckIn.json();
      expect(body2.success).toBe(true);
      expect(body2.data.status).toBe("ALREADY_CHECKED_IN");

      // Confirma que no banco de dados existe ESTRITAMENTE 1 registro de check-in
      const totalCheckIns = await prisma.checkIn.count({
        where: { eventId: event.id, participantId: participant.id },
      });
      expect(totalCheckIns).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Official Schedule Retrieval for COPOL 05/11–07/11
  // --------------------------------------------------------------------------
  describe("T1.5 — Official Schedule Retrieval", () => {
    it("recupera a grade completa de programação do COPOL com atividades nos dias 05, 06 e 07/11", async () => {
      const event = await createTestEvent({ name: "3º COPOL — Congresso Odontológico" });
      await prisma.event.update({ where: { id: event.id }, data: { slug: "copol-sched" } });

      // Cadastra atividades representando os 3 dias do congresso
      await prisma.eventScheduleItem.createMany({
        data: [
          {
            eventId: event.id,
            date: new Date("2026-11-05T00:00:00Z"),
            startTime: "08:30",
            endTime: "09:00",
            title: "Credenciamento – Retirada de Crachás",
            speaker: null,
            location: "Foyer Principal",
            type: "Credenciamento",
            order: 0,
          },
          {
            eventId: event.id,
            date: new Date("2026-11-05T00:00:00Z"),
            startTime: "10:00",
            endTime: "11:00",
            title: "Cristina Miura – Lucratividade para Recém-Formados",
            speaker: "Cristina Miura",
            location: "Auditório Principal",
            type: "Palestra",
            order: 1,
          },
          {
            eventId: event.id,
            date: new Date("2026-11-06T00:00:00Z"),
            startTime: "10:00",
            endTime: "11:00",
            title: "Dr. Giuliano Cesar – Periodontia",
            speaker: "Dr. Giuliano Cesar",
            location: "Auditório Principal",
            type: "Palestra",
            order: 2,
          },
          {
            eventId: event.id,
            date: new Date("2026-11-07T00:00:00Z"),
            startTime: "10:00",
            endTime: "11:00",
            title: "Dra. Stephanie – Dentística",
            speaker: "Dra. Stephanie",
            location: "Auditório Principal",
            type: "Palestra",
            order: 3,
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: `/events/${event.id}/schedule`,
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data;
      expect(items.length).toBe(4);

      // Valida presença de atividades para os 3 dias
      const dates = items.map((i: any) => new Date(i.date).toISOString().slice(0, 10));
      expect(dates).toContain("2026-11-05");
      expect(dates).toContain("2026-11-06");
      expect(dates).toContain("2026-11-07");
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Certificate PDF Download and Public Verification
  // --------------------------------------------------------------------------
  describe("T1.6 — Certificate PDF Download & Public Verification", () => {
    it("permite ao participante presente baixar o PDF e valida publicamente via código de verificação", async () => {
      const event = await createEndedTestEvent({ name: "COPOL 2026 Concluído" });
      const participant = await createTestParticipant(event.id, { name: "Mariana Oliveira" });
      await createTestCheckIn(event.id, participant.id);
      const attendeeToken = await createAttendeeToken(app, participant);

      // Download do certificado em formato PDF
      const downloadRes = await app.inject({
        method: "GET",
        url: `/events/${event.id}/certificates/download`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });

      expect(downloadRes.statusCode).toBe(200);
      expect(downloadRes.headers["content-type"]).toBe("application/pdf");
      const pdfBuffer = downloadRes.rawPayload;
      // Header mágico do PDF: %PDF
      expect(pdfBuffer.toString("utf8", 0, 4)).toBe("%PDF");

      // Localiza certificado gerado para o participante
      const certRecord = await prisma.certificate.findUniqueOrThrow({
        where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
      });
      expect(certRecord.status).toBe("GENERATED");
      expect(certRecord.verificationCode).toBeTruthy();

      // Consulta pública do QR Code do certificado (sem autenticação)
      const publicVerifyRes = await app.inject({
        method: "GET",
        url: `/public/certificates/${certRecord.verificationCode}`,
      });

      expect(publicVerifyRes.statusCode).toBe(200);
      const publicData = publicVerifyRes.json().data;
      expect(publicData.valid).toBe(true);
      expect(publicData.participantName).toBe("Mariana Oliveira");
      expect(publicData.eventName).toBe("COPOL 2026 Concluído");
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Webhook Idempotency
  // --------------------------------------------------------------------------
  describe("T1.7 — Webhook Idempotency", () => {
    it("processa webhooks repetidos do PicPay com 200 OK sem duplicar participantes nem ingressos", async () => {
      const event = await createTestEvent();

      // Cria uma inscrição pendente
      const createRes = await app.inject({
        method: "POST",
        url: `/events/${event.id}/inscriptions`,
        payload: {
          name: "Gabriel Medeiros",
          email: "gabriel_t1@webhook-test.com",
          document: "777.888.999-11",
          phone: "(43) 91234-5678",
          consentVersion: "1.0",
        },
      });

      expect(createRes.statusCode).toBe(201);
      const inscriptionId = createRes.json().data.id;

      // Dispara o mesmo webhook do PicPay 3 vezes sequenciais
      const webhookPayload = {
        referenceId: inscriptionId,
        authorizationId: "AUTH-E2E-IDEMPOTENCY-1",
      };

      const res1 = await app.inject({
        method: "POST",
        url: "/inscriptions/picpay/webhook",
        payload: webhookPayload,
      });
      const res2 = await app.inject({
        method: "POST",
        url: "/inscriptions/picpay/webhook",
        payload: webhookPayload,
      });
      const res3 = await app.inject({
        method: "POST",
        url: "/inscriptions/picpay/webhook",
        payload: webhookPayload,
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res3.statusCode).toBe(200);

      // Deve existir EXATAMENTE 1 participante criado
      const participantCount = await prisma.participant.count({
        where: { eventId: event.id, email: "gabriel_t1@webhook-test.com" },
      });
      expect(participantCount).toBe(1);

      // A inscrição deve estar CONFIRMED e vinculada a este participante
      const updatedInscription = await prisma.inscription.findUniqueOrThrow({
        where: { id: inscriptionId },
      });
      expect(updatedInscription.status).toBe("CONFIRMED");
      expect(updatedInscription.paymentId).toBe("AUTH-E2E-IDEMPOTENCY-1");
    });
  });
});
