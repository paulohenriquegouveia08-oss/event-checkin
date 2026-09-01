import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

let token: string;
let eventId: string;

// `createTestAdmin` cria o usuário mas não emite token — o login é uma
// chamada à parte, como nos outros testes deste diretório.
async function loginAdmin(email = "admin@teste.com", password = "senha-forte-123") {
  await createTestAdmin(email, password);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  return res.json().data.token as string;
}

beforeEach(async () => {
  await resetDatabase();
  token = await loginAdmin();
  const event = await createTestEvent();
  eventId = event.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

function auth() {
  return { authorization: `Bearer ${token}` };
}

async function get(path: string) {
  return app.inject({ method: "GET", url: path, headers: auth() });
}
async function patch(path: string, payload: unknown) {
  return app.inject({ method: "PATCH", url: path, headers: auth(), payload });
}
async function put(path: string, payload: unknown) {
  return app.inject({ method: "PUT", url: path, headers: auth(), payload });
}

describe("configuração do evento — padrões", () => {
  it("evento novo nasce privado, sem endereço e sem módulo nenhum", async () => {
    // Isto é o contrato da migração: aplicar não muda o comportamento de
    // nenhum evento que já existia. Se algum dia um módulo passar a vir
    // ligado por padrão, este teste falha e obriga a decisão a ser
    // consciente.
    const res = await get(`/events/${eventId}/config`);
    expect(res.statusCode).toBe(200);
    const cfg = res.json().data;

    expect(cfg.visibility).toBe("PRIVATE");
    expect(cfg.slug).toBeNull();
    expect(cfg.timezone).toBe("America/Sao_Paulo");
    expect(cfg.modules.every((m: { enabled: boolean }) => !m.enabled)).toBe(true);
  });

  it("lista todos os módulos do catálogo, mesmo os desligados", async () => {
    // Sem isso o organizador nunca descobre que existe um módulo novo.
    const cfg = (await get(`/events/${eventId}/config`)).json().data;
    const chaves = cfg.modules.map((m: { key: string }) => m.key);
    expect(chaves).toContain("submission");
    expect(chaves).toContain("checkin");
    expect(chaves.length).toBeGreaterThanOrEqual(6);
  });
});

describe("endereço público (slug)", () => {
  it("aceita um slug válido e devolve na leitura", async () => {
    const res = await patch(`/events/${eventId}/config`, { slug: "copol-2026" });
    expect(res.statusCode).toBe(200);
    expect((await get(`/events/${eventId}/config`)).json().data.slug).toBe(
      "copol-2026"
    );
  });

  it("normaliza maiúsculas e espaços nas bordas", async () => {
    await patch(`/events/${eventId}/config`, { slug: "  COPOL-2026  " });
    expect((await get(`/events/${eventId}/config`)).json().data.slug).toBe(
      "copol-2026"
    );
  });

  it("recusa formato que não cabe numa URL", async () => {
    for (const ruim of ["com espaço", "acentuação", "-começa", "termina-", "a", "du--plo"]) {
      const res = await patch(`/events/${eventId}/config`, { slug: ruim });
      expect(res.statusCode, `deveria recusar "${ruim}"`).toBeGreaterThanOrEqual(400);
    }
  });

  it("recusa palavra reservada pelo sistema", async () => {
    // "admin" viraria /e/admin e brigaria com a própria aplicação.
    const res = await patch(`/events/${eventId}/config`, { slug: "admin" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("recusa slug já usado por outro evento, dizendo o motivo", async () => {
    await patch(`/events/${eventId}/config`, { slug: "copol-2026" });
    const outro = await createTestEvent({ name: "Outro" });

    const res = await patch(`/events/${outro.id}/config`, { slug: "copol-2026" });
    expect(res.statusCode).toBe(409);
    // A mensagem precisa nomear o conflito — "erro ao salvar" faria a
    // pessoa tentar o mesmo valor de novo.
    expect(JSON.stringify(res.json())).toMatch(/já está em uso/i);
  });

  it("permite limpar o endereço", async () => {
    await patch(`/events/${eventId}/config`, { slug: "copol-2026" });
    await patch(`/events/${eventId}/config`, { slug: null });
    expect((await get(`/events/${eventId}/config`)).json().data.slug).toBeNull();
  });
});

describe("fuso horário", () => {
  it("aceita um fuso IANA de verdade", async () => {
    const res = await patch(`/events/${eventId}/config`, {
      timezone: "America/Manaus",
    });
    expect(res.statusCode).toBe(200);
  });

  it("recusa fuso que não existe", async () => {
    // A validação pergunta ao Intl do runtime, não a uma lista nossa —
    // que envelheceria a cada atualização da IANA.
    const res = await patch(`/events/${eventId}/config`, {
      timezone: "Marte/Olympus",
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("módulos — ligar e desligar", () => {
  it("liga e desliga um módulo sem dependência", async () => {
    await put(`/events/${eventId}/modules/checkin`, { enabled: true });
    let cfg = (await get(`/events/${eventId}/config`)).json().data;
    expect(cfg.modules.find((m: { key: string }) => m.key === "checkin").enabled).toBe(true);

    await put(`/events/${eventId}/modules/checkin`, { enabled: false });
    cfg = (await get(`/events/${eventId}/config`)).json().data;
    expect(cfg.modules.find((m: { key: string }) => m.key === "checkin").enabled).toBe(false);
  });

  it("ligar duas vezes não duplica nem quebra", async () => {
    await put(`/events/${eventId}/modules/checkin`, { enabled: true });
    const res = await put(`/events/${eventId}/modules/checkin`, { enabled: true });
    expect(res.statusCode).toBe(200);
    expect(
      await prisma.eventModule.count({ where: { eventId, module: "checkin" } })
    ).toBe(1);
  });

  it("recusa Avaliação sem Submissão, dizendo o que falta", async () => {
    // Pareceres sobre trabalhos que não existem seria uma tela vazia que
    // ninguém entende.
    const res = await put(`/events/${eventId}/modules/review`, { enabled: true });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/Submiss/i);
  });

  it("desligar Submissão desliga Avaliação junto, e avisa", async () => {
    await put(`/events/${eventId}/modules/submission`, { enabled: true });
    await put(`/events/${eventId}/modules/review`, { enabled: true });

    const res = await put(`/events/${eventId}/modules/submission`, { enabled: false });
    expect(res.statusCode).toBe(200);
    // O aviso importa: ver Avaliação sumir sozinha pareceria defeito.
    expect(res.json().data.alsoDisabled).toContain("review");

    const cfg = (await get(`/events/${eventId}/config`)).json().data;
    expect(cfg.modules.find((m: { key: string }) => m.key === "review").enabled).toBe(false);
  });

  it("recusa módulo que não existe no catálogo", async () => {
    const res = await put(`/events/${eventId}/modules/telepatia`, { enabled: true });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("guarda quem ligou o módulo", async () => {
    await put(`/events/${eventId}/modules/checkin`, { enabled: true });
    const linha = await prisma.eventModule.findUnique({
      where: { eventId_module: { eventId, module: "checkin" } },
    });
    expect(linha?.enabledBy).toBeTruthy();
  });
});

describe("desligar não apaga dado", () => {
  it("participantes sobrevivem a desligar e religar o credenciamento", async () => {
    // A garantia mais importante deste módulo. Desligar é reversível; se
    // não fosse, um clique errado custaria um mês de cadastros.
    await prisma.participant.create({
      data: { eventId, name: "Fulano", qrToken: `tok-${Date.now()}` },
    });

    await put(`/events/${eventId}/modules/checkin`, { enabled: true });
    await put(`/events/${eventId}/modules/checkin`, { enabled: false });
    await put(`/events/${eventId}/modules/checkin`, { enabled: true });

    expect(await prisma.participant.count({ where: { eventId } })).toBe(1);
  });
});

describe("permissão", () => {
  it("sem autenticação não lê nem escreve", async () => {
    const semAuth = await app.inject({
      method: "GET",
      url: `/events/${eventId}/config`,
    });
    expect(semAuth.statusCode).toBe(401);
  });

  it("evento inexistente responde 404, não 500", async () => {
    const res = await get(
      "/events/00000000-0000-0000-0000-000000000000/config"
    );
    expect(res.statusCode).toBe(404);
  });
});
