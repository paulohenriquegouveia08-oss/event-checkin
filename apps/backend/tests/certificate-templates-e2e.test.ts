import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createEndedTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();
let token: string;

const artePng = readFileSync(
  new URL("../assets/certificates/semantix-2026-base.png", import.meta.url),
).toString("base64");

beforeEach(async () => {
  await resetDatabase();
  await createTestAdmin("admin@teste.com", "senha-forte-123");
  token = (
    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@teste.com", password: "senha-forte-123" },
    })
  ).json().data.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("ciclo completo: cadastrar modelo, escolher no evento, gerar", () => {
  it("o certificado sai com a arte do modelo escolhido", async () => {
    const auth = { authorization: `Bearer ${token}` };

    // 1. Cadastra o modelo na biblioteca.
    const modelo = (
      await app.inject({
        method: "POST",
        url: "/certificate-templates",
        headers: auth,
        payload: {
          name: "Semantix 2026",
          mimeType: "image/png",
          dataBase64: artePng,
          layout: {
            nome: { xEsquerda: 142, xDireita: 1047, yBase: 498, alinhamento: "esquerda", fonte: "sem-serifa" },
            paragrafo: null,
            chipData: null,
            assinaturas: null,
            qr: { xEsquerda: 1310, yTopo: 880, tamanho: 120 },
          },
        },
      })
    ).json().data;

    expect(modelo.imageWidth).toBe(1536);

    // 2. Escolhe o modelo no evento, pela mesma rota que o painel usa.
    const evento = await createEndedTestEvent();
    const patch = await app.inject({
      method: "PATCH",
      url: `/events/${evento.id}`,
      headers: auth,
      payload: { certificateTemplateId: modelo.id },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.certificateTemplateId).toBe(modelo.id);

    // 3. Gera o PDF de teste — mesmo caminho do certificado real.
    const pdf = await app.inject({
      method: "GET",
      url: `/events/${evento.id}/certificates/preview?name=Maria%20de%20Souza`,
      headers: auth,
    });
    expect(pdf.statusCode).toBe(200);

    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");

    // A arte da Semantix é 1536×1024 (3:2). O PDF sai na proporção da
    // arte, não em A4 — é o que evita esticar a imagem em 6%.
    //
    // Lido com o pdf-lib, e não com regex: o PDF sai comprimido, e o
    // MediaBox não aparece como texto puro.
    const doc = await PDFDocument.load(pdf.rawPayload);
    const { width, height } = doc.getPage(0).getSize();
    expect(width / height).toBeCloseTo(1536 / 1024, 2);
  });

  it("evento sem modelo continua no certificado padrão, em ~A4", async () => {
    const evento = await createEndedTestEvent();
    const pdf = await app.inject({
      method: "GET",
      url: `/events/${evento.id}/certificates/preview?name=Joao`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pdf.statusCode).toBe(200);

    const doc = await PDFDocument.load(pdf.rawPayload);
    const { width, height } = doc.getPage(0).getSize();
    expect(width / height).toBeCloseTo(1491 / 1055, 2);
  });
});
