import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

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

function inscriptionPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Maria Teste",
    email: "maria@teste.com",
    document: "123.456.789-00",
    category: "STUDENT_UP",
    ...overrides,
  };
}

describe("POST /events/:eventId/inscriptions", () => {
  it("cria inscrição usando a categoria/valor padrão quando o evento não tem siteContent configurado", async () => {
    const event = await createTestEvent();
    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json().data;
    expect(body.category).toBe("STUDENT_UP");
    expect(body.amount).toBe(30);
  });

  it("rejeita categoria que não existe pros tiers configurados do evento", async () => {
    const event = await createTestEvent();
    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload({ category: "CATEGORIA_INEXISTENTE" }),
    });

    expect(response.statusCode).toBe(422);
  });

  it("usa o valor configurado em siteContent.pricingTiers quando o evento tem conteúdo customizado", async () => {
    const event = await createTestEvent();
    await prisma.event.update({
      where: { id: event.id },
      data: {
        siteContent: {
          pricingTiers: [{ key: "VIP", label: "Convidado VIP", amount: 199.9 }],
        },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload({ category: "VIP" }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.amount).toBe(199.9);
  });

  it("rejeita inscrição quando o evento tem inscrições encerradas manualmente", async () => {
    const event = await createTestEvent();
    await prisma.event.update({ where: { id: event.id }, data: { registrationsClosedAt: new Date() } });

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejeita inscrição quando o prazo de inscrição (registrationDeadline) já passou", async () => {
    const event = await createTestEvent();
    await prisma.event.update({
      where: { id: event.id },
      data: { registrationDeadline: new Date("2020-01-01T00:00:00Z") },
    });

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });

    expect(response.statusCode).toBe(403);
  });

  it("aceita inscrição normalmente quando o prazo ainda não passou", async () => {
    const event = await createTestEvent();
    await prisma.event.update({
      where: { id: event.id },
      data: { registrationDeadline: new Date("2099-01-01T00:00:00Z") },
    });

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });

    expect(response.statusCode).toBe(201);
  });
});

describe("POST /events/:eventId/registrations/close e /reopen", () => {
  it("encerra e depois reabre as inscrições, refletindo em registrationsOpen", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();

    const closeResponse = await app.inject({
      method: "POST",
      url: `/events/${event.id}/registrations/close`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().data.registrationsOpen).toBe(false);

    const blockedInscription = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });
    expect(blockedInscription.statusCode).toBe(403);

    const reopenResponse = await app.inject({
      method: "POST",
      url: `/events/${event.id}/registrations/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reopenResponse.statusCode).toBe(200);
    expect(reopenResponse.json().data.registrationsOpen).toBe(true);

    const allowedInscription = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });
    expect(allowedInscription.statusCode).toBe(201);
  });

  it("reabre inscrições fechadas só pelo prazo (sem fechamento manual), limpando o prazo vencido", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();
    await prisma.event.update({
      where: { id: event.id },
      data: { registrationDeadline: new Date("2020-01-01T00:00:00Z") },
    });

    const blocked = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });
    expect(blocked.statusCode).toBe(403);

    const reopenResponse = await app.inject({
      method: "POST",
      url: `/events/${event.id}/registrations/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reopenResponse.statusCode).toBe(200);
    const reopened = reopenResponse.json().data;
    expect(reopened.registrationsOpen).toBe(true);
    expect(reopened.registrationDeadline).toBeNull();

    const allowed = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions`,
      payload: inscriptionPayload(),
    });
    expect(allowed.statusCode).toBe(201);
  });

  it("preserva um prazo futuro ao reabrir (não precisa limpar o que ainda não venceu)", async () => {
    const event = await createTestEvent();
    const token = await loginAsAdmin();
    const futureDeadline = new Date("2099-01-01T00:00:00Z");
    await prisma.event.update({
      where: { id: event.id },
      data: { registrationsClosedAt: new Date(), registrationDeadline: futureDeadline },
    });

    const reopenResponse = await app.inject({
      method: "POST",
      url: `/events/${event.id}/registrations/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reopenResponse.statusCode).toBe(200);
    const reopened = reopenResponse.json().data;
    expect(reopened.registrationsOpen).toBe(true);
    expect(new Date(reopened.registrationDeadline).getTime()).toBe(futureDeadline.getTime());
  });

  it("exige autenticação de admin", async () => {
    const event = await createTestEvent();
    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/registrations/close`,
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /events/:eventId/public", () => {
  it("inclui registrationsOpen e siteContent resolvido com os defaults", async () => {
    const event = await createTestEvent();
    const response = await app.inject({ method: "GET", url: `/events/${event.id}/public` });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.registrationsOpen).toBe(true);
    expect(body.siteContent.pricingTiers).toHaveLength(3);
    expect(body.siteContent.aboutText).toBeTruthy();
  });
});
