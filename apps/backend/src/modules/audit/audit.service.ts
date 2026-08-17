import type { FastifyRequest } from "fastify";
import * as auditRepository from "./audit.repository.js";

/**
 * Registra uma ação administrativa sensível. Nunca lança — auditoria não
 * pode derrubar a ação principal se a escrita do log falhar (loga o erro
 * e segue). Exige request.admin (preenchido por requireAdmin/requirePermission),
 * então só deve ser chamado depois desses middlewares.
 */
export async function recordAudit(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: unknown
): Promise<void> {
  const admin = request.admin;
  if (!admin) return;

  try {
    await auditRepository.createAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    request.log.error({ error, action, entityType }, "Falha ao gravar log de auditoria");
  }
}

export async function listAuditLogs(limit = 200) {
  return auditRepository.listAuditLogs(Math.min(limit, 500));
}

/**
 * Mesmo princípio de recordAudit(), mas para ações disparadas pelo próprio
 * participante (attendee), que não passa por requireAdmin — não existe
 * request.admin nesses endpoints. Usado por certificates.routes.ts para
 * registrar geração/download de certificado e comprovante (ver seção 14 do
 * pedido: "certificate.generated", "certificate.downloaded" etc. também
 * precisam ficar auditados mesmo sem um admin envolvido na ação).
 */
export async function recordParticipantAudit(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId: string | null,
  actorEmail: string,
  metadata?: unknown
): Promise<void> {
  try {
    await auditRepository.createAuditLog({
      actorId: null,
      actorEmail,
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    request.log.error({ error, action, entityType }, "Falha ao gravar log de auditoria");
  }
}
