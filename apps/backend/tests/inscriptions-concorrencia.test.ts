import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";

/**
 * Venda além do teto do lote.
 *
 * O lote 1 do COPOL tem 60 vagas a R$100; os seguintes custam R$150 ou
 * mais. Vender 70 vagas do lote 1 não deixa ninguém sem lugar — deixa
 * R$500 na mesa por cada vaga vendida a mais. É por isso que estes
 * testes existem.
 *
 * Todos disparam as requisições EM PARALELO de verdade
 * (`Promise.all`), sem enfileirar. Um teste sequencial passaria mesmo
 * com o código antigo e não provaria nada.
 */
const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function eventoComLoteDe(vagas: number) {
  const event = await createTestEvent();
  const lote = await prisma.eventBatch.create({
    data: {
      eventId: event.id,
      batchNumber: 1,
      name: "1º Lote — Promocional",
      price: 100,
      maxQuantity: vagas,
      isActive: true,
    },
  });
  return { event, lote };
}

function inscricao(i: number) {
  return {
    name: `Pessoa ${i}`,
    email: `pessoa${i}@teste.com`,
    // CPF distinto por pessoa: repetido esbarraria em outra validação e
    // o teste passaria pelo motivo errado.
    document: `000.000.${String(i).padStart(3, "0")}-00`,
    consentVersion: "1.0",
  };
}

async function tentarEmParalelo(eventId: string, quantas: number) {
  const respostas = await Promise.all(
    Array.from({ length: quantas }, (_, i) =>
      app.inject({
        method: "POST",
        url: `/events/${eventId}/inscriptions`,
        payload: inscricao(i),
      }),
    ),
  );
  return {
    aceitas: respostas.filter((r) => r.statusCode === 201).length,
    recusadas: respostas.filter((r) => r.statusCode === 409).length,
    outras: respostas.filter((r) => r.statusCode !== 201 && r.statusCode !== 409),
  };
}

describe("concorrência no lote com vagas limitadas", () => {
  it("com 1 vaga e 2 pedidos simultâneos, só um entra", async () => {
    const { event, lote } = await eventoComLoteDe(1);

    const r = await tentarEmParalelo(event.id, 2);

    expect(r.aceitas).toBe(1);
    expect(r.recusadas).toBe(1);

    const noLote = await prisma.inscription.count({ where: { batchId: lote.id } });
    expect(noLote).toBe(1);
  });

  it("com 1 vaga e 20 pedidos simultâneos, só um entra", async () => {
    // Vinte de uma vez é o que separa "passou por sorte" de "está
    // correto": com o código antigo, os vinte entrariam.
    const { event, lote } = await eventoComLoteDe(1);

    const r = await tentarEmParalelo(event.id, 20);

    expect(r.aceitas).toBe(1);
    expect(r.recusadas).toBe(19);
    expect(r.outras).toEqual([]);

    const noLote = await prisma.inscription.count({ where: { batchId: lote.id } });
    expect(noLote).toBe(1);
  });

  it("com 10 vagas e 30 pedidos simultâneos, entram exatamente 10", async () => {
    const { event, lote } = await eventoComLoteDe(10);

    const r = await tentarEmParalelo(event.id, 30);

    expect(r.aceitas).toBe(10);
    expect(r.recusadas).toBe(20);

    const noLote = await prisma.inscription.count({ where: { batchId: lote.id } });
    expect(noLote).toBe(10);
  });

  it("recusa com 409 e mensagem que explica, não com erro genérico", async () => {
    const { event } = await eventoComLoteDe(1);
    await tentarEmParalelo(event.id, 1);

    const resposta = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscricao(99),
    });

    expect(resposta.statusCode).toBe(409);
    const corpo = resposta.json();
    expect(corpo.error.code).toBe("LOTE_ESGOTADO");
    // A pessoa precisa saber o que fazer, não só que deu errado.
    expect(corpo.error.message).toMatch(/esgotou/i);
    expect(corpo.error.message).toMatch(/recarregue/i);
  });
});

