import type { LocalParticipant } from "../../types/index";
import { emitTerminalUnauthorized } from "../session/sessionEvents";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}
interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// O check-in é o único caminho onde uma resposta lenta do servidor
// afeta diretamente o operador na fila (seção 23: poucos segundos por
// pessoa). Um timeout curto aqui garante que, se o servidor não responder
// rápido, o app cai para o fluxo offline sem fazer a pessoa esperar.
const CHECKIN_REQUEST_TIMEOUT_MS = 3000;

async function request<T>(
  serverUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${serverUrl.replace(/\/$/, "")}${path}`, {
      method: options.method ?? "GET",
      headers: {
        // Só declara JSON quando há corpo — o Fastify rejeita (400) uma
        // requisição com esse header e corpo vazio (achado real: dava
        // 500 no painel admin num POST sem body; aplicando a mesma
        // correção aqui defensivamente).
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401 && options.token) {
      // Credencial do terminal revogada (ex.: excluído no painel admin,
      // ou reativado noutro aparelho). Não adianta insistir — avisa quem
      // chamou (checkinService/syncService) via ApiError com código
      // próprio; a camada de sessão (session/sessionEvents.ts) decide o
      // que fazer (desconectar o app sozinho).
      emitTerminalUnauthorized();
    }

    const json = (await response.json()) as ApiSuccess<T> | ApiFailure;

    if (!json.success) {
      throw new ApiError(json.error.message, json.error.code, response.status);
    }
    return json.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Servidor não respondeu a tempo", "TIMEOUT", 0);
    }
    throw new ApiError("Não foi possível conectar ao servidor", "NETWORK_ERROR", 0);
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkServerHealth(serverUrl: string): Promise<boolean> {
  try {
    await request<{ status: string }>(serverUrl, "/health");
    return true;
  } catch {
    return false;
  }
}

export interface ActivationResponse {
  token: string;
  terminal: { id: string; name: string; identifier: string };
  event: { id: string; name: string; status: string };
}

export function activateTerminal(serverUrl: string, activationCode: string): Promise<ActivationResponse> {
  return request<ActivationResponse>(serverUrl, "/terminals/activate", {
    method: "POST",
    body: { activationCode },
  });
}

export interface OfflineRosterResponse {
  event: { id: string; name: string; status: string };
  participants: LocalParticipant[];
}

export function fetchOfflineRoster(serverUrl: string, token: string): Promise<OfflineRosterResponse> {
  return request<OfflineRosterResponse>(serverUrl, "/terminals/sync/participants", { token });
}

export type OnlineCheckInStatus = "CONFIRMED" | "ALREADY_CHECKED_IN";

export interface OnlineCheckInResponse {
  status: OnlineCheckInStatus;
  participant: { id: string; name: string };
  checkedInAt: string;
}

export function submitCheckIn(
  serverUrl: string,
  token: string,
  eventId: string,
  qrToken: string
): Promise<OnlineCheckInResponse> {
  return request<OnlineCheckInResponse>(serverUrl, `/events/${eventId}/checkins`, {
    method: "POST",
    token,
    timeoutMs: CHECKIN_REQUEST_TIMEOUT_MS,
    body: { qrToken },
  });
}

export interface SyncBatchItem {
  localCheckInId: string;
  qrToken: string;
  checkedInAt: string;
}

export type SyncItemStatus = "CONFIRMED" | "ALREADY_CHECKED_IN" | "REJECTED";

export interface SyncBatchResultItem {
  localCheckInId: string;
  status: SyncItemStatus;
  code?: string;
  message?: string;
}

export async function syncCheckInBatch(
  serverUrl: string,
  token: string,
  items: SyncBatchItem[]
): Promise<SyncBatchResultItem[]> {
  const { results } = await request<{ results: SyncBatchResultItem[] }>(serverUrl, "/terminals/sync", {
    method: "POST",
    token,
    body: { checkIns: items },
  });
  return results;
}
