import { prisma } from "../../database/prisma.js";

const withRole = { role: true } as const;

export function listUsers() {
  return prisma.user.findMany({ include: withRole, orderBy: { createdAt: "asc" } });
}

export function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, include: withRole });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(data: { name: string; email: string; passwordHash: string; roleId: string }) {
  return prisma.user.create({ data, include: withRole });
}

export function updateUser(
  userId: string,
  data: Partial<{ name: string; email: string; roleId: string; passwordHash: string }>
) {
  return prisma.user.update({ where: { id: userId }, data, include: withRole });
}

export function setUserActive(userId: string, isActive: boolean) {
  return prisma.user.update({ where: { id: userId }, data: { isActive }, include: withRole });
}

export function deleteUser(userId: string) {
  return prisma.user.delete({ where: { id: userId } });
}

export function countUsersWithSystemRole() {
  return prisma.user.count({ where: { role: { isSystem: true }, isActive: true } });
}

export function touchLastLogin(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}
