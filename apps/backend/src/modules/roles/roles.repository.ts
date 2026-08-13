import { prisma } from "../../database/prisma.js";
import type { CreateRoleInput, UpdateRoleInput } from "./roles.schema.js";

const withPermissions = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

export function listRoles() {
  return prisma.role.findMany({ include: withPermissions, orderBy: { createdAt: "asc" } });
}

export function findRoleById(roleId: string) {
  return prisma.role.findUnique({ where: { id: roleId }, include: withPermissions });
}

export function findRoleByKey(key: string) {
  return prisma.role.findUnique({ where: { key } });
}

export function createRole(data: CreateRoleInput & { key: string }) {
  return prisma.role.create({
    data: { key: data.key, name: data.name, description: data.description },
    include: withPermissions,
  });
}

export function updateRole(roleId: string, data: UpdateRoleInput) {
  return prisma.role.update({ where: { id: roleId }, data, include: withPermissions });
}

export function deleteRole(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export function countUsersWithRole(roleId: string) {
  return prisma.user.count({ where: { roleId } });
}

export async function setRolePermissions(roleId: string, permissionKeys: string[]) {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    }),
  ]);

  return findRoleById(roleId);
}

export function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
}
