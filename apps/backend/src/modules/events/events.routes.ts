import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import * as eventsService from "./events.service.js";
import { createEventSchema, eventIdParamsSchema, updateEventSchema } from "./events.schema.js";

export async function eventsRoutes(app: FastifyInstance) {
  app.post("/events", { preHandler: requirePermission("events.create") }, async (request, reply) => {
    const input = createEventSchema.parse(request.body);
    const event = await eventsService.createEvent(input);
    await recordAudit(request, "event.create", "Event", event.id, { name: event.name });
    return reply.status(201).send(ok(event));
  });

  app.get("/events", { preHandler: requirePermission("events.view") }, async () => {
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
    const event = await eventsService.getPublicEventOrThrow(eventId);
    return ok(event);
  });

  app.get("/events/:eventId", { preHandler: requirePermission("events.view") }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const event = await eventsService.getEventOrThrow(eventId);
    return ok(event);
  });

  app.patch("/events/:eventId", { preHandler: requirePermission("events.edit") }, async (request) => {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const input = updateEventSchema.parse(request.body);
    const event = await eventsService.updateEvent(eventId, input);
    await recordAudit(request, "event.update", "Event", eventId);
    return ok(event);
  });

  // Encerra/retoma inscrições manualmente, independente do
  // registrationDeadline (ver isRegistrationOpen em events.service.ts)
  app.post(
    "/events/:eventId/registrations/close",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const event = await eventsService.closeRegistrations(eventId);
      await recordAudit(request, "event.close_registrations", "Event", eventId);
      return ok(event);
    }
  );

  app.post(
    "/events/:eventId/registrations/reopen",
    { preHandler: requirePermission("events.edit") },
    async (request) => {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const event = await eventsService.reopenRegistrations(eventId);
      await recordAudit(request, "event.reopen_registrations", "Event", eventId);
      return ok(event);
    }
  );
}
