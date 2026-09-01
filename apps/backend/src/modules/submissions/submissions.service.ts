import { prisma } from "../../database/prisma.js";
import {
  certificateStorage,
  submissionFileKey,
} from "../certificates/certificate-storage.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { isModuleEnabled } from "../event-config/event-config.service.js";
import type {
  CreateSubmissionInput,
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

export async function createSubmission(eventId: string, input: CreateSubmissionInput) {
  const event = await eventOrThrow(eventId);
  await requireModule(eventId);

  const settings = await getSettings(eventId);
  const janela = janelaAberta(settings);
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  // Modalidade e área precisam ser DESTE evento. Sem esta checagem daria
  // para classificar um trabalho com a modalidade de outro congresso
  // passando o id na mão.
  const [modality, topic] = await Promise.all([
    prisma.submissionModality.findFirst({
      where: { id: input.modalityId, eventId },
    }),
    prisma.submissionTopic.findFirst({ where: { id: input.topicId, eventId } }),
  ]);
  if (!modality) throw new ValidationError("Modalidade não encontrada neste evento");
  if (!topic) throw new ValidationError("Área temática não encontrada neste evento");
  if (!modality.active) throw new ValidationError("Essa modalidade não está aceitando trabalhos");
  if (!topic.active) throw new ValidationError("Essa área temática não está aceitando trabalhos");

  const apresentadores = input.authors.filter((a) => a.isPresenter);
  if (apresentadores.length > 1) {
    throw new ValidationError("Marque apenas um autor como apresentador");
  }

  const code = await gerarCodigo(eventId, event.name);

  return prisma.submission.create({
    data: {
      eventId,
      code,
      modalityId: input.modalityId,
      topicId: input.topicId,
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

  const [total, items] = await Promise.all([
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
  ]);

  return { total, page: q.page, pageSize: q.pageSize, items };
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

  return prisma.submission.update({
    where: { id: submissionId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
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
  decision: "APPROVED" | "REJECTED"
) {
  const s = await getSubmission(eventId, submissionId);
  if (s.status === "DRAFT") {
    throw new ValidationError("Este trabalho ainda não foi enviado pelo autor");
  }
  if (s.status === "WITHDRAWN") {
    throw new ValidationError("O autor retirou este trabalho");
  }
  return prisma.submission.update({
    where: { id: submissionId },
    data: { status: decision, decidedAt: new Date() },
  });
}

// ─── Arquivo do trabalho ────────────────────────────────────────────────

/**
 * Os primeiros bytes de todo PDF são `%PDF-`.
 *
 * A extensão e o tipo declarado vêm do cliente e não provam nada — quem
 * quiser mandar outra coisa só precisa renomear. Ler o cabeçalho é o que
 * de fato responde "isto é um PDF?", e evita que a comissão baixe um
 * arquivo que não abre depois de a chamada já ter fechado.
 */
function pareceRealmentePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
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

  const janela = janelaAberta(await getSettings(eventId));
  if (!janela.aberta) throw new ValidationError(janela.motivo!);

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) throw new ValidationError("Arquivo vazio.");

  const settings = await getSettings(eventId);
  const limite = settings.maxFileSizeMb * 1024 * 1024;
  if (buffer.length > limite) {
    throw new ValidationError(
      `Arquivo muito grande — o limite deste evento é ${settings.maxFileSizeMb} MB.`
    );
  }
  if (!pareceRealmentePdf(buffer)) {
    throw new ValidationError("Envie um PDF. O arquivo recebido não é um PDF.");
  }

  const key = submissionFileKey(eventId, submissionId);
  await certificateStorage.save(key, buffer);

  return prisma.submission.update({
    where: { id: submissionId },
    data: { fileKey: key, fileName, fileSizeBytes: buffer.length },
    select: { id: true, fileName: true, fileSizeBytes: true },
  });
}

/** Bytes do PDF, para a comissão baixar e ler. */
export async function readFile(eventId: string, submissionId: string) {
  const s = await getSubmission(eventId, submissionId);
  if (!s.fileKey) throw new NotFoundError("Este trabalho não tem arquivo anexado");
  return {
    buffer: await certificateStorage.read(s.fileKey),
    fileName: s.fileName ?? `${s.code}.pdf`,
  };
}
