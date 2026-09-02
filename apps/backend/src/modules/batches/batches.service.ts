import { prisma } from "../../database/prisma.js";
import type { EventBatch } from "@prisma/client";

export interface BatchViewItem {
  id: string;
  batchNumber: number;
  name: string;
  price: number;
  maxQuantity: number | null;
  confirmedCount: number;
  endDate: string | null;
  status: "ACTIVE" | "CLOSED" | "UPCOMING" | "FINISHED";
  isActive: boolean;
}

export const DEFAULT_BATCH_DEFINITIONS = [
  {
    batchNumber: 1,
    name: "1º Lote — Promocional",
    price: 100.0,
    maxQuantity: 60,
    endDate: null,
  },
  {
    batchNumber: 2,
    name: "2º Lote",
    price: 150.0,
    maxQuantity: null,
    endDate: new Date("2026-09-22T23:59:59.999-03:00"),
  },
  {
    batchNumber: 3,
    name: "3º Lote",
    price: 180.0,
    maxQuantity: null,
    endDate: new Date("2026-10-22T23:59:59.999-03:00"),
  },
  {
    batchNumber: 4,
    name: "4º Lote",
    price: 220.0,
    maxQuantity: null,
    endDate: new Date("2026-11-05T23:59:59.999-03:00"),
  },
];

/**
 * Garante que os 4 lotes oficiais existam no banco para o evento.
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
          endDate: def.endDate,
        },
      })
    )
  );

  return created;
}

/**
 * Identifica e resolve qual lote está ativo no momento, calculando
 * a contagem de vagas do Lote 1 e as datas de encerramento dos lotes 2, 3 e 4.
 */
export async function resolveActiveBatch(eventId: string, now: Date = new Date()) {
  const batches = await ensureDefaultBatches(eventId);

  // Conta quantas inscrições confirmadas existem no Lote 1
  const lote1 = batches.find((b) => b.batchNumber === 1);
  const lote1ConfirmedCount = lote1
    ? await prisma.inscription.count({
        where: {
          eventId,
          status: "CONFIRMED",
          OR: [
            { batchId: lote1.id },
            { category: "LOTE_1" },
          ],
        },
      })
    : 0;

  const lote2 = batches.find((b) => b.batchNumber === 2);
  const lote3 = batches.find((b) => b.batchNumber === 3);
  const lote4 = batches.find((b) => b.batchNumber === 4);

  // 1. Regra Lote 1: Até 60 inscrições válidas/confirmadas
  if (lote1 && (!lote1.maxQuantity || lote1ConfirmedCount < lote1.maxQuantity)) {
    return {
      activeBatch: lote1,
      lote1Count: lote1ConfirmedCount,
      allBatches: batches,
    };
  }

  // 2. Regra Lote 2: Até 22/09/2026
  if (lote2 && lote2.endDate && now <= lote2.endDate) {
    return {
      activeBatch: lote2,
      lote1Count: lote1ConfirmedCount,
      allBatches: batches,
    };
  }

  // 3. Regra Lote 3: Até 22/10/2026
  if (lote3 && lote3.endDate && now <= lote3.endDate) {
    return {
      activeBatch: lote3,
      lote1Count: lote1ConfirmedCount,
      allBatches: batches,
    };
  }

  // 4. Regra Lote 4: Até 05/11/2026
  if (lote4 && lote4.endDate && now <= lote4.endDate) {
    return {
      activeBatch: lote4,
      lote1Count: lote1ConfirmedCount,
      allBatches: batches,
    };
  }

  // Se passou de 05/11/2026, todos os lotes estão encerrados
  return {
    activeBatch: null,
    lote1Count: lote1ConfirmedCount,
    allBatches: batches,
  };
}

/**
 * Retorna os dados completos dos lotes para exibição no painel administrativo
 * e na interface pública.
 */
export async function getBatchesOverview(eventId: string): Promise<BatchViewItem[]> {
  const { activeBatch, lote1Count, allBatches } = await resolveActiveBatch(eventId);

  const activeNum = activeBatch?.batchNumber ?? 999;

  // Busca a contagem de inscritos confirmados em cada lote
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
    const isThisActive = b.batchNumber === activeNum;
    let status: BatchViewItem["status"] = "UPCOMING";

    if (isThisActive) {
      status = "ACTIVE";
    } else if (b.batchNumber < activeNum) {
      status = "CLOSED";
    } else {
      status = "UPCOMING";
    }

    const confirmed = b.batchNumber === 1 ? lote1Count : (countMap.get(b.id) ?? 0);

    return {
      id: b.id,
      batchNumber: b.batchNumber,
      name: b.name,
      price: Number(b.price),
      maxQuantity: b.maxQuantity,
      confirmedCount: confirmed,
      endDate: b.endDate ? b.endDate.toISOString() : null,
      status,
      isActive: isThisActive,
    };
  });
}
