const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://137.131.233.254:3000";

export interface PricingTier {
  key: string;
  label: string;
  amount: number;
}

export interface Step {
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
  eventTitle: string;
  eventYear: string;
  heroBadge: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  stepsTitle: string;
  steps: Step[];
  pricingTitle: string;
  pricingTiers: PricingTier[];
  partnersTitle: string;
  partnersText: string;
  footerText: string;
}

export interface EventData {
  id: string;
  name: string;
  slug?: string | null;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: string;
  registrationDeadline: string | null;
  registrationsOpen: boolean;
  siteContent: SiteContent;
  pixKey?: string;
  pixKeyType?: string;
  pixReceiverName?: string;
}

export interface InscriptionInput {
  name: string;
  email: string;
  document: string;
  phone: string;
  category?: string;
  institution?: string;
  notes?: string;
  /** Versao do termo que estava na tela quando a pessoa aceitou.
   *  Ver src/lib/termos.ts — o servidor a grava junto com a data. */
  consentVersion: string;
}

export interface InscriptionResult {
  id: string;
  eventId: string;
  name: string;
  email: string;
  status: string;
  amount: number;
  category: string;
  paymentUrl?: string | null;
  qrCodeBase64?: string | null;
  qrCodeContent?: string | null;
  expiresAt?: string | null;
  pixKey?: string;
  pixKeyType?: string;
  pixReceiverName?: string;
}

export interface InscriptionPaymentStatus {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  amount: number;
  category: string;
  paymentUrl: string | null;
  qrCodeBase64: string | null;
  qrCodeContent: string | null;
  paymentExpiresAt: string | null;
  participantId: string | null;
  qrToken: string | null;
  attendeePortalUrl: string | null;
  name?: string;
  pixKey?: string;
  pixKeyType?: string;
  pixReceiverName?: string;
}

export interface InscriptionDetail {
  id: string;
  eventId: string;
  name: string;
  email: string;
  document: string;
  phone: string;
  category?: string;
  institution?: string;
  notes?: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  amount: number;
  pixKey?: string;
  pixKeyType?: string;
  pixReceiverName?: string;
}

export interface BatchItem {
  id: string;
  batchNumber: number;
  name: string;
  price: number | null;
  maxQuantity: number | null;
  confirmedCount: number;
  startDate?: string | null;
  endDate: string | null;
  status: "ACTIVE" | "CLOSED" | "UPCOMING" | "FINISHED";
  isActive: boolean;
}

export interface BatchesResponse {
  batches: BatchItem[];
  activeBatch: BatchItem | null;
}

export interface ScheduleItem {
  id: string;
  eventId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  speaker?: string | null;
  location?: string | null;
  description?: string | null;
  type?: string | null;
  order: number;
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message ?? "Erro na requisição");
  return json.data;
}

export function getEvent(eventId: string) {
  return request<EventData>(`/events/${eventId}/public`);
}

export function listActiveEvents() {
  return request<EventData[]>("/events/active");
}

export function createInscription(eventId: string, input: InscriptionInput) {
  return request<InscriptionResult>(`/events/${eventId}/inscriptions`, {
    method: "POST",
    body: input,
  });
}

export function getPaymentStatus(id: string) {
  return request<InscriptionPaymentStatus>(`/inscriptions/${id}/payment-status`);
}

export function getInscription(id: string) {
  return request<InscriptionDetail>(`/inscriptions/${id}`);
}

export function getBatches(eventId: string) {
  return request<BatchesResponse>(`/events/${eventId}/batches`);
}

export function getSchedule(eventId: string) {
  return request<ScheduleItem[]>(`/events/${eventId}/schedule`);
}

export interface PublicCertificate {
  valid: boolean;
  revoked: boolean;
  participantName: string;
  eventName: string;
  eventLocation: string | null;
  eventStartDate: string;
  eventEndDate: string;
  workloadHours: number | null;
  generatedAt: string | null;
}

export function getPublicCertificate(code: string) {
  return request<PublicCertificate>(`/public/certificates/${code}`);
}

// --- Submissão de trabalhos ---

export interface SubmissionPublicConfig {
  eventId: string;
  eventName: string;
  aberta: boolean;
  motivo: string | null;
  closesAt: string | null;
  maxFileSizeMb: number;
  /** Null = sem taxa. */
  feeAmount: number | null;
  modalities: { id: string; name: string; description: string | null }[];
  topics: { id: string; name: string }[];
}

