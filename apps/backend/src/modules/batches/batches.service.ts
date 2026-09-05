import { prisma } from "../../database/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import type { EventBatch, Prisma } from "@prisma/client";

export interface BatchViewItem {
  id: string;
  batchNumber: number;
  name: string;
  price: number | null;
  maxQuantity: number | null;
  confirmedCount: number;
  startDate: string | null;
  endDate: string | null;
  status: "ACTIVE" | "CLOSED" | "UPCOMING" | "FINISHED";
  isActive: boolean;
  isClosed: boolean;
}

export interface CreateBatchInput {
  batchNumber?: number;
  name: string;
  price: number;
  maxQuantity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateBatchInput {
  batchNumber?: number;
  name?: string;
  price?: number;
  maxQuantity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isClosed?: boolean;
  isActive?: boolean;
}

export const DEFAULT_BATCH_DEFINITIONS = [
  {
    batchNumber: 1,
    name: "1º Lote — Promocional",
    price: 100.0,
    maxQuantity: 60,
    startDate: null,
    endDate: null,
  },
  {
    batchNumber: 2,
    name: "2º Lote",
    price: 150.0,
    maxQuantity: null,
    startDate: null,
    endDate: new Date("2026-09-22T23:59:59.999-03:00"),
  },
  {
    batchNumber: 3,
    name: "3º Lote",
    price: 180.0,
    maxQuantity: null,
    startDate: null,
    endDate: new Date("2026-10-22T23:59:59.999-03:00"),
  },
  {
    batchNumber: 4,
    name: "4º Lote",
    price: 220.0,
    maxQuantity: null,
    startDate: null,
    endDate: new Date("2026-11-05T23:59:59.999-03:00"),
  },
];

/**
 * Garante que lotes existam para o evento. Se nenhum existir, cria os 4 padrão.
 */
export async function ensureDefaultBatches(eventId: string): Promise<EventBatch[]> {
  const existing = await prisma.eventBatch.findMany({
    where: { eventId },
    orderBy: { batchNumber: "asc" },
  });

  if (existing.length > 0) return existing;

  const created = await prisma.$transaction(
    DEFAULT_BATCH_DEFINITIONS.map((def) =>
      prisma.eventBatch.create({
        data: {
          eventId,
          batchNumber: def.batchNumber,
          name: def.name,
          price: def.price,
          maxQuantity: def.maxQuantity,
          startDate: def.startDate,
          endDate: def.endDate,
        },
      })
    )
  );

  return created;
}

/**
 * Resolução dinâmica do lote ativo:
 * 1. Verifica se algum lote foi fixado manualmente como ativo (isActive = true e !isClosed).
 * 2. Caso contrário, percorre os lotes em ordem de batchNumber:
 *    - Se fechado manualmente -> pula;
 *    - Se atingiu maxQuantity de confirmados -> pula;
 *    - Se passou da data de encerramento -> pula;
 *    - Se a data atual ainda é anterior à data de início (startDate) -> pula;
 *    - O primeiro lote elegível é o ativo automaticamente!
 */
/**
 * O QUE OCUPA UMA VAGA NO LOTE.
 *
 * Uma definicao so, usada tanto pela rolagem automatica de lote quanto
 * pela reserva atomica. Se as duas contassem diferente, o sistema
 * rolaria para o lote 2 num momento e aceitaria mais uma no lote 1 no
 * seguinte — e ninguem entenderia por que.
 *
 * Ocupa vaga:
 *   - inscricao CONFIRMED (pagou);
 *   - inscricao PENDING dentro do prazo de pagamento.
 *
 * A segunda linha e' a correcao principal. Antes so CONFIRMED contava:
 * entre criar a inscricao e o webhook confirmar passam ATE 24 HORAS, e
 * nessa janela o lote parecia vazio para todo mundo. Nao era uma corrida
 * de milissegundos — 100 pessoas podiam receber inscricao no lote de 60
 * ao longo de um dia inteiro, pagar todas, e todas serem confirmadas.
 *
 * PENDING vencida NAO ocupa: quem nao pagou em 24h libera a vaga.
 */
export function ocupaVagaWhere(batchId: string, agora: Date = new Date()) {
  return {
    batchId,
    OR: [
      { status: "CONFIRMED" as const },
      { status: "PENDING" as const, paymentExpiresAt: { gt: agora } },
    ],
  };
}

/**
 * Quantas vagas do lote estao ocupadas AGORA.
 *
 * `tx` para poder rodar dentro da transacao da reserva — a contagem
 * precisa enxergar o mesmo instante do bloqueio da linha do lote.
 */
export async function contarOcupadas(
  tx: Prisma.TransactionClient,
  batchId: string,
  agora: Date = new Date(),
): Promise<number> {
  return tx.inscription.count({ where: ocupaVagaWhere(batchId, agora) });
}

export async function resolveActiveBatch(eventId: string, now: Date = new Date()) {
  const batches = await ensureDefaultBatches(eventId);

  // Conta o que OCUPA VAGA, não só o que já foi pago.
  //
  // Antes contava apenas CONFIRMED. Como a confirmação só chega pelo
  // webhook do pagamento — até 24h depois —, o lote parecia vazio
  // durante toda essa janela, e a rolagem para o lote seguinte só
  // acontecia tarde demais. Ver `ocupaVagaWhere` acima.
  const agora = new Date();
  const counts = await prisma.inscription.groupBy({
    by: ["batchId"],
    where: {
      eventId,
      OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", paymentExpiresAt: { gt: agora } },
      ],
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  counts.forEach((c) => {
    if (c.batchId) countMap.set(c.batchId, c._count.id);
  });

  // Também conta inscrições legadas com category "LOTE_1"
  const lote1 = batches.find((b) => b.batchNumber === 1);
  if (lote1) {
    const legacyCount = await prisma.inscription.count({
      where: {
        eventId,
        category: "LOTE_1",
        batchId: null,
        OR: [
          { status: "CONFIRMED" },
          { status: "PENDING", paymentExpiresAt: { gt: agora } },
        ],
      },
    });
    const current = countMap.get(lote1.id) ?? 0;
    countMap.set(lote1.id, current + legacyCount);
  }

  // 1. Checa fixação manual ativa pelo administrador
  const manualActive = batches.find((b) => b.isActive && !b.isClosed);
  if (manualActive) {
    return {
      activeBatch: manualActive,
      lote1Count: lote1 ? (countMap.get(lote1.id) ?? 0) : 0,
      allBatches: batches,
    };
  }

  // 2. Resolução automática por regras (data de início, data final, capacidade)
  let resolvedActive: EventBatch | null = null;

  for (const b of batches) {
    if (b.isClosed) continue;

    const count = countMap.get(b.id) ?? 0;
    if (b.maxQuantity !== null && count >= b.maxQuantity) {
      continue;
    }

    if (b.endDate !== null && now > b.endDate) {
      continue;
    }

    if (b.startDate !== null && now < b.startDate) {
      continue;
    }

    resolvedActive = b;
    break;
  }

  return {
    activeBatch: resolvedActive,
    lote1Count: lote1 ? (countMap.get(lote1.id) ?? 0) : 0,
    allBatches: batches,
  };
}

/**
 * Retorna visão completa dos lotes para o painel admin e página pública.
 * Opcionalmente oculta o valor dos próximos lotes (UPCOMING) para visitantes não autenticados.
 */
export async function getBatchesOverview(
  eventId: string,
  options?: { hideUpcomingPrice?: boolean }
): Promise<BatchViewItem[]> {
  const { activeBatch, allBatches } = await resolveActiveBatch(eventId);
  const activeId = activeBatch?.id ?? null;
  const activeNum = activeBatch?.batchNumber ?? 999;

  const countsByBatch = await prisma.inscription.groupBy({
    by: ["batchId"],
    where: { eventId, status: "CONFIRMED" },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  countsByBatch.forEach((c) => {
    if (c.batchId) countMap.set(c.batchId, c._count.id);
  });

  return allBatches.map((b) => {
    const isThisActive = b.id === activeId;
    const confirmed = countMap.get(b.id) ?? 0;

    let status: BatchViewItem["status"] = "UPCOMING";
    if (b.isClosed) {
      status = "CLOSED";
    } else if (isThisActive) {
      status = "ACTIVE";
    } else if (b.batchNumber < activeNum) {
      status = "CLOSED";
    } else {
      status = "UPCOMING";
    }

    const price = options?.hideUpcomingPrice && status === "UPCOMING" ? null : Number(b.price);

    return {
      id: b.id,
      batchNumber: b.batchNumber,
      name: b.name,
      price,
      maxQuantity: b.maxQuantity,
      confirmedCount: confirmed,
      startDate: b.startDate ? b.startDate.toISOString() : null,
      endDate: b.endDate ? b.endDate.toISOString() : null,
      status,
      isActive: isThisActive,
      isClosed: b.isClosed,
    };
  });
}

/**
 * Criação de um novo lote para qualquer evento.
 */
export async function createBatch(eventId: string, input: CreateBatchInput) {
  let batchNum = input.batchNumber;
  if (!batchNum) {
    const highest = await prisma.eventBatch.findFirst({
      where: { eventId },
      orderBy: { batchNumber: "desc" },
    });
    batchNum = (highest?.batchNumber ?? 0) + 1;
  }

  const existing = await prisma.eventBatch.findUnique({
    where: { eventId_batchNumber: { eventId, batchNumber: batchNum } },
  });
  if (existing) {
    throw new ValidationError(`Já existe um lote #${batchNum} para este evento.`);
  }

  const batch = await prisma.eventBatch.create({
    data: {
      eventId,
      batchNumber: batchNum,
      name: input.name,
      price: input.price,
      maxQuantity: input.maxQuantity ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });

  return batch;
}

/**
 * Atualização dos parâmetros de um lote (preço, nome, vagas, data de início, data final, status).
 */
export async function updateBatch(id: string, input: UpdateBatchInput) {
  const existing = await prisma.eventBatch.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Lote não encontrado");

  const updated = await prisma.eventBatch.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      batchNumber: input.batchNumber ?? undefined,
      price: input.price !== undefined ? input.price : undefined,
      maxQuantity: input.maxQuantity !== undefined ? input.maxQuantity : undefined,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : undefined,
      isClosed: input.isClosed !== undefined ? input.isClosed : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined,
    },
  });

  return updated;
}

/**
 * Exclui um lote caso não possua inscrições confirmadas vinculadas.
 */
export async function deleteBatch(id: string) {
  const existing = await prisma.eventBatch.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Lote não encontrado");

  const confirmedInscriptions = await prisma.inscription.count({
    where: { batchId: id, status: "CONFIRMED" },
  });
  if (confirmedInscriptions > 0) {
    throw new ValidationError("Não é possível excluir um lote que já possui inscrições confirmadas.");
  }

  await prisma.eventBatch.delete({ where: { id } });
}

/**
 * Força a ativação manual de um lote específico para o evento.
 */
export async function setActiveBatchManual(eventId: string, batchId: string) {
  await prisma.$transaction([
    prisma.eventBatch.updateMany({
      where: { eventId },
      data: { isActive: false },
    }),
    prisma.eventBatch.update({
      where: { id: batchId },
      data: { isActive: true, isClosed: false },
    }),
  ]);

  return getBatchesOverview(eventId);
}

/**
 * Reseta e aplica os lotes padrão do Copol no evento selecionado.
 */
export async function seedDefaultBatches(eventId: string) {
  const existing = await prisma.eventBatch.findMany({ where: { eventId } });
  for (const b of existing) {
    const hasInscriptions = await prisma.inscription.count({ where: { batchId: b.id } });
    if (hasInscriptions === 0) {
      await prisma.eventBatch.delete({ where: { id: b.id } });
    }
  }

  return ensureDefaultBatches(eventId);
}

/**
 * Erro de lote esgotado. Existe como classe própria para a rota poder
 * responder 409 (conflito) em vez de 500 — quem tentou não fez nada
 * errado, só chegou depois.
 */
export class LoteEsgotadoError extends ConflictError {
  constructor(readonly batchName: string) {
    super(
      "LOTE_ESGOTADO",
      `O ${batchName} esgotou enquanto você preenchia o formulário. ` +
        `Recarregue a página para ver o lote e o valor atuais.`,
    );
    this.name = "LoteEsgotadoError";
  }
}

/**
 * Toma uma vaga do lote, ou recusa. ATOMICAMENTE.
 *
 * Precisa rodar DENTRO de uma transação, junto com a criação da
 * inscrição — senão a vaga é conferida e a inscrição é criada em
 * momentos diferentes, que é exatamente o problema que isto resolve.
 *
 * Como funciona
 * -------------
 * `SELECT ... FOR UPDATE` na linha do lote. A primeira transação que
 * chega trava a linha; a segunda FICA ESPERANDO nesse ponto, não
 * prossegue com uma contagem velha. Quando a primeira comita, a
 * segunda acorda e conta de novo — já enxergando a inscrição que a
 * primeira acabou de criar.
 *
 * É por isso que a checagem não é `SELECT` seguido de `UPDATE`: entre
 * um e outro qualquer número de requisições passa. Aqui não existe
 * "entre".
 *
 * O bloqueio é por LOTE, não global: reservas em lotes diferentes (ou
 * em eventos diferentes) não esperam umas pelas outras.
 */
export async function reservarVaga(
  tx: Prisma.TransactionClient,
  batchId: string,
): Promise<void> {
  // Trava a linha do lote. O retorno não interessa — o efeito é o
  // bloqueio.
  //
  // Sem cast de tipo: `event_batches.id` é TEXT (o `@default(uuid())`
  // do Prisma gera o valor na aplicação, a coluna continua texto).
  // Um `::uuid` aqui faz o Postgres recusar a comparação com
  // "operator does not exist: text = uuid".
  const travado = await tx.$queryRaw<{ id: string; name: string; maxQuantity: number | null }[]>`
    SELECT id, name, "maxQuantity"
      FROM event_batches
     WHERE id = ${batchId}
       FOR UPDATE
  `;

  const lote = travado[0];
  if (!lote) throw new NotFoundError("Lote de inscrição não encontrado");

  // Lote sem teto não pode esgotar — nada a conferir.
  if (lote.maxQuantity === null) return;

  const ocupadas = await contarOcupadas(tx, batchId);
  if (ocupadas >= lote.maxQuantity) {
    // O rollback da transação desfaz o bloqueio e a inscrição.
    throw new LoteEsgotadoError(lote.name);
  }
}
