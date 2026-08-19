import { AppError } from "../../shared/errors.js";
import * as checkinsService from "../checkins/checkins.service.js";
import type { SyncRequestInput } from "./synchronization.schema.js";

export interface SyncItemResult {
  localCheckInId: string;
  status: "CONFIRMED" | "ALREADY_CHECKED_IN" | "REJECTED";
  code?: string;
  message?: string;
  participant?: { id: string; name: string };
  checkedInAt?: Date;
}

/**
 * Processa cada check-in offline do lote de forma independente — um item
 * inválido (QR desconhecido, participante inativo) nunca aborta o restante
 * do lote. O terminal usa o resultado por item para marcar cada registro
 * local como sincronizado, rejeitado ou já confirmado antes.
 */
export async function syncCheckIns(
  eventId: string,
  terminalId: string,
  terminalName: string,
  input: SyncRequestInput
): Promise<SyncItemResult[]> {
  const results: SyncItemResult[] = [];

  for (const item of input.checkIns) {
    try {
      const outcome = await checkinsService.performCheckIn({
        eventId,
        qrToken: item.qrToken,
        terminalId,
        terminalName,
        source: "OFFLINE_SYNC",
        checkedInAt: item.checkedInAt,
        localCheckInId: item.localCheckInId,
      });
      results.push({
        localCheckInId: item.localCheckInId,
        status: outcome.status,
        participant: outcome.participant,
        checkedInAt: outcome.checkIn.checkedInAt,
      });
    } catch (error) {
      if (error instanceof AppError) {
        results.push({
          localCheckInId: item.localCheckInId,
          status: "REJECTED",
          code: error.code,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  return results;
}
