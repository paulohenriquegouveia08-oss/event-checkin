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
