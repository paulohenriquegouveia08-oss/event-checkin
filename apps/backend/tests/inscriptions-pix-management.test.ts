import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createTestAdmin,
  createTestCheckIn,
  createTestEvent,
  createTestRole,
  createTestUserWithRole,
  resetDatabase,
} from "./helpers.js";
import * as batchesService from "../src/modules/batches/batches.service.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function loginAsAdmin(): Promise<string> {
  const email = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@teste.com`;
  const { user, password } = await createTestAdmin(email);
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password },
  });
  return response.json().data.token as string;
}

async function loginAsUserWithPermissions(permissionKeys: string[] = []): Promise<string> {
  const role = await createTestRole(`ROLE_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, permissionKeys);
  const email = `operator_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@teste.com`;
  const { password } = await createTestUserWithRole(role.id, email, "senha-forte-123");
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  return response.json().data.token as string;
}

function sampleInscriptionPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Carlos Eduardo Silveira",
    email: "carlos.silveira@teste.com",
    document: "123.456.789-00",
    phone: "(43) 99999-8888",
    institution: "Universidade Positivo",
    consentVersion: "1.0",
    ...overrides,
  };
}

describe.sequential("Inscriptions & PIX Management — 3º COPOL", () => {
  // --------------------------------------------------------------------------
  // 1. Configuração de campos PIX no evento
  // --------------------------------------------------------------------------
  it("1.1: permite ao admin atualizar chave PIX, tipo e beneficiário via PATCH /events/:id", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();
    const slug = `copol-2026-${Math.random().toString(36).slice(2, 6)}`;

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        slug,
        pixKey: "terceirocopol@gmail.com",
        pixKeyType: "EMAIL",
        pixReceiverName: "3º COPOL — Congresso Odontológico Positivo Londrinense",
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const resBody = patchResponse.json();
    expect(resBody.success).toBe(true);

    const eventData = resBody.data ?? resBody;
    expect(eventData.pixKey).toBe("terceirocopol@gmail.com");
    expect(eventData.pixKeyType).toBe("EMAIL");
    expect(eventData.pixReceiverName).toBe("3º COPOL — Congresso Odontológico Positivo Londrinense");

    // Verificação de persistência direta no PostgreSQL
    const dbEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.pixKey).toBe("terceirocopol@gmail.com");
    expect(dbEvent?.pixKeyType).toBe("EMAIL");
    expect(dbEvent?.pixReceiverName).toBe("3º COPOL — Congresso Odontológico Positivo Londrinense");
  });

  it("1.2: expõe campos PIX nos endpoints públicos (/public/events/:slug e /events/:id/public)", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();
    const slug = `copol-public-${Math.random().toString(36).slice(2, 6)}`;

    await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        slug,
        pixKey: "pix@copol.com.br",
        pixKeyType: "EMAIL",
        pixReceiverName: "Comissão COPOL",
      },
    });

    // 1. GET /public/events/:slug
    const slugRes = await app.inject({
      method: "GET",
      url: `/public/events/${slug}`,
    });
    expect(slugRes.statusCode).toBe(200);
    const slugData = slugRes.json().data ?? slugRes.json();
    expect(slugData.pixKey).toBe("pix@copol.com.br");
    expect(slugData.pixKeyType).toBe("EMAIL");
    expect(slugData.pixReceiverName).toBe("Comissão COPOL");

    // 2. GET /events/:eventId/public
    const idRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/public`,
    });
    expect(idRes.statusCode).toBe(200);
    const idData = idRes.json().data ?? idRes.json();
    expect(idData.pixKey).toBe("pix@copol.com.br");
    expect(idData.pixKeyType).toBe("EMAIL");
    expect(idData.pixReceiverName).toBe("Comissão COPOL");
  });

  it("1.3: recusa atualização de PIX sem permissão events.edit", async () => {
    const event = await createTestEvent();
    const viewOnlyToken = await loginAsUserWithPermissions(["events.view"]);

    const response = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${viewOnlyToken}` },
      payload: { pixKey: "hacker@teste.com" },
    });

    expect(response.statusCode).toBe(403);
  });

  // --------------------------------------------------------------------------
  // 2. Status do Pagamento (GET /inscriptions/:id/payment-status)
  // --------------------------------------------------------------------------
  it("2.1: retorna nome do participante, dados PIX do evento e status PENDING antes da aprovação", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();

    await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        pixKey: "terceirocopol@gmail.com",
        pixKeyType: "EMAIL",
        pixReceiverName: "3º COPOL",
      },
    });

    await batchesService.ensureDefaultBatches(event.id);

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Mariana Souza", email: "mariana.souza@teste.com" }),
    });
    const insId = insRes.json().data.id;

    const statusRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${insId}/payment-status`,
    });

    expect(statusRes.statusCode).toBe(200);
    const data = statusRes.json().data ?? statusRes.json();
    expect(data.id).toBe(insId);
    expect(data.status).toBe("PENDING");
    expect(data.name).toBe("Mariana Souza");
    expect(data.pixKey).toBe("terceirocopol@gmail.com");
    expect(data.pixKeyType).toBe("EMAIL");
    expect(data.pixReceiverName).toBe("3º COPOL");
    expect(data.participantId).toBeNull();
    expect(data.qrToken).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 3. Confirmação Manual de Inscrição (POST .../confirm)
  // --------------------------------------------------------------------------
  it("3.1: confirma inscrição -> status CONFIRMED, gera Participant com qrToken e vincula", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Juliana Santos", email: "juliana@teste.com" }),
    });
    const insId = insRes.json().data.id;

    // Chama rota de confirmação
    const confirmRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmBody = confirmRes.json().data ?? confirmRes.json();
    const confirmedIns = confirmBody.inscription ?? confirmBody;
    expect(confirmedIns.status).toBe("CONFIRMED");
    expect(confirmedIns.participantId).toBeTruthy();

    // Confere criação de Participant na tabela
    const dbParticipant = await prisma.participant.findUnique({
      where: { id: confirmedIns.participantId },
    });
    expect(dbParticipant).not.toBeNull();
    expect(dbParticipant?.name).toBe("Juliana Santos");
    expect(dbParticipant?.email).toBe("juliana@teste.com");
    expect(dbParticipant?.status).toBe("ACTIVE");
    expect(dbParticipant?.qrToken).toBeTruthy();

    // Confere log de auditoria
    const audit = await prisma.auditLog.findFirst({
      where: { action: "inscription.confirm", entityId: insId },
    });
    expect(audit).not.toBeNull();

    // Polling agora devolve qrToken e status CONFIRMED
    const pollRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${insId}/payment-status`,
    });
    const pollData = pollRes.json().data ?? pollRes.json();
    expect(pollData.status).toBe("CONFIRMED");
    expect(pollData.qrToken).toBe(dbParticipant?.qrToken);
    expect(pollData.participantId).toBe(dbParticipant?.id);
  });

  it("3.2: é idempotente: confirmar inscrição já confirmada não duplica participante", async () => {
    const event = await createTestEvent();
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload(),
    });
    const insId = insRes.json().data.id;

    // Primeira confirmação
    await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    // Segunda confirmação
    const secondRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(secondRes.statusCode).toBe(200);

    // Total de participantes para esta inscrição continua 1
    const count = await prisma.participant.count({
      where: { email: "carlos.silveira@teste.com", eventId: event.id },
    });
    expect(count).toBe(1);
  });

  it("3.3: recusa confirmação para evento não correspondente (multi-tenant safety)", async () => {
    const eventA = await createTestEvent({ name: "Evento A" });
    const eventB = await createTestEvent({ name: "Evento B" });
    await batchesService.ensureDefaultBatches(eventA.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${eventA.id}/inscriptions`,
      payload: sampleInscriptionPayload(),
    });
    const insId = insRes.json().data.id;

    // Tenta confirmar usando eventId do Evento B
    const badRes = await app.inject({
      method: "POST",
      url: `/events/${eventB.id}/inscriptions/${insId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(badRes.statusCode).toBe(404);
  });

  // --------------------------------------------------------------------------
  // 4. Cancelamento Manual de Inscrição (POST .../cancel)
  // --------------------------------------------------------------------------
  it("4.1: cancela inscrição e libera vaga de lote esgotado para nova inscrição", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();

    // Cria lote com capacidade estrita de 1 vaga
    await prisma.eventBatch.create({
      data: {
        eventId: event.id,
        name: "Lote VIP Limitado",
        price: 150,
        batchNumber: 1,
        maxQuantity: 1,
        isActive: true,
        isClosed: false,
      },
    });

    // 1. Primeira inscrição ocupa a única vaga do lote
    const ins1Res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "participante1@teste.com" }),
    });
    expect(ins1Res.statusCode).toBe(201);
    const ins1Id = ins1Res.json().data.id;

    // 2. Segunda inscrição deve falhar pois lote está esgotado (409 Conflict)
    const ins2Res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "participante2@teste.com" }),
    });
    expect(ins2Res.statusCode).toBe(409);

    // 3. Admin cancela a primeira inscrição
    const cancelRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${ins1Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);
    const cancelBody = cancelRes.json().data ?? cancelRes.json();
    const cancelledIns = cancelBody.inscription ?? cancelBody;
    expect(cancelledIns.status).toBe("CANCELLED");

    // Confere auditoria
    const audit = await prisma.auditLog.findFirst({
      where: { action: "inscription.cancel", entityId: ins1Id },
    });
    expect(audit).not.toBeNull();

    // 4. Agora a vaga do lote foi liberada: segunda inscrição deve ter sucesso
    const ins3Res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "participante3@teste.com" }),
    });
    expect(ins3Res.statusCode).toBe(201);
    expect(ins3Res.json().data.status).toBe("PENDING");
  });

  it("4.2: quando inscrição confirmada é cancelada, participante vinculado também se torna CANCELLED", async () => {
    const event = await createTestEvent();
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "cancelar_ativo@teste.com" }),
    });
    const insId = insRes.json().data.id;

    // Confirma para gerar participante
    const confirmRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const participantId = confirmRes.json().data.inscription.participantId;

    // Cancela a inscrição
    await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    // Verifica status do participante no banco
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
    });
    expect(participant?.status).toBe("CANCELLED");
  });

  // --------------------------------------------------------------------------
  // 5. Exclusão Física de Inscrição (DELETE .../inscriptions/:id)
  // --------------------------------------------------------------------------
  it("5.1: remove inscrição e participante em cascata sem erros ou órfãos no banco", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    // Cria e confirma inscrição para gerar participante
    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Registro Ensaio", email: "ensaio@teste.com" }),
    });
    const insId = insRes.json().data.id;

    const confirmRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const participantId = confirmRes.json().data.inscription.participantId;

    // Cria registros dependentes (check-in)
    await createTestCheckIn(event.id, participantId);

    // Executa exclusão definitiva
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${insId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deleteRes.statusCode).toBe(200);
    const deleteData = deleteRes.json().data ?? deleteRes.json();
    expect(deleteData.success).toBe(true);
    expect(deleteData.deletedId).toBe(insId);

    // Confere que inscrição foi apagada do banco
    const dbIns = await prisma.inscription.findUnique({ where: { id: insId } });
    expect(dbIns).toBeNull();

    // Confere que participante foi apagado do banco
    const dbPart = await prisma.participant.findUnique({ where: { id: participantId } });
    expect(dbPart).toBeNull();

    // Confere que check-in foi cascateado e apagado
    const dbCheckins = await prisma.checkIn.findMany({ where: { participantId } });
    expect(dbCheckins).toHaveLength(0);

    // Auditoria registrada
    const audit = await prisma.auditLog.findFirst({
      where: { action: "inscription.delete", entityId: insId },
    });
    expect(audit).not.toBeNull();

    // Consulta pública agora retorna 404
    const getRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${insId}`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("5.2: recusa exclusão por usuário sem permissão participants.edit", async () => {
    const event = await createTestEvent();
    await batchesService.ensureDefaultBatches(event.id);
    const viewOnlyToken = await loginAsUserWithPermissions(["participants.view"]);

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload(),
    });
    const insId = insRes.json().data.id;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${insId}`,
      headers: { authorization: `Bearer ${viewOnlyToken}` },
    });

    expect(deleteRes.statusCode).toBe(403);
  });
});
