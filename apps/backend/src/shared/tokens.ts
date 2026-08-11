import { randomBytes, createHash } from "node:crypto";

/**
 * Gera um token opaco de alta entropia (192 bits) para representar um
 * participante no QR Code. Nunca deriva de dados pessoais — é só um
 * identificador aleatório, sem significado fora do banco de dados.
 * Formato: "evt_<base64url>", ex.: evt_7Hk92LmP4x9qT...
 */
export function generateQrToken(): string {
  return `evt_${randomBytes(24).toString("base64url")}`;
}

// Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L) — o código de ativação
// é digitado manualmente pelo operador na configuração inicial do terminal.
const ACTIVATION_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Gera um código de ativação curto, no formato "XXXX-XXXX", para o operador
 * digitar no terminal. É de uso único e expira (ver TerminalService).
 */
export function generateActivationCode(): string {
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((byte) => ACTIVATION_ALPHABET[byte % ACTIVATION_ALPHABET.length])
      .join("");
  return `${pick(4)}-${pick(4)}`;
}

/** Hash SHA-256 (hex) usado para armazenar a credencial do terminal — permite
 * revogar/rotacionar sem guardar o token em claro no banco. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
