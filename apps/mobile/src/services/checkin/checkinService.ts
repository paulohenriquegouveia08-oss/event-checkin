import * as checkinsRepository from "../../database/checkinsRepository";
import * as participantsRepository from "../../database/participantsRepository";
import * as configRepository from "../../database/configRepository";
import { ApiError, submitCheckIn } from "../api/client";
import { isOnline } from "../network/connectivity";
import { generateLocalId } from "../../utils/id";
import type { CheckInResult } from "../../types/index";

/**
 * Regra central de check-in do terminal — espelha, no lado do app, o que
 * `checkins.service.ts#performCheckIn` faz no backend (validação local
 * primeiro, tenta o servidor quando há rede, cai para modo offline sem
 * nunca travar o operador). Ver seção 11 e 13 da especificação do produto.
 */
export async function performCheckIn(qrToken: string): Promise<CheckInResult> {
  const config = await configRepository.loadConfig();
  if (!config) {
    throw new Error("Terminal não configurado");
  }

  const participant = await participantsRepository.findByQrToken(qrToken);
  if (!participant) {
    return { status: "INVALID_TOKEN" };
  }
  if (participant.status !== "ACTIVE") {
    return { status: "PARTICIPANT_INACTIVE", participantName: participant.name };
  }

  // Duplicidade já conhecida por este terminal — resolve sem tocar rede.
  const existingLocal = await checkinsRepository.findByParticipantId(participant.id);
  if (existingLocal) {
    return {
      status: "ALREADY_CHECKED_IN",
      participantName: participant.name,
      checkedInAt: existingLocal.checkedInAt,
    };
  }

  const online = await isOnline();
  if (online) {
    try {
      const response = await submitCheckIn(config.serverUrl, config.token, config.eventId, qrToken);
      await checkinsRepository.insert({
        localCheckInId: generateLocalId(),
        participantId: participant.id,
        participantName: participant.name,
        qrToken,
        checkedInAt: response.checkedInAt,
        syncStatus: "synced",
      });
      return { status: response.status, participantName: participant.name, checkedInAt: response.checkedInAt };
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_FOUND") {
        return { status: "INVALID_TOKEN" };
      }
      if (error instanceof ApiError && error.code === "FORBIDDEN") {
        return { status: "PARTICIPANT_INACTIVE", participantName: participant.name };
      }
      // Falha de rede mesmo com isOnline() indicando conexão (timeout,
      // servidor fora do ar, etc.) — cai para o caminho offline abaixo em
      // vez de travar o operador. Fail-safe > fail-fast aqui.
    }
  }

  const checkedInAt = new Date().toISOString();
  await checkinsRepository.insert({
    localCheckInId: generateLocalId(),
    participantId: participant.id,
    participantName: participant.name,
    qrToken,
    checkedInAt,
    syncStatus: "pending",
  });
  return { status: "CONFIRMED", participantName: participant.name, checkedInAt };
}
