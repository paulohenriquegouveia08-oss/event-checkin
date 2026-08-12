import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import * as eventsService from "./events.service.js";
import { createEventSchema, eventIdParamsSchema, updateEventSchema } from "./events.schema.js";

export async function eventsRoutes(app: FastifyInstance) {
  app.post("/events", { preHandler: requireAdmin }, async (request, reply) => {
    const input = createEventSchema.parse(request.body);
    const event = await eventsService.createEvent(input);
    return reply.status(201).send(ok(event));
  });

  app.get("/events", { preHandler: requireAdmin }, async () => {
    const events = await eventsService.listEvents();
    return ok(events);
  });

  // Public — list active events (for pre-copol site)
  app.get("/events/active", async () => {
    const events = await eventsService.listActiveEvents();
    return ok(events);
  });

  // Public — get event by ID (for pre-copol inscription form)
  app.get("/events/:eventId/public", async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const event = await eventsService.getEventOrThrow(eventId);
    return ok(event);
  });

  app.get("/events/:eventId", { preHandler: requireAdmin }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const event = await eventsService.getEventOrThrow(eventId);
    return ok(event);
  });

  app.patch("/events/:eventId", { preHandler: requireAdmin }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const input = updateEventSchema.parse(request.body);
    const event = await eventsService.updateEvent(eventId, input);
    return ok(event);
  });
}
