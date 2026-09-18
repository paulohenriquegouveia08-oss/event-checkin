import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

/**
 * Formas de pagamento aceitas por lote.
 *
 * O COPOL vende o 1º lote só no Pix e abre cartão no 2º. Quem decide isso
 * é o admin, pelo painel — e o que o painel manda precisa chegar ao banco,
 * porque é essa coluna que a geração da cobrança consulta.
 *
 * O caso do meio (admin não escolhe nada) é o que protege os lotes que já
 * existem em produção: eles continuam vendendo no Pix.
 */

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

describe.sequential("Formas de pagamento por lote", () => {
  it("cria o lote com as formas escolhidas pelo admin", async () => {
    const token = await loginAsAdmin();
    const evento = await createTestEvent();

    const resposta = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "2º Lote", price: 150, allowPix: false, allowCard: true },
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().data.allowPix).toBe(false);
    expect(resposta.json().data.allowCard).toBe(true);

    const salvo = await prisma.eventBatch.findUnique({ where: { id: resposta.json().data.id } });
    expect(salvo?.allowPix).toBe(false);
    expect(salvo?.allowCard).toBe(true);
  });

  it("sem escolha do admin, o lote nasce no Pix e sem cartão", async () => {
    const token = await loginAsAdmin();
    const evento = await createTestEvent();

    const resposta = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "1º Lote", price: 100 },
    });

    expect(resposta.statusCode).toBe(201);

    const salvo = await prisma.eventBatch.findUnique({ where: { id: resposta.json().data.id } });
    expect(salvo?.allowPix).toBe(true);
    expect(salvo?.allowCard).toBe(false);
  });

  it("edita as formas de um lote existente sem mexer no que não foi enviado", async () => {
    const token = await loginAsAdmin();
    const evento = await createTestEvent();
    const lote = await prisma.eventBatch.create({
      data: { eventId: evento.id, batchNumber: 2, name: "2º Lote", price: 150 },
    });

    const resposta = await app.inject({
      method: "PUT",
      url: `/batches/${lote.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { allowCard: true },
    });

    expect(resposta.statusCode).toBe(200);

    const salvo = await prisma.eventBatch.findUnique({ where: { id: lote.id } });
    expect(salvo?.allowCard).toBe(true);
    // Não foi enviado: precisa continuar como estava, e não virar false.
    expect(salvo?.allowPix).toBe(true);
    expect(Number(salvo?.price)).toBe(150);
  });

  it("recusa forma de pagamento que não seja booleana", async () => {
    const token = await loginAsAdmin();
    const evento = await createTestEvent();

    const resposta = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/batches`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "3º Lote", price: 200, allowCard: "false" },
    });

    // "false" virando true abriria cartão num lote que não deveria ter.
    expect(resposta.statusCode).toBe(422);
  });
});
