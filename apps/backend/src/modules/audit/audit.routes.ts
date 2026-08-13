import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import * as auditService from "./audit.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  app.get("/audit-logs", { preHandler: requirePermission("audit.view") }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);
    return ok(await auditService.listAuditLogs(limit));
  });
}
