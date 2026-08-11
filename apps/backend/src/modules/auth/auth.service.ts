import { prisma } from "../../database/prisma.js";
import { UnauthorizedError } from "../../shared/errors.js";
import { verifyPassword } from "../../shared/passwords.js";

/**
 * Valida e-mail/senha e retorna os dados mínimos necessários para emitir
 * o token de sessão. Não diferencia "usuário não existe" de "senha errada"
 * na mensagem de erro, para não vazar quais e-mails estão cadastrados.
 */
export async function authenticateAdmin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("E-mail ou senha inválidos");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("E-mail ou senha inválidos");
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
