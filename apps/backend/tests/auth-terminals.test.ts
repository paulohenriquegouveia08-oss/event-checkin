import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createActiveTerminalWithToken, createTestAdmin, createTestEvent, createTestParticipant, resetDatabase } from "./helpers.js";

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

describe("GET /health", () => {
  it("responde ok sem exigir autenticação", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("ok");
  });
});

describe("POST /auth/login", () => {
  it("autentica com credenciais válidas", async () => {
    const { user, password } = await createTestAdmin();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: user.email, password },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.token).toBeTruthy();
  });

  it("rejeita senha incorreta sem revelar se o e-mail existe", async () => {
    const { user } = await createTestAdmin();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: user.email, password: "senha-errada" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("E-mail ou senha inválidos");
  });

  it("nunca retorna o hash da senha", async () => {
    const { user, password } = await createTestAdmin();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: user.email, password },
    });
    expect(JSON.stringify(response.json())).not.toContain("passwordHash");
  });
});

describe("Autorização", () => {
  it("bloqueia acesso a endpoints de admin sem token", async () => {
    const response = await app.inject({ method: "GET", url: "/events" });
    expect(response.statusCode).toBe(401);
  });

  it("bloqueia um token de terminal em endpoint de admin", async () => {
    const event = await createTestEvent();
    const { token } = await createActiveTerminalWithToken(app, event.id);
    const response = await app.inject({
      method: "GET",
      url: "/events",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("bloqueia um token de admin em endpoint de terminal", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const adminToken = await loginAsAdmin();

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { qrToken: participant.qrToken },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("POST /events/:eventId/terminals — sequência de identificadores", () => {
  it("continua criando terminais depois de um do meio da sequência ser apagado", async () => {
    // Regressão de um 500 em produção: o identificador vinha de
    // `count + 1`, então apagar um terminal do meio deixava um buraco e
    // o próximo cálculo colidia com um identificador já existente. Como
    // a geração era determinística, todas as tentativas de retry
    // repetiam o mesmo valor e a criação ficava quebrada para sempre.
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();

    const create = (name: string) =>
      app.inject({
        method: "POST",
        url: `/events/${event.id}/terminals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name },
      });

    const first = await create("Terminal 1");
    const second = await create("Terminal 2");
    const third = await create("Terminal 3");
    expect(first.json().data.identifier).toBe("TERM-001");
    expect(second.json().data.identifier).toBe("TERM-002");
    expect(third.json().data.identifier).toBe("TERM-003");

    // Abre o buraco no meio — é isso que quebrava o cálculo antigo.
    await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/terminals/${second.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const fourth = await create("Terminal 4");
    expect(fourth.statusCode).toBe(201);
    // Continua a partir do MAIOR sufixo (003), sem reaproveitar o 002
    // que ficou vago: reciclar identificador faria um terminal novo
    // herdar a identidade de um que foi removido.
    expect(fourth.json().data.identifier).toBe("TERM-004");
  });
});

describe("Ativação de terminal", () => {
  it("troca o código de ativação por um token e invalida o código", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();

    const created = await app.inject({
      method: "POST",
      url: `/events/${event.id}/terminals`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Entrada Principal" },
    });
    expect(created.statusCode).toBe(201);
    const activationCode = created.json().data.activationCode as string;
    expect(activationCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const activated = await app.inject({
      method: "POST",
      url: "/terminals/activate",
      payload: { activationCode },
    });
    expect(activated.statusCode).toBe(200);
    expect(activated.json().data.token).toBeTruthy();
    expect(activated.json().data.event.id).toBe(event.id);

    // O mesmo código não pode ser usado uma segunda vez.
    const reused = await app.inject({
      method: "POST",
      url: "/terminals/activate",
      payload: { activationCode },
    });
    expect(reused.statusCode).toBe(401);
  });

  it("rejeita código de ativação inexistente", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/terminals/activate",
      payload: { activationCode: "AAAA-BBBB" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("recusa a credencial de um terminal desativado", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const { terminal, token } = await createActiveTerminalWithToken(app, event.id);

    await prisma.terminal.update({ where: { id: terminal.id }, data: { status: "INACTIVE" } });

    const response = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("DELETE /events/:eventId/terminals/:terminalId", () => {
  it("exclui o terminal e o token dele passa a ser rejeitado (401)", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();
    const { terminal, token } = await createActiveTerminalWithToken(app, event.id);

    const del = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/terminals/${terminal.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(204);

    const listAfter = await app.inject({
      method: "GET",
      url: `/events/${event.id}/terminals`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listAfter.json().data).toHaveLength(0);

    // O app do terminal usa exatamente essa resposta (401) pra se
    // desconectar sozinho — ver apps/mobile/src/services/api/client.ts.
    const syncAttempt = await app.inject({
      method: "GET",
      url: "/terminals/sync/participants",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(syncAttempt.statusCode).toBe(401);
  });

  it("preserva o histórico de check-ins já feitos pelo terminal excluído", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const { terminal, token } = await createActiveTerminalWithToken(app, event.id);

    await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { qrToken: participant.qrToken },
    });

    await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/terminals/${terminal.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const checkIn = await prisma.checkIn.findFirst({ where: { participantId: participant.id } });
    expect(checkIn).not.toBeNull();
    expect(checkIn?.terminalId).toBeNull();

    const stats = await app.inject({
      method: "GET",
      url: `/events/${event.id}/statistics`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(stats.json().data.totalCheckedIn).toBe(1);
  });

  it("retorna 404 ao excluir um terminal que não existe", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();

    const response = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/terminals/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("DELETE /events/:eventId/participants/:participantId", () => {
  it("exclui o participante", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);

    const del = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/participants/${participant.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(204);

    const found = await prisma.participant.findUnique({ where: { id: participant.id } });
    expect(found).toBeNull();
  });

  it("retorna 404 ao excluir um participante que não existe", async () => {
    const adminToken = await loginAsAdmin();
    const event = await createTestEvent();

    const response = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/participants/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it("exige autenticação de admin", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const response = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/participants/${participant.id}`,
    });
    expect(response.statusCode).toBe(401);
  });
});
