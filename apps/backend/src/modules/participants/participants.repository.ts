import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";

export function createParticipant(data: Prisma.ParticipantUncheckedCreateInput) {
  return prisma.participant.create({ data });
}

export function createManyParticipants(data: Prisma.ParticipantUncheckedCreateInput[]) {
  return prisma.participant.createMany({ data });
}

export function listParticipantsByEvent(eventId: string) {
  return prisma.participant.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
}

export function findParticipantById(eventId: string, participantId: string) {
  return prisma.participant.findFirst({ where: { id: participantId, eventId } });
}

export function findParticipantByQrToken(qrToken: string) {
  return prisma.participant.findUnique({ where: { qrToken } });
}

/** Payload enxuto para o terminal cachear localmente (offline-first —
 * seção 13 da especificação: o terminal precisa dos participantes e QR
 * tokens antes do evento, para validar leituras sem depender da rede). */
export function listParticipantsForOfflineSync(eventId: string) {
  return prisma.participant.findMany({
    where: { eventId },
    select: { id: true, name: true, qrToken: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  });
}

export function updateParticipant(participantId: string, data: Prisma.ParticipantUpdateInput) {
  return prisma.participant.update({ where: { id: participantId }, data });
}

/** Apaga o participante. onDelete: Cascade (ver schema.prisma) remove
 * junto qualquer check-in dele — diferente de excluir um terminal, aqui
 * não dá pra preservar histórico porque o próprio dono do registro deixa
 * de existir. */
export function deleteParticipant(participantId: string) {
  return prisma.participant.delete({ where: { id: participantId } });
}

/** Usado na detecção de duplicados durante a importação: participantes já
 * existentes no evento com o mesmo e-mail ou documento informados. */
export function findExistingByEmailOrDocument(eventId: string, emails: string[], documents: string[]) {
  return prisma.participant.findMany({
    where: {
      eventId,
      OR: [
        emails.length ? { email: { in: emails } } : undefined,
        documents.length ? { document: { in: documents } } : undefined,
      ].filter(Boolean) as Prisma.ParticipantWhereInput[],
    },
    select: { email: true, document: true },
  });
}
