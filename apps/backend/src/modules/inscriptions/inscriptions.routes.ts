import type { FastifyInstance } from "fastify";
import { ok } from "../../shared/response.js";
import * as inscriptionsService from "./inscriptions.service.js";
import { createInscriptionSchema, inscriptionEventParamsSchema } from "./inscriptions.schema.js";

export async function inscriptionsRoutes(app: FastifyInstance) {
  // Public — create inscription (used by pre-copol site)
  app.post("/events/:eventId/inscriptions", async (request, reply) => {
    const { eventId } = inscriptionEventParamsSchema.parse(request.params);
    const input = createInscriptionSchema.parse(request.body);

    const inscription = await inscriptionsService.createInscription(eventId, input);
    return reply.status(201).send(ok(inscription));
  });

  // Public — get inscription details
  app.get("/inscriptions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const inscription = await inscriptionsService.getInscription(id);
    return ok(inscription);
  });
}
