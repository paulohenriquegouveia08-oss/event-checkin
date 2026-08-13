import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { recordAudit } from "../audit/audit.service.js";
import * as rolesService from "./roles.service.js";
import { createRoleSchema, roleIdParamsSchema, updateRolePermissionsSchema, updateRoleSchema } from "./roles.schema.js";

export async function rolesRoutes(app: FastifyInstance) {
  app.get("/roles", { preHandler: requirePermission("roles.view") }, async () => {
    return ok(await rolesService.listRoles());
  });

  app.get("/permissions", { preHandler: requirePermission("roles.view") }, async () => {
    return ok(await rolesService.listPermissions());
  });

  app.get("/roles/:roleId", { preHandler: requirePermission("roles.view") }, async (request) => {
    const { roleId } = roleIdParamsSchema.parse(request.params);
    const role = await rolesService.getRoleOrThrow(roleId);
    return ok(role);
  });

  app.post("/roles", { preHandler: requirePermission("roles.create") }, async (request, reply) => {
    const input = createRoleSchema.parse(request.body);
    const role = await rolesService.createRole(input);
    await recordAudit(request, "role.create", "Role", role.id, { name: role.name });
    return reply.status(201).send(ok(role));
  });

  app.patch("/roles/:roleId", { preHandler: requirePermission("roles.edit") }, async (request) => {
    const { roleId } = roleIdParamsSchema.parse(request.params);
    const input = updateRoleSchema.parse(request.body);
    const role = await rolesService.updateRole(roleId, input);
    await recordAudit(request, "role.update", "Role", roleId, input);
    return ok(role);
  });

  app.delete("/roles/:roleId", { preHandler: requirePermission("roles.delete") }, async (request, reply) => {
    const { roleId } = roleIdParamsSchema.parse(request.params);
    await rolesService.deleteRole(roleId);
    await recordAudit(request, "role.delete", "Role", roleId);
    return reply.status(204).send();
  });

  app.put(
    "/roles/:roleId/permissions",
    { preHandler: requirePermission("roles.manage_permissions") },
    async (request) => {
      const { roleId } = roleIdParamsSchema.parse(request.params);
      const { permissionKeys } = updateRolePermissionsSchema.parse(request.body);
      const role = await rolesService.updateRolePermissions(roleId, permissionKeys);
      await recordAudit(request, "role.update_permissions", "Role", roleId, { permissionKeys });
      return ok(role);
    }
  );
}
