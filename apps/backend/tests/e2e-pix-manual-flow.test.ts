import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createActiveTerminalWithToken,
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
    name: "Ana Beatriz Fonseca",
    email: "anabeatriz@exemplo.com",
    document: "111.222.333-44",
    phone: "(43) 98888-7777",
    institution: "Universidade Positivo",
    consentVersion: "1.0",
    ...overrides,
  };
}

describe.sequential("E2E — 3º COPOL: Pagamento PIX Manual & Gestão de Participantes", () => {
  // ==========================================================================
  // Tier 1: Feature Coverage
  // ==========================================================================
  it("T1.1: Admin configura campos PIX do evento (pixKey, pixKeyType, pixReceiverName)", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
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

    // Verificação de persistência no banco
    const updatedEvent = (await prisma.event.findUnique({
      where: { id: event.id },
    })) as any;
    expect(updatedEvent.pixKey).toBe("terceirocopol@gmail.com");
    expect(updatedEvent.pixKeyType).toBe("EMAIL");
    expect(updatedEvent.pixReceiverName).toBe("3º COPOL — Congresso Odontológico Positivo Londrinense");
  });

  it("T1.2: Endpoint público de detalhes do evento expõe campos PIX configurados", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();
    const slug = `copol-2026-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.event.update({ where: { id: event.id }, data: { slug } });

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        pixKey: "terceirocopol@gmail.com",
        pixKeyType: "EMAIL",
        pixReceiverName: "3º COPOL — Congresso Odontológico Positivo Londrinense",
      },
    });
    expect(patchRes.statusCode).toBe(200);

    // 1. GET /public/events/:slug
    const publicSlugRes = await app.inject({
      method: "GET",
      url: `/public/events/${slug}`,
    });

    expect(publicSlugRes.statusCode).toBe(200);
    const publicSlugData = publicSlugRes.json().data ?? publicSlugRes.json();
    expect(publicSlugData.pixKey).toBe("terceirocopol@gmail.com");
    expect(publicSlugData.pixKeyType).toBe("EMAIL");
    expect(publicSlugData.pixReceiverName).toBe("3º COPOL — Congresso Odontológico Positivo Londrinense");

    // 2. GET /events/:eventId/public
    const publicIdRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/public`,
    });

    expect(publicIdRes.statusCode).toBe(200);
    const publicIdData = publicIdRes.json().data ?? publicIdRes.json();
    expect(publicIdData.pixKey).toBe("terceirocopol@gmail.com");
    expect(publicIdData.pixKeyType).toBe("EMAIL");
    expect(publicIdData.pixReceiverName).toBe("3º COPOL — Congresso Odontológico Positivo Londrinense");
  });

  it("T1.3: Criação de inscrição pública retorna status PENDING sem criar participante", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "mariasilva@teste.com" }),
    });

    expect(response.statusCode).toBe(201);
    const data = response.json().data;
    expect(data.status).toBe("PENDING");
    expect(data.id).toBeTruthy();
    expect(data.amount).toBe(100);

    // Regra: Participante NÃO existe enquanto não houver pagamento confirmado
    const participantCount = await prisma.participant.count({
      where: { eventId: event.id, email: "mariasilva@teste.com" },
    });
    expect(participantCount).toBe(0);
  });

  it("T1.4: Endpoint de status do pagamento expõe informações de PIX e nome do inscrito", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    const adminToken = await loginAsAdmin();

    await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        pixKey: "financeiro@copol.com.br",
        pixKeyType: "EMAIL",
        pixReceiverName: "Comissão Financeira COPOL",
      },
    });

    await batchesService.ensureDefaultBatches(event.id);

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Lucas Andrade", email: "lucas@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    // GET /inscriptions/:id/payment-status
    const statusRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${inscriptionId}/payment-status`,
    });

    expect(statusRes.statusCode).toBe(200);
    const statusData = statusRes.json().data ?? statusRes.json();
    expect(statusData.id).toBe(inscriptionId);
    expect(statusData.status).toBe("PENDING");
    expect(statusData.name).toBe("Lucas Andrade");
    expect(statusData.amount).toBe(100);
    expect(statusData.pixKey).toBe("financeiro@copol.com.br");
    expect(statusData.pixKeyType).toBe("EMAIL");
    expect(statusData.pixReceiverName).toBe("Comissão Financeira COPOL");
    expect(statusData.participantId).toBeNull();
    expect(statusData.qrToken).toBeNull();
  });

  it("T1.5: Admin confirma manualmente inscrição -> status CONFIRMED, cria Participant com qrToken e vincula", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Mariana Costa", email: "mariana@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    // Confirmação manual pelo Admin
    const confirmRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmData = confirmRes.json().data ?? confirmRes.json();
    const updatedIns = confirmData.inscription ?? confirmData;
    expect(updatedIns.status).toBe("CONFIRMED");

    // Verificação no banco de dados: participante criado
    const dbIns = await prisma.inscription.findUnique({
      where: { id: inscriptionId },
    });
    expect(dbIns?.status).toBe("CONFIRMED");
    expect(dbIns?.participantId).toBeTruthy();

    const participant = await prisma.participant.findUnique({
      where: { id: dbIns!.participantId! },
    });
    expect(participant).toBeTruthy();
    expect(participant?.name).toBe("Mariana Costa");
    expect(participant?.email).toBe("mariana@teste.com");
    expect(participant?.status).toBe("ACTIVE");
    expect(participant?.qrToken).toBeTruthy();

    // Polling de payment-status reflete confirmação imediatamente com qrToken
    const pollRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${inscriptionId}/payment-status`,
    });
    expect(pollRes.statusCode).toBe(200);
    const pollData = pollRes.json().data ?? pollRes.json();
    expect(pollData.status).toBe("CONFIRMED");
    expect(pollData.participantId).toBe(participant!.id);
    expect(pollData.qrToken).toBe(participant!.qrToken);
  });

  it("T1.6: Admin cancela manualmente inscrição -> status torna-se CANCELLED", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Felipe Ramos", email: "felipe@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    // Cancelamento manual pelo Admin
    const cancelRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(cancelRes.statusCode).toBe(200);
    const cancelData = cancelRes.json().data ?? cancelRes.json();
    const updatedIns = cancelData.inscription ?? cancelData;
    expect(updatedIns.status).toBe("CANCELLED");

    // Verificação no banco de dados
    const dbIns = await prisma.inscription.findUnique({
      where: { id: inscriptionId },
    });
    expect(dbIns?.status).toBe("CANCELLED");

    // Polling de status reflete CANCELLED
    const pollRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${inscriptionId}/payment-status`,
    });
    expect(pollRes.statusCode).toBe(200);
    const pollData = pollRes.json().data ?? pollRes.json();
    expect(pollData.status).toBe("CANCELLED");
  });

  it("T1.7: Admin exclui inscrição -> registro removido fisicamente do banco de dados", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Teste Exclusão", email: "excluir@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    // Exclusão definitiva pelo Admin
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${inscriptionId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deleteRes.statusCode).toBe(200);

    // Verificação no banco de dados: registro NÃO existe mais
    const dbIns = await prisma.inscription.findUnique({
      where: { id: inscriptionId },
    });
    expect(dbIns).toBeNull();

    // Consulta pública subsequente resulta em 404 NOT_FOUND
    const getRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${inscriptionId}`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  // ==========================================================================
  // Tier 2: Boundary & Corner Cases
  // ==========================================================================
  it("T2.1: Tentativa de confirmar inscrição já confirmada é idempotente e não duplica participante", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "idempotent@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    // 1ª Confirmação -> 200
    const firstConfirm = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(firstConfirm.statusCode).toBe(200);

    const countAfterFirst = await prisma.participant.count({
      where: { eventId: event.id, email: "idempotent@teste.com" },
    });
    expect(countAfterFirst).toBe(1);

    // 2ª Confirmação -> Idempotente (200 ou 400 graceful), mas NUNCA erro 500 ou duplicação
    const secondConfirm = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect([200, 400]).toContain(secondConfirm.statusCode);

    // Garante que não foram criados múltiplos participantes
    const countAfterSecond = await prisma.participant.count({
      where: { eventId: event.id, email: "idempotent@teste.com" },
    });
    expect(countAfterSecond).toBe(1);
  });

  it("T2.2: Tentativa de confirmar inscrição inexistente retorna 404 NOT_FOUND", async () => {
    const event = await createTestEvent();
    const adminToken = await loginAsAdmin();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${fakeId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().success).toBe(false);
  });

  it("T2.3: Tentativa de cancelar inscrição já cancelada é segura e idempotente", async () => {
    const event = await createTestEvent();
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "doublecancel@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    // 1º Cancelamento
    const res1 = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res1.statusCode).toBe(200);

    // 2º Cancelamento
    const res2 = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect([200, 400]).toContain(res2.statusCode);

    const dbIns = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
    expect(dbIns?.status).toBe("CANCELLED");
  });

  it("T2.4: Exclusão de inscrição com check-in e certificado limpa em cascata sem erro de Foreign Key", async () => {
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);
    const adminToken = await loginAsAdmin();

    // 1. Cria e confirma inscrição
    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "cascade_test@teste.com" }),
    });
    const inscriptionId = insRes.json().data.id;

    await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const dbIns = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
    const participantId = dbIns!.participantId!;
    expect(participantId).toBeTruthy();

    // 2. Cria registros filhos vinculados ao participante: checkIn e certificado
    await createTestCheckIn(event.id, participantId);
    await prisma.certificate.create({
      data: {
        eventId: event.id,
        participantId,
        status: "LOCKED",
        verificationCode: `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });

    expect(await prisma.checkIn.count({ where: { participantId } })).toBe(1);
    expect(await prisma.certificate.count({ where: { participantId } })).toBe(1);

    // 3. Executa DELETE na inscrição
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${inscriptionId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deleteRes.statusCode).toBe(200);

    // 4. Validação: Todos os registros filhos e pais foram apagados sem violação de FK
    expect(await prisma.inscription.findUnique({ where: { id: inscriptionId } })).toBeNull();
    expect(await prisma.participant.findUnique({ where: { id: participantId } })).toBeNull();
    expect(await prisma.checkIn.count({ where: { participantId } })).toBe(0);
    expect(await prisma.certificate.count({ where: { participantId } })).toBe(0);
  });

  it("T2.5: Controle de acesso RBAC rejeita chamadas não autenticadas ou sem permissão", async () => {
    const event = await createTestEvent();
    await batchesService.ensureDefaultBatches(event.id);

    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload(),
    });
    const inscriptionId = insRes.json().data.id;

    // 1. Chamadas anônimas (sem token)
    const anonPatch = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      payload: { pixKey: "hacker@pix.com" },
    });
    expect(anonPatch.statusCode).toBe(401);

    const anonConfirm = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/confirm`,
    });
    expect(anonConfirm.statusCode).toBe(401);

    const anonCancel = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/cancel`,
    });
    expect(anonCancel.statusCode).toBe(401);

    const anonDelete = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${inscriptionId}`,
    });
    expect(anonDelete.statusCode).toBe(401);

    // 2. Chamadas com usuário autenticado mas SEM permissão participants.edit
    const viewOnlyToken = await loginAsUserWithPermissions(["participants.view"]);

    const forbiddenConfirm = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/confirm`,
      headers: { authorization: `Bearer ${viewOnlyToken}` },
    });
    expect(forbiddenConfirm.statusCode).toBe(403);

    const forbiddenCancel = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${inscriptionId}/cancel`,
      headers: { authorization: `Bearer ${viewOnlyToken}` },
    });
    expect(forbiddenCancel.statusCode).toBe(403);

    const forbiddenDelete = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${inscriptionId}`,
      headers: { authorization: `Bearer ${viewOnlyToken}` },
    });
    expect(forbiddenDelete.statusCode).toBe(403);
  });

  // ==========================================================================
  // Tier 3: Cross-Feature Combinations
  // ==========================================================================
  it("T3.1: Controle de cota de lote: PENDING reserva vaga, CONFIRMED mantém, CANCELLED e DELETED liberam a vaga", async () => {
    const event = await createTestEvent({ name: "Workshop Limitado" });
    const adminToken = await loginAsAdmin();

    // Cria lote com capacidade máxima de exatamente 2 vagas
    const batch = await prisma.eventBatch.create({
      data: {
        eventId: event.id,
        batchNumber: 1,
        name: "Lote Estrito 2 Vagas",
        price: 120.0,
        maxQuantity: 2,
        isActive: true,
        isClosed: false,
      },
    });

    // 1. Estudante 1 se inscreve -> PENDING (1/2 vagas ocupadas)
    const ins1Res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 1", email: "aluno1@teste.com" }),
    });
    expect(ins1Res.statusCode).toBe(201);
    const ins1Id = ins1Res.json().data.id;

    // 2. Estudante 2 se inscreve -> PENDING (2/2 vagas ocupadas - ESGOTOU)
    const ins2Res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 2", email: "aluno2@teste.com" }),
    });
    expect(ins2Res.statusCode).toBe(201);
    const ins2Id = ins2Res.json().data.id;

    // 3. Estudante 3 tenta se inscrever -> RECUSADO (409 Lote Esgotado)
    const ins3Blocked = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 3", email: "aluno3@teste.com" }),
    });
    expect([409, 403]).toContain(ins3Blocked.statusCode);

    // 4. Admin confirma Aluno 1 -> status CONFIRMED (cota continua 2/2 ocupada)
    const confirmIns1 = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${ins1Id}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(confirmIns1.statusCode).toBe(200);

    // Tentativa ainda é recusada porque Aluno 1 está CONFIRMED e Aluno 2 está PENDING
    const ins3StillBlocked = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 3", email: "aluno3@teste.com" }),
    });
    expect([409, 403]).toContain(ins3StillBlocked.statusCode);

    // 5. Admin cancela Aluno 2 -> status CANCELLED (libera 1 vaga! Agora 1/2 ocupada)
    const cancelIns2 = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${ins2Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(cancelIns2.statusCode).toBe(200);

    // 6. Estudante 3 tenta novamente -> SUCESSO (201)! Cota volta para 2/2
    const ins3Success = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 3", email: "aluno3@teste.com" }),
    });
    expect(ins3Success.statusCode).toBe(201);
    const ins3Id = ins3Success.json().data.id;

    // Estudante 4 tenta -> RECUSADO (409)
    const ins4Blocked = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 4", email: "aluno4@teste.com" }),
    });
    expect([409, 403]).toContain(ins4Blocked.statusCode);

    // 7. Admin exclui fisicamente Aluno 3 -> DELETE (libera 1 vaga!)
    const deleteIns3 = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${ins3Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(deleteIns3.statusCode).toBe(200);

    // 8. Estudante 4 tenta novamente -> SUCESSO (201)!
    const ins4Success = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Aluno 4", email: "aluno4@teste.com" }),
    });
    expect(ins4Success.statusCode).toBe(201);
  });

  it("T3.2: Isolamento multi-evento e inviolabilidade de fronteiras de tenant", async () => {
    const adminToken = await loginAsAdmin();

    // Evento A
    const eventA = await createTestEvent({ name: "Congresso A" });
    const slugA = `slug-a-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.event.update({ where: { id: eventA.id }, data: { slug: slugA } });
    await app.inject({
      method: "PATCH",
      url: `/events/${eventA.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        pixKey: "pix-evento-a@teste.com",
        pixKeyType: "EMAIL",
        pixReceiverName: "Organização do Evento A",
      },
    });

    // Evento B
    const eventB = await createTestEvent({ name: "Congresso B" });
    const slugB = `slug-b-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.event.update({ where: { id: eventB.id }, data: { slug: slugB } });
    await app.inject({
      method: "PATCH",
      url: `/events/${eventB.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        pixKey: "pix-evento-b@teste.com",
        pixKeyType: "EMAIL",
        pixReceiverName: "Organização do Evento B",
      },
    });

    // 1. Verificação de vazamento de dados PIX entre eventos
    const getPublicA = await app.inject({ method: "GET", url: `/public/events/${slugA}` });
    expect(getPublicA.statusCode).toBe(200);
    const dataA = getPublicA.json().data ?? getPublicA.json();
    expect(dataA.pixKey).toBe("pix-evento-a@teste.com");
    expect(dataA.pixKey).not.toBe("pix-evento-b@teste.com");

    const getPublicB = await app.inject({ method: "GET", url: `/public/events/${slugB}` });
    expect(getPublicB.statusCode).toBe(200);
    const dataB = getPublicB.json().data ?? getPublicB.json();
    expect(dataB.pixKey).toBe("pix-evento-b@teste.com");
    expect(dataB.pixKey).not.toBe("pix-evento-a@teste.com");

    // 2. Inscrição criada no Evento B
    await batchesService.ensureDefaultBatches(eventB.id);
    const insBRes = await app.inject({
      method: "POST",
      url: `/events/${eventB.id}/inscriptions`,
      payload: sampleInscriptionPayload({ email: "aluno-b@teste.com" }),
    });
    const insBId = insBRes.json().data.id;

    // 3. Tentativa de confirmar Inscrição B através da rota do Evento A -> REJEITADA
    const crossConfirm = await app.inject({
      method: "POST",
      url: `/events/${eventA.id}/inscriptions/${insBId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect([404, 400]).toContain(crossConfirm.statusCode);

    // 4. Tentativa de cancelar Inscrição B através da rota do Evento A -> REJEITADA
    const crossCancel = await app.inject({
      method: "POST",
      url: `/events/${eventA.id}/inscriptions/${insBId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect([404, 400]).toContain(crossCancel.statusCode);

    // 5. Tentativa de excluir Inscrição B através da rota do Evento A -> REJEITADA
    const crossDelete = await app.inject({
      method: "DELETE",
      url: `/events/${eventA.id}/inscriptions/${insBId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect([404, 400]).toContain(crossDelete.statusCode);

    // Inscrição B permanece intacta no Evento B
    const dbInsB = await prisma.inscription.findUnique({ where: { id: insBId } });
    expect(dbInsB?.status).toBe("PENDING");
    expect(dbInsB?.eventId).toBe(eventB.id);
  });

  // ==========================================================================
  // Tier 4: Real-World Scenarios
  // ==========================================================================
  it("T4.1: Ciclo de vida completo do estudante: inscrição -> visualização PIX manual -> aprovação admin -> check-in no credenciamento", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent({ name: "3º COPOL Oficial" });
    const slug = `copol-2026-e2e-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.event.update({ where: { id: event.id }, data: { slug } });
    await batchesService.ensureDefaultBatches(event.id);

    // Passo 1: Organização configura os dados de PIX no painel administrativo
    const configRes = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        pixKey: "terceirocopol@gmail.com",
        pixKeyType: "EMAIL",
        pixReceiverName: "3º COPOL — Congresso Odontológico Positivo Londrinense",
      },
    });
    expect(configRes.statusCode).toBe(200);

    // Passo 2: Estudante acessa a landing page e consulta detalhes públicos do evento
    const publicRes = await app.inject({
      method: "GET",
      url: `/public/events/${slug}`,
    });
    expect(publicRes.statusCode).toBe(200);
    const publicDetails = publicRes.json().data ?? publicRes.json();
    expect(publicDetails.pixKey).toBe("terceirocopol@gmail.com");

    // Passo 3: Estudante preenche formulário de inscrição no portal
    const registerRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({
        name: "Camila Guimarães",
        email: "camila.odonto@exemplo.com",
        document: "321.654.987-00",
        phone: "(43) 99111-2222",
        institution: "Universidade Positivo Londrina",
      }),
    });
    expect(registerRes.statusCode).toBe(201);
    const studentInscriptionId = registerRes.json().data.id;

    // Passo 4: Estudante é direcionado para a tela de pagamento e realiza polling do status
    const initialPoll = await app.inject({
      method: "GET",
      url: `/inscriptions/${studentInscriptionId}/payment-status`,
    });
    expect(initialPoll.statusCode).toBe(200);
    const poll1Data = initialPoll.json().data ?? initialPoll.json();
    expect(poll1Data.status).toBe("PENDING");
    expect(poll1Data.name).toBe("Camila Guimarães");
    expect(poll1Data.pixKey).toBe("terceirocopol@gmail.com");
    expect(poll1Data.pixReceiverName).toBe("3º COPOL — Congresso Odontológico Positivo Londrinense");
    expect(poll1Data.qrToken).toBeNull();

    // Passo 5: Administrador consulta relatório de inscritos no painel admin
    const reportRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/inscriptions/report`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(reportRes.statusCode).toBe(200);
    const reportList = reportRes.json().data as any[];
    const foundStudent = reportList.find((item) => item.id === studentInscriptionId);
    expect(foundStudent).toBeTruthy();
    expect(foundStudent.status).toBe("PENDING");
    expect(foundStudent.name).toBe("Camila Guimarães");

    // Passo 6: Administrador valida o comprovante recebido e confirma a inscrição manualmente
    const confirmAction = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${studentInscriptionId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(confirmAction.statusCode).toBe(200);

    // Passo 7: Tela do participante detecta confirmação no polling subsequente
    const afterApprovalPoll = await app.inject({
      method: "GET",
      url: `/inscriptions/${studentInscriptionId}/payment-status`,
    });
    expect(afterApprovalPoll.statusCode).toBe(200);
    const poll2Data = afterApprovalPoll.json().data ?? afterApprovalPoll.json();
    expect(poll2Data.status).toBe("CONFIRMED");
    expect(poll2Data.participantId).toBeTruthy();
    expect(poll2Data.qrToken).toBeTruthy();

    const qrToken = poll2Data.qrToken;

    // Passo 8: No dia do evento, terminal na portaria realiza o check-in da estudante
    const { token: terminalToken } = await createActiveTerminalWithToken(app, event.id);

    const checkInRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${terminalToken}` },
      payload: { qrToken },
    });

    expect(checkInRes.statusCode).toBe(201);
    const checkInData = checkInRes.json();
    expect(checkInData.success).toBe(true);
    expect(checkInData.data.status).toBe("CONFIRMED");
    expect(checkInData.data.participant.name).toBe("Camila Guimarães");

    // Presença registrada com sucesso no banco de dados!
    const checkInDb = await prisma.checkIn.findFirst({
      where: { eventId: event.id, participantId: poll2Data.participantId },
    });
    expect(checkInDb).toBeTruthy();
  });

  it("T4.2: Fluxo de desistência / inadimplência: cancelamento e liberação da vaga", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);

    // Estudante inicia inscrição mas não efetua PIX
    const insRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Desistente", email: "desistente@teste.com" }),
    });
    const insId = insRes.json().data.id;

    // Admin identifica não-pagamento e cancela a inscrição
    const cancelRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${insId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);

    // Participante nunca foi criado
    const participantCount = await prisma.participant.count({
      where: { eventId: event.id, email: "desistente@teste.com" },
    });
    expect(participantCount).toBe(0);

    // Inscrição está CANCELLED
    const dbIns = await prisma.inscription.findUnique({ where: { id: insId } });
    expect(dbIns?.status).toBe("CANCELLED");
  });

  it("T4.3: Expulgo / limpeza física de registros de teste de ensaio antes do evento", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent({ name: "3º COPOL 2026" });
    await batchesService.ensureDefaultBatches(event.id);

    // Organizadores criam inscrição de teste
    const testInsRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: sampleInscriptionPayload({ name: "Ensaio Teste Equipamento", email: "ensaio@copol.com" }),
    });
    const testInsId = testInsRes.json().data.id;

    // Confirmam e testam leitura no terminal de check-in
    await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${testInsId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const dbIns = await prisma.inscription.findUnique({ where: { id: testInsId } });
    const participantId = dbIns!.participantId!;

    const { token: terminalToken } = await createActiveTerminalWithToken(app, event.id);
    const participant = await prisma.participant.findUnique({ where: { id: participantId } });

    await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${terminalToken}` },
      payload: { qrToken: participant!.qrToken },
    });

    expect(await prisma.checkIn.count({ where: { participantId } })).toBe(1);

    // Antes da abertura real dos portões, o admin purga o cadastro de teste
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/inscriptions/${testInsId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Base completamente limpa sem resíduos do teste de ensaio
    expect(await prisma.inscription.findUnique({ where: { id: testInsId } })).toBeNull();
    expect(await prisma.participant.findUnique({ where: { id: participantId } })).toBeNull();
    expect(await prisma.checkIn.count({ where: { participantId } })).toBe(0);
  });
});
