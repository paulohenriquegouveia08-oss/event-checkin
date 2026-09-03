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
export interface SiteTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  textMutedColor: string;
}

export type SectionType =
  | "hero"
  | "about"
  | "schedule"
  | "batches"
  | "steps"
  | "partners"
  | "faq";

export interface SiteSectionConfig {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string | null;
  enabled: boolean;
  order: number;
  backgroundColor?: string | null;
  textColor?: string | null;
  content?: Record<string, any>;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PartnerItem {
  name: string;
  role?: string;
  logoUrl?: string | null;
}

export interface SiteContent {
  theme?: SiteTheme;
  sections?: SiteSectionConfig[];
  faqs?: FaqItem[];
  partnersList?: PartnerItem[];
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
  // Chave de storage da imagem de assinatura já enviada (ver
  // uploadSignatureImage/signatureImageUrl abaixo) — ausente = sem imagem.
  signatureImageKey?: string;
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

/** Estado do certificado por participante, para a coluna "Certificado" da
 * aba de participantes. Diferente de listCertificates(), cobre TODOS os
 * participantes — inclusive quem ainda não tem certificado, que é
 * justamente quem precisa da liberação manual. */
export interface ParticipantCertificateStatus {
  participantId: string;
  certificateId: string | null;
  status: CertificateRowStatus;
  generatedAt: string | null;
  manuallyReleased: boolean;
  hasCheckIn: boolean;
  canDownload: boolean;
}

export function listParticipantCertificates(eventId: string) {
  return request<ParticipantCertificateStatus[]>(`/events/${eventId}/participants/certificates`);
}

export function releaseParticipantCertificate(eventId: string, participantId: string) {
  return request<unknown>(`/events/${eventId}/participants/${participantId}/certificate/release`, {
    method: "POST",
  });
}

export function undoReleaseParticipantCertificate(eventId: string, participantId: string) {
  return request<unknown>(`/events/${eventId}/participants/${participantId}/certificate/release`, {
    method: "DELETE",
  });
}

/** Baixa o certificado de um participante pelo painel. Mesmo padrão de
 * previewCertificate: não usa request<T>() porque a resposta é o PDF
 * binário, não o envelope JSON success/data. O nome do arquivo vem do
 * servidor (Content-Disposition), que já inclui o nome da pessoa. */
export async function downloadParticipantCertificate(eventId: string, participantId: string): Promise<void> {
  const token = getToken();
  const response = await fetch(
    `${API_URL}/events/${eventId}/participants/${participantId}/certificate/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
  );

  if (!response.ok) {
    const json = (await response.json()) as ApiFailure;
    throw new ApiError(json.error.message, json.error.code, response.status);
  }

  const filename =
    /filename=([^;]+)/.exec(response.headers.get("Content-Disposition") ?? "")?.[1]?.trim() ?? "certificado.pdf";

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
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

/** Envia a imagem de assinatura de um signatário — base64 em JSON, não
 * multipart (arquivo pequeno, evita puxar uma dependência só pra isso no
 * backend). Devolve a chave de storage, que entra em
 * CertificateSignatory.signatureImageKey pra ser salva junto do resto das
 * configurações do certificado (PATCH /events/:eventId). */
export async function uploadSignatureImage(file: File): Promise<{ key: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });
  const dataBase64 = dataUrl.split(",")[1] ?? "";
  return request<{ key: string }>("/certificates/signature-image", {
    method: "POST",
    body: { mimeType: file.type, dataBase64 },
  });
}

/** Monta a URL pra um <img> mostrar uma assinatura já enviada — token via
 * query string, mesmo padrão do SSE de monitor (um <img src> não manda
 * header Authorization). */
export function signatureImageUrl(key: string): string {
  const filename = key.split("/").pop() ?? key;
  const token = getToken();
  return `${API_URL}/signatures/${encodeURIComponent(filename)}?token=${encodeURIComponent(token ?? "")}`;
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

// --- Configuração do evento (endereço público, fuso, módulos) ---
export interface EventModuleInfo {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  enabledAt: string | null;
  requires: string[];
}
export interface EventConfig {
  id: string;
  name: string;
  slug: string | null;
  timezone: string;
  language: string;
  visibility: "PUBLIC" | "PRIVATE";
  modules: EventModuleInfo[];
}

export function getEventConfig(eventId: string) {
  return request<EventConfig>(`/events/${eventId}/config`);
}
export function updateEventConfig(
  eventId: string,
  body: Partial<Pick<EventConfig, "slug" | "timezone" | "language" | "visibility">>
) {
  return request<EventConfig>(`/events/${eventId}/config`, { method: "PATCH", body });
}
export function toggleEventModule(eventId: string, moduleKey: string, enabled: boolean) {
  return request<{ module: string; enabled: boolean; alsoDisabled: string[] }>(
    `/events/${eventId}/modules/${moduleKey}`,
    { method: "PUT", body: { enabled } }
  );
}

// --- Submissão de trabalhos ---
export interface SubmissionSettings {
  opensAt: string | null;
  closesAt: string | null;
  authorFeeRequired: boolean;
  authorFeeAmount: number | null;
  maxFileSizeMb: number;
  minReviewsToDecide: number;
}
export interface CatalogItem {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  position: number;
  submissionCount: number;
}
export type SubmissionStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export interface SubmissionAuthorRecord {
  id: string;
  name: string;
  email: string;
  institution: string | null;
  isPresenter: boolean;
  position: number;
}
export interface SubmissionRecord {
  id: string;
  code: string;
  title: string;
  abstract: string;
  keywords: string[];
  status: SubmissionStatus;
  fileName: string | null;
  fileSizeBytes: number | null;
  submittedAt: string | null;
  decidedAt: string | null;
  modality: { id: string; name: string };
  topic: { id: string; name: string };
  authors: SubmissionAuthorRecord[];
}

export function getSubmissionSettings(eventId: string) {
  return request<SubmissionSettings>(`/events/${eventId}/submissions/settings`);
}
export function updateSubmissionSettings(eventId: string, body: Partial<SubmissionSettings>) {
  return request<SubmissionSettings>(`/events/${eventId}/submissions/settings`, {
    method: "PATCH",
    body,
  });
}
export function listModalities(eventId: string) {
  return request<CatalogItem[]>(`/events/${eventId}/submissions/modalities`);
}
export function createModality(eventId: string, name: string) {
  return request<CatalogItem>(`/events/${eventId}/submissions/modalities`, {
    method: "POST",
    body: { name },
  });
}
export function deleteModality(eventId: string, id: string) {
  return request<{ deleted: true }>(`/events/${eventId}/submissions/modalities/${id}`, {
    method: "DELETE",
  });
}
export function listTopics(eventId: string) {
  return request<CatalogItem[]>(`/events/${eventId}/submissions/topics`);
}
export function createTopic(eventId: string, name: string) {
  return request<CatalogItem>(`/events/${eventId}/submissions/topics`, {
    method: "POST",
    body: { name },
  });
}
export function deleteTopic(eventId: string, id: string) {
  return request<{ deleted: true }>(`/events/${eventId}/submissions/topics/${id}`, {
    method: "DELETE",
  });
}
export function listSubmissions(
  eventId: string,
  params: { status?: string; search?: string; page?: number } = {}
) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  const qs = q.toString();
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: SubmissionRecord[];
  }>(`/events/${eventId}/submissions${qs ? `?${qs}` : ""}`);
}
export function createSubmission(
  eventId: string,
  body: {
    modalityId: string;
    topicId: string;
    title: string;
    abstract: string;
    keywords: string[];
    authors: { name: string; email: string; institution?: string | null; isPresenter?: boolean }[];
  }
) {
  return request<SubmissionRecord>(`/events/${eventId}/submissions`, { method: "POST", body });
}
export function uploadSubmissionFile(
  eventId: string,
  submissionId: string,
  fileName: string,
  dataBase64: string
) {
  return request<{ id: string; fileName: string; fileSizeBytes: number }>(
    `/events/${eventId}/submissions/${submissionId}/file`,
    { method: "POST", body: { fileName, dataBase64 } }
  );
}
export function submitSubmission(eventId: string, submissionId: string) {
  return request<SubmissionRecord>(`/events/${eventId}/submissions/${submissionId}/submit`, {
    method: "POST",
  });
}
export function withdrawSubmission(eventId: string, submissionId: string) {
  return request<SubmissionRecord>(`/events/${eventId}/submissions/${submissionId}/withdraw`, {
    method: "POST",
  });
}
export function decideSubmission(
  eventId: string,
  submissionId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string
) {
  return request<SubmissionRecord>(`/events/${eventId}/submissions/${submissionId}/decide`, {
    method: "POST",
    body: { decision, reason },
  });
}
/** URL do PDF para abrir em nova aba. O token vai no header, então o
 *  link direto não serve — quem chama precisa buscar e criar um blob. */
export async function fetchSubmissionFile(eventId: string, submissionId: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_URL}/events/${eventId}/submissions/${submissionId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError("Não consegui abrir o arquivo", "file_error", res.status);
  return res.blob();
}

// --- Lotes Automáticos ---
export interface BatchItem {
  id: string;
  batchNumber: number;
  name: string;
  price: number;
  maxQuantity: number | null;
  confirmedCount: number;
  startDate?: string | null;
  endDate: string | null;
  status: "ACTIVE" | "CLOSED" | "UPCOMING" | "FINISHED";
  isActive: boolean;
}

export function getBatches(eventId: string) {
  return request<{ batches: BatchItem[]; activeBatch: BatchItem | null }>(`/events/${eventId}/batches`);
}

export function createBatch(
  eventId: string,
  body: {
    batchNumber?: number;
    name: string;
    price: number;
    maxQuantity?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  return request<BatchItem>(`/events/${eventId}/batches`, { method: "POST", body });
}

export function updateBatch(
  id: string,
  body: {
    batchNumber?: number;
    name?: string;
    price?: number;
    maxQuantity?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    isClosed?: boolean;
    isActive?: boolean;
  }
) {
  return request<BatchItem>(`/batches/${id}`, { method: "PUT", body });
}

export function deleteBatch(id: string) {
  return request<{ deleted: boolean }>(`/batches/${id}`, { method: "DELETE" });
}

export function activateBatch(eventId: string, id: string) {
  return request<{ batches: BatchItem[]; activeBatch: BatchItem | null }>(
    `/events/${eventId}/batches/${id}/activate`,
    { method: "POST" }
  );
}

export function seedDefaultBatches(eventId: string) {
  return request<BatchItem[]>(`/events/${eventId}/batches/seed-default`, { method: "POST" });
}

// --- Programação do Evento ---
export interface ScheduleItem {
  id: string;
  eventId: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  title: string;
  speaker?: string | null;
  location?: string | null;
  description?: string | null;
  type?: string | null;
  order: number;
}

export interface CreateScheduleInput {
  date: string;
  startTime: string;
  endTime?: string | null;
  title: string;
  speaker?: string | null;
  location?: string | null;
  description?: string | null;
  type?: string | null;
  order?: number;
}

export function getSchedule(eventId: string) {
  return request<ScheduleItem[]>(`/events/${eventId}/schedule`);
}

export function createScheduleItem(eventId: string, body: CreateScheduleInput) {
  return request<ScheduleItem>(`/events/${eventId}/schedule`, {
    method: "POST",
    body,
  });
}

export function updateScheduleItem(id: string, body: Partial<CreateScheduleInput>) {
  return request<ScheduleItem>(`/schedule/${id}`, {
    method: "PUT",
    body,
  });
}

export function deleteScheduleItem(id: string) {
  return request<{ deleted: boolean }>(`/schedule/${id}`, {
    method: "DELETE",
  });
}

export function reorderSchedule(eventId: string, itemIds: string[]) {
  return request<ScheduleItem[]>(`/events/${eventId}/schedule/reorder`, {
    method: "POST",
    body: { itemIds },
  });
}

// --- Relatório de Inscritos ---
export interface InscriptionReportItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  document: string;
  institution: string | null;
  category: string;
  amount: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId: string | null;
  participantId: string | null;
  createdAt: string;
}

export function getInscriptionsReport(eventId: string) {
  return request<InscriptionReportItem[]>(`/events/${eventId}/inscriptions/report`);
}

