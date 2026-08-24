import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";

export function createTerminal(data: Prisma.TerminalUncheckedCreateInput) {
  return prisma.terminal.create({ data });
}

/** Só a coluna `identifier` de todos os terminais, para calcular o
 * próximo número livre da sequência (ver nextIdentifierNumber em
 * terminals.service.ts). A tabela é pequena — terminais são criados
 * manualmente por um admin — então ler todos é mais barato e muito
 * mais simples do que manter uma sequência dedicada. */
export function listTerminalIdentifiers() {
  return prisma.terminal.findMany({ select: { identifier: true } });
}

export function findTerminalByActivationCode(activationCode: string) {
  return prisma.terminal.findUnique({ where: { activationCode } });
}

export function findTerminalById(terminalId: string) {
  return prisma.terminal.findUnique({ where: { id: terminalId } });
}

export function activateTerminal(terminalId: string, credentialHash: string) {
  return prisma.terminal.update({
    where: { id: terminalId },
    data: {
      status: "ACTIVE",
      activationCode: null,
      activationCodeExpiresAt: null,
      credentialHash,
      activatedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
}

export function listTerminalsByEvent(eventId: string) {
  return prisma.terminal.findMany({ where: { eventId }, orderBy: { createdAt: "asc" } });
}

export function findTerminalByIdAndEvent(eventId: string, terminalId: string) {
  return prisma.terminal.findFirst({ where: { id: terminalId, eventId } });
}

/** Apaga o terminal (não só desativa) — o histórico de check-ins que ele
 * já fez é preservado (CheckIn.terminalId vira null, ver schema.prisma).
 * Qualquer requisição futura vinda desse terminal passa a ser rejeitada
 * com 401 pelo middleware requireTerminal (a linha simplesmente não
 * existe mais para o findUnique encontrar). */
export function deleteTerminal(terminalId: string) {
  return prisma.terminal.delete({ where: { id: terminalId } });
}
