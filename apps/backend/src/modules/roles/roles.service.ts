import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { PERMISSION_KEYS } from "../../shared/permissions.js";
import * as rolesRepository from "./roles.repository.js";
import type { CreateRoleInput, UpdateRoleInput } from "./roles.schema.js";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove marcas de acento (após NFD)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function generateUniqueKey(name: string): Promise<string> {
  const base = slugify(name) || "PERFIL";
  let candidate = base;
  let suffix = 2;
  while (await rolesRepository.findRoleByKey(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function serializeRole(role: NonNullable<Awaited<ReturnType<typeof rolesRepository.findRoleById>>>) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissionKeys: role.permissions.map((rp) => rp.permission.key),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function listRoles() {
  const roles = await rolesRepository.listRoles();
  return roles.map(serializeRole);
}

export async function getRoleOrThrow(roleId: string) {
  const role = await rolesRepository.findRoleById(roleId);
  if (!role) throw new NotFoundError("Perfil não encontrado");
  return role;
}

export async function createRole(input: CreateRoleInput) {
  const key = await generateUniqueKey(input.name);
  const role = await rolesRepository.createRole({ ...input, key });
  return serializeRole(role);
}

export async function updateRole(roleId: string, input: UpdateRoleInput) {
  const role = await getRoleOrThrow(roleId);
  if (role.isSystem && input.name) {
    throw new ForbiddenError("O perfil Administrador é protegido e não pode ser renomeado");
  }
  const updated = await rolesRepository.updateRole(roleId, input);
  return serializeRole(updated);
}

export async function deleteRole(roleId: string) {
  const role = await getRoleOrThrow(roleId);
  if (role.isSystem) {
    throw new ForbiddenError("O perfil Administrador é protegido e não pode ser excluído");
  }
  const userCount = await rolesRepository.countUsersWithRole(roleId);
  if (userCount > 0) {
    throw new ConflictError(
      "ROLE_IN_USE",
      `Este perfil tem ${userCount} usuário(s) vinculado(s). Troque o perfil deles antes de excluir.`
    );
  }
  await rolesRepository.deleteRole(roleId);
}

export async function updateRolePermissions(roleId: string, permissionKeys: string[]) {
  const role = await getRoleOrThrow(roleId);
  if (role.isSystem) {
    throw new ForbiddenError("O perfil Administrador sempre tem acesso completo — não há permissões pra configurar nele");
  }

  const invalid = permissionKeys.filter((k) => !PERMISSION_KEYS.has(k));
  if (invalid.length > 0) {
    throw new ValidationError(`Permissão(ões) desconhecida(s): ${invalid.join(", ")}`);
  }

  const updated = await rolesRepository.setRolePermissions(roleId, permissionKeys);
  return serializeRole(updated!);
}

export async function listPermissions() {
  return rolesRepository.listPermissions();
}
