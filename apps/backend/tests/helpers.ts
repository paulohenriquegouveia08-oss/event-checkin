import type { FastifyInstance } from "fastify";
import { prisma } from "../src/database/prisma.js";
import { generateQrToken, sha256Hex } from "../src/shared/tokens.js";
import { hashPassword } from "../src/shared/passwords.js";

export async function resetDatabase() {
  await prisma.checkIn.deleteMany();
  await prisma.terminal.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestEvent(overrides: Partial<{ name: string; status: "ACTIVE" | "CLOSED" }> = {}) {
  return prisma.event.create({
    data: {
      name: overrides.name ?? "Congresso de Teste 2026",
      startDate: new Date("2026-09-01T09:00:00Z"),
      endDate: new Date("2026-09-03T18:00:00Z"),
      status: overrides.status ?? "ACTIVE",
    },
  });
}

export async function createTestParticipant(
  eventId: string,
  overrides: Partial<{ name: string; status: "ACTIVE" | "CANCELLED" }> = {}
) {
  return prisma.participant.create({
    data: {
      eventId,
      name: overrides.name ?? "João da Silva",
      qrToken: generateQrToken(),
      status: overrides.status ?? "ACTIVE",
    },
  });
}

/** Cria um terminal já ATIVO diretamente no banco (sem passar pelo fluxo
 * HTTP de ativação) e devolve também o token Bearer correspondente, para
 * testes que só precisam de um terminal autenticado, não do fluxo de
 * ativação em si (esse é testado separadamente em terminals.test.ts). */
export async function createActiveTerminalWithToken(app: FastifyInstance, eventId: string) {
  // Os plugins (incluindo @fastify/jwt) só terminam de registrar depois de
  // app.ready() — necessário aqui porque este helper pode ser o primeiro
  // ponto de contato com a app num teste, antes de qualquer app.inject().
  await app.ready();

  const terminal = await prisma.terminal.create({
    data: {
      eventId,
      name: "Entrada Principal",
      identifier: `TERM-TEST-${Math.random().toString(36).slice(2, 8)}`,
      status: "PENDING",
    },
  });

  const token = app.jwt.sign({ sub: terminal.id, eventId, type: "terminal" as const }, { expiresIn: "1h" });

  await prisma.terminal.update({
    where: { id: terminal.id },
    data: { status: "ACTIVE", credentialHash: sha256Hex(token) },
  });

  return { terminal, token };
}

export async function createTestAdmin(email = "admin@teste.com", password = "senha-forte-123") {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: "Admin de Teste", email, passwordHash, role: "ADMIN" },
  });
  return { user, password };
}
