import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../database/prisma.js";
import { ForbiddenError, UnauthorizedError } from "../shared/errors.js";
import { sha256Hex } from "../shared/tokens.js";

export interface AdminJwtPayload {
  sub: string;
  role: "ADMIN";
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
    admin?: { userId: string; role: "ADMIN" };
    terminal?: { terminalId: string; eventId: string };
  }
}

/** Exige um token de sessão de administrador válido. */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError("Token inválido ou expirado");
  }
  const payload = request.user;
  if (payload.type !== "admin") {
    throw new ForbiddenError("Este endpoint requer autenticação de administrador");
  }
  request.admin = { userId: payload.sub, role: payload.role };
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

  request.terminal = { terminalId: terminal.id, eventId: terminal.eventId };
}
