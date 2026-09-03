import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import * as batchesService from "./batches.service.js";

const eventIdParams = z.object({ eventId: z.string() });
const idParams = z.object({ id: z.string() });
const activateParams = z.object({ eventId: z.string(), id: z.string() });

const createBatchSchema = z.object({
  batchNumber: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  price: z.coerce.number().positive("Preço deve ser positivo"),
  maxQuantity: z.coerce.number().int().positive().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const updateBatchSchema = z.object({
  batchNumber: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  price: z.coerce.number().positive().optional(),
  maxQuantity: z.coerce.number().int().positive().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isClosed: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function batchesRoutes(app: FastifyInstance) {
  // Retorna visão geral dos lotes do evento (público e admin)
  app.get("/events/:eventId/batches", async (request) => {
    const { eventId } = eventIdParams.parse(request.params);
    const batches = await batchesService.getBatchesOverview(eventId);
    const active = batches.find((b) => b.isActive) ?? null;

    return ok({
      batches,
      activeBatch: active,
    });
  });

  // Admin: Criar novo lote para o evento
  app.post(
    "/events/:eventId/batches",
    { preHandler: requirePermission("events.edit") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = createBatchSchema.parse(request.body);
      const batch = await batchesService.createBatch(eventId, input);
      return reply.status(201).send(ok(batch));
    }
  );

  // Admin: Atualizar lote existente
  app.put(
    "/batches/:id",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { id } = idParams.parse(request.params);
      const input = updateBatchSchema.parse(request.body);
      const batch = await batchesService.updateBatch(id, input);
      return ok(batch);
    }
  );

  // Admin: Excluir lote
  app.delete(
    "/batches/:id",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { id } = idParams.parse(request.params);
      await batchesService.deleteBatch(id);
      return ok({ deleted: true });
    }
  );

  // Admin: Ativar lote manualmente para o evento
  app.post(
    "/events/:eventId/batches/:id/activate",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { eventId, id } = activateParams.parse(request.params);
      const result = await batchesService.setActiveBatchManual(eventId, id);
      return ok(result);
    }
  );

  // Admin: Popular os 4 lotes padrão no evento
  app.post(
    "/events/:eventId/batches/seed-default",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const batches = await batchesService.seedDefaultBatches(eventId);
      return ok(batches);
    }
  );
}
