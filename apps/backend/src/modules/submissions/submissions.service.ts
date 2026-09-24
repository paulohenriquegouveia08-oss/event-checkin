import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import {
  certificateStorage,
  submissionFileKey,
} from "../certificates/certificate-storage.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { isModuleEnabled } from "../event-config/event-config.service.js";
import {
  mercadoPagoClient,
  type PagamentoConferido,
} from "../../lib/mercadopago/mercadopago.client.js";
import { receberParte, retirarArquivo } from "./submissions.parts.js";
import { emailService } from "../../lib/email/email.service.js";
import { resolveEmailSettings } from "../../lib/email/email-settings.js";
import type {
  CreateSubmissionInput,
  PublicCreateSubmissionInput,
  PublicUploadPartInput,
  SubmissionSettingsInput,
} from "./submissions.schema.js";

/**
 * Chamada de trabalhos: catálogo (modalidades e áreas), janela de envio e
 * os trabalhos em si.
 */

async function eventOrThrow(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError("Evento não encontrado");
  return event;
}

/**
 * Recusa qualquer operação de submissão num evento que não ligou o módulo.
 *
 * A verificação é aqui, no servidor, e não só na navegação do painel:
 * esconder uma aba não impede ninguém de chamar a rota direto, e um evento
 * que nunca abriu chamada não deve conseguir receber trabalho por acidente.
 */
async function requireModule(eventId: string) {
  if (!(await isModuleEnabled(eventId, "submission"))) {
    throw new ValidationError(
      "A chamada de trabalhos não está ativa neste evento."
    );
  }
}

// ─── Configuração da chamada ────────────────────────────────────────────

export async function getSettings(eventId: string) {
  await eventOrThrow(eventId);
  const s = await prisma.submissionSettings.findUnique({ where: { eventId } });

  // Devolve os padrões em vez de null: a tela precisa mostrar algo, e
  // "ainda não configurado" e "configurado com os padrões" produzem
  // exatamente o mesmo comportamento.
  return (
    s ?? {
      eventId,
      opensAt: null,
      closesAt: null,
      authorFeeRequired: false,
      authorFeeAmount: null,
      maxFileSizeMb: 10,
      minReviewsToDecide: 2,
    }
  );
}

export async function updateSettings(
  eventId: string,
  input: SubmissionSettingsInput
) {
  await eventOrThrow(eventId);
  return prisma.submissionSettings.upsert({
    where: { eventId },
    create: { eventId, ...input },
    update: input,
  });
}

/**
 * A chamada está aberta agora?
 *
 * Datas nulas não limitam: sem `opensAt` já está aberta, sem `closesAt`
 * nunca fecha sozinha. É o comportamento menos surpreendente para quem
 * ainda não configurou nada.
 */
export function janelaAberta(
  settings: { opensAt: Date | null; closesAt: Date | null },
  agora = new Date()
): { aberta: boolean; motivo?: string } {
  if (settings.opensAt && agora < settings.opensAt) {
    return {
      aberta: false,
      motivo: `A chamada abre em ${settings.opensAt.toLocaleString("pt-BR")}.`,
    };
  }
  if (settings.closesAt && agora > settings.closesAt) {
    return {
      aberta: false,
      motivo: `A chamada fechou em ${settings.closesAt.toLocaleString("pt-BR")}.`,
    };
  }
  return { aberta: true };
}

// ─── Catálogo: modalidades e áreas ──────────────────────────────────────

export async function listModalities(eventId: string) {
  await eventOrThrow(eventId);
  const rows = await prisma.submissionModality.findMany({
    where: { eventId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { submissions: true } } },
  });
  // O contador que o organizador vê ao lado de cada modalidade. Vem de
  // _count e não de uma coluna: coluna denormalizada aqui só criaria uma
  // segunda verdade para manter em sincronia.
  return rows.map(({ _count, ...m }) => ({ ...m, submissionCount: _count.submissions }));
}

export async function listTopics(eventId: string) {
  await eventOrThrow(eventId);
  const rows = await prisma.submissionTopic.findMany({
    where: { eventId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { submissions: true } } },
  });
  return rows.map(({ _count, ...t }) => ({ ...t, submissionCount: _count.submissions }));
}

async function criarNoCatalogo<T>(
  fn: () => Promise<T>,
  oQue: "modalidade" | "área temática"
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      throw new ConflictError(
        "duplicate_name",
        `Já existe uma ${oQue} com esse nome neste evento.`
      );
    }
    throw err;
  }
}

