import { getDatabase } from "./db";
import type { LocalParticipant } from "../types/index";

/** Substitui o cache local pelo roster mais recente vindo do backend.
 * Roda dentro de uma transação: ou atualiza tudo, ou nada — o terminal
 * nunca fica com uma mistura de dois snapshots diferentes. */
export async function replaceAll(participants: LocalParticipant[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM participants`);
    for (const p of participants) {
      await db.runAsync(
        `INSERT INTO participants (id, name, qrToken, status, updatedAt) VALUES (?, ?, ?, ?, ?)`,
        [p.id, p.name, p.qrToken, p.status, p.updatedAt]
      );
    }
  });
}

export async function findByQrToken(qrToken: string): Promise<LocalParticipant | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalParticipant>(
    `SELECT id, name, qrToken, status, updatedAt FROM participants WHERE qrToken = ?`,
    [qrToken]
  );
  return row ?? null;
}

export async function count(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) as total FROM participants`);
  return row?.total ?? 0;
}
