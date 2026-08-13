import { prisma } from "../../database/prisma.js";
import { UnauthorizedError } from "../../shared/errors.js";
import { verifyPassword } from "../../shared/passwords.js";
import * as usersRepository from "../users/users.repository.js";

/**
 * Valida e-mail/senha e retorna os dados mínimos necessários para emitir
 * o token de sessão, incluindo o perfil e as permissões atuais (a UI usa
 * isso pra mostrar só o que o usuário pode fazer). Não diferencia
 * "usuário não existe" de "senha errada" na mensagem de erro, e trata
 * usuário desativado como credenciais inválidas — não vaza que a conta
 * existe mas está desativada.
 */
export async function authenticateAdmin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user || !user.isActive) {
    throw new UnauthorizedError("E-mail ou senha inválidos");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("E-mail ou senha inválidos");
  }

  await usersRepository.touchLastLogin(user.id);

  const permissionKeys = user.role.isSystem
    ? "ALL"
    : user.role.permissions.map((rp) => rp.permission.key);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: { id: user.role.id, key: user.role.key, name: user.role.name, isSystem: user.role.isSystem },
    permissions: permissionKeys,
  };
}
