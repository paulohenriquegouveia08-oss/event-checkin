/** Configuração de ativação do terminal, salva localmente após
 * POST /terminals/activate. Sem isso, o app mostra o assistente de
 * configuração inicial em vez da tela de scanner. */
export interface TerminalConfig {
  serverUrl: string;
  token: string;
  terminalId: string;
  terminalName: string;
  eventId: string;
  eventName: string;
}

/** Cópia local (SQLite) de um participante, baixada de
 * GET /terminals/sync/participants — é contra ela que o app valida
 * leituras de QR Code quando está offline. */
export interface LocalParticipant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  qrToken: string;
  status: "ACTIVE" | "CANCELLED";
  updatedAt: string;
}

export type LocalCheckInSyncStatus = "pending" | "synced" | "rejected";

/** Registro de check-in feito no terminal. Existe tanto para check-ins
 * que já foram confirmados online quanto para os feitos offline
 * aguardando sincronização — `syncStatus` distingue os dois casos. */
export interface LocalCheckIn {
  localCheckInId: string;
  participantId: string;
  participantName: string;
  qrToken: string;
  checkedInAt: string; // ISO 8601 — momento real da leitura, não do envio
  syncStatus: LocalCheckInSyncStatus;
  rejectionReason?: string;
}

/** Desfecho de uma tentativa de check-in — usado tanto no fluxo online
 * quanto no offline, para a tela de scanner decidir qual feedback mostrar
 * (seção 22 da especificação do produto). */
export type CheckInResultStatus =
  | "CONFIRMED"
  | "ALREADY_CHECKED_IN"
  | "INVALID_TOKEN"
  | "PARTICIPANT_INACTIVE";

export interface CheckInResult {
  status: CheckInResultStatus;
  participantName?: string;
  participantEmail?: string | null;
  participantPhone?: string | null;
  participantDocument?: string | null;
  checkedInAt?: string;
}
