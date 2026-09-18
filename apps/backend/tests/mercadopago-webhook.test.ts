import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";
import { mercadoPagoClient } from "../src/lib/mercadopago/mercadopago.client.js";

/**
 * Webhook do Mercado Pago.
 *
 * O que estes testes protegem, em ordem de gravidade:
 *
 * 1. Notificação forjada NÃO confirma inscrição (a assinatura barra antes
 *    de qualquer consulta).
 * 2. Pagamento menor que o preço do lote NÃO confirma — senão alguém cria
 *    um pagamento de R$ 0,01 com a nossa referência e entra no congresso.
 * 3. Reentrega da mesma notificação NÃO duplica participante. O Mercado
 *    Pago reenvia até receber 200, e duplicar aqui significa duas
 *    credenciais para um pagamento só.
 * 4. O teste do painel do Mercado Pago (data.id "123456", pagamento que
 *    não existe) responde 200 — responder erro faz o reenvio nunca parar.
 */

// Precisa ser o MESMO valor definido em tests/setup.ts: o env.ts congela
// as variáveis no import, então definir aqui não teria efeito.
const SEGREDO = "segredo-de-teste-do-webhook";

const app = buildApp();

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const inscricao = {
  name: "Maria Aparecida Souza",
  email: "maria.souza@teste.com",
  document: "123.456.789-00",
  phone: "(43) 99999-8888",
  consentVersion: "1.0",
};

/** Cria evento com lote pago e devolve a inscrição pendente. */
async function inscricaoPendente(preco = 100) {
  const evento = await createTestEvent();
  await prisma.eventBatch.create({
    data: { eventId: evento.id, batchNumber: 1, name: "Lote 1", price: preco, isActive: true },
  });

  const resposta = await app.inject({
    method: "POST",
    url: `/events/${evento.id}/inscriptions`,
    payload: inscricao,
  });

  expect(resposta.statusCode).toBe(201);
  const dados = resposta.json().data;
  expect(dados.status).toBe("PENDING");

  return { eventoId: evento.id as string, inscricaoId: dados.id as string };
}

function assinar(dataId: string, requestId: string, ts = Math.floor(Date.now() / 1000)) {
  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SEGREDO).update(manifesto).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

/** Notificação como o Mercado Pago envia: id na query e no corpo. */
function notificar(dataId: string) {
  const requestId = `req-${dataId}`;
  return app.inject({
    method: "POST",
    url: `/inscriptions/mercadopago/webhook?data.id=${dataId}&type=payment`,
    headers: {
      "x-request-id": requestId,
      "x-signature": assinar(dataId, requestId),
    },
    payload: {
      action: "payment.updated",
      api_version: "v1",
      data: { id: dataId },
      type: "payment",
      live_mode: false,
    },
  });
}

function pagamentoAprovado(referenceId: string, centavos: number, paymentId = "pag-1") {
  return vi.spyOn(mercadoPagoClient, "conferirPagamento").mockResolvedValue({
    ok: true,
    dados: { aprovado: true, status: "approved", paymentId, centavos, referenceId },
  });
}

describe.sequential("Webhook do Mercado Pago", () => {
  it("recusa notificação com assinatura inválida e não consulta a API", async () => {
    const { inscricaoId } = await inscricaoPendente();
    const espiao = vi.spyOn(mercadoPagoClient, "conferirPagamento");

    const resposta = await app.inject({
      method: "POST",
      url: "/inscriptions/mercadopago/webhook?data.id=999&type=payment",
      headers: { "x-signature": "ts=1,v1=assinatura-falsa", "x-request-id": "req-falso" },
      payload: { type: "payment", data: { id: "999" } },
    });

    expect(resposta.statusCode).toBe(401);
    expect(espiao).not.toHaveBeenCalled();

    const registro = await prisma.inscription.findUnique({ where: { id: inscricaoId } });
    expect(registro?.status).toBe("PENDING");
    expect(registro?.participantId).toBeNull();
  });

  it("responde 200 ao teste do painel (pagamento inexistente)", async () => {
    vi.spyOn(mercadoPagoClient, "conferirPagamento").mockResolvedValue({
      ok: false,
      erro: "pagamento_inexistente",
      definitivo: true,
    });

    const resposta = await notificar("123456");

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ignorado).toBe("pagamento_inexistente");
  });

  it("devolve 500 em falha temporária, para o Mercado Pago reenviar depois", async () => {
    vi.spyOn(mercadoPagoClient, "conferirPagamento").mockResolvedValue({
      ok: false,
      erro: "mp_inacessivel",
    });

    const resposta = await notificar("pag-temporario");

    expect(resposta.statusCode).toBe(500);
    expect(resposta.json().comoResolver).toBeTruthy();
  });

  it("não confirma quando o valor pago é menor que o preço do lote", async () => {
    const { inscricaoId } = await inscricaoPendente(100);
    pagamentoAprovado(inscricaoId, 1, "pag-centavo");

    const resposta = await notificar("pag-centavo");

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ignorado).toBe("valor_insuficiente");

    const registro = await prisma.inscription.findUnique({ where: { id: inscricaoId } });
    expect(registro?.status).toBe("PENDING");
    expect(registro?.participantId).toBeNull();
  });

  it("não confirma pagamento ainda pendente (só approved confirma)", async () => {
    const { inscricaoId } = await inscricaoPendente(100);
    vi.spyOn(mercadoPagoClient, "conferirPagamento").mockResolvedValue({
      ok: true,
      dados: {
        aprovado: false,
        status: "pending",
        paymentId: "pag-pendente",
        centavos: 10000,
        referenceId: inscricaoId,
      },
    });

    const resposta = await notificar("pag-pendente");

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ignorado).toBe("nao_aprovado");

    const registro = await prisma.inscription.findUnique({ where: { id: inscricaoId } });
    expect(registro?.status).toBe("PENDING");
  });

  it("confirma a inscrição, cria o participante com QR e registra o provedor", async () => {
    const { inscricaoId } = await inscricaoPendente(100);
    pagamentoAprovado(inscricaoId, 10000, "pag-aprovado");

    const resposta = await notificar("pag-aprovado");

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().status).toBe("confirmed");

    const registro = await prisma.inscription.findUnique({ where: { id: inscricaoId } });
    expect(registro?.status).toBe("CONFIRMED");
    expect(registro?.participantId).not.toBeNull();
    expect(registro?.paymentProvider).toBe("MERCADO_PAGO");
    expect(registro?.paymentMethod).toBe("PIX");
    expect(registro?.paymentId).toBe("pag-aprovado");

    const participante = await prisma.participant.findUnique({
      where: { id: registro!.participantId! },
    });
    expect(participante?.qrToken).toBeTruthy();
  });

  it("reentrega da mesma notificação não cria um segundo participante", async () => {
    const { eventoId, inscricaoId } = await inscricaoPendente(100);
    pagamentoAprovado(inscricaoId, 10000, "pag-reentrega");

    const primeira = await notificar("pag-reentrega");
    const segunda = await notificar("pag-reentrega");

    expect(primeira.statusCode).toBe(200);
    expect(primeira.json().status).toBe("confirmed");
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json().status).toBe("already_confirmed");

    const participantes = await prisma.participant.count({ where: { eventId: eventoId } });
    expect(participantes).toBe(1);
  });
});