export async function createModality(
  eventId: string,
  input: { name: string; description?: string | null; position?: number }
) {
  await eventOrThrow(eventId);
  return criarNoCatalogo(
    () => prisma.submissionModality.create({ data: { eventId, ...input } }),
    "modalidade"
  );
}

export async function createTopic(
  eventId: string,
  input: { name: string; position?: number }
) {
  await eventOrThrow(eventId);
  return criarNoCatalogo(
    () => prisma.submissionTopic.create({ data: { eventId, ...input } }),
    "área temática"
  );
}

/**
 * Apagar item do catálogo.
 *
 * Com trabalho vinculado, o banco recusa (onDelete: Restrict) e a mensagem
 * diz o que fazer. As alternativas seriam apagar os trabalhos junto ou
 * deixá-los sem classificação — as duas perdem informação que ninguém
 * pediu para perder. Desativar (`active: false`) existe justamente para
 * tirar da lista sem apagar nada.
 */
async function apagarDoCatalogo(
  pertenceAoEvento: () => Promise<boolean>,
  apagar: () => Promise<unknown>,
  contar: () => Promise<number>,
  oQue: string
) {
  // O item precisa ser DESTE evento. Sem esta checagem, o id na URL bastaria
  // para apagar a modalidade de outro congresso — a permissão é por usuário,
  // não por evento, então quem organiza um evento poderia mexer no de outro.
  if (!(await pertenceAoEvento())) {
    throw new NotFoundError(`Essa ${oQue} não existe neste evento`);
  }

  const usados = await contar();
  if (usados > 0) {
    throw new ConflictError(
      "in_use",
      `Esta ${oQue} tem ${usados} trabalho(s) vinculado(s). ` +
        `Mova-os para outra antes de apagar, ou desative-a para tirá-la da lista sem perder nada.`
    );
  }
  await apagar();
}

export async function deleteModality(eventId: string, id: string) {
  await apagarDoCatalogo(
    async () =>
      !!(await prisma.submissionModality.findFirst({ where: { id, eventId } })),
    () => prisma.submissionModality.delete({ where: { id } }),
    () => prisma.submission.count({ where: { modalityId: id } }),
    "modalidade"
  );
}

export async function deleteTopic(eventId: string, id: string) {
  await apagarDoCatalogo(
    async () =>
      !!(await prisma.submissionTopic.findFirst({ where: { id, eventId } })),
    () => prisma.submissionTopic.delete({ where: { id } }),
    () => prisma.submission.count({ where: { topicId: id } }),
    "área temática"
  );
}

// ─── Trabalhos ──────────────────────────────────────────────────────────

/**
 * Protocolo curto e legível: COPOL-0042.
 *
 * Deriva do nome do evento e da contagem, porque o autor precisa citar o
 * trabalho por telefone e num e-mail — ninguém dita um uuid. A colisão é
 * tratada por tentativa: a coluna é única, então dois envios simultâneos
 * fazem um deles repetir com o número seguinte em vez de gravar duplicado.
 */
