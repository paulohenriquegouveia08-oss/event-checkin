import { getDatabase } from "./db";
import type { LocalCheckIn, LocalCheckInSyncStatus } from "../types/index";

export async function insert(checkIn: LocalCheckIn): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO checkins (localCheckInId, participantId, participantName, qrToken, checkedInAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      checkIn.localCheckInId,
      checkIn.participantId,
      checkIn.participantName,
      checkIn.qrToken,
      checkIn.checkedInAt,
      checkIn.syncStatus,
    ]
  );
}

/** Mesma regra do backend, aplicada localmente: um participante só pode
 * ter um check-in neste terminal. A constraint UNIQUE(participantId) na
 * tabela é a garantia real; esta consulta é usada para decidir qual
 * feedback mostrar (CONFIRMED vs ALREADY_CHECKED_IN) antes de tentar o
 * INSERT. */
export async function findByParticipantId(participantId: string): Promise<LocalCheckIn | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalCheckIn>(`SELECT * FROM checkins WHERE participantId = ?`, [
    participantId,
  ]);
  return row ?? null;
}

export async function listPending(): Promise<LocalCheckIn[]> {
  const db = await getDatabase();
  return db.getAllAsync<LocalCheckIn>(`SELECT * FROM checkins WHERE syncStatus = 'pending' ORDER BY checkedInAt ASC`);
}

/** Todas as presenças confirmadas por este terminal (exclui os poucos
 * casos raros de 'rejected' — ex.: participante cancelado depois do
 * check-in local, antes de sincronizar — esses não contam como presença
 * válida). Usado no relatório de presença (tela de configurações). */
export async function listConfirmed(): Promise<LocalCheckIn[]> {
  const db = await getDatabase();
  return db.getAllAsync<LocalCheckIn>(
    `SELECT * FROM checkins WHERE syncStatus IN ('pending', 'synced') ORDER BY checkedInAt ASC`
  );
}

export async function markSyncStatus(
  localCheckInId: string,
  syncStatus: LocalCheckInSyncStatus,
  rejectionReason?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE checkins SET syncStatus = ?, rejectionReason = ? WHERE localCheckInId = ?`, [
    syncStatus,
    rejectionReason ?? null,
    localCheckInId,
  ]);
}

export interface CheckInCounts {
  total: number;
  pending: number;
  synced: number;
  rejected: number;
}

/** Usado na tela de scanner para o operador saber se há pendências de
 * sincronização (seção 29 — observabilidade). */
export async function counts(): Promise<CheckInCounts> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ syncStatus: LocalCheckInSyncStatus; total: number }>(
    `SELECT syncStatus, COUNT(*) as total FROM checkins GROUP BY syncStatus`
  );
  const result: CheckInCounts = { total: 0, pending: 0, synced: 0, rejected: 0 };
  for (const row of rows) {
    result[row.syncStatus] = row.total;
    result.total += row.total;
  }
  return result;
}
