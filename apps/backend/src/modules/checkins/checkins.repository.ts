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
