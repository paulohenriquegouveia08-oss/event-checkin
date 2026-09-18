import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";
import { mercadoPagoClient } from "../src/lib/mercadopago/mercadopago.client.js";
import { ocupaVagaWhere } from "../src/modules/batches/batches.service.js";

/**
 * Geração da cobrança na inscrição.
 *
 * O que estes testes protegem:
 *
 * 1. Com Mercado Pago configurado, a inscrição paga sai com QR Code do Pix
 *    e fica marcada como MERCADO_PAGO — é o que a tela do site exibe.
 * 2. Sem Mercado Pago configurado, o fluxo antigo (PicPay) continua
 *    funcionando. Sem isso, um deploy sem credencial derrubaria a venda.
 * 3. Lote que não aceita Pix não ganha cobrança de Pix. Gerar um Pix num
 *    lote só de cartão seria cobrar pelo canal errado.
 * 4. Evento gratuito não gera cobrança nenhuma e confirma na hora.
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
  name: "Joana Ribeiro Prado",
  email: "joana.prado@teste.com",
  document: "987.654.321-00",
  phone: "(43) 98888-7777",
  consentVersion: "1.0",
};

async function eventoComLote(opcoes: { preco: number; allowPix?: boolean; allowCard?: boolean }) {
  const evento = await createTestEvent();
  await prisma.eventBatch.create({
    data: {
      eventId: evento.id,
      batchNumber: 1,
      name: "1º Lote",
      price: opcoes.preco,
      isActive: true,
      allowPix: opcoes.allowPix ?? true,
      allowCard: opcoes.allowCard ?? false,
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

/** Liga o Mercado Pago sem token real: o cliente é stub nos dois pontos. */
function ligarMercadoPago() {
  vi.spyOn(mercadoPagoClient, "configurado", "get").mockReturnValue(true);
  return vi.spyOn(mercadoPagoClient, "createPixPayment").mockResolvedValue({
    paymentId: "mp-pagamento-1",
    status: "pending",
    qrCodeContent: "00020126580014BR.GOV.BCB.PIX-COPOL",
    qrCodeBase64: "iVBORw0KGgoAAAANSUhEUg==",
    paymentUrl: "https://www.mercadopago.com.br/pix/mp-pagamento-1",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}

describe.sequential("Cobrança da inscrição", () => {
  it("gera Pix pelo Mercado Pago quando há credencial e o lote aceita Pix", async () => {
    const criar = ligarMercadoPago();
    const evento = await eventoComLote({ preco: 100 });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    const dados = resposta.json().data;
    expect(dados.status).toBe("PENDING");
    expect(dados.qrCodeContent).toContain("BR.GOV.BCB.PIX");
    expect(dados.qrCodeBase64).toBeTruthy();

    // O valor cobrado é o do lote, e a referência é a própria inscrição —
    // é por ela que o webhook sabe quem confirmar.
    expect(criar).toHaveBeenCalledTimes(1);
    const args = criar.mock.calls[0][0];
    expect(args.amount).toBe(100);
    expect(args.referenceId).toBe(dados.id);

    const registro = await prisma.inscription.findUnique({ where: { id: dados.id } });
    expect(registro?.paymentProvider).toBe("MERCADO_PAGO");
    expect(registro?.paymentMethod).toBe("PIX");
    expect(registro?.paymentId).toBe("mp-pagamento-1");
    expect(registro?.paymentExpiresAt).not.toBeNull();
  });

  it("sem credencial do Mercado Pago, mantém o fluxo antigo (PicPay)", async () => {
    const criarMP = vi.spyOn(mercadoPagoClient, "createPixPayment");
    const evento = await eventoComLote({ preco: 150 });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    expect(criarMP).not.toHaveBeenCalled();

    const registro = await prisma.inscription.findUnique({ where: { id: resposta.json().data.id } });
    expect(registro?.paymentProvider).toBe("PICPAY");
    expect(registro?.status).toBe("PENDING");
  });

  it("lote que não aceita Pix não recebe cobrança de Pix", async () => {
    const criar = ligarMercadoPago();
    const evento = await eventoComLote({ preco: 150, allowPix: false, allowCard: false });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    expect(criar).not.toHaveBeenCalled();

    const dados = resposta.json().data;
    expect(dados.qrCodeContent).toBeNull();

    const registro = await prisma.inscription.findUnique({ where: { id: dados.id } });
    expect(registro?.status).toBe("PENDING");
    expect(registro?.paymentProvider).toBeNull();
  });

  it("Pix vencido cancela a inscrição na consulta e libera a vaga do lote", async () => {
    ligarMercadoPago();
    const evento = await eventoComLote({ preco: 100 });
    const criada = await inscrever(evento.id);
    const id = criada.json().data.id as string;

    const lote = await prisma.eventBatch.findFirstOrThrow({ where: { eventId: evento.id } });
    const ocupadaAntes = await prisma.inscription.count({ where: ocupaVagaWhere(lote.id) });
    expect(ocupadaAntes).toBe(1);

    // Vence a cobrança: é o que o Mercado Pago faz sozinho aos 30 minutos.
    await prisma.inscription.update({
      where: { id },
      data: { paymentExpiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const status = await app.inject({ method: "GET", url: `/inscriptions/${id}/payment-status` });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.status).toBe("CANCELLED");

    const registro = await prisma.inscription.findUnique({ where: { id } });
    expect(registro?.status).toBe("CANCELLED");
    expect(registro?.participantId).toBeNull();

    const ocupadaDepois = await prisma.inscription.count({ where: ocupaVagaWhere(lote.id) });
    expect(ocupadaDepois).toBe(0);
  });

  it("Pix dentro do prazo continua pendente", async () => {
    ligarMercadoPago();
    const evento = await eventoComLote({ preco: 100 });
    const criada = await inscrever(evento.id);
    const id = criada.json().data.id as string;

    const status = await app.inject({ method: "GET", url: `/inscriptions/${id}/payment-status` });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.status).toBe("PENDING");
  });

  it("evento gratuito não gera cobrança e confirma na hora", async () => {
    const criar = ligarMercadoPago();
    const evento = await eventoComLote({ preco: 0 });

    const resposta = await inscrever(evento.id);
    expect(resposta.statusCode).toBe(201);

    expect(criar).not.toHaveBeenCalled();

    const dados = resposta.json().data;
    expect(dados.status).toBe("CONFIRMED");
    expect(dados.paymentUrl).toBeNull();

    const registro = await prisma.inscription.findUnique({ where: { id: dados.id } });
    expect(registro?.participantId).not.toBeNull();
  });
});
