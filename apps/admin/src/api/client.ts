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
export interface AdminRoleRef {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRoleRef;
  // "ALL" pro perfil protegido (ADMINISTRADOR); lista de keys pros demais.
  permissions: "ALL" | string[];
}
export function login(email: string, password: string) {
  return request<{ token: string; user: AdminUser }>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// --- Perfis e permissões (RBAC) ---
export interface PermissionDef {
  id: string;
  key: string;
  description: string;
  category: string;
}
export interface RoleRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
  createdAt: string;
  updatedAt: string;
}
export function listRoles() {
  return request<RoleRecord[]>("/roles");
}
export function listPermissions() {
  return request<PermissionDef[]>("/permissions");
}
export function createRole(input: { name: string; description?: string }) {
  return request<RoleRecord>("/roles", { method: "POST", body: input });
}
export function updateRole(roleId: string, input: { name?: string; description?: string }) {
  return request<RoleRecord>(`/roles/${roleId}`, { method: "PATCH", body: input });
}
export function deleteRole(roleId: string) {
  return request<void>(`/roles/${roleId}`, { method: "DELETE" });
}
export function updateRolePermissions(roleId: string, permissionKeys: string[]) {
  return request<RoleRecord>(`/roles/${roleId}/permissions`, { method: "PUT", body: { permissionKeys } });
}

// --- Usuários ---
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: AdminRoleRef;
}
export function listUsers() {
  return request<UserRecord[]>("/users");
}
export function createUser(input: { name: string; email: string; password: string; roleId: string }) {
  return request<UserRecord>("/users", { method: "POST", body: input });
}
export function updateUser(
  userId: string,
  input: Partial<{ name: string; email: string; roleId: string; password: string }>
) {
  return request<UserRecord>(`/users/${userId}`, { method: "PATCH", body: input });
}
export function toggleUserActive(userId: string, isActive: boolean) {
  return request<UserRecord>(`/users/${userId}/toggle-active`, { method: "POST", body: { isActive } });
}
export function deleteUser(userId: string) {
  return request<void>(`/users/${userId}`, { method: "DELETE" });
}

// --- Auditoria ---
export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}
export function listAuditLogs(limit = 200) {
  return request<AuditLogRecord[]>(`/audit-logs?limit=${limit}`);
}

// --- Events ---
export interface PricingTier {
  key: string;
  label: string;
  amount: number;
}
export interface SiteStep {
  title: string;
  text: string;
}
export interface SiteContent {
  eventTitle?: string;
  eventYear?: string;
  heroBadge?: string;
  heroSubtitle?: string;
  aboutTitle?: string;
  aboutText?: string;
  stepsTitle?: string;
  steps?: SiteStep[];
  pricingTitle?: string;
  pricingTiers?: PricingTier[];
  partnersTitle?: string;
  partnersText?: string;
  footerText?: string;
}
export interface CertificateSignatory {
  name: string;
  role: string;
}

// Espelha ParagraphTokenKey/ParagraphSegment do backend
// (certificate-settings.ts) — cada token é um valor dinâmico do
// certificado (nome do evento, local, datas, carga horária), inserido
// como um "chip" protegido no RichTextEditor, nunca texto livre.
export type ParagraphTokenKey = "eventName" | "locationLabel" | "eventDateRange" | "workloadHours";
export type ParagraphSegment =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; color?: string }
  | { type: "token"; key: ParagraphTokenKey; bold?: boolean; italic?: boolean; color?: string };

