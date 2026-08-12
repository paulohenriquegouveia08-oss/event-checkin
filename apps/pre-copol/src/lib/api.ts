const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface EventData {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

export interface InscriptionInput {
  name: string;
  email: string;
  document: string;
  phone: string;
  category: "STUDENT_UP" | "STUDENT_OTHER" | "PROFESSIONAL";
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
