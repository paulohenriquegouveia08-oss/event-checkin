import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import * as usersService from "./users.service.js";
import { createUserSchema, updateUserSchema, userIdParamsSchema } from "./users.schema.js";

const toggleActiveSchema = z.object({ isActive: z.boolean() });

export async function usersRoutes(app: FastifyInstance) {
  app.get("/users", { preHandler: requirePermission("users.view") }, async () => {
    return ok(await usersService.listUsers());
  });

  app.get("/users/:userId", { preHandler: requirePermission("users.view") }, async (request) => {
    const { userId } = userIdParamsSchema.parse(request.params);
    const user = await usersService.getUserOrThrow(userId);
    return ok(user);
  });

  app.post("/users", { preHandler: requirePermission("users.create") }, async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    const user = await usersService.createUser(input);
    await recordAudit(request, "user.create", "User", user.id, { email: user.email, role: user.role.key });
    return reply.status(201).send(ok(user));
  });

  app.patch("/users/:userId", { preHandler: requirePermission("users.edit") }, async (request) => {
    const { userId } = userIdParamsSchema.parse(request.params);
    const input = updateUserSchema.parse(request.body);
    const user = await usersService.updateUser(userId, input);
    await recordAudit(request, "user.update", "User", userId, {
      name: input.name,
      email: input.email,
      roleId: input.roleId,
      passwordChanged: !!input.password,
    });
    return ok(user);
  });

  app.post(
    "/users/:userId/toggle-active",
    { preHandler: requirePermission("users.toggle_active") },
    async (request) => {
      const { userId } = userIdParamsSchema.parse(request.params);
      const { isActive } = toggleActiveSchema.parse(request.body);
      const user = await usersService.setUserActive(userId, isActive, request.admin!.userId);
      await recordAudit(request, isActive ? "user.activate" : "user.deactivate", "User", userId);
      return ok(user);
    }
  );

  app.delete("/users/:userId", { preHandler: requirePermission("users.delete") }, async (request, reply) => {
    const { userId } = userIdParamsSchema.parse(request.params);
    await usersService.deleteUser(userId, request.admin!.userId);
    await recordAudit(request, "user.delete", "User", userId);
    return reply.status(204).send();
  });
}
