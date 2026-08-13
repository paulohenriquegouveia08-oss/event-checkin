import type { FastifyInstance } from "fastify";
import { prisma } from "../src/database/prisma.js";
import { generateQrToken, sha256Hex } from "../src/shared/tokens.js";
import { hashPassword } from "../src/shared/passwords.js";
import { syncPermissions } from "../src/shared/permissions.js";

export async function resetDatabase() {
  await prisma.checkIn.deleteMany();
  await prisma.terminal.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.inscription.deleteMany();
  await prisma.event.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await syncPermissions(prisma);
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

/** Papel bootstrap ADMINISTRADOR (isSystem = true, sempre acesso total —
 * ver requirePermission()). Idempotente: reaproveita se outro teste no
 * mesmo arquivo já criou. */
export async function ensureAdminRole() {
  return prisma.role.upsert({
    where: { key: "ADMINISTRADOR" },
    create: { key: "ADMINISTRADOR", name: "Administrador", isSystem: true },
    update: {},
  });
}

/** Cria um perfil comum (não-sistema) com as permissões informadas —
 * usado pra testar requirePermission() com um usuário que NÃO é
 * ADMINISTRADOR, ou seja, que só pode o que o perfil explicitamente lista. */
export async function createTestRole(name: string, permissionKeys: string[] = []) {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  return prisma.role.create({
    data: {
      key: name.toUpperCase().replace(/\s+/g, "_"),
      name,
      permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
    },
  });
}

export async function createTestAdmin(email = "admin@teste.com", password = "senha-forte-123") {
  const role = await ensureAdminRole();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: "Admin de Teste", email, passwordHash, roleId: role.id },
  });
  return { user, password };
}

/** Cria um usuário de teste vinculado a um perfil específico (não
 * necessariamente ADMINISTRADOR) — para testar cenários de permissão
 * negada. */
export async function createTestUserWithRole(roleId: string, email = "user@teste.com", password = "senha-forte-123") {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: "Usuário de Teste", email, passwordHash, roleId },
  });
  return { user, password };
}
