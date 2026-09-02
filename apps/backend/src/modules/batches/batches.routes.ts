import type { FastifyInstance } from "fastify";
import { ok } from "../../shared/response.js";
import * as batchesService from "./batches.service.js";

export async function batchesRoutes(app: FastifyInstance) {
  // Retorna visão geral dos lotes do evento (público e admin)
  app.get("/events/:eventId/batches", async (request) => {
    const { eventId } = request.params as { eventId: string };
    const batches = await batchesService.getBatchesOverview(eventId);
    const active = batches.find((b) => b.isActive) ?? null;

    return ok({
      batches,
      activeBatch: active,
    });
  });
}
