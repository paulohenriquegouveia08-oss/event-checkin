import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createTestEvent,
  createTestRole,
  createTestUserWithRole,
  resetDatabase,
} from "./helpers.js";

/**
 * Conta restrita a eventos (User.allowedEventIds): o perfil decide O QUE
 * a pessoa faz; a lista de eventos decide EM QUAL evento. Caso real:
 * organizador externo que só acompanha inscritos, participantes e
 * trabalhos do próprio congresso.
 */

const app = buildApp();

let copolId: string;
let outroId: string;
let token: string;

async function login(email: string, password: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().data as { token: string; user: { allowedEventIds: string[] } };
}

const get = (url: string) =>
  app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });

beforeEach(async () => {
  await resetDatabase();
  copolId = (await createTestEvent({ name: "COPOL" })).id;
  outroId = (await createTestEvent({ name: "Outro Evento" })).id;

  const role = await createTestRole("Acompanhamento", [
    "events.view",
    "participants.view",
    "submissions.view",
  ]);
  const { user, password } = await createTestUserWithRole(role.id, "restrito@teste.com");
  await prisma.user.update({ where: { id: user.id }, data: { allowedEventIds: [copolId] } });

  const sessao = await login("restrito@teste.com", password);
  token = sessao.token;
  expect(sessao.user.allowedEventIds).toEqual([copolId]);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("conta restrita a eventos", () => {
  it("a lista de eventos mostra só os permitidos", async () => {
    const res = await get("/events");
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((e: { id: string }) => e.id);
    expect(ids).toEqual([copolId]);
  });

  it("vê o próprio evento", async () => {
    expect((await get(`/events/${copolId}`)).statusCode).toBe(200);
    expect((await get(`/events/${copolId}/participants`)).statusCode).toBe(200);
  });

  it("recusa qualquer rota de outro evento, mesmo tendo a permissão", async () => {
    for (const url of [
      `/events/${outroId}`,
      `/events/${outroId}/participants`,
      `/events/${outroId}/submissions`,
    ]) {
      const res = await get(url);
      expect(res.statusCode, url).toBe(403);
    }
  });

  it("continua limitado pelo perfil: não edita o próprio evento", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/events/${copolId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Outro nome" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("usuário sem restrição continua vendo todos os eventos", async () => {
    const role = await createTestRole("Leitura geral", ["events.view"]);
    const { password } = await createTestUserWithRole(role.id, "geral@teste.com");
    token = (await login("geral@teste.com", password)).token;

    const ids = (await get("/events")).json().data.map((e: { id: string }) => e.id);
    expect(ids).toEqual(expect.arrayContaining([copolId, outroId]));
  });
});
