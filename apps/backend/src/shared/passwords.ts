import bcrypt from "bcryptjs";

// bcryptjs (implementação pura em JS do bcrypt) foi escolhida em vez de
// argon2/bcrypt nativos para não depender de compilação de módulo nativo
// no build da imagem Docker da VPS nem no ambiente de desenvolvimento —
// ver docs/security.md para a justificativa completa.
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