describe("o que ocupa uma vaga", () => {
  it("inscrição PENDENTE ocupa vaga — é a correção principal", async () => {
    // Antes, só CONFIRMED contava. Entre criar a inscrição e o webhook
    // confirmar passam ATÉ 24 HORAS: nessa janela o lote parecia vazio
    // para todo mundo, e 100 pessoas podiam receber vaga num lote de 60
    // ao longo de um dia — sem nenhuma simultaneidade envolvida.
    const { event } = await eventoComLoteDe(1);

    const primeira = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscricao(1),
    });
    expect(primeira.statusCode).toBe(201);
    expect(primeira.json().data.status).toBe("PENDING");

    const segunda = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscricao(2),
    });
    expect(segunda.statusCode).toBe(409);
  });

  it("inscrição pendente VENCIDA libera a vaga", async () => {
    const { event, lote } = await eventoComLoteDe(1);

    // Uma pendência de ontem: quem não pagou em 24h não segura a vaga.
    await prisma.inscription.create({
      data: {
        eventId: event.id,
        batchId: lote.id,
        name: "Quem não pagou",
        email: "atrasado@teste.com",
        document: "111.111.111-11",
        category: lote.name,
        amount: 100,
        status: "PENDING",
        paymentExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
        consentVersion: "1.0",
        consentAcceptedAt: new Date(),
      },
    });

    const resposta = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscricao(1),
    });

    expect(resposta.statusCode).toBe(201);
  });

  it("lote sem teto não esgota", async () => {
    const event = await createTestEvent();
    await prisma.eventBatch.create({
      data: {
        eventId: event.id,
        batchNumber: 1,
        name: "Lote sem limite",
        price: 150,
        maxQuantity: null,
        isActive: true,
      },
    });

    const r = await tentarEmParalelo(event.id, 12);

    expect(r.aceitas).toBe(12);
    expect(r.recusadas).toBe(0);
  });
});

describe("isolamento entre eventos", () => {
  it("lotar o lote de um evento não fecha o do outro", async () => {
    // O bloqueio é por LOTE. Se fosse global, um evento cheio travaria
    // as inscrições de todos os outros.
    const a = await eventoComLoteDe(1);
    const b = await eventoComLoteDe(1);

    const rA = await tentarEmParalelo(a.event.id, 5);
    expect(rA.aceitas).toBe(1);

    const rB = await tentarEmParalelo(b.event.id, 5);
    expect(rB.aceitas).toBe(1);

    expect(await prisma.inscription.count({ where: { batchId: a.lote.id } })).toBe(1);
    expect(await prisma.inscription.count({ where: { batchId: b.lote.id } })).toBe(1);
  });
});

describe("webhook de pagamento repetido", () => {
  async function criarEConfirmar(quantosWebhooks: number) {
    const { event } = await eventoComLoteDe(10);

    const criada = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscricao(1),
    });
    const id = criada.json().data.id;

    // Todos ao MESMO TEMPO. O PicPay reenvia o webhook quando não
    // recebe resposta a tempo, e as reentregas podem se cruzar — não
    // chegam necessariamente uma depois da outra.
    const respostas = await Promise.all(
      Array.from({ length: quantosWebhooks }, () =>
        app.inject({
          method: "POST",
          url: "/inscriptions/picpay/webhook",
          payload: { referenceId: id, authorizationId: "AUTH-REPETIDO" },
        }),
      ),
    );

    return { event, id, respostas };
  }

  it("o mesmo webhook cinco vezes gera UM participante", async () => {
    // Dois participantes para a mesma inscrição significam duas
    // credenciais, dois QR codes e duas entradas no evento.
    const { event, respostas } = await criarEConfirmar(5);

    expect(respostas.every((r) => r.statusCode === 200)).toBe(true);

    const participantes = await prisma.participant.count({
      where: { eventId: event.id, email: "pessoa1@teste.com" },
    });
    expect(participantes).toBe(1);
  });

  it("a inscrição continua confirmada uma vez só", async () => {
    const { id, respostas } = await criarEConfirmar(4);

    const inscricaoFinal = await prisma.inscription.findUnique({ where: { id } });
    expect(inscricaoFinal?.status).toBe("CONFIRMED");
    expect(inscricaoFinal?.participantId).toBeTruthy();

    // Nenhuma reentrega pode responder com erro: o PicPay trataria
    // como falha e reenviaria de novo, para sempre.
    expect(respostas.filter((r) => r.statusCode >= 400)).toEqual([]);
  });

  it("webhook repetido não consome vaga extra do lote", async () => {
    const { event, lote } = await eventoComLoteDe(1);

    const criada = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscricao(1),
    });
    const id = criada.json().data.id;

    await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({
          method: "POST",
          url: "/inscriptions/picpay/webhook",
          payload: { referenceId: id, authorizationId: "AUTH-X" },
        }),
      ),
    );

    const noLote = await prisma.inscription.count({ where: { batchId: lote.id } });
    expect(noLote).toBe(1);
  });
});
