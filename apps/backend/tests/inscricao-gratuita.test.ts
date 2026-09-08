import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function eventoGratuito() {
  const evento = await createTestEvent();
  await prisma.eventBatch.create({
    data: {
      eventId: evento.id,
      batchNumber: 1,
      name: "Inscrição gratuita",
      price: 0,
      isActive: true,
    },
  });
  return evento;
}

const inscricao = {
  name: "Maria Aparecida de Souza",
  email: "maria@exemplo.com",
  document: "12345678901",
  phone: "43999990000",
  consentVersion: "1.0",
};

describe("inscrição em evento gratuito", () => {
  it("confirma na hora e cria o participante com QR", async () => {
    // Sem isto a pessoa ficaria PENDING para sempre, esperando um
    // webhook de pagamento que nunca vem — sem QR e sem certificado.
    const evento = await eventoGratuito();

    const res = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: inscricao,
    });

    expect(res.statusCode).toBe(201);
    const d = res.json().data;
    expect(d.status).toBe("CONFIRMED");
    expect(d.gratuita).toBe(true);
    expect(d.paymentUrl).toBeNull();

    const participante = await prisma.participant.findFirst({
      where: { eventId: evento.id, email: inscricao.email },
    });
    expect(participante).not.toBeNull();
    expect(participante!.qrToken).toBeTruthy();
    expect(participante!.status).toBe("ACTIVE");
  });

  it("a pessoa consegue entrar na área do participante logo depois", async () => {
    // É o caminho real: inscreveu, é levada para o QR Code.
    const evento = await eventoGratuito();
    await app.inject({ method: "POST", url: `/events/${evento.id}/inscriptions`, payload: inscricao });

    const login = await app.inject({
      method: "POST",
      url: "/attendee/login",
      payload: { email: inscricao.email },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().data.token).toBeTruthy();
  });

  it("recusa CPF vazio e e-mail inválido", async () => {
    const evento = await eventoGratuito();
    for (const ruim of [{ ...inscricao, document: "" }, { ...inscricao, email: "nao-e-email" }]) {
      const res = await app.inject({
        method: "POST",
        url: `/events/${evento.id}/inscriptions`,
        payload: ruim,
      });
      expect(res.statusCode).toBe(422);
    }
  });

  it("exige o aceite do termo", async () => {
    // LGPD art. 8º, §1º: o registro precisa dizer COM O QUE a pessoa
    // concordou, não só que concordou.
    const evento = await eventoGratuito();
    const { consentVersion, ...semAceite } = inscricao;
    const res = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: semAceite,
    });
    expect(res.statusCode).toBe(422);
  });

  it("evento pago continua exigindo pagamento", async () => {
    // A mudança não pode ter aberto uma porta para confirmar sem pagar.
    const evento = await createTestEvent();
    await prisma.eventBatch.create({
      data: { eventId: evento.id, batchNumber: 1, name: "Lote 1", price: 150, isActive: true },
    });

    const res = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: inscricao,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe("PENDING");

    const participante = await prisma.participant.findFirst({ where: { eventId: evento.id } });
    expect(participante).toBeNull();
  });
});