async function gerarCodigo(eventId: string, eventName: string): Promise<string> {
  const prefixo =
    eventName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 6)
      .toUpperCase() || "TRAB";

  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const total = await prisma.submission.count({ where: { eventId } });
    const codigo = `${prefixo}-${String(total + 1 + tentativa).padStart(4, "0")}`;
    const existe = await prisma.submission.findUnique({ where: { code: codigo } });
    if (!existe) return codigo;
  }
  // Depois de 10 tentativas, cai para algo garantidamente único em vez de
  // recusar a submissão do autor por um problema nosso de numeração.
  return `${prefixo}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Modalidade e área: obrigatórias SE o evento tem catálogo, proibidas se
 * não tem.
 *
 * Evento que nunca cadastrou modalidade/área ainda recebe trabalho pelo
 * site — antes, sem catálogo, ninguém conseguia enviar nada e a tela não
 * dizia por quê. Com catálogo, a escolha volta a ser exigida, porque é
 * ela que manda o trabalho para o parecerista certo.
 *
 * E o item escolhido precisa ser DESTE evento: sem essa checagem daria
 * para classificar um trabalho com a modalidade de outro congresso
 * passando o id na mão.
 */
async function validarCatalogo(
  eventId: string,
  modalityId: string | null,
  topicId: string | null,
): Promise<{ modalityId: string | null; topicId: string | null }> {
  const [temModalidade, temArea] = await Promise.all([
    prisma.submissionModality.count({ where: { eventId, active: true } }),
    prisma.submissionTopic.count({ where: { eventId, active: true } }),
  ]);

  let modalidadeFinal: string | null = null;
  if (temModalidade > 0) {
    if (!modalityId) throw new ValidationError("Escolha a modalidade do trabalho");
    const m = await prisma.submissionModality.findFirst({ where: { id: modalityId, eventId } });
    if (!m) throw new ValidationError("Modalidade não encontrada neste evento");
    if (!m.active) throw new ValidationError("Essa modalidade não está aceitando trabalhos");
    modalidadeFinal = m.id;
  }

  let areaFinal: string | null = null;
  if (temArea > 0) {
    if (!topicId) throw new ValidationError("Escolha a área temática do trabalho");
    const t = await prisma.submissionTopic.findFirst({ where: { id: topicId, eventId } });
    if (!t) throw new ValidationError("Área temática não encontrada neste evento");
    if (!t.active) throw new ValidationError("Essa área temática não está aceitando trabalhos");
    areaFinal = t.id;
  }

  return { modalityId: modalidadeFinal, topicId: areaFinal };
}

export async function createSubmission(eventId: string, input: CreateSubmissionInput) {
  const event = await eventOrThrow(eventId);
  await requireModule(eventId);

  const settings = await getSettings(eventId);
  const janela = janelaAberta(settings);
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  const { modalityId, topicId } = await validarCatalogo(
    eventId,
    input.modalityId ?? null,
    input.topicId ?? null,
  );

  const apresentadores = input.authors.filter((a) => a.isPresenter);
  if (apresentadores.length > 1) {
    throw new ValidationError("Marque apenas um autor como apresentador");
  }

  const code = await gerarCodigo(eventId, event.name);

  return prisma.submission.create({
    data: {
      eventId,
      code,
      modalityId,
      topicId,
      title: input.title,
      abstract: input.abstract,
      keywords: input.keywords,
      status: "DRAFT",
      authors: {
        create: input.authors.map((a, i) => ({
          name: a.name,
          email: a.email,
          institution: a.institution ?? null,
          // Sem ninguém marcado, o primeiro da lista apresenta — é a
          // convenção acadêmica, e evita trabalho aprovado sem apresentador.
          isPresenter: a.isPresenter ?? (apresentadores.length === 0 && i === 0),
          position: i,
        })),
      },
    },
    include: { authors: { orderBy: { position: "asc" } }, modality: true, topic: true },
  });
}

export async function getSubmission(eventId: string, submissionId: string) {
  const s = await prisma.submission.findFirst({
    where: { id: submissionId, eventId },
    include: { authors: { orderBy: { position: "asc" } }, modality: true, topic: true },
  });
  if (!s) throw new NotFoundError("Trabalho não encontrado");
  return s;
}

export async function listSubmissions(
  eventId: string,
  q: {
    status?: string;
    modalityId?: string;
    topicId?: string;
    search?: string;
    page: number;
    pageSize: number;
  }
) {
  await eventOrThrow(eventId);

  const where = {
    eventId,
    ...(q.status ? { status: q.status as never } : {}),
    ...(q.modalityId ? { modalityId: q.modalityId } : {}),
    ...(q.topicId ? { topicId: q.topicId } : {}),
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: "insensitive" as const } },
            { code: { contains: q.search, mode: "insensitive" as const } },
            { authors: { some: { name: { contains: q.search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  // O resumo da taxa é do evento inteiro — não muda com o filtro da lista:
  // "quanto os trabalhos já renderam" não depende de quem está sendo buscado.
  const [total, items, pagos, aguardando, liberadosSemPagamento] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        authors: { orderBy: { position: "asc" } },
        modality: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
      },
    }),
    prisma.submission.aggregate({
      where: { eventId, paymentStatus: "PAID" },
      _count: { _all: true },
      _sum: { feeAmount: true },
    }),
    // Pix gerado e ainda não pago. Os liberados pela comissão também ficam
    // PENDING (o Pix continua valendo), mas já saíram do rascunho.
    prisma.submission.aggregate({
      where: { eventId, paymentStatus: "PENDING", status: "DRAFT" },
      _count: { _all: true },
      _sum: { feeAmount: true },
    }),
    prisma.submission.count({
      where: { eventId, paymentStatus: "PENDING", status: { not: "DRAFT" } },
    }),
  ]);

  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    items,
    resumo: {
      pagos: pagos._count._all,
      receita: Number(pagos._sum.feeAmount ?? 0),
      aguardando: aguardando._count._all,
      aguardandoValor: Number(aguardando._sum.feeAmount ?? 0),
      liberadosSemPagamento,
    },
  };
}

/** O autor envia de vez: sai de DRAFT e entra na fila da comissão. */
export async function submitSubmission(eventId: string, submissionId: string) {
  const s = await getSubmission(eventId, submissionId);
  if (s.status !== "DRAFT") {
    throw new ValidationError("Este trabalho já foi enviado");
  }
  if (!s.fileKey) {
    throw new ValidationError("Anexe o arquivo do trabalho antes de enviar");
  }

  const janela = janelaAberta(await getSettings(eventId));
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  const atualizado = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  void notificarEnvioDeTrabalho(submissionId);

  return atualizado;
}

/** Retirada pelo autor. Não apaga — os anais precisam do histórico. */
export async function withdrawSubmission(eventId: string, submissionId: string) {
  const s = await getSubmission(eventId, submissionId);
  if (s.status === "APPROVED") {
    throw new ValidationError(
      "Trabalho já aprovado. Fale com a comissão para retirá-lo."
    );
  }
  return prisma.submission.update({
    where: { id: submissionId },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });
}

export async function decideSubmission(
  eventId: string,
  submissionId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string
) {
  const s = await getSubmission(eventId, submissionId);
  if (s.status === "DRAFT") {
    throw new ValidationError("Este trabalho ainda não foi enviado pelo autor");
  }
  if (s.status === "WITHDRAWN") {
    throw new ValidationError("O autor retirou este trabalho");
  }
  // Clique repetido na mesma decisão: nada muda, e ninguém recebe o
  // mesmo e-mail duas vezes.
  if (s.status === decision) {
    return { ...s, autoresAvisados: 0, falhasNoAviso: 0 };
  }

  const atualizado = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: decision, decidedAt: new Date() },
  });

  const aviso = await avisarAutores(eventId, s, decision, reason);
  return { ...atualizado, autoresAvisados: aviso.enviados, falhasNoAviso: aviso.falhas };
}

/**
 * Manda o resultado a cada autor, um e-mail por endereço.
 *
 * Falha no envio não desfaz a decisão: a comissão decidiu, e o painel
 * mostra quantos avisos não saíram para alguém avisar por outro meio.
 */
async function avisarAutores(
  eventId: string,
  s: { id: string; code: string; title: string; authors: { name: string; email: string }[] },
  decision: "APPROVED" | "REJECTED",
  reason?: string,
): Promise<{ enviados: number; falhas: number }> {
  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, location: true, emailSettings: true },
  });
  if (!evento) return { enviados: 0, falhas: 0 };

  const vistos = new Set<string>();
  const autores = s.authors.filter((a) => {
    const email = a.email.trim().toLowerCase();
    if (!email || vistos.has(email)) return false;
    vistos.add(email);
    return true;
  });

  const resultados = await Promise.allSettled(
    autores.map((a) =>
      emailService.sendSubmissionDecision(evento, {
        to: a.email.trim(),
        authorName: a.name,
        submissionId: s.id,
        code: s.code,
        title: s.title,
        decision,
        reason,
      })
    )
  );
  const enviados = resultados.filter((r) => r.status === "fulfilled" && r.value.success).length;
  if (enviados < autores.length) {
    console.error(`[Submissions] ${autores.length - enviados} aviso(s) de decisão não saíram para ${s.code}`);
  }
  return { enviados, falhas: autores.length - enviados };
}

// ─── Arquivo do trabalho ────────────────────────────────────────────────

type TipoArquivo = "pdf" | "docx" | "pptx";

const FORMATO_INVALIDO =
  "Envie o trabalho em PDF, DOCX (Word) ou PPTX (PowerPoint). Arquivos .doc e .ppt antigos precisam ser salvos como .docx, .pptx ou PDF antes.";

const CONTENT_TYPE: Record<TipoArquivo, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * O que o arquivo É, pelos bytes — não pelo nome.
 *
 * A extensão e o tipo declarado vêm do cliente e não provam nada: quem
 * quiser mandar outra coisa só precisa renomear. Ler o conteúdo é o que
 * de fato responde "isto abre?", e evita que a comissão baixe um arquivo
 * que não abre depois de a chamada já ter fechado.
 *
 * - PDF começa com `%PDF-`.
 * - DOCX é um ZIP (`PK\x03\x04`) com a pasta `word/` dentro; PPTX é o
 *   mesmo ZIP com `ppt/`. Planilha do Office também é ZIP, mas com `xl/` —
 *   e fica de fora.
 */
function tipoDoArquivo(buffer: Buffer): TipoArquivo | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  const ehZip =
    buffer.length > 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  if (ehZip && buffer.includes("word/", 0, "latin1")) return "docx";
  if (ehZip && buffer.includes("ppt/", 0, "latin1")) return "pptx";
  return null;
}

/**
 * Valida e grava o arquivo de um trabalho. Compartilhado pelo painel
 * (uploadFile) e pelo envio público (createPublicSubmission).
 */
async function gravarArquivo(
  eventId: string,
  submissionId: string,
  fileKeyAtual: string | null,
  buffer: Buffer,
  maxFileSizeMb: number,
) {
  if (buffer.length === 0) throw new ValidationError("Arquivo vazio.");

  const limite = maxFileSizeMb * 1024 * 1024;
  if (buffer.length > limite) {
    throw new ValidationError(
      `Arquivo muito grande — o limite deste evento é ${maxFileSizeMb} MB.`
    );
  }

  const tipo = tipoDoArquivo(buffer);
  if (!tipo) {
    throw new ValidationError(FORMATO_INVALIDO);
  }

  const key = submissionFileKey(eventId, submissionId, tipo);
  await certificateStorage.save(key, buffer);

  // Trocou um PDF por um DOCX (ou o contrário) ainda em rascunho: o
  // arquivo anterior tem outra extensão, então não foi sobrescrito — apaga
  // para não ficar lixo no disco com o trabalho de alguém.
  if (fileKeyAtual && fileKeyAtual !== key) {
    await certificateStorage.remove(fileKeyAtual).catch(() => {});
  }

  return { key, tamanho: buffer.length };
}

export async function uploadFile(
  eventId: string,
  submissionId: string,
  fileName: string,
  dataBase64: string
) {
  const s = await getSubmission(eventId, submissionId);

  // Depois de enviado, o arquivo é o que a comissão vai avaliar. Trocá-lo
  // sem passar pela retirada seria mudar o objeto do parecer pelas costas
  // de quem já leu.
  if (s.status !== "DRAFT") {
    throw new ValidationError(
      "Este trabalho já foi enviado — não é possível trocar o arquivo."
    );
  }

  const settings = await getSettings(eventId);
  const janela = janelaAberta(settings);
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  const { key, tamanho } = await gravarArquivo(
    eventId,
    submissionId,
    s.fileKey,
    Buffer.from(dataBase64, "base64"),
    settings.maxFileSizeMb,
  );

  return prisma.submission.update({
    where: { id: submissionId },
    data: { fileKey: key, fileName, fileSizeBytes: tamanho },
    select: { id: true, fileName: true, fileSizeBytes: true },
  });
}

/** Bytes do arquivo (PDF, DOCX ou PPTX), para a comissão baixar e ler. */
export async function readFile(eventId: string, submissionId: string) {
  const s = await getSubmission(eventId, submissionId);
  if (!s.fileKey) throw new NotFoundError("Este trabalho não tem arquivo anexado");
  const extensao = s.fileKey.slice(s.fileKey.lastIndexOf(".") + 1);
  const tipo: TipoArquivo = extensao === "docx" || extensao === "pptx" ? extensao : "pdf";
  return {
    buffer: await certificateStorage.read(s.fileKey),
    fileName: s.fileName ?? `${s.code}.${tipo}`,
    tipo,
    contentType: CONTENT_TYPE[tipo],
  };
}

// ─── Envio público e taxa de submissão ──────────────────────────────────

/** Pix vale 24 h, igual à inscrição. Venceu, o autor gera outro na página. */
const VALIDADE_DO_PIX_MS = 24 * 60 * 60 * 1000;

/** Prefixo do external_reference no Mercado Pago. Ver handleMercadoPagoWebhook. */
export const PREFIXO_REFERENCIA_TRABALHO = "sub:";

function taxaDoEvento(settings: {
  authorFeeRequired: boolean;
  authorFeeAmount: unknown;
}): number | null {
  if (!settings.authorFeeRequired) return null;
  const valor = Number(settings.authorFeeAmount ?? 0);
  return valor > 0 ? valor : null;
}

/**
 * O que a página pública precisa para montar o formulário: se a chamada
 * está aberta, o catálogo, o limite de tamanho e quanto custa.
 */
export async function getPublicConfig(eventId: string) {
  const event = await eventOrThrow(eventId);
  const moduloAtivo = await isModuleEnabled(eventId, "submission");
  const settings = await getSettings(eventId);
  const janela = moduloAtivo
    ? janelaAberta(settings)
    : { aberta: false, motivo: "A chamada de trabalhos deste evento não está aberta." };

  const [modalities, topics] = await Promise.all([
    prisma.submissionModality.findMany({
      where: { eventId, active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true },
    }),
    prisma.submissionTopic.findMany({
      where: { eventId, active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return {
    eventId: event.id,
    eventName: event.name,
    aberta: janela.aberta,
    motivo: janela.motivo ?? null,
    closesAt: settings.closesAt,
    maxFileSizeMb: settings.maxFileSizeMb,
    feeAmount: taxaDoEvento(settings),
    modalities,
    topics,
  };
}

/**
 * Gera (ou regera) a cobrança da taxa no Mercado Pago — o MESMO Pix e o
 * MESMO link de pagamento da inscrição.
 *
 * O Pix sai sempre; o link do Checkout Pro (cartão) sai junto, como
 * alternativa, igual ao lote híbrido da inscrição. Quem confirma é o
 * webhook de sempre, pelo prefixo `sub:` na referência.
 */
async function iniciarCobranca(
  submission: { id: string; code: string; title: string },
  eventName: string,
  valor: number,
  pagador: { name: string; email: string },
  idempotencyKey?: string,
) {
  const referenceId = `${PREFIXO_REFERENCIA_TRABALHO}${submission.id}`;
  const partes = pagador.name.trim().split(/\s+/);
  const payer = {
    firstName: partes[0] || "Autor",
    lastName: partes.slice(1).join(" ") || "Trabalho",
    // O envio de trabalho não pede CPF: o Pix não exige, e o checkout do
    // cartão pede o documento na própria página do Mercado Pago.
    document: "",
    email: pagador.email,
  };
  const descricao = `${eventName} — Taxa de submissão ${submission.code}`;
  const expiresAt = new Date(Date.now() + VALIDADE_DO_PIX_MS);

  const pix = await mercadoPagoClient.createPixPayment({
    referenceId,
    amount: valor,
    description: descricao,
    expiresAt,
    payer,
    idempotencyKey,
  });

  let paymentUrl = pix.paymentUrl;
  try {
    const checkout = await mercadoPagoClient.createCardCheckout({
      referenceId,
      amount: valor,
      description: descricao,
      expiresAt,
      payer,
      returnUrl: `${env.PRE_COPOL_BASE_URL}/trabalhos/pagamento/?id=${submission.id}`,
      idempotencyKey,
    });
    paymentUrl = checkout.checkoutUrl;
  } catch (err) {
    // O Pix já está de pé — sem o cartão, o autor ainda consegue pagar.
    console.error("[Submissions] Falha ao gerar link de cartão:", err);
  }

  return prisma.submission.update({
    where: { id: submission.id },
    data: {
      paymentStatus: "PENDING",
      feeAmount: valor,
      paymentProvider: "MERCADO_PAGO",
      paymentMethod: "PIX",
      paymentId: pix.paymentId,
      paymentUrl,
      paymentQrCodeContent: pix.qrCodeContent,
      paymentQrCodeBase64: pix.qrCodeBase64,
      // A validade que vale é a que o Mercado Pago devolveu.
      paymentExpiresAt: new Date(pix.expiresAt),
    },
  });
}

/**
 * Envio pelo próprio autor, pelo site do evento.
 *
 * Cria o trabalho, grava o arquivo e, se o evento cobra taxa, gera a
 * cobrança — tudo de uma vez. O trabalho fica em DRAFT até o pagamento
 * ser aprovado; aí o webhook o envia para a comissão. Sem taxa, já entra
 * direto como SUBMITTED.
 *
 * Se a cobrança falhar, o trabalho é apagado: um rascunho com arquivo e
 * sem forma de pagar é um beco sem saída para o autor e lixo para a
 * comissão.
 */
/**
 * Uma parte do arquivo, antes do envio do formulário — ver
 * submissions.parts.ts. Confere módulo e janela já aqui para o autor não
 * subir 10 MB e só então descobrir que a chamada fechou.
 */
export async function receivePublicFilePart(eventId: string, input: PublicUploadPartInput) {
  await eventOrThrow(eventId);
  await requireModule(eventId);
  const settings = await getSettings(eventId);
  const janela = janelaAberta(settings);
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  return receberParte({
    eventId,
    uploadId: input.uploadId,
    index: input.index,
    total: input.total,
    dados: Buffer.from(input.dataBase64, "base64"),
    limiteBytes: settings.maxFileSizeMb * 1024 * 1024,
    limiteMb: settings.maxFileSizeMb,
  });
}

export async function createPublicSubmission(eventId: string, input: PublicCreateSubmissionInput) {
  const event = await eventOrThrow(eventId);
  await requireModule(eventId);

  const settings = await getSettings(eventId);
  const janela = janelaAberta(settings);
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  const { fileName, dataBase64, uploadId, ...dados } = input;

  // Valida o arquivo ANTES de criar qualquer coisa: arquivo errado é o erro
  // mais comum, e ele não pode deixar um trabalho vazio para trás.
  const buffer = uploadId
    ? retirarArquivo(eventId, uploadId)
    : Buffer.from(dataBase64 ?? "", "base64");
  if (!tipoDoArquivo(buffer)) {
    throw new ValidationError(FORMATO_INVALIDO);
  }

  const criado = await createSubmission(eventId, dados);

  try {
    const { key, tamanho } = await gravarArquivo(
      eventId,
      criado.id,
      null,
      buffer,
      settings.maxFileSizeMb,
    );

    const valor = taxaDoEvento(settings);
    await prisma.submission.update({
      where: { id: criado.id },
      data: {
        fileKey: key,
        fileName,
        fileSizeBytes: tamanho,
        ...(valor === null ? { status: "SUBMITTED", submittedAt: new Date() } : {}),
      },
    });

    if (valor !== null) {
      const apresentador = criado.authors.find((a) => a.isPresenter) ?? criado.authors[0];
      await iniciarCobranca(criado, event.name, valor, apresentador);
    } else {
      void notificarEnvioDeTrabalho(criado.id);
    }
  } catch (err) {
    const arquivo = await prisma.submission.findUnique({
      where: { id: criado.id },
      select: { fileKey: true },
    });
    if (arquivo?.fileKey) await certificateStorage.remove(arquivo.fileKey).catch(() => {});
    await prisma.submission.delete({ where: { id: criado.id } }).catch(() => {});
    if (err instanceof ValidationError) throw err;
    console.error("[Submissions] Falha no envio público:", err);
    throw new ValidationError(
      "Não foi possível gerar a cobrança no Mercado Pago. Confira o e-mail do autor e tente de novo."
    );
  }

  return getPublicStatus(criado.id);
}

/**
 * Situação do trabalho para a página de pagamento — sem dados pessoais:
 * o id é um uuid e quem o tem é quem acabou de enviar, mas a página não
 * precisa de e-mail de ninguém para mostrar um QR Code.
 *
 * Se ainda está pendente, confere direto no Mercado Pago: o webhook é o
 * caminho principal, mas se ele atrasar o autor não fica olhando para
 * "aguardando" com o dinheiro já na conta.
 */
export async function getPublicStatus(submissionId: string) {
  let s = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!s) throw new NotFoundError("Trabalho não encontrado");

  if (s.paymentStatus === "PENDING" && s.paymentId && mercadoPagoClient.configurado) {
    try {
      const conferencia = await mercadoPagoClient.conferirPagamento(s.paymentId);
      if (conferencia.ok && conferencia.dados.aprovado) {
        await confirmarPagamentoSubmissao(conferencia.dados);
        s = (await prisma.submission.findUnique({ where: { id: submissionId } })) ?? s;
      }
    } catch {
      // Falha momentânea de rede: a página tenta de novo no próximo ciclo.
    }
  }

  return {
    id: s.id,
    code: s.code,
    title: s.title,
    status: s.status,
    paymentStatus: s.paymentStatus,
    feeAmount: s.feeAmount === null ? null : Number(s.feeAmount),
    paymentUrl: s.paymentUrl,
    qrCodeContent: s.paymentQrCodeContent,
    qrCodeBase64: s.paymentQrCodeBase64,
    paymentExpiresAt: s.paymentExpiresAt,
    paidAt: s.paidAt,
    fileName: s.fileName,
  };
}

/** O Pix venceu sem pagamento: gera outro, com o mesmo valor congelado. */
export async function regeneratePayment(submissionId: string) {
  const s = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { event: true, authors: { orderBy: { position: "asc" } } },
  });
  if (!s) throw new NotFoundError("Trabalho não encontrado");
  if (s.paymentStatus !== "PENDING") {
    throw new ValidationError("Este trabalho não tem cobrança pendente.");
  }
  if (s.status === "WITHDRAWN") {
    throw new ValidationError("Este trabalho foi retirado.");
  }
  if (s.paymentExpiresAt && s.paymentExpiresAt > new Date()) {
    // Ainda vale: devolve a mesma. Gerar outra agora deixaria duas
    // cobranças abertas para o mesmo trabalho.
    return getPublicStatus(s.id);
  }

  const apresentador = s.authors.find((a) => a.isPresenter) ?? s.authors[0];
  await iniciarCobranca(
    s,
    s.event.name,
    Number(s.feeAmount ?? 0),
    apresentador,
    // Chave nova: com a antiga o Mercado Pago devolveria o Pix vencido.
    `${PREFIXO_REFERENCIA_TRABALHO}${s.id}:${Date.now()}`,
  );
  return getPublicStatus(s.id);
}

/**
 * Pagamento aprovado da taxa — chamado pelo webhook do Mercado Pago
 * (inscriptions.service.ts#handleMercadoPagoWebhook) e pela conferência
 * ativa em getPublicStatus.
 *
 * Idempotente: o Mercado Pago reenvia a notificação, e as reentregas se
 * cruzam. Os dois `updateMany` com condição fazem a segunda chegada não
 * mudar nada.
 *
 * O VALOR PAGO PRECISA COBRIR A TAXA, pelo mesmo motivo da inscrição:
 * senão alguém cria um pagamento de R$ 0,01 com a nossa referência e o
 * trabalho vai para a comissão sem pagar.
 */
export async function confirmarPagamentoSubmissao(
  pagamento: PagamentoConferido,
): Promise<{ ok: boolean; motivo?: string }> {
  const submissionId = pagamento.referenceId.slice(PREFIXO_REFERENCIA_TRABALHO.length);
  const s = await prisma.submission.findUnique({ where: { id: submissionId } }).catch(() => null);
  if (!s) return { ok: false, motivo: "trabalho_inexistente" };
  if (s.paymentStatus === "PAID") return { ok: true, motivo: "ja_pago" };

  const esperado = Math.round(Number(s.feeAmount ?? 0) * 100);
  // Em modo simulado (sem MP_ACCESS_TOKEN) a conferência devolve 0
  // centavos — é o mesmo comportamento que a inscrição tem nesse modo.
  if (mercadoPagoClient.configurado && pagamento.centavos < esperado) {
    console.warn(
      `[MercadoPago] taxa de trabalho abaixo do valor: pagou ${pagamento.centavos}, esperado ${esperado}, trabalho ${s.id}`
    );
    return { ok: false, motivo: "valor_insuficiente" };
  }

  const pagoNoCartao = pagamento.tipo === "credit_card" || pagamento.tipo === "debit_card";
  const agora = new Date();

  await prisma.submission.updateMany({
    where: { id: s.id, paymentStatus: { not: "PAID" } },
    data: {
      paymentStatus: "PAID",
      paidAt: agora,
      paymentId: pagamento.paymentId,
      paymentProvider: "MERCADO_PAGO",
      paymentMethod: pagoNoCartao ? "CARD" : "PIX",
    },
  });

  // Pago → vai para a comissão. Só sai de DRAFT: se o organizador já
  // tiver enviado ou retirado o trabalho à mão, a decisão dele fica.
  const atualizado = await prisma.submission.updateMany({
    where: { id: s.id, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: agora },
  });

  if (atualizado.count > 0) {
    void notificarEnvioDeTrabalho(s.id);
  }

  return { ok: true };
}

/**
 * Notifica os autores do trabalho por e-mail via Resend confirmando o envio.
 *
 * É acionado assim que o trabalho passa para SUBMITTED:
 * - No envio público direto (gratuito);
 * - Na confirmação do pagamento da taxa (pago);
 * - No envio manual de um rascunho pelo painel.
 */
export async function notificarEnvioDeTrabalho(
  submissionId: string,
  opcoes: { reenvio?: boolean } = {}
) {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        event: true,
        modality: true,
        topic: true,
        authors: { orderBy: { position: "asc" } },
      },
    });

    if (!submission) return;

    const configEmail = resolveEmailSettings(submission.event.emailSettings);
    if (!configEmail.autoSendSubmissionReceipt && !opcoes.reenvio) {
      return;
    }

    const destinatarios = new Map<string, string>(); // email -> name
    for (const a of submission.authors) {
      const email = a.email.trim().toLowerCase();
      if (email && !destinatarios.has(email)) {
        destinatarios.set(email, a.name.trim());
      }
    }

    if (destinatarios.size === 0) return;

    for (const [destEmail, destNome] of destinatarios) {
      const res = await emailService.sendSubmissionReceipt(
        submission.event,
        {
          to: destEmail,
          authorName: destNome,
          submissionId: submission.id,
          submissionCode: submission.code,
          submissionTitle: submission.title,
          modalityName: submission.modality?.name ?? null,
          topicName: submission.topic?.name ?? null,
          fileName: submission.fileName ?? null,
          authors: submission.authors.map((a) => ({
            name: a.name,
            email: a.email,
            isPresenter: a.isPresenter,
          })),
          submittedAt: submission.submittedAt ?? new Date(),
        },
        opcoes
      );

      if (!res.success) {
        console.error(
          `[Submissions] Falha ao enviar e-mail para ${destEmail} (trabalho ${submission.code}):`,
          res.erro
        );
      } else {
        console.log(
          `[Submissions] E-mail de confirmação enviado para ${destEmail} (trabalho ${submission.code}, id ${res.id})`
        );
      }
    }
  } catch (err) {
    console.error("[Submissions] Erro inesperado ao notificar envio de trabalho:", err);
  }
}
