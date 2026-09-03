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
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: string;
  registrationDeadline: string | null;
  registrationsOpen: boolean;
  siteContent: SiteContent;
}

export interface InscriptionInput {
  name: string;
  email: string;
  document: string;
  phone: string;
  category?: string;
  institution?: string;
  notes?: string;
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
  startTime: string;
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
