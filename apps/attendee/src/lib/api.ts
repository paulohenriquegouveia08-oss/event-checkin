const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://137.131.233.254:3000";

export interface ParticipantData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  document: string | null;
  qrToken: string;
  status: string;
  event: {
    id: string;
    name: string;
    location: string | null;
    startDate: string;
    endDate: string;
  };
  lastCheckIn: {
    id: string;
    checkedInAt: string;
    terminal: { name: string } | null;
  } | null;
  checkedIn: boolean;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token?: string;
    participant?: ParticipantData;
    requiresEventSelection?: boolean;
    events?: ParticipantData[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export async function loginAttendee(
  email: string
): Promise<LoginResponse> {
  const res = await fetch("/api/attendee/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Erro ao fazer login");
  }

  return data;
}

export async function selectEvent(
  participantId: string
): Promise<LoginResponse> {
  const res = await fetch("/api/attendee/select-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Erro ao selecionar evento");
  }

  return data;
}

export async function getParticipantMe(
  token: string
): Promise<ApiResponse<ParticipantData>> {
  const res = await fetch("/api/attendee/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

// --- Meus documentos (certificado / comprovante) ---

export type CertificateDisplayStatus = "LOCKED" | "ELIGIBLE" | "GENERATED" | "REVOKED";

export interface MyDocuments {
  qrCode: { available: boolean };
  attendanceProof: { available: boolean };
  certificate: {
    status: CertificateDisplayStatus;
    canDownload: boolean;
    reason: "EVENT_NOT_ENDED" | "NOT_PRESENT" | null;
    generatedAt: string | null;
  };
}

export async function getMyDocuments(token: string, eventId: string): Promise<ApiResponse<MyDocuments>> {
  const res = await fetch(`/api/attendee/my-documents?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function downloadPdf(path: string, token: string, eventId: string, filename: string): Promise<void> {
  const res = await fetch(`${path}?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Não foi possível baixar o arquivo");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCertificate(token: string, eventId: string, participantName: string): Promise<void> {
  return downloadPdf("/api/attendee/certificate", token, eventId, `certificado-${participantName.replace(/\s+/g, "_")}.pdf`);
}

export function downloadAttendanceProof(token: string, eventId: string, participantName: string): Promise<void> {
  return downloadPdf(
    "/api/attendee/attendance-proof",
    token,
    eventId,
    `comprovante-${participantName.replace(/\s+/g, "_")}.pdf`
  );
}

export function connectSSE(
  token: string,
  onEvent: (event: any) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(
    `/api/attendee/checkin-status?token=${encodeURIComponent(token)}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch {
      // Ignore parse errors (heartbeat comments, etc.)
    }
  };

  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    onError?.(error);
  };

  return () => {
    eventSource.close();
  };
}
