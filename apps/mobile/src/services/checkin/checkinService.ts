import * as checkinsRepository from "../../database/checkinsRepository";
import * as participantsRepository from "../../database/participantsRepository";
import * as configRepository from "../../database/configRepository";
import { ApiError, submitCheckIn } from "../api/client";
import { isOnline } from "../network/connectivity";
import { generateLocalId } from "../../utils/id";
import type { CheckInResult } from "../../types/index";

/**
 * Avisa o backend em segundo plano quando o terminal já resolveu o scan
 * sozinho, sem rede (token inválido, participante inativo, duplicidade já
 * conhecida localmente) — só para o monitor ao vivo do admin (SSE) saber
 * que aconteceu. Nunca é esperado pelo fluxo principal (dispara e
 * esquece; erro aqui não pode virar erro pro operador, que já tem a
 * resposta correta e imediata da checagem local) e só roda se houver
 * rede — sem isso, esses casos nunca apareciam no monitor porque a
 * checagem local nunca chegava a fazer nenhuma chamada HTTP.
 */
function reportForMonitor(config: { serverUrl: string; token: string; eventId: string }, qrToken: string): void {
  isOnline()
    .then((online) => {
      if (!online) return;
      return submitCheckIn(config.serverUrl, config.token, config.eventId, qrToken).then(() => undefined);
    })
    .catch(() => {
      // Sem rede de verdade, terminal ainda ativando, etc. — ignora; o
      // resultado que o operador já viu na tela continua correto.
    });
}

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
    reportForMonitor(config, qrToken);
    return { status: "INVALID_TOKEN" };
  }
  if (participant.status !== "ACTIVE") {
    reportForMonitor(config, qrToken);
    return { status: "PARTICIPANT_INACTIVE", participantName: participant.name };
  }

  // Duplicidade já conhecida por este terminal — resolve sem tocar rede
  // pro operador (resposta instantânea), mas ainda assim avisa o backend
  // em segundo plano pro monitor ao vivo do admin mostrar o duplicado.
  const existingLocal = await checkinsRepository.findByParticipantId(participant.id);
  if (existingLocal) {
    reportForMonitor(config, qrToken);
    return {
      status: "ALREADY_CHECKED_IN",
      participantName: participant.name,
      participantEmail: participant.email,
      participantPhone: participant.phone,
      participantDocument: participant.document,
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
      return {
        status: response.status,
        participantName: participant.name,
        participantEmail: response.participant.email,
        participantPhone: response.participant.phone,
        participantDocument: response.participant.document,
        checkedInAt: response.checkedInAt,
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_FOUND") {
        return { status: "INVALID_TOKEN" };
      }
      if (error instanceof ApiError && error.code === "FORBIDDEN") {
        return { status: "PARTICIPANT_INACTIVE", participantName: participant.name };
      }
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
  return {
    status: "CONFIRMED",
    participantName: participant.name,
    participantEmail: participant.email,
    participantPhone: participant.phone,
    participantDocument: participant.document,
    checkedInAt,
  };
}
