/** Gera um id local único por terminal (não precisa de aleatoriedade
 * criptográfica — é só a chave de idempotência da sincronização offline,
 * nunca sai do escopo deste aparelho até virar `localCheckInId` no
 * backend). Evita adicionar `expo-crypto` só para isso. */
export function generateLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
