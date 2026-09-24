import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";
import {
  PREFIXO_REFERENCIA_TRABALHO,
  confirmarPagamentoSubmissao,
  janelaAberta,
} from "../src/modules/submissions/submissions.service.js";

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

/** PDF mínimo de verdade — começa com %PDF-, que é o que o servidor confere. */
const pdfValido = () =>
  Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF").toString("base64");

/** DOCX mínimo pelo que o servidor confere: ZIP (PK\x03\x04) com a pasta word/. */
const docxValido = () =>
  Buffer.from("PK\u0003\u0004....[Content_Types].xml....word/document.xml....").toString("base64");

/** PPTX mínimo pelo que o servidor confere: ZIP (PK\x03\x04) com a pasta ppt/. */
const pptxValido = () =>
  Buffer.from("PK\u0003\u0004....[Content_Types].xml....ppt/presentation.xml....").toString("base64");

describe("arquivo do trabalho", () => {
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

  it("recusa arquivo que não é PDF nem DOCX, mesmo com nome .pdf", async () => {
    // A extensão vem do cliente e não prova nada — quem quiser mandar outra
    // coisa só precisa renomear. O servidor lê os bytes.
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "disfarcado.pdf",
      dataBase64: Buffer.from("PK\u0003\u0004 isto aqui é um zip").toString("base64"),
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/PDF, DOCX/i);
  });

  it("anexa um DOCX e baixa como documento do Word", async () => {
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "meu-trabalho.docx",
      dataBase64: docxValido(),
    });
    expect(res.statusCode).toBe(200);

    const baixado = await get(`/events/${eventId}/submissions/${s.id}/file`);
    expect(baixado.statusCode).toBe(200);
    expect(baixado.headers["content-type"]).toMatch(/wordprocessingml/);
    // DOCX o navegador não abre: vai como download.
    expect(baixado.headers["content-disposition"]).toMatch(/^attachment/);
  });

  it("anexa um PPTX e baixa como apresentação do PowerPoint", async () => {
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "apresentacao.pptx",
      dataBase64: pptxValido(),
    });
    expect(res.statusCode).toBe(200);

    const baixado = await get(`/events/${eventId}/submissions/${s.id}/file`);
    expect(baixado.headers["content-type"]).toMatch(/presentationml/);
    expect(baixado.headers["content-disposition"]).toMatch(/^attachment/);
  });

  it("recusa planilha do Excel (ZIP do Office sem a pasta word/)", async () => {
    const s = await novoTrabalho();
    const res = await post(`/events/${eventId}/submissions/${s.id}/file`, {
      fileName: "planilha.docx",
      dataBase64: Buffer.from("PK\u0003\u0004....xl/workbook.xml....").toString("base64"),
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
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

describe("envio público pelo site, com taxa no Mercado Pago", () => {
  /** Sem token: é o próprio autor, pelo site do evento. */
  const postPublico = (url: string, payload?: unknown) =>
    app.inject({ method: "POST", url, payload: payload ?? {} });
  const getPublico = (url: string) => app.inject({ method: "GET", url });

  const envio = (over: Record<string, unknown> = {}) => ({
    ...trabalho(),
    fileName: "trabalho.pdf",
    dataBase64: pdfValido(),
    ...over,
  });

  async function ligarTaxa(valor = 10) {
    await patch(`/events/${eventId}/submissions/settings`, {
      authorFeeRequired: true,
      authorFeeAmount: valor,
    });
  }

  it("a configuração pública mostra catálogo, taxa e se está aberta", async () => {
    await ligarTaxa();
    const res = await getPublico(`/public/events/${eventId}/submissions/config`);
    expect(res.statusCode).toBe(200);
    const cfg = res.json().data;
    expect(cfg.aberta).toBe(true);
    expect(cfg.feeAmount).toBe(10);
    expect(cfg.modalities).toHaveLength(1);
    expect(cfg.topics).toHaveLength(1);
  });

  it("sem taxa, o trabalho entra direto na fila da comissão", async () => {
    const res = await postPublico(`/public/events/${eventId}/submissions`, envio());
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe("SUBMITTED");
    expect(res.json().data.paymentStatus).toBe("NOT_REQUIRED");
  });

  it("com taxa, gera o Pix e segura o trabalho até pagar", async () => {
    await ligarTaxa();
    const res = await postPublico(
      `/public/events/${eventId}/submissions`,
      envio({ fileName: "trabalho.docx", dataBase64: docxValido() })
    );
    expect(res.statusCode).toBe(201);
    const s = res.json().data;
    expect(s.status).toBe("DRAFT");
    expect(s.paymentStatus).toBe("PENDING");
    expect(s.feeAmount).toBe(10);
    expect(s.qrCodeContent).toBeTruthy();
    expect(s.paymentUrl).toBeTruthy();
  });

  it("pagamento aprovado envia para a comissão, e reentrega não muda nada", async () => {
    await ligarTaxa();
    const s = (await postPublico(`/public/events/${eventId}/submissions`, envio())).json().data;

    const pagamento = {
      aprovado: true,
      status: "approved",
      paymentId: "123",
      tipo: "bank_transfer",
      centavos: 1000,
      referenceId: `${PREFIXO_REFERENCIA_TRABALHO}${s.id}`,
    };
    expect((await confirmarPagamentoSubmissao(pagamento)).ok).toBe(true);

    const depois = (await getPublico(`/public/submissions/${s.id}`)).json().data;
    expect(depois.paymentStatus).toBe("PAID");
    expect(depois.status).toBe("SUBMITTED");

    // O Mercado Pago reenvia a notificação — a segunda não pode mudar nada.
    const segunda = await confirmarPagamentoSubmissao(pagamento);
    expect(segunda.ok).toBe(true);
    expect(segunda.motivo).toBe("ja_pago");
  });

  it("a comissão aprova e recusa o trabalho pago pelo painel", async () => {
    await ligarTaxa();
    const a = (await postPublico(`/public/events/${eventId}/submissions`, envio())).json().data;
    const b = (await postPublico(`/public/events/${eventId}/submissions`, envio())).json().data;
    for (const s of [a, b]) {
      await confirmarPagamentoSubmissao({
        aprovado: true,
        status: "approved",
        paymentId: `p-${s.id}`,
        tipo: "credit_card",
        centavos: 1000,
        referenceId: `${PREFIXO_REFERENCIA_TRABALHO}${s.id}`,
      });
    }

    const aprovado = await post(`/events/${eventId}/submissions/${a.id}/decide`, { decision: "APPROVED" });
    const recusado = await post(`/events/${eventId}/submissions/${b.id}/decide`, { decision: "REJECTED" });
    expect(aprovado.json().data.status).toBe("APPROVED");
    expect(recusado.json().data.status).toBe("REJECTED");

    // Pago no cartão fica registrado como cartão — o relatório separa.
    const lido = await prisma.submission.findUnique({ where: { id: a.id } });
    expect(lido?.paymentMethod).toBe("CARD");
  });

  it("recusa arquivo que não é PDF nem DOCX e não deixa trabalho para trás", async () => {
    const res = await postPublico(
      `/public/events/${eventId}/submissions`,
      envio({ fileName: "foto.pdf", dataBase64: Buffer.from("GIF89a....").toString("base64") })
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(await prisma.submission.count({ where: { eventId } })).toBe(0);
  });

  /** Manda o arquivo em partes, como o site faz com arquivo grande. */
  async function enviarEmPartes(base64: string, tamanho = 8) {
    const uploadId = randomUUID();
    const total = Math.ceil(base64.length / tamanho);
    for (let index = 0; index < total; index++) {
      const res = await postPublico(`/public/events/${eventId}/submissions/parts`, {
        uploadId,
        index,
        total,
        dataBase64: base64.slice(index * tamanho, (index + 1) * tamanho),
      });
      expect(res.statusCode).toBe(200);
    }
    return uploadId;
  }

  it("arquivo em partes chega inteiro", async () => {
    // O proxy HTTPS na frente da API recusa corpo acima de 1 MB: arquivo
    // grande vai em partes e o envio só aponta para elas.
    const original = pdfValido();
    const uploadId = await enviarEmPartes(original);
    const { dataBase64: _, ...semArquivo } = envio();

    const res = await postPublico(`/public/events/${eventId}/submissions`, {
      ...semArquivo,
      uploadId,
    });
    expect(res.statusCode).toBe(201);

    const s = res.json().data;
    const baixado = await get(`/events/${eventId}/submissions/${s.id}/file`);
    expect(baixado.rawPayload.toString("base64")).toBe(original);
  });

  it("partes incompletas não viram trabalho", async () => {
    const uploadId = randomUUID();
    await postPublico(`/public/events/${eventId}/submissions/parts`, {
      uploadId,
      index: 0,
      total: 2,
      dataBase64: pdfValido().slice(0, 8),
    });
    const { dataBase64: _, ...semArquivo } = envio();

    const res = await postPublico(`/public/events/${eventId}/submissions`, {
      ...semArquivo,
      uploadId,
    });
    expect(res.statusCode).toBe(422);
    expect(await prisma.submission.count({ where: { eventId } })).toBe(0);
  });

  it("parte fora de ordem é recusada", async () => {
    const res = await postPublico(`/public/events/${eventId}/submissions/parts`, {
      uploadId: randomUUID(),
      index: 1,
      total: 2,
      dataBase64: pdfValido().slice(0, 8),
    });
    expect(res.statusCode).toBe(422);
  });

  it("evento sem catálogo aceita o trabalho sem modalidade nem área", async () => {
    await prisma.submissionModality.deleteMany({ where: { eventId } });
    await prisma.submissionTopic.deleteMany({ where: { eventId } });

    const res = await postPublico(
      `/public/events/${eventId}/submissions`,
      envio({ modalityId: undefined, topicId: undefined })
    );
    expect(res.statusCode).toBe(201);
  });

  it("evento com catálogo exige a escolha", async () => {
    const res = await postPublico(
      `/public/events/${eventId}/submissions`,
      envio({ modalityId: undefined })
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).toMatch(/modalidade/i);
  });

  it("recusa envio público com a chamada desligada", async () => {
    await prisma.eventModule.deleteMany({ where: { eventId, module: "submission" } });
    const res = await postPublico(`/public/events/${eventId}/submissions`, envio());
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("a consulta pública não expõe e-mail de autor", async () => {
    const s = (await postPublico(`/public/events/${eventId}/submissions`, envio())).json().data;
    const res = await getPublico(`/public/submissions/${s.id}`);
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json())).not.toMatch(/ana@uni\.br/);
  });
});
