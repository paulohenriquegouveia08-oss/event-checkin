import type { FastifyInstance } from "fastify";

import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import * as service from "./event-config.service.js";
import {
  moduleParamsSchema,
  toggleModuleSchema,
  updateEventConfigSchema,
} from "./event-config.schema.js";
import { z } from "zod";

const eventIdParams = z.object({ eventId: z.string().uuid() });

export async function eventConfigRoutes(app: FastifyInstance) {
  // Ler a configuração exige só `events.view` — quem enxerga o evento pode
  // ver como ele está configurado. Alterar é que pede `events.configure`.
  app.get(
    "/events/:eventId/config",
    { preHandler: requirePermission("events.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      return ok(await service.getConfig(eventId));
    }
  );

  app.patch(
    "/events/:eventId/config",
    { preHandler: requirePermission("events.configure") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const input = updateEventConfigSchema.parse(request.body);
      const event = await service.updateConfig(eventId, input);

      // Visibilidade tem entrada própria na auditoria. "Alguém editou a
      // configuração" não responde a pergunta que se faz quando um evento
      // aparece publicamente sem querer: quem publicou, e quando.
      if (input.visibility !== undefined) {
        await recordAudit(
          request,
          input.visibility === "PUBLIC" ? "event.publish" : "event.unpublish",
          "Event",
          eventId
        );
      }
      await recordAudit(request, "event.configure", "Event", eventId, input);

      return ok(event);
    }
  );

  app.put(
    "/events/:eventId/modules/:module",
    { preHandler: requirePermission("events.configure") },
    async (request) => {
      const { eventId, module } = moduleParamsSchema.parse(request.params);
      const { enabled } = toggleModuleSchema.parse(request.body);

      // `sub` é onde o id do usuário vive no JWT deste sistema (ver
      // AdminJwtPayload em middleware/auth.ts). Usar `.id` gravaria null
      // em todo mundo, e a coluna existe justamente para dizer quem ligou.
      const userId = (request as { user?: { sub?: string } }).user?.sub ?? null;
      const result = await service.toggleModule(eventId, module, enabled, userId);

      await recordAudit(
        request,
        enabled ? "event.module_enable" : "event.module_disable",
        "Event",
        eventId,
        { module, alsoDisabled: result.alsoDisabled }
      );

      return ok(result);
    }
  );
}