export interface CertificateSettings {
  workloadHours?: number;
  closingText?: string;
  locationLabel?: string;
  signatories?: CertificateSignatory[];
  templateAssetKey?: string;
  // Hex "#RRGGBB". primaryColor = nome do participante, título do chip de
  // data, nomes dos signatários, e cor padrão de token no parágrafo.
  // textColor = corpo do parágrafo (padrão), local do chip de data, cargo
  // dos signatários.
  primaryColor?: string;
  textColor?: string;
  // O parágrafo descritivo inteiro, editável trecho a trecho — ver
  // RichTextEditor.tsx e CertificatesTab.tsx.
  paragraphSegments?: ParagraphSegment[];
}
export interface EventRecord {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "CLOSED";
  registrationDeadline: string | null;
  registrationsClosedAt: string | null;
  registrationsOpen: boolean;
  siteContent: SiteContent | null;
  certificateSettings: CertificateSettings | null;
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
export function updateEvent(
  eventId: string,
  input: Partial<Omit<EventRecord, "registrationDeadline">> & { registrationDeadline?: string | null }
) {
  return request<EventRecord>(`/events/${eventId}`, { method: "PATCH", body: input });
}
export function closeRegistrations(eventId: string) {
  return request<EventRecord>(`/events/${eventId}/registrations/close`, { method: "POST" });
}
export function reopenRegistrations(eventId: string) {
  return request<EventRecord>(`/events/${eventId}/registrations/reopen`, { method: "POST" });
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

// --- Report ---
export interface ReportCheckIn {
  participantName: string;
  participantEmail: string | null;
  participantPhone: string | null;
  participantDocument: string | null;
  terminalName: string | null;
  source: string;
  checkedInAt: string;
}
export interface EventReport {
  eventName: string;
  eventLocation: string;
  totalRegistered: number;
  totalCheckedIn: number;
  checkIns: ReportCheckIn[];
}
export function getReport(eventId: string) {
  return request<EventReport>(`/events/${eventId}/report`);
}

// --- Certificados ---
export interface CertificateStats {
  totalParticipants: number;
  present: number;
  eligible: number;
  generated: number;
  pending: number;
  revoked: number;
  eventEnded: boolean;
}
export function getCertificateStats(eventId: string) {
  return request<CertificateStats>(`/events/${eventId}/certificates/stats`);
}

export type CertificateRowStatus = "LOCKED" | "ELIGIBLE" | "GENERATED" | "REVOKED";
export interface CertificateRow {
  id: string;
  participantName: string;
  participantEmail: string | null;
  status: CertificateRowStatus;
  generatedAt: string | null;
  revokedAt: string | null;
}
export function listCertificates(eventId: string) {
  return request<CertificateRow[]>(`/events/${eventId}/certificates`);
}

export function releaseCertificates(eventId: string) {
  return request<{ createdCount: number }>(`/events/${eventId}/certificates/release`, { method: "POST" });
}

export function revokeCertificate(certificateId: string) {
  return request<CertificateRow>(`/certificates/${certificateId}/revoke`, { method: "POST" });
}

export function reinstateCertificate(certificateId: string) {
  return request<CertificateRow>(`/certificates/${certificateId}/reinstate`, { method: "POST" });
}

/** Baixa um PDF de teste do certificado (não gera/persiste nada de real —
 * ver generateTestCertificatePdf no backend). Não usa request<T>() porque
 * a resposta é application/pdf, não o envelope JSON success/data. */
export async function previewCertificate(eventId: string, name: string): Promise<void> {
  const token = getToken();
  const url = `${API_URL}/events/${eventId}/certificates/preview?name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const json = (await response.json()) as ApiFailure;
    throw new ApiError(json.error.message, json.error.code, response.status);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "certificado-teste.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// --- App do terminal (APK) ---
export interface ApkInfo {
  available: boolean;
  sizeBytes: number | null;
  updatedAt: string | null;
}
export function getApkInfo() {
  return request<ApkInfo>("/apk/info");
}

/** Baixa o APK do app do terminal. Mesmo padrão de previewCertificate:
 * não usa request<T>() porque a resposta é o binário, não o envelope
 * JSON success/data. */
export async function downloadApk(): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_URL}/apk`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const json = (await response.json()) as ApiFailure;
    throw new ApiError(json.error.message, json.error.code, response.status);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "pk-digital-credenciamento.apk";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function checkHealth() {
  return request<{ status: string; apiVersion: string }>("/health", { auth: false });
}