export interface SubmissionPublicInput {
  modalityId?: string | null;
  topicId?: string | null;
  title: string;
  abstract: string;
  keywords: string[];
  authors: { name: string; email: string; institution?: string | null; isPresenter?: boolean }[];
  fileName: string;
  dataBase64: string;
}

export interface SubmissionPublicStatus {
  id: string;
  code: string;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID";
  feeAmount: number | null;
  paymentUrl: string | null;
  qrCodeContent: string | null;
  qrCodeBase64: string | null;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  fileName: string | null;
}

export function getSubmissionConfig(eventId: string) {
  return request<SubmissionPublicConfig>(`/public/events/${eventId}/submissions/config`);
}

/**
 * Tamanho de cada parte do arquivo, em caracteres de base64.
 *
 * O proxy HTTPS na frente da API recusa corpo acima de 1 MB — e o 413 dele
 * vem sem CORS, então o navegador só mostra "Failed to fetch". Arquivo
 * maior que isto vai em partes antes do formulário. Múltiplo de 4: cada
 * pedaço de base64 decodifica sozinho.
 */
const PARTE_BASE64 = 700_000;

/** A requisição nem chegou ao servidor — só nesse caso vale tentar de novo. */
class FalhaDeRede extends Error {}

/**
 * POST de JSON no envio de trabalho. Não usa `request()` porque precisa
 * tratar o 413 e o 429 — a resposta deles vem do proxy, não é o nosso
 * JSON de erro — e dar uma mensagem útil quando a rede cai no meio.
 */
async function postarEnvio<T>(caminho: string, corpo: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new FalhaDeRede("A conexão caiu durante o envio. Confira a internet e tente de novo.");
  }
  if (response.status === 413) {
    throw new Error("O arquivo é grande demais para o envio. Reduza o tamanho (ex.: exporte o PDF com imagens comprimidas) e tente de novo.");
  }
  if (response.status === 429) {
    throw new Error("Muitos envios seguidos deste endereço. Aguarde alguns minutos e tente de novo.");
  }
  const json = await response.json().catch(() => null);
  if (!json?.success) {
    const detalhe =
      json?.error?.details?.fieldErrors &&
      Object.values(json.error.details.fieldErrors as Record<string, string[]>).flat().filter(Boolean).join(" ");
    throw new Error(detalhe || json?.error?.message || "Não foi possível enviar o trabalho.");
  }
  return json.data as T;
}

/**
 * Envia o trabalho com o arquivo. Arquivo pequeno vai junto no formulário;
 * grande vai antes, em partes, e o formulário leva só o `uploadId`.
 * `aoProgredir` recebe de 0 a 1, para a tela mostrar o andamento.
 */
export async function createPublicSubmission(
  eventId: string,
  input: SubmissionPublicInput,
  aoProgredir?: (fracao: number) => void,
) {
  const { dataBase64, ...dados } = input;
  let arquivo: { dataBase64: string } | { uploadId: string } = { dataBase64 };

  if (dataBase64.length > PARTE_BASE64) {
    const uploadId = crypto.randomUUID();
    const total = Math.ceil(dataBase64.length / PARTE_BASE64);
    for (let index = 0; index < total; index++) {
      const parte = {
        uploadId,
        index,
        total,
        dataBase64: dataBase64.slice(index * PARTE_BASE64, (index + 1) * PARTE_BASE64),
      };
      const caminho = `/public/events/${eventId}/submissions/parts`;
      // Uma nova tentativa por parte: no celular a rede oscila, e reenviar
      // a mesma parte não duplica nada no servidor.
      await postarEnvio(caminho, parte).catch((err) => {
        if (err instanceof FalhaDeRede) return postarEnvio(caminho, parte);
        throw err;
      });
      aoProgredir?.((index + 1) / (total + 1));
    }
    arquivo = { uploadId };
  }

  const resultado = await postarEnvio<SubmissionPublicStatus>(
    `/public/events/${eventId}/submissions`,
    { ...dados, ...arquivo },
  );
  aoProgredir?.(1);
  return resultado;
}

export function getSubmissionStatus(submissionId: string) {
  return request<SubmissionPublicStatus>(`/public/submissions/${submissionId}`);
}

export function regenerateSubmissionPayment(submissionId: string) {
  return request<SubmissionPublicStatus>(`/public/submissions/${submissionId}/payment`, {
    method: "POST",
  });
}
