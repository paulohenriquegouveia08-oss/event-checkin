import { prisma } from "../../database/prisma.js";

export interface CreateAuditLogParams {
  actorId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
}

export function createAuditLog(data: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      actorId: data.actorId,
      actorEmail: data.actorEmail,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      metadata: data.metadata === undefined ? undefined : (data.metadata as object),
    },
  });
}

export function listAuditLogs(limit: number) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
