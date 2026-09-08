import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();
let token: string;

const artePng = readFileSync(
  new URL("../assets/certificates/semantix-2026-base.png", import.meta.url),
).toString("base64");

const layoutSemantix = {
  nome: { xEsquerda: 142, xDireita: 1047, yBase: 498, alinhamento: "esquerda", fonte: "sem-serifa" },
  paragrafo: null,
  chipData: null,
  assinaturas: null,
  qr: { xEsquerda: 1310, yTopo: 880, tamanho: 120 },
};

beforeEach(async () => {
  await resetDatabase();
  await createTestAdmin("admin@teste.com", "senha-forte-123");
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "admin@teste.com", password: "senha-forte-123" },
  });
  token = res.json().data.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

async function criarModelo(extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/certificate-templates",
    headers: auth(),
    payload: {
      name: "Semantix 2026",
      mimeType: "image/png",
      dataBase64: artePng,
      layout: layoutSemantix,
      ...extra,
    },
  });
}

describe("biblioteca de modelos de certificado", () => {
  it("mede as dimensões do arquivo enviado, e não confia no cliente", async () => {
    // Declarar 1536×1024 e mandar outra imagem poria as coordenadas numa
    // escala que não é a da arte — o nome sairia no lugar errado sem erro.
    const res = await criarModelo();
    expect(res.statusCode).toBe(200);
    const m = res.json().data;
    expect(m.imageWidth).toBe(1536);
    expect(m.imageHeight).toBe(1024);
  });

  it("recusa coordenada fora da arte, com o motivo", async () => {
    const res = await criarModelo({
      layout: { ...layoutSemantix, qr: { xEsquerda: 3000, yTopo: 880, tamanho: 120 } },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(res.json())).toMatch(/fora da arte/i);
  });

  it("recusa arquivo que não é PNG", async () => {
    const res = await criarModelo({ mimeType: "image/jpeg" });
    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(res.json())).toMatch(/PNG/);
  });

  it("recusa apagar um modelo em uso, dizendo quantos eventos usam", async () => {
    // Desvincular em silêncio faria o evento voltar ao modelo do COPOL, e
    // ninguém perceberia até baixar um certificado com a arte errada.
    const modelo = (await criarModelo()).json().data;
    const evento = await createTestEvent();
    await prisma.event.update({
      where: { id: evento.id },
      data: { certificateTemplateId: modelo.id },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/certificate-templates/${modelo.id}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.stringify(res.json())).toMatch(/1 evento/);
  });

  it("apaga um modelo que ninguém usa", async () => {
    const modelo = (await criarModelo()).json().data;
    const res = await app.inject({
      method: "DELETE",
      url: `/certificate-templates/${modelo.id}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
  });

  it("exige autenticação para listar e para criar", async () => {
    expect((await app.inject({ method: "GET", url: "/certificate-templates" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/certificate-templates", payload: {} })).statusCode).toBe(401);
  });

  it("informa quantos eventos usam cada modelo", async () => {
    const modelo = (await criarModelo()).json().data;
    const evento = await createTestEvent();
    await prisma.event.update({ where: { id: evento.id }, data: { certificateTemplateId: modelo.id } });

    const lista = (await app.inject({ method: "GET", url: "/certificate-templates", headers: auth() })).json().data;
    expect(lista[0].eventosUsando).toBe(1);
  });
});
