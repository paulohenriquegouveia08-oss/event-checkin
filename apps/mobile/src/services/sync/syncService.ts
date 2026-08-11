import * as checkinsRepository from "../../database/checkinsRepository";
import * as participantsRepository from "../../database/participantsRepository";
import * as configRepository from "../../database/configRepository";
import { fetchOfflineRoster, syncCheckInBatch, type SyncBatchItem } from "../api/client";

const BATCH_SIZE = 100; // bem abaixo do limite de 500 do backend por chamada

/** Baixa o roster completo do evento (participantes + qrTokens) e
 * substitui o cache local. Chamado na ativação e sob demanda enquanto
 * online — seção 13: "antes do evento, o terminal deve sincronizar
 * participantes, QR tokens, evento". */
export async function syncRoster(): Promise<{ participantCount: number }> {
  const config = await configRepository.loadConfig();
  if (!config) throw new Error("Terminal não configurado");

  const { participants } = await fetchOfflineRoster(config.serverUrl, config.token);
  await participantsRepository.replaceAll(participants);
  return { participantCount: participants.length };
}

export interface SyncPendingResult {
  attempted: number;
  synced: number;
  rejected: number;
}

/** Envia os check-ins feitos offline, em lotes. Cada item é resolvido
 * independentemente pelo backend (ver /docs/offline-sync.md) — um item
 * rejeitado não impede os demais de serem marcados como sincronizados. */
export async function syncPendingCheckIns(): Promise<SyncPendingResult> {
  const config = await configRepository.loadConfig();
  if (!config) throw new Error("Terminal não configurado");

  const pending = await checkinsRepository.listPending();
  if (pending.length === 0) {
    return { attempted: 0, synced: 0, rejected: 0 };
  }

  let synced = 0;
  let rejected = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const items: SyncBatchItem[] = batch.map((c) => ({
      localCheckInId: c.localCheckInId,
      qrToken: c.qrToken,
      checkedInAt: c.checkedInAt,
    }));

    const results = await syncCheckInBatch(config.serverUrl, config.token, items);

    for (const result of results) {
      if (result.status === "REJECTED") {
        await checkinsRepository.markSyncStatus(result.localCheckInId, "rejected", result.message);
        rejected += 1;
      } else {
        // CONFIRMED ou ALREADY_CHECKED_IN: em ambos os casos o backend já
        // tem um registro canônico para esse participante — do ponto de
        // vista deste terminal, o item local está resolvido.
        await checkinsRepository.markSyncStatus(result.localCheckInId, "synced");
        synced += 1;
      }
    }
  }

  return { attempted: pending.length, synced, rejected };
}
