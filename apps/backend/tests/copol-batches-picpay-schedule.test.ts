import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";
import * as batchesService from "../src/modules/batches/batches.service.js";

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

describe("Copol — Inscrição Única, Lotes Automáticos e PicPay", () => {
  it("cria inscrição única sem seleção de categoria, aplicando automaticamente o Lote 1 (R$ 100)", async () => {
    const event = await createTestEvent();

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: {
        name: "Carlos da Silva",
        email: "carlos@teste.com",
        document: "123.456.789-01",
        phone: "(43) 99999-8888",
      },
    });

    expect(response.statusCode).toBe(201);
    const data = response.json().data;
    expect(data.name).toBe("Carlos da Silva");
    expect(data.amount).toBe(100);
    expect(data.category).toBe("1º Lote — Promocional");
    expect(data.status).toBe("PENDING");

    // REGRA FUNDAMENTAL: Sem pagamento, a pessoa NÃO existe como participante
    const participantCount = await prisma.participant.count({
      where: { eventId: event.id, email: "carlos@teste.com" },
    });
    expect(participantCount).toBe(0);
  });

  it("vira automaticamente para o Lote 2 (R$ 150) ao atingir 60 inscrições confirmadas no Lote 1", async () => {
    const event = await createTestEvent();
    const batches = await batchesService.ensureDefaultBatches(event.id);
    const lote1 = batches.find((b) => b.batchNumber === 1)!;

    // Simula 60 inscrições confirmadas no Lote 1
    const dummyInscriptions = Array.from({ length: 60 }).map((_, i) => ({
      eventId: event.id,
      name: `Participante Lote 1 #${i + 1}`,
      email: `part${i + 1}@teste.com`,
      document: `000.000.000-${String(i + 1).padStart(2, "0")}`,
      category: lote1.name,
      batchId: lote1.id,
      amount: 100,
      status: "CONFIRMED" as const,
    }));
    await prisma.inscription.createMany({ data: dummyInscriptions });

    // Próxima inscrição deve virar automaticamente para o Lote 2
    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: {
        name: "Inscrito 61",
        email: "inscrito61@teste.com",
        document: "999.888.777-66",
      },
    });

    expect(response.statusCode).toBe(201);
    const data = response.json().data;
    expect(data.amount).toBe(150);
    expect(data.category).toBe("2º Lote");
  });

  it("vira os lotes por data (Lote 3 após 22/09 e Lote 4 após 22/10)", async () => {
    const event = await createTestEvent();
    const batches = await batchesService.ensureDefaultBatches(event.id);
    const lote1 = batches.find((b) => b.batchNumber === 1)!;

    // Simula Lote 1 esgotado
    await prisma.inscription.createMany({
      data: Array.from({ length: 60 }).map((_, i) => ({
        eventId: event.id,
        name: `Inscrito #${i}`,
        email: `part_lote1_${i}@email.com`,
        document: `111.222.333-${i}`,
        batchId: lote1.id,
        category: lote1.name,
        amount: 100,
        status: "CONFIRMED",
      })),
    });

    // Simula data em 25/09/2026 -> Lote 3
    const dateLote3 = new Date("2026-09-25T12:00:00-03:00");
    const activeLote3 = await batchesService.resolveActiveBatch(event.id, dateLote3);
    expect(activeLote3.activeBatch?.batchNumber).toBe(3);
    expect(Number(activeLote3.activeBatch?.price)).toBe(180);

    // Simula data em 25/10/2026 -> Lote 4
    const dateLote4 = new Date("2026-10-25T12:00:00-03:00");
    const activeLote4 = await batchesService.resolveActiveBatch(event.id, dateLote4);
    expect(activeLote4.activeBatch?.batchNumber).toBe(4);
    expect(Number(activeLote4.activeBatch?.price)).toBe(220);

    // Simula data em 10/11/2026 -> Encerrado
    const dateEncerrado = new Date("2026-11-10T12:00:00-03:00");
    const activeEncerrado = await batchesService.resolveActiveBatch(event.id, dateEncerrado);
    expect(activeEncerrado.activeBatch).toBeNull();
  });

  it("processa webhook do PicPay, confirma inscrição e cadastra participante de forma atômica", async () => {
    const event = await createTestEvent();

    // 1. Cria inscrição
    const createRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: {
        name: "Ana Julia",
        email: "anajulia@teste.com",
        document: "321.654.987-00",
        phone: "(43) 98888-7777",
      },
    });
    const inscriptionId = createRes.json().data.id;

    // Antes do webhook, participante NÃO existe
    const countBefore = await prisma.participant.count({ where: { email: "anajulia@teste.com" } });
    expect(countBefore).toBe(0);

    // 2. Simula webhook do PicPay
    const webhookRes = await app.inject({
      method: "POST",
      url: "/inscriptions/picpay/webhook",
      payload: {
        referenceId: inscriptionId,
        authorizationId: "AUTH-123456",
      },
    });
    expect(webhookRes.statusCode).toBe(200);

    // 3. Após o webhook, participante FOI CRIADO com qrToken único e status ativo
    const participant = await prisma.participant.findFirst({
      where: { eventId: event.id, email: "anajulia@teste.com" },
    });
    expect(participant).not.toBeNull();
    expect(participant?.name).toBe("Ana Julia");
    expect(participant?.qrToken).toBeTruthy();

    // 4. Inscrição foi confirmada e vinculada ao participante
    const updated = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
    expect(updated?.status).toBe("CONFIRMED");
    expect(updated?.participantId).toBe(participant?.id);
    expect(updated?.paymentId).toBe("AUTH-123456");

    // 5. Consulta polling da tela
    const statusRes = await app.inject({
      method: "GET",
      url: `/inscriptions/${inscriptionId}/payment-status`,
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().data.status).toBe("CONFIRMED");
    expect(statusRes.json().data.qrToken).toBe(participant?.qrToken);
  });

  it("retorna relatório de inscritos contendo Nome, E-mail, Telefone e CPF", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();

    await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: {
        name: "Beatriz Santos",
        email: "beatriz@teste.com",
        document: "555.444.333-22",
        phone: "(43) 97777-6666",
      },
    });

    const reportRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/inscriptions/report`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(reportRes.statusCode).toBe(200);
    const list = reportRes.json().data;
    expect(list.length).toBeGreaterThan(0);

    const item = list.find((i: any) => i.email === "beatriz@teste.com");
    expect(item).toBeDefined();
    expect(item.name).toBe("Beatriz Santos");
    expect(item.email).toBe("beatriz@teste.com");
    expect(item.phone).toBe("(43) 97777-6666");
    expect(item.document).toBe("555.444.333-22");
    expect(item.amount).toBe(100);
  });

  it("oculta o preço de lotes UPCOMING para visitantes públicos, mas exibe para admins autenticados", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();

    // 1. Chamada pública (sem token): lotes UPCOMING devem ter price null
    const publicRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/batches`,
    });
    expect(publicRes.statusCode).toBe(200);
    const publicBatches = publicRes.json().data.batches;
    const activeBatch = publicBatches.find((b: any) => b.isActive);
    const upcomingBatch = publicBatches.find((b: any) => b.status === "UPCOMING");

    expect(activeBatch.price).toBe(100); // Lote ativo revela o preço!
    expect(upcomingBatch.price).toBeNull(); // Próximo lote oculta o preço!

    // 2. Chamada autenticada como admin: deve retornar todos os preços
    const adminRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/batches`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(adminRes.statusCode).toBe(200);
    const adminBatches = adminRes.json().data.batches;
    const adminUpcoming = adminBatches.find((b: any) => b.status === "UPCOMING");
    expect(adminUpcoming.price).toBeGreaterThan(0); // Admin vê o preço real para editar!
  });

  it("respeita startDate na ativação automática e permite ativação manual pelo admin", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();
    const batches = await batchesService.ensureDefaultBatches(event.id);
    const lote2 = batches.find((b) => b.batchNumber === 2)!;

    // Agenda o lote 2 para começar apenas daqui a 7 dias
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    await app.inject({
      method: "PUT",
      url: `/batches/${lote2.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        startDate: futureDate.toISOString(),
      },
    });

    // Simula lote 1 esgotado
    const lote1 = batches.find((b) => b.batchNumber === 1)!;
    await app.inject({
      method: "PUT",
      url: `/batches/${lote1.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isClosed: true },
    });

    // Como o lote 2 só começa daqui a 7 dias, a resolução automática NÃO ativa o lote 2
    const checkRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/batches`,
    });
    const checkBatches = checkRes.json().data.batches;
    const activeNow = checkBatches.find((b: any) => b.isActive);
    expect(activeNow?.id).not.toBe(lote2.id);

    // Agora o admin força a ativação manual pelo painel
    const activateRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/batches/${lote2.id}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(activateRes.statusCode).toBe(200);
    const activatedBatches = activateRes.json().data;
    const lote2Active = activatedBatches.find((b: any) => b.id === lote2.id);
    expect(lote2Active.isActive).toBe(true);
    expect(lote2Active.status).toBe("ACTIVE");
  });
});

