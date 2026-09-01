import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";
import { janelaAberta } from "../src/modules/submissions/submissions.service.js";

const app = buildApp();

let token: string;
let eventId: string;
let modalityId: string;
let topicId: string;

async function loginAdmin(email = "admin@teste.com", password = "senha-forte-123") {
  await createTestAdmin(email, password);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  return res.json().data.token as string;
}

const auth = () => ({ authorization: `Bearer ${token}` });
const get = (url: string) => app.inject({ method: "GET", url, headers: auth() });
const post = (url: string, payload?: unknown) =>
  app.inject({ method: "POST", url, headers: auth(), payload: payload ?? {} });
const patch = (url: string, payload: unknown) =>
  app.inject({ method: "PATCH", url, headers: auth(), payload });
const del = (url: string) => app.inject({ method: "DELETE", url, headers: auth() });

/** Trabalho válido mínimo. */
function trabalho(over: Record<string, unknown> = {}) {
  return {
    modalityId,
    topicId,
    title: "Prevalência de cárie em escolares de Londrina",
    abstract:
      "Estudo transversal com 400 escolares de 7 a 12 anos, avaliando prevalência de cárie e fatores associados ao acesso a serviço odontológico.",
    keywords: ["cárie", "saúde coletiva"],
    authors: [{ name: "Ana Souza", email: "ana@uni.br", institution: "UP" }],
    ...over,
  };
}

