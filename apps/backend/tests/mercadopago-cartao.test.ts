import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";
import { mercadoPagoClient } from "../src/lib/mercadopago/mercadopago.client.js";

/**
 * Cobrança no cartão (Checkout Pro) — o 2º lote do COPOL.
 *
 * O que estes testes protegem:
 *
 * 1. Lote de cartão gera a página do Mercado Pago, e não um Pix. Gerar Pix
 *    num lote que o admin fechou para cartão desfaz a decisão dele.
 * 2. A inscrição fica marcada como CARD — é isso que o relatório do admin lê.
 * 3. Sem credencial, o lote de cartão não gera cobrança nenhuma: melhor
 *    PENDING visível no painel do que uma cobrança pelo canal errado.
 * 4. Lote que aceita os dois continua no Pix, que é o caminho barato e
 *    confirma em segundos.
 */

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
  name: "Marcos Vinícius Leal",
  email: "marcos.leal@teste.com",
  document: "321.654.987-00",
  phone: "(43) 96666-5555",
  consentVersion: "1.0",
};

async function eventoComLote(opcoes: { preco: number; allowPix: boolean; allowCard: boolean }) {
  const evento = await createTestEvent();
  await prisma.eventBatch.create({
    data: {
      eventId: evento.id,
      batchNumber: 1,
      name: "2º Lote",
      price: opcoes.preco,
      isActive: true,
      allowPix: opcoes.allowPix,
      allowCard: opcoes.allowCard,
    },
  });
  return evento;
}

function inscrever(eventId: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/inscriptions`,
    payload: inscricao,
  });
}

function ligarMercadoPago() {
  vi.spyOn(mercadoPagoClient, "configurado", "get").mockReturnValue(true);
  const cartao = vi.spyOn(mercadoPagoClient, "createCardCheckout").mockResolvedValue({
    preferenceId: "pref-123",
    checkoutUrl: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  const pix = vi.spyOn(mercadoPagoClient, "createPixPayment").mockResolvedValue({
    paymentId: "mp-pagamento-1",
    status: "pending",
    qrCodeContent: "00020126580014BR.GOV.BCB.PIX-COPOL",
    qrCodeBase64: "iVBORw0KGgoAAAANSUhEUg==",
    paymentUrl: "https://www.mercadopago.com.br/pix/mp-pagamento-1",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  return { cartao, pix };
}

describe.sequential("Cobrança no cartão", () => {
  it("lote só de cartão gera a página do Mercado Pago, não um Pix", async () => {
    const { cartao, pix } = ligarMercadoPago();
    const evento = await eventoComLote({ preco: 150, allowPix: false, allowCard: true });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    expect(pix).not.toHaveBeenCalled();
    expect(cartao).toHaveBeenCalledTimes(1);

    const args = cartao.mock.calls[0][0];
    expect(args.amount).toBe(150);
    expect(args.referenceId).toBe(resposta.json().data.id);
    // É por esta URL que a pessoa volta para a tela de acompanhamento.
    expect(args.returnUrl).toContain(resposta.json().data.id);

    const dados = resposta.json().data;
    expect(dados.paymentUrl).toContain("mercadopago.com.br");
    expect(dados.qrCodeContent).toBeNull();

    const registro = await prisma.inscription.findUnique({ where: { id: dados.id } });
    expect(registro?.paymentProvider).toBe("MERCADO_PAGO");
    expect(registro?.paymentMethod).toBe("CARD");
    expect(registro?.status).toBe("PENDING");
    // O id da preferência não é id de pagamento: guardá-lo aqui faria a
    // consulta de status procurar um pagamento que não existe.
    expect(registro?.paymentId).toBeNull();
  });

  it("sem credencial do Mercado Pago, lote de cartão não gera cobrança", async () => {
    const cartao = vi.spyOn(mercadoPagoClient, "createCardCheckout");
    const evento = await eventoComLote({ preco: 150, allowPix: false, allowCard: true });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    expect(cartao).not.toHaveBeenCalled();

    const registro = await prisma.inscription.findUnique({ where: { id: resposta.json().data.id } });
    expect(registro?.status).toBe("PENDING");
    expect(registro?.paymentProvider).toBeNull();
    expect(registro?.paymentUrl).toBeNull();
  });

  it("lote que aceita Pix e cartão cobra no Pix", async () => {
    const { cartao, pix } = ligarMercadoPago();
    const evento = await eventoComLote({ preco: 150, allowPix: true, allowCard: true });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    expect(cartao).not.toHaveBeenCalled();
    expect(pix).toHaveBeenCalledTimes(1);

    const registro = await prisma.inscription.findUnique({ where: { id: resposta.json().data.id } });
    expect(registro?.paymentMethod).toBe("PIX");
  });

  it("webhook com pagamento no cartão registra a forma como CARD", async () => {
    ligarMercadoPago();
    const evento = await eventoComLote({ preco: 150, allowPix: false, allowCard: true });
    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);
    const { id: inscricaoId } = resposta.json().data;

    vi.spyOn(mercadoPagoClient, "conferirPagamento").mockResolvedValue({
      ok: true,
      dados: {
        aprovado: true,
        status: "approved",
        paymentId: "pag-cartao-1",
        centavos: 15000,
        referenceId: inscricaoId,
        tipo: "credit_card",
      },
    });

    const SEGREDO = "segredo-de-teste-do-webhook";
    const requestId = "req-cartao-1";
    const ts = Math.floor(Date.now() / 1000);
    const manifesto = `id:pag-cartao-1;request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", SEGREDO).update(manifesto).digest("hex");

    const webhookRes = await app.inject({
      method: "POST",
      url: "/inscriptions/mercadopago/webhook?data.id=pag-cartao-1&type=payment",
      headers: {
        "x-request-id": requestId,
        "x-signature": `ts=${ts},v1=${v1}`,
      },
      payload: {
        action: "payment.updated",
        api_version: "v1",
        data: { id: "pag-cartao-1" },
        type: "payment",
        live_mode: false,
      },
    });

    expect(webhookRes.statusCode).toBe(200);
    expect(webhookRes.json().status).toBe("confirmed");

    const registro = await prisma.inscription.findUnique({ where: { id: inscricaoId } });
    expect(registro?.status).toBe("CONFIRMED");
    expect(registro?.paymentProvider).toBe("MERCADO_PAGO");
    expect(registro?.paymentMethod).toBe("CARD");
    expect(registro?.paymentId).toBe("pag-cartao-1");
  });
});
