const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface ParticipantData {
  id: string;
  name: string;
  email: string;
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
    token: string;
    participant: ParticipantData;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export async function loginAttendee(
  email: string,
  eventName: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/attendee/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, eventName }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Erro ao fazer login");
  }

  return data;
}

export async function getParticipantMe(
  token: string
): Promise<ApiResponse<ParticipantData>> {
  const res = await fetch(`${API_URL}/attendee/me`, {
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
    `${API_URL}/attendee/checkin-status?token=${encodeURIComponent(token)}`
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
