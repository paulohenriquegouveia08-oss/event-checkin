import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";
import {
  createActiveTerminalWithToken,
  createTestAdmin,
  createTestEvent,
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

async function loginAsAdmin() {
  const { user, password } = await createTestAdmin();
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password },
  });
  return response.json().data.token as string;
}

describe("Tier 3: Cross-Feature Combinations (Opaque-Box E2E)", () => {
  describe("T3.1 — Full Integration Pipeline (Subdomain -> Batch -> Inscription -> Webhook -> Terminal Check-in -> Certificate Release & Public Verification)", () => {
    it("executa com sucesso o pipeline completo e encadeado de ponta a ponta", async () => {
      const adminToken = await loginAsAdmin();

      // ----------------------------------------------------------------------
      // PASSO 1: Criação do Evento com Subdomínio Dedicado e Lote Promocional
      // ----------------------------------------------------------------------
      const event = await createTestEvent({
        name: "3º COPOL — Odontologia Positivo",
      });
      await prisma.event.update({
        where: { id: event.id },
        data: {
          slug: "copol-pipeline",
          certificateSettings: {
            workloadHours: 24,
            organizerName: "Comissão COPOL",
          },
        },
      });

      const batch = await prisma.eventBatch.create({
        data: {
          eventId: event.id,
          batchNumber: 1,
          name: "1º Lote — Promocional Pipeline",
          price: 100,
          maxQuantity: 10,
          isActive: true,
        },
      });

      const { token: terminalToken } = await createActiveTerminalWithToken(app, event.id);

      // ----------------------------------------------------------------------
      // PASSO 2: Resolução de Tenant por Subdomínio e Consulta Pública de Lotes
      // ----------------------------------------------------------------------
      const batchesRes = await app.inject({
        method: "GET",
        url: `/events/${event.id}/batches`,
        headers: { host: "copol-pipeline.lspkeventos.com.br" },
      });

      expect(batchesRes.statusCode).toBe(200);
      const activeBatch = batchesRes.json().data.batches.find((b: any) => b.isActive);
      expect(activeBatch).toBeDefined();
      expect(activeBatch.id).toBe(batch.id);
      expect(activeBatch.price).toBe(100);

      // ----------------------------------------------------------------------
      // PASSO 3: Inscrição Pública sob Contexto do Tenant
      // ----------------------------------------------------------------------
      const attendeeData = {
        name: "Renata Lima",
        email: "renata.lima@pipeline-test.com",
        document: "987.654.321-00",
        phone: "(43) 98765-4321",
        consentVersion: "1.0",
      };

      const inscriptionRes = await app.inject({
        method: "POST",
        url: `/events/${event.id}/inscriptions`,
        headers: { host: "copol-pipeline.lspkeventos.com.br" },
        payload: attendeeData,
      });

      expect(inscriptionRes.statusCode).toBe(201);
      const inscription = inscriptionRes.json().data;
      expect(inscription.status).toBe("PENDING");
      expect(inscription.amount).toBe(100);
      expect(inscription.category).toBe("1º Lote — Promocional Pipeline");

      // Regra de Integridade: Participante NÃO existe antes da confirmação de pagamento
      const unconfirmedCount = await prisma.participant.count({
        where: { eventId: event.id, email: attendeeData.email },
      });
      expect(unconfirmedCount).toBe(0);

      // ----------------------------------------------------------------------
      // PASSO 4: Notificação de Webhook do PicPay (Confirmação de Pagamento)
      // ----------------------------------------------------------------------
      const webhookRes = await app.inject({
        method: "POST",
        url: "/inscriptions/picpay/webhook",
        payload: {
          referenceId: inscription.id,
          authorizationId: "AUTH-PIPELINE-E2E-100",
        },
      });

      expect(webhookRes.statusCode).toBe(200);

      // Inscrição deve ter sido confirmada
      const confirmedInscription = await prisma.inscription.findUniqueOrThrow({
        where: { id: inscription.id },
      });
      expect(confirmedInscription.status).toBe("CONFIRMED");
      expect(confirmedInscription.participantId).toBeTruthy();

      // Participante deve ter sido criado com qrToken de alta entropia
      const participant = await prisma.participant.findFirstOrThrow({
        where: { eventId: event.id, email: attendeeData.email },
      });
      expect(participant.status).toBe("ACTIVE");
      expect(participant.qrToken).toBeTruthy();

      // ----------------------------------------------------------------------
      // PASSO 5: Login do Congressista no Portal do Participante via Subdomínio
      // ----------------------------------------------------------------------
      const loginRes = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "copol-pipeline.lspkeventos.com.br" },
        payload: { email: attendeeData.email },
      });

      expect(loginRes.statusCode).toBe(200);
      const loginData = loginRes.json().data;
      const attendeeJwt = loginData.token;
      expect(attendeeJwt).toBeTruthy();
      expect(loginData.participant.qrToken).toBe(participant.qrToken);
      expect(loginData.participant.checkedIn).toBe(false);

      // Perfil do Congressista autenticado (/attendee/me)
      const meBeforeCheckin = await app.inject({
        method: "GET",
        url: "/attendee/me",
        headers: {
          authorization: `Bearer ${attendeeJwt}`,
          host: "copol-pipeline.lspkeventos.com.br",
        },
      });
      expect(meBeforeCheckin.statusCode).toBe(200);
      expect(meBeforeCheckin.json().data.checkedIn).toBe(false);

      // ----------------------------------------------------------------------
      // PASSO 6: Validação de Presença no Terminal de Check-in
      // ----------------------------------------------------------------------
      const checkinRes = await app.inject({
        method: "POST",
        url: `/events/${event.id}/checkins`,
        headers: { authorization: `Bearer ${terminalToken}` },
        payload: { qrToken: participant.qrToken },
      });

      expect(checkinRes.statusCode).toBe(201);
      expect(checkinRes.json().data.status).toBe("CONFIRMED");

      // Consulta pós-check-in no portal do congressista
      const meAfterCheckin = await app.inject({
        method: "GET",
        url: "/attendee/me",
        headers: {
          authorization: `Bearer ${attendeeJwt}`,
          host: "copol-pipeline.lspkeventos.com.br",
        },
      });
      expect(meAfterCheckin.statusCode).toBe(200);
      expect(meAfterCheckin.json().data.checkedIn).toBe(true);

      // Comprovante de presença disponível imediatamente após o check-in
      const proofRes = await app.inject({
        method: "GET",
        url: `/events/${event.id}/attendance-proof/download`,
        headers: { authorization: `Bearer ${attendeeJwt}` },
      });
      expect(proofRes.statusCode).toBe(200);
      expect(proofRes.headers["content-type"]).toBe("application/pdf");
      expect(proofRes.rawPayload.toString("utf8", 0, 4)).toBe("%PDF");

      // ----------------------------------------------------------------------
      // PASSO 7: Liberação e Emissão do Certificado Oficial
      // ----------------------------------------------------------------------
      // Admin realiza a liberação do certificado para o participante presente
      const releaseRes = await app.inject({
        method: "POST",
        url: `/events/${event.id}/participants/${participant.id}/certificate/release`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(releaseRes.statusCode).toBe(200);

      // Congressista faz o download do certificado em PDF
      const certDownloadRes = await app.inject({
        method: "GET",
        url: `/events/${event.id}/certificates/download`,
        headers: { authorization: `Bearer ${attendeeJwt}` },
      });
      expect(certDownloadRes.statusCode).toBe(200);
      expect(certDownloadRes.headers["content-type"]).toBe("application/pdf");
      expect(certDownloadRes.rawPayload.toString("utf8", 0, 4)).toBe("%PDF");

      // ----------------------------------------------------------------------
      // PASSO 8: Verificação Pública Externa do Certificado via Código QR
      // ----------------------------------------------------------------------
      const generatedCert = await prisma.certificate.findUniqueOrThrow({
        where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
      });
      expect(generatedCert.status).toBe("GENERATED");
      expect(generatedCert.verificationCode).toBeTruthy();

      const publicVerifyRes = await app.inject({
        method: "GET",
        url: `/public/certificates/${generatedCert.verificationCode}`,
      });

      expect(publicVerifyRes.statusCode).toBe(200);
      const verificationData = publicVerifyRes.json().data;
      expect(verificationData.valid).toBe(true);
      expect(verificationData.participantName).toBe("Renata Lima");
      expect(verificationData.eventName).toBe("3º COPOL — Odontologia Positivo");
    });
  });
});
