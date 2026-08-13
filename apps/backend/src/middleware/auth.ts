import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../database/prisma.js";
import { ForbiddenError, UnauthorizedError } from "../shared/errors.js";
import { sha256Hex } from "../shared/tokens.js";

export interface AdminJwtPayload {
  sub: string;
  // key do Role no momento do login (ex: "ADMINISTRADOR") — só informativo
  // no token; a checagem de permissão real sempre confere o banco (ver
  // requirePermission), então mudar as permissões de um perfil já vale
  // pra sessões abertas, sem esperar reautenticação.
  role: string;
  type: "admin";
}

export interface TerminalJwtPayload {
  sub: string; // terminalId
  eventId: string;
  type: "terminal";
}

export interface AttendeeJwtPayload {
  sub: string; // participantId
  eventId: string;
  type: "attendee";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AdminJwtPayload | TerminalJwtPayload | AttendeeJwtPayload;
    user: AdminJwtPayload | TerminalJwtPayload | AttendeeJwtPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    admin?: {
      userId: string;
      email: string;
      roleKey: string;
      roleId: string;
      isSystem: boolean;
      permissions: Set<string>;
    };
    terminal?: { terminalId: string; eventId: string; name: string };
  }
}

/**
 * Valida a sessão de admin (JWT + usuário ainda ativo) e carrega o perfil
 * com suas permissões em request.admin. Não decide sozinha se a ação é
 * permitida — isso é requirePermission(). Perfil com isSystem=true (só o
 * bootstrap ADMINISTRADOR) é tratado como "todas as permissões" sem
 * precisar de linha em role_permissions — ver comentário no schema.prisma.
 */
async function loadAdminSession(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError("Token inválido ou expirado");
  }
  const payload = request.user;
  if (payload.type !== "admin") {
    throw new ForbiddenError("Este endpoint requer autenticação de administrador");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Sessão inválida ou usuário desativado");
  }

  const permissions = new Set(user.role.permissions.map((rp) => rp.permission.key));
  request.admin = {
    userId: user.id,
    email: user.email,
    roleKey: user.role.key,
    roleId: user.role.id,
    isSystem: user.role.isSystem,
    permissions,
  };
}

/** Mesma checagem de requirePermission(), mas utilizável fora do ciclo de
 * preHandler do Fastify — usado pelo endpoint SSE de monitor, que recebe
 * o token via query string (EventSource não manda headers) e por isso
 * não passa pelo fluxo normal de autenticação. */
export async function userHasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user || !user.isActive) return false;
  if (user.role.isSystem) return true;
  return user.role.permissions.some((rp) => rp.permission.key === permissionKey);
}

/** Exige apenas uma sessão de admin válida, sem checar permissão
 * específica — uso restrito a endpoints que qualquer perfil autenticado
 * pode acessar (ex: "quem sou eu"). Ações de verdade devem usar
 * requirePermission(). */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  await loadAdminSession(request);
}

/** Exige sessão de admin válida E a permissão informada (ou isSystem).
 * A checagem é sempre contra o banco no momento da requisição — mudar as
 * permissões de um perfil pela UI reflete imediatamente, sem esperar o
 * usuário logado de novo. */
export function requirePermission(permissionKey: string) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    await loadAdminSession(request);
    const admin = request.admin!;
    if (!admin.isSystem && !admin.permissions.has(permissionKey)) {
      throw new ForbiddenError(`Seu perfil não tem a permissão "${permissionKey}"`);
    }
  };
}

/**
 * Exige um token de terminal válido e ativo. Além da assinatura JWT,
 * confirma no banco que o terminal ainda está ACTIVE e que o token
 * apresentado é o mais recente emitido (permite revogar/rotacionar a
 * credencial do terminal sem esperar o JWT expirar).
 */
export async function requireTerminal(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError("Token inválido ou expirado");
  }
  const payload = request.user;
  if (payload.type !== "terminal") {
    throw new ForbiddenError("Este endpoint requer autenticação de terminal");
  }

  const authHeader = request.headers.authorization ?? "";
  const rawToken = authHeader.replace(/^Bearer\s+/i, "");
  const tokenHash = sha256Hex(rawToken);

  const terminal = await prisma.terminal.findUnique({ where: { id: payload.sub } });
  if (!terminal || terminal.status !== "ACTIVE" || terminal.credentialHash !== tokenHash) {
    throw new UnauthorizedError("Credencial do terminal revogada ou inválida");
  }

  await prisma.terminal.update({
    where: { id: terminal.id },
    data: { lastSeenAt: new Date() },
  });

  request.terminal = { terminalId: terminal.id, eventId: terminal.eventId, name: terminal.name };
}
