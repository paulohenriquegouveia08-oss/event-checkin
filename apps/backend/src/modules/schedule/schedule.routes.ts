import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import * as scheduleService from "./schedule.service.js";
import { createScheduleItemSchema, updateScheduleItemSchema } from "./schedule.schema.js";

const eventIdParams = z.object({ eventId: z.string() });
const idParams = z.object({ id: z.string() });
const reorderSchema = z.object({ itemIds: z.array(z.string()) });

export async function scheduleRoutes(app: FastifyInstance) {
  // Rota pública: consulta da programação do evento
  app.get("/events/:eventId/schedule", async (request) => {
    const { eventId } = eventIdParams.parse(request.params);
    const items = await scheduleService.listSchedule(eventId);
    return ok(items);
  });

  // Admin: adicionar item à programação
  app.post(
    "/events/:eventId/schedule",
    { preHandler: requirePermission("events.edit") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = createScheduleItemSchema.parse(request.body);
      const item = await scheduleService.createScheduleItem(eventId, input);
      return reply.status(201).send(ok(item));
    }
  );

  // Admin: atualizar item da programação
  app.put(
    "/schedule/:id",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { id } = idParams.parse(request.params);
      const input = updateScheduleItemSchema.parse(request.body);
      const item = await scheduleService.updateScheduleItem(id, input);
      return ok(item);
    }
  );

  // Admin: excluir item da programação
  app.delete(
    "/schedule/:id",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { id } = idParams.parse(request.params);
      await scheduleService.deleteScheduleItem(id);
      return ok({ deleted: true });
    }
  );

  // Admin: reordenar itens da programação
  app.post(
    "/events/:eventId/schedule/reorder",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const { itemIds } = reorderSchema.parse(request.body);
      const items = await scheduleService.reorderScheduleItems(eventId, itemIds);
      return ok(items);
    }
  );
}
