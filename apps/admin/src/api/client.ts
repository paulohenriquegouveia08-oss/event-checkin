// Base URL configurável em build-time (VITE_API_URL) — aponta pro backend
// Fastify da Fase 1. Em dev local, cai para localhost:3900 por padrão.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3900";

const TOKEN_KEY = "admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}
interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  // Só declara Content-Type JSON quando há corpo de fato — o Fastify
  // rejeita (400 -> nosso error handler devolve 500) uma requisição com
  // esse header presente e corpo vazio (POST/DELETE sem payload, como
  // rotate-qr-token ou excluir terminal).
  const headers: Record<string, string> = {};
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // 204 (ex.: DELETE) não tem corpo — response.json() lançaria erro de parse.
  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!json.success) {
    if (response.status === 401) {
      clearToken();
    }
    throw new ApiError(json.error.message, json.error.code, response.status);
  }
  return json.data;
}

// --- Auth ---
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
export function login(email: string, password: string) {
  return request<{ token: string; user: AdminUser }>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// --- Events ---
export interface EventRecord {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}
export function listEvents() {
  return request<EventRecord[]>("/events");
}
export function getEvent(eventId: string) {
  return request<EventRecord>(`/events/${eventId}`);
}
export function createEvent(input: {
  name: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
}) {
  return request<EventRecord>("/events", { method: "POST", body: input });
}
export function updateEvent(eventId: string, input: Partial<EventRecord>) {
  return request<EventRecord>(`/events/${eventId}`, { method: "PATCH", body: input });
}

// --- Participants ---
export interface ParticipantRecord {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  status: "ACTIVE" | "CANCELLED";
  qrToken: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export function listParticipants(eventId: string) {
  return request<ParticipantRecord[]>(`/events/${eventId}/participants`);
}
export function createParticipant(
  eventId: string,
  input: { name: string; email?: string; phone?: string; document?: string }
) {
  return request<ParticipantRecord>(`/events/${eventId}/participants`, { method: "POST", body: input });
}
export function updateParticipant(
  eventId: string,
  participantId: string,
  input: Partial<Pick<ParticipantRecord, "name" | "email" | "phone" | "document" | "status">>
) {
  return request<ParticipantRecord>(`/events/${eventId}/participants/${participantId}`, {
    method: "PATCH",
    body: input,
  });
}
export function rotateQrToken(eventId: string, participantId: string) {
  return request<ParticipantRecord>(`/events/${eventId}/participants/${participantId}/rotate-qr-token`, {
    method: "POST",
  });
}
export function deleteParticipant(eventId: string, participantId: string) {
  return request<void>(`/events/${eventId}/participants/${participantId}`, { method: "DELETE" });
}

export interface ImportRow {
  row: number;
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  status: "valid" | "invalid" | "duplicate";
  reason?: string;
}
export interface ImportReport {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  imported: number;
  rows: ImportRow[];
}
export function importParticipants(eventId: string, csv: string, confirm: boolean) {
  return request<ImportReport>(`/events/${eventId}/participants/import`, {
    method: "POST",
    body: { csv, confirm },
  });
}

// --- Terminals ---
export interface TerminalRecord {
  id: string;
  eventId: string;
  name: string;
  identifier: string;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  activationCode: string | null;
  activationCodeExpiresAt: string | null;
  activatedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export function listTerminals(eventId: string) {
  return request<TerminalRecord[]>(`/events/${eventId}/terminals`);
}
export function createTerminal(eventId: string, name: string) {
  return request<TerminalRecord>(`/events/${eventId}/terminals`, { method: "POST", body: { name } });
}
export function deleteTerminal(eventId: string, terminalId: string) {
  return request<void>(`/events/${eventId}/terminals/${terminalId}`, { method: "DELETE" });
}

// --- Statistics ---
export interface EventStatistics {
  totalRegistered: number;
  totalCheckedIn: number;
  totalAbsent: number;
  attendancePercentage: number;
  checkInsByTerminal: { terminalId: string | null; count: number }[];
}
export function getStatistics(eventId: string) {
  return request<EventStatistics>(`/events/${eventId}/statistics`);
}

export function checkHealth() {
  return request<{ status: string; apiVersion: string }>("/health", { auth: false });
}
