import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { hashPassword } from "../../shared/passwords.js";
import * as rolesRepository from "../roles/roles.repository.js";
import * as usersRepository from "./users.repository.js";
import type { CreateUserInput, UpdateUserInput } from "./users.schema.js";

function serializeUser(user: NonNullable<Awaited<ReturnType<typeof usersRepository.findUserById>>>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: { id: user.role.id, key: user.role.key, name: user.role.name, isSystem: user.role.isSystem },
  };
}

async function assertRoleExists(roleId: string) {
  const role = await rolesRepository.findRoleById(roleId);
  if (!role) throw new NotFoundError("Perfil selecionado não existe");
  return role;
}

async function assertEmailAvailable(email: string, ignoreUserId?: string) {
  const existing = await usersRepository.findUserByEmail(email);
  if (existing && existing.id !== ignoreUserId) {
    throw new ConflictError("EMAIL_IN_USE", "Já existe um usuário com este e-mail");
  }
}

/** Impede deixar o sistema sem nenhum usuário ativo com o perfil
 * protegido (ADMINISTRADOR) — sem isso, ninguém mais conseguiria
 * gerenciar usuários/perfis. Chamada antes de excluir, desativar ou
 * trocar o perfil de um usuário que hoje tem perfil de sistema. */
async function assertNotLastSystemUser(user: { role: { isSystem: boolean } }) {
  if (!user.role.isSystem) return;
  const count = await usersRepository.countUsersWithSystemRole();
  if (count <= 1) {
    throw new ForbiddenError("Precisa existir ao menos um usuário ativo com o perfil Administrador");
  }
}

export async function listUsers() {
  const users = await usersRepository.listUsers();
  return users.map(serializeUser);
}

export async function getUserOrThrow(userId: string) {
  const user = await usersRepository.findUserById(userId);
  if (!user) throw new NotFoundError("Usuário não encontrado");
  return user;
}

export async function createUser(input: CreateUserInput) {
  await assertRoleExists(input.roleId);
  await assertEmailAvailable(input.email);

  const passwordHash = await hashPassword(input.password);
  const user = await usersRepository.createUser({
    name: input.name,
    email: input.email,
    passwordHash,
    roleId: input.roleId,
  });
  return serializeUser(user);
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const current = await getUserOrThrow(userId);

  if (input.email) await assertEmailAvailable(input.email, userId);
  if (input.roleId && input.roleId !== current.roleId) {
    await assertRoleExists(input.roleId);
    await assertNotLastSystemUser(current);
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const updated = await usersRepository.updateUser(userId, {
    name: input.name,
    email: input.email,
    roleId: input.roleId,
    passwordHash,
  });
  return serializeUser(updated);
}

export async function setUserActive(userId: string, isActive: boolean, actorUserId: string) {
  const current = await getUserOrThrow(userId);

  if (!isActive) {
    if (userId === actorUserId) {
      throw new ForbiddenError("Você não pode desativar sua própria conta");
    }
    await assertNotLastSystemUser(current);
  }

  const updated = await usersRepository.setUserActive(userId, isActive);
  return serializeUser(updated);
}

export async function deleteUser(userId: string, actorUserId: string) {
  if (userId === actorUserId) {
    throw new ForbiddenError("Você não pode excluir sua própria conta");
  }
  const current = await getUserOrThrow(userId);
  await assertNotLastSystemUser(current);
  await usersRepository.deleteUser(userId);
}
