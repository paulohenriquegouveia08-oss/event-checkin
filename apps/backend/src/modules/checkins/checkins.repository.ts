import { prisma } from "../../database/prisma.js";
import type { CheckInSource } from "@prisma/client";

export interface CreateCheckInParams {
  eventId: string;
  participantId: string;
  terminalId: string | null;
  source: CheckInSource;
  checkedInAt: Date;
  localCheckInId?: string | null;
}

export function createCheckIn(params: CreateCheckInParams) {
  return prisma.checkIn.create({ data: params });
}

export function findByEventAndParticipant(eventId: string, participantId: string) {
  return prisma.checkIn.findUnique({
    where: { eventId_participantId: { eventId, participantId } },
  });
}

export function findByTerminalAndLocalId(terminalId: string, localCheckInId: string) {
  return prisma.checkIn.findUnique({
    where: { terminalId_localCheckInId: { terminalId, localCheckInId } },
  });
}

export function countByEvent(eventId: string) {
  return prisma.checkIn.count({ where: { eventId } });
}

export function countByEventAndTerminal(eventId: string) {
  return prisma.checkIn.groupBy({
    by: ["terminalId"],
    where: { eventId },
    _count: { _all: true },
  });
}

export function listCheckInsByEvent(eventId: string) {
  return prisma.checkIn.findMany({
    where: { eventId },
    include: {
      participant: { select: { name: true, email: true, phone: true, document: true } },
      terminal: { select: { name: true } },
    },
    orderBy: { checkedInAt: "asc" },
  });
}

/** Os `limit` check-ins mais recentes do evento — usado só para preencher
 * o histórico do monitor ao vivo quando um admin conecta (ver
 * checkins.routes.ts). Devolve do mais antigo pro mais novo (mesma ordem
 * em que os eventos apareceriam se o admin tivesse assistido ao vivo). */
export function listRecentCheckInsByEvent(eventId: string, limit: number) {
  return prisma.checkIn
    .findMany({
      where: { eventId },
      include: {
        participant: { select: { name: true, email: true, phone: true, document: true } },
        terminal: { select: { name: true } },
      },
      orderBy: { checkedInAt: "desc" },
      take: limit,
    })
    .then((rows) => rows.reverse());
}
