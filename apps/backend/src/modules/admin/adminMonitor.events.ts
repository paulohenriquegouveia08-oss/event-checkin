export interface AdminCheckInEvent {
  type: "check_in";
  eventId: string;
  participantId: string;
  participantName: string;
  participantEmail?: string | null;
  participantPhone?: string | null;
  participantDocument?: string | null;
  status: "CONFIRMED" | "ALREADY_CHECKED_IN" | "REJECTED";
  checkedInAt: string;
  terminalName?: string | null;
  terminalId?: string | null;
  source?: string;
  errorMessage?: string;
}

type Listener = (event: AdminCheckInEvent) => void;

class AdminCheckInEventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(eventId: string, listener: Listener): () => void {
    if (!this.listeners.has(eventId)) {
      this.listeners.set(eventId, new Set());
    }
    this.listeners.get(eventId)!.add(listener);

    return () => {
      this.listeners.get(eventId)?.delete(listener);
      if (this.listeners.get(eventId)?.size === 0) {
        this.listeners.delete(eventId);
      }
    };
  }

  publish(eventId: string, event: AdminCheckInEvent): void {
    const subs = this.listeners.get(eventId);
    if (subs) {
      subs.forEach((listener) => listener(event));
    }
  }

  getSubscriberCount(eventId: string): number {
    return this.listeners.get(eventId)?.size ?? 0;
  }
}

export const adminCheckInBus = new AdminCheckInEventBus();