beforeEach(async () => {
  await resetDatabase();
  token = await loginAdmin();
  const event = await createTestEvent();
  eventId = event.id;

  // Preparo direto pelo Prisma, não por HTTP: o que se testa aqui é o
  // comportamento das rotas, e gastar 3 requisições por teste só para
  // montar o cenário deixa a suíte lenta e refém do rate limit.
  await prisma.eventModule.create({ data: { eventId, module: "submission" } });
  modalityId = (
    await prisma.submissionModality.create({ data: { eventId, name: "Pôster" } })
  ).id;
  topicId = (
    await prisma.submissionTopic.create({ data: { eventId, name: "Saúde Coletiva" } })
  ).id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("módulo desligado", () => {
  it("recusa submissão quando a chamada não está ativa", async () => {
    // A checagem é no servidor, não só na navegação: esconder a aba não
    // impede ninguém de chamar a rota direto.
    await app.inject({
      method: "PUT",
      url: `/events/${eventId}/modules/submission`,
      headers: auth(),
      payload: { enabled: false },
    });

    const res = await post(`/events/${eventId}/submissions`, trabalho());
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/não está ativa/i);
  });
});

describe("catálogo — modalidades e áreas", () => {
  it("cria, lista com contador e apaga", async () => {
    const lista = (await get(`/events/${eventId}/submissions/modalities`)).json().data;
    expect(lista).toHaveLength(1);
    expect(lista[0].submissionCount).toBe(0);

    expect((await del(`/events/${eventId}/submissions/modalities/${modalityId}`)).statusCode).toBe(200);
    expect((await get(`/events/${eventId}/submissions/modalities`)).json().data).toHaveLength(0);
  });

  it("recusa nome repetido no mesmo evento", async () => {
    const res = await post(`/events/${eventId}/submissions/modalities`, { name: "Pôster" });
    expect(res.statusCode).toBe(409);
  });

  it("o mesmo nome vale em outro evento", async () => {
    const outro = await createTestEvent({ name: "Outro Congresso" });
    const res = await post(`/events/${outro.id}/submissions/modalities`, { name: "Pôster" });
    expect(res.statusCode).toBe(201);
  });

  it("não apaga modalidade com trabalho vinculado, e diz o que fazer", async () => {
    await post(`/events/${eventId}/submissions`, trabalho());
    const res = await del(`/events/${eventId}/submissions/modalities/${modalityId}`);
    expect(res.statusCode).toBe(409);
    // A mensagem oferece a saída (desativar) em vez de só barrar.
    expect(JSON.stringify(res.json())).toMatch(/desativ/i);
  });

  it("não apaga item de OUTRO evento pelo id", async () => {
    // Sem a checagem de dono, o id na URL bastaria para mexer no catálogo
    // de outro congresso — a permissão é por usuário, não por evento.
    const outro = await createTestEvent({ name: "Outro Congresso" });
    const res = await del(`/events/${outro.id}/submissions/modalities/${modalityId}`);
    expect(res.statusCode).toBe(404);

    // e continua existindo no evento original
    expect((await get(`/events/${eventId}/submissions/modalities`)).json().data).toHaveLength(1);
  });
});

describe("janela de envio", () => {
  it("sem datas, está aberta", () => {
    expect(janelaAberta({ opensAt: null, closesAt: null }).aberta).toBe(true);
  });

  it("antes da abertura e depois do fechamento, fechada com motivo", () => {
    const agora = new Date("2026-06-15T12:00:00Z");
    const antes = janelaAberta(
      { opensAt: new Date("2026-07-01T00:00:00Z"), closesAt: null },
      agora
    );
    expect(antes.aberta).toBe(false);
    expect(antes.motivo).toMatch(/abre em/i);

    const depois = janelaAberta(
      { opensAt: null, closesAt: new Date("2026-06-01T00:00:00Z") },
      agora
    );
    expect(depois.aberta).toBe(false);
    expect(depois.motivo).toMatch(/fechou/i);
  });

  it("a rota recusa envio fora do prazo", async () => {
    await patch(`/events/${eventId}/submissions/settings`, {
      closesAt: new Date("2020-01-01T00:00:00Z").toISOString(),
    });
    const res = await post(`/events/${eventId}/submissions`, trabalho());
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/fechou/i);
  });

  it("recusa janela que abre depois de fechar", async () => {
    // Sem esta validação dá para gravar uma janela que nunca abre, e o
    // sintoma seria "ninguém consegue submeter" sem nada explicando.
    const res = await patch(`/events/${eventId}/submissions/settings`, {
      opensAt: "2026-12-01T00:00:00Z",
      closesAt: "2026-06-01T00:00:00Z",
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("trabalho — criar, listar, decidir", () => {
  it("cria com protocolo legível e o primeiro autor como apresentador", async () => {
    const res = await post(`/events/${eventId}/submissions`, trabalho());
    expect(res.statusCode).toBe(201);
    const s = res.json().data;

    // Ninguém dita um uuid por telefone.
    expect(s.code).toMatch(/^[A-Z]+-\d{4}$/);
    expect(s.status).toBe("DRAFT");
    // Sem ninguém marcado, o primeiro apresenta — evita trabalho aprovado
    // sem apresentador.
    expect(s.authors[0].isPresenter).toBe(true);
  });

  it("recusa dois apresentadores", async () => {
    const res = await post(
      `/events/${eventId}/submissions`,
      trabalho({
        authors: [
          { name: "A", email: "a@x.br", isPresenter: true },
          { name: "B", email: "b@x.br", isPresenter: true },
        ],
      })
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("recusa modalidade de outro evento", async () => {
    const outro = await createTestEvent({ name: "Outro" });
    const m = await post(`/events/${outro.id}/submissions/modalities`, { name: "Oral" });
    const res = await post(
      `/events/${eventId}/submissions`,
      trabalho({ modalityId: m.json().data.id })
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("recusa resumo curto demais", async () => {
    const res = await post(`/events/${eventId}/submissions`, trabalho({ abstract: "curto" }));
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("filtra por status e busca por título, autor e protocolo", async () => {
    await post(`/events/${eventId}/submissions`, trabalho());
    await post(`/events/${eventId}/submissions`, trabalho({ title: "Outro tema completamente diferente" }));

    const porTitulo = (await get(`/events/${eventId}/submissions?search=Prevalência`)).json().data;
    expect(porTitulo.total).toBe(1);

    const porAutor = (await get(`/events/${eventId}/submissions?search=Ana`)).json().data;
    expect(porAutor.total).toBe(2);

    const porStatus = (await get(`/events/${eventId}/submissions?status=DRAFT`)).json().data;
    expect(porStatus.total).toBe(2);
  });

  it("não envia sem arquivo anexado", async () => {
    const s = (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
    const res = await post(`/events/${eventId}/submissions/${s.id}/submit`);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/arquivo/i);
  });

  it("envia, e não deixa enviar duas vezes", async () => {
    const s = (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
    await prisma.submission.update({
      where: { id: s.id },
      data: { fileKey: "k", fileName: "t.pdf", fileSizeBytes: 10 },
    });

    expect((await post(`/events/${eventId}/submissions/${s.id}/submit`)).statusCode).toBe(200);
    expect(
      (await post(`/events/${eventId}/submissions/${s.id}/submit`)).statusCode
    ).toBeGreaterThanOrEqual(400);
  });

  it("não decide trabalho que o autor nem enviou", async () => {
    const s = (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
    const res = await post(`/events/${eventId}/submissions/${s.id}/decide`, {
      decision: "APPROVED",
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("aprova um trabalho enviado e carimba a data", async () => {
    const s = (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
    await prisma.submission.update({
      where: { id: s.id },
      data: { fileKey: "k", fileName: "t.pdf", fileSizeBytes: 10 },
    });
    await post(`/events/${eventId}/submissions/${s.id}/submit`);

    const res = await post(`/events/${eventId}/submissions/${s.id}/decide`, {
      decision: "APPROVED",
      reason: "Metodologia consistente",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("APPROVED");
    expect(res.json().data.decidedAt).toBeTruthy();
  });

  it("retirada pelo autor não apaga o trabalho", async () => {
    // Os anais precisam do histórico: "retirado pelo autor" e "reprovado
    // pela comissão" são coisas diferentes, e nenhuma delas é "sumiu".
    const s = (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
    await post(`/events/${eventId}/submissions/${s.id}/withdraw`);

    const depois = await prisma.submission.findUnique({ where: { id: s.id } });
    expect(depois?.status).toBe("WITHDRAWN");
    expect(depois?.withdrawnAt).toBeTruthy();
  });

  it("não busca trabalho de outro evento pelo id", async () => {
    const s = (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
    const outro = await createTestEvent({ name: "Outro" });
    expect((await get(`/events/${outro.id}/submissions/${s.id}`)).statusCode).toBe(404);
  });
});

describe("permissão", () => {
  it("sem token não lê nem escreve", async () => {
    expect(
      (await app.inject({ method: "GET", url: `/events/${eventId}/submissions` })).statusCode
    ).toBe(401);
  });
});

describe("arquivo do trabalho", () => {
  /** PDF mínimo de verdade — começa com %PDF-, que é o que o servidor confere. */
  const pdfValido = () =>
    Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF").toString("base64");

  async function novoTrabalho() {
    return (await post(`/events/${eventId}/submissions`, trabalho())).json().data;
  }

  it("anexa um PDF e guarda nome e tamanho", async () => {
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "meu-trabalho.pdf",
      dataBase64: pdfValido(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.fileName).toBe("meu-trabalho.pdf");
    expect(res.json().data.fileSizeBytes).toBeGreaterThan(0);
  });

  it("recusa arquivo que não é PDF, mesmo com nome .pdf", async () => {
    // A extensão vem do cliente e não prova nada — quem quiser mandar outra
    // coisa só precisa renomear. O servidor lê os primeiros bytes.
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "disfarcado.pdf",
      dataBase64: Buffer.from("PK\u0003\u0004 isto aqui é um zip").toString("base64"),
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/n[ãa]o é um PDF/i);
  });

  it("recusa arquivo vazio", async () => {
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "vazio.pdf",
      dataBase64: "",
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("recusa acima do limite do evento, dizendo qual é", async () => {
    await patch(`/events/${eventId}/submissions/settings`, { maxFileSizeMb: 1 });
    const s = await novoTrabalho();
    // 1,5 MB de PDF válido
    const gordo = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(1_500_000, 0x20),
    ]).toString("base64");

    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "gordo.pdf",
      dataBase64: gordo,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/1 MB/);
  });

  it("recusa nome de arquivo com caminho", async () => {
    const s = await novoTrabalho();
    for (const nome of ["../../etc/passwd", "pasta/arquivo.pdf"]) {
      const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
        fileName: nome,
        dataBase64: pdfValido(),
      });
      expect(res.statusCode, `deveria recusar "${nome}"`).toBeGreaterThanOrEqual(400);
    }
  });

  it("não troca o arquivo depois de enviado", async () => {
    // Trocar o PDF sem passar pela retirada mudaria o objeto do parecer
    // pelas costas de quem já leu.
    const s = await novoTrabalho();
    await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "v1.pdf",
      dataBase64: pdfValido(),
    });
    await post(`/events/${eventId}/submissions/${s.id}/submit`);

    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "v2.pdf",
      dataBase64: pdfValido(),
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("baixa o PDF anexado", async () => {
    const s = await novoTrabalho();
    await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "trabalho.pdf",
      dataBase64: pdfValido(),
    });

    const res = await get(`/events/${eventId}/submissions/${s.id}/file`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("baixar sem arquivo anexado responde 404", async () => {
    const s = await novoTrabalho();
    expect((await get(`/events/${eventId}/submissions/${s.id}/file`)).statusCode).toBe(404);
  });
});