describe("Copol — Programação do Evento", () => {
  it("permite ao admin criar, listar, atualizar e excluir atividades da programação", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();

    // 1. Criar atividade
    const createRes = await app.inject({
      method: "POST",
      url: `/events/${event.id}/schedule`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: "2026-11-20",
        startTime: "08:30",
        endTime: "10:00",
        title: "Abertura Oficial e Mesa Redonda",
        speaker: "Dr. João Paulo",
        location: "Auditório Principal",
        description: "Boas-vindas aos congressistas e abertura solene.",
        type: "Abertura",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const item = createRes.json().data;
    expect(item.title).toBe("Abertura Oficial e Mesa Redonda");
    expect(item.speaker).toBe("Dr. João Paulo");

    // 2. Consulta pública
    const publicRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/schedule`,
    });
    expect(publicRes.statusCode).toBe(200);
    const schedule = publicRes.json().data;
    expect(schedule.length).toBe(1);
    expect(schedule[0].title).toBe("Abertura Oficial e Mesa Redonda");

    // 3. Editar atividade
    const updateRes = await app.inject({
      method: "PUT",
      url: `/schedule/${item.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "Abertura Oficial e Palestra Magna",
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.title).toBe("Abertura Oficial e Palestra Magna");

    // 4. Excluir atividade
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/schedule/${item.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    const publicAfterRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}/schedule`,
    });
    expect(publicAfterRes.json().data.length).toBe(0);
  });
});
