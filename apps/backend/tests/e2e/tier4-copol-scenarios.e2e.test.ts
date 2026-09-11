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

describe("Tier 4: Real-World COPOL Application Scenarios (Opaque-Box E2E)", () => {
  // --------------------------------------------------------------------------
  // Scenario 1: Attendee Full Lifecycle for COPOL 2026
  // --------------------------------------------------------------------------
  describe("T4.1 — COPOL Attendee Full Lifecycle", () => {
    it("conduz o congressista por todo o ciclo: inscrição, pagamento, check-in no dia do evento, comprovante e certificado", async () => {
      const adminToken = await loginAsAdmin();

      // 1. Criação do evento oficial COPOL
      const copolEvent = await createTestEvent({
        name: "3º Congresso Odontológico Positivo Londrinense — COPOL 2026",
      });
      await prisma.event.update({
        where: { id: copolEvent.id },
        data: {
          slug: "copol",
          startDate: new Date("2020-11-05T08:00:00Z"), // No passado para permitir liberação de certificado
          endDate: new Date("2020-11-07T18:00:00Z"),
          certificateSettings: {
            workloadHours: 30,
            organizerName: "Comissão Organizadora COPOL",
            eventTitle: "3º COPOL 2026",
          },
        },
      });

      // Lote 1 Promocional oficial (R$ 100)
      const batch = await prisma.eventBatch.create({
        data: {
          eventId: copolEvent.id,
          batchNumber: 1,
          name: "1º Lote — Promocional COPOL",
          price: 100,
          maxQuantity: 60,
          isActive: true,
        },
      });

      const { token: terminalToken } = await createActiveTerminalWithToken(app, copolEvent.id);

      // 2. Participante realiza a inscrição pelo site oficial do evento (host copol.lspkeventos.com.br)
      const registrationPayload = {
        name: "Dr. Lucas Martins",
        email: "dr.lucas@odontocopol.com.br",
        document: "456.789.012-34",
        phone: "(43) 99123-4567",
        consentVersion: "1.0",
      };

      const regRes = await app.inject({
        method: "POST",
        url: `/events/${copolEvent.id}/inscriptions`,
        headers: { host: "copol.lspkeventos.com.br" },
        payload: registrationPayload,
      });

      expect(regRes.statusCode).toBe(201);
      const inscription = regRes.json().data;
      expect(inscription.batchId).toBe(batch.id);
      expect(inscription.amount).toBe(100);
      expect(inscription.status).toBe("PENDING");

      // 3. Pagamento processado via PicPay Webhook
      const webhookRes = await app.inject({
        method: "POST",
        url: "/inscriptions/picpay/webhook",
        payload: {
          referenceId: inscription.id,
          authorizationId: "AUTH-COPOL-PAYMENT-777",
        },
      });
      expect(webhookRes.statusCode).toBe(200);

      // Participante agora existe
      const participant = await prisma.participant.findFirstOrThrow({
        where: { eventId: copolEvent.id, email: "dr.lucas@odontocopol.com.br" },
      });
      expect(participant.name).toBe("Dr. Lucas Martins");
      expect(participant.qrToken).toBeTruthy();

      // 4. Congressista faz login no portal do participante
      const loginRes = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "copol.lspkeventos.com.br" },
        payload: { email: "dr.lucas@odontocopol.com.br" },
      });
      expect(loginRes.statusCode).toBe(200);
      const attendeeToken = loginRes.json().data.token;
      expect(attendeeToken).toBeDefined();

      // 5. Credenciamento / Check-in no Terminal da Entrada Principal
      const checkinRes = await app.inject({
        method: "POST",
        url: `/events/${copolEvent.id}/checkins`,
        headers: { authorization: `Bearer ${terminalToken}` },
        payload: { qrToken: participant.qrToken },
      });
      expect(checkinRes.statusCode).toBe(201);
      expect(checkinRes.json().data.status).toBe("CONFIRMED");

      // 6. Download imediato do Comprovante de Presença
      const proofRes = await app.inject({
        method: "GET",
        url: `/events/${copolEvent.id}/attendance-proof/download`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });
      expect(proofRes.statusCode).toBe(200);
      expect(proofRes.headers["content-type"]).toBe("application/pdf");
      expect(proofRes.rawPayload.toString("utf8", 0, 4)).toBe("%PDF");

      // 7. Encerramento do evento e Liberação de Certificados pelo Painel Admin
      const releaseRes = await app.inject({
        method: "POST",
        url: `/events/${copolEvent.id}/certificates/release`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(releaseRes.statusCode).toBe(200);

      // 8. Congressista consulta seus documentos e baixa o Certificado em PDF
      const myDocsRes = await app.inject({
        method: "GET",
        url: `/events/${copolEvent.id}/my-documents`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });
      expect(myDocsRes.statusCode).toBe(200);
      expect(myDocsRes.json().data.hasCertificate).toBe(true);

      const certDownloadRes = await app.inject({
        method: "GET",
        url: `/events/${copolEvent.id}/certificates/download`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });
      expect(certDownloadRes.statusCode).toBe(200);
      expect(certDownloadRes.headers["content-type"]).toBe("application/pdf");
      expect(certDownloadRes.rawPayload.toString("utf8", 0, 4)).toBe("%PDF");

      // 9. Terceiro valida autenticidade pelo QR Code do certificado
      const cert = await prisma.certificate.findUniqueOrThrow({
        where: { eventId_participantId: { eventId: copolEvent.id, participantId: participant.id } },
      });

      const verifyRes = await app.inject({
        method: "GET",
        url: `/public/certificates/${cert.verificationCode}`,
      });
      expect(verifyRes.statusCode).toBe(200);
      const verifyData = verifyRes.json().data;
      expect(verifyData.valid).toBe(true);
      expect(verifyData.participantName).toBe("Dr. Lucas Martins");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: COPOL Official Schedule Management & Real-Time Reordering
  // --------------------------------------------------------------------------
  describe("T4.2 — COPOL Official Schedule Management & Public View", () => {
    it("permite ao admin cadastrar grade oficial (05/11 a 07/11), reordenar palestras e refletir no endpoint público", async () => {
      const adminToken = await loginAsAdmin();
      const event = await createTestEvent({ name: "3º COPOL 2026" });
      await prisma.event.update({ where: { id: event.id }, data: { slug: "copol" } });

      // 1. Cadastrar atividades do Dia 1 (05/11)
      const item1 = (
        await app.inject({
          method: "POST",
          url: `/events/${event.id}/schedule`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            date: "2026-11-05",
            startTime: "08:30",
            endTime: "09:00",
            title: "Credenciamento – Retirada de Crachás",
            location: "Foyer",
            type: "Credenciamento",
          },
        })
      ).json().data;

      const item2 = (
        await app.inject({
          method: "POST",
          url: `/events/${event.id}/schedule`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            date: "2026-11-05",
            startTime: "10:00",
            endTime: "11:00",
            title: "Cristina Miura – Lucratividade para Recém-Formados",
            speaker: "Cristina Miura",
            location: "Auditório Principal",
            type: "Palestra",
          },
        })
      ).json().data;

      const item3 = (
        await app.inject({
          method: "POST",
          url: `/events/${event.id}/schedule`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            date: "2026-11-05",
            startTime: "11:00",
            endTime: "12:00",
            title: "Prof. Dr. Letícia Lang – Odontologia Oncológica",
            speaker: "Prof. Dr. Letícia Lang",
            location: "Auditório Principal",
            type: "Palestra",
          },
        })
      ).json().data;

      // 2. Cadastrar atividades do Dia 2 (06/11)
      const item4 = (
        await app.inject({
          method: "POST",
          url: `/events/${event.id}/schedule`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            date: "2026-11-06",
            startTime: "10:00",
            endTime: "11:00",
            title: "Dr. Giuliano Cesar – Periodontia",
            speaker: "Dr. Giuliano Cesar",
            location: "Auditório Principal",
            type: "Palestra",
          },
        })
      ).json().data;

      // 3. Cadastrar atividades do Dia 3 (07/11)
      const item5 = (
        await app.inject({
          method: "POST",
          url: `/events/${event.id}/schedule`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            date: "2026-11-07",
            startTime: "10:00",
            endTime: "11:00",
            title: "Dra. Stephanie – Dentística",
            speaker: "Dra. Stephanie",
            location: "Auditório Principal",
            type: "Palestra",
          },
        })
      ).json().data;

      // 4. Consulta pública no site pré-copol
      const publicRes = await app.inject({
        method: "GET",
        url: `/events/${event.id}/schedule`,
      });
      expect(publicRes.statusCode).toBe(200);
      const publicItems = publicRes.json().data;
      expect(publicItems.length).toBe(5);

      // Ordem inicial no Dia 1: item1 (credenciamento), item2 (Cristina Miura), item3 (Letícia Lang)
      const day1Initial = publicItems.filter((i: any) => i.date.startsWith("2026-11-05"));
      expect(day1Initial.map((i: any) => i.id)).toEqual([item1.id, item2.id, item3.id]);

      // 5. Admin altera a ordem das palestras do Dia 1 (invertendo Letícia Lang antes de Cristina Miura)
      const reorderRes = await app.inject({
        method: "POST",
        url: `/events/${event.id}/schedule/reorder`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          itemIds: [item1.id, item3.id, item2.id],
        },
      });
      expect(reorderRes.statusCode).toBe(200);

      // 6. Consulta pública após reordenação
      const publicAfterReorder = await app.inject({
        method: "GET",
        url: `/events/${event.id}/schedule`,
      });
      expect(publicAfterReorder.statusCode).toBe(200);
      const day1Updated = publicAfterReorder.json().data.filter((i: any) => i.date.startsWith("2026-11-05"));
      expect(day1Updated.map((i: any) => i.id)).toEqual([item1.id, item3.id, item2.id]);
      expect(day1Updated[1].title).toBe("Prof. Dr. Letícia Lang – Odontologia Oncológica");
      expect(day1Updated[2].title).toBe("Cristina Miura – Lucratividade para Recém-Formados");

      // 7. Admin adiciona um novo Hands-on e exclui uma atividade
      const newHandsOnRes = await app.inject({
        method: "POST",
        url: `/events/${event.id}/schedule`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          date: "2026-11-06",
          startTime: "14:00",
          endTime: "15:00",
          title: "Hands On Marcela – Diastema",
          speaker: "Marcela",
          location: "Lab 02",
          type: "Hands On",
        },
      });
      expect(newHandsOnRes.statusCode).toBe(201);
      const newHandsOn = newHandsOnRes.json().data;

      // Exclusão de atividade
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/schedule/${item4.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);

      // Consulta pública reflete a exclusão e inclusão
      const finalScheduleRes = await app.inject({
        method: "GET",
        url: `/events/${event.id}/schedule`,
      });
      const finalIds = finalScheduleRes.json().data.map((i: any) => i.id);
      expect(finalIds).toContain(newHandsOn.id);
      expect(finalIds).not.toContain(item4.id);
    });
  });
});
