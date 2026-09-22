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

export interface AdminNewInscriptionEvent {
  type: "new_inscription";
  eventId: string;
  inscription: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    document: string;
    category: string;
    amount: number;
    status: "PENDING" | "CONFIRMED";
    paymentMethod?: string | null;
    createdAt: string;
    gratuita: boolean;
  };
}

export interface AdminInscriptionConfirmedEvent {
  type: "inscription_confirmed";
  eventId: string;
  inscriptionId: string;
  name: string;
  email: string;
  category: string;
  amount: number;
  paymentMethod?: string | null;
  confirmedAt: string;
}

export interface AdminInscriptionStatusEvent {
  type: "inscription_status_changed";
  eventId: string;
  inscriptionId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

export type AdminRealtimeEvent =
  | AdminCheckInEvent
  | AdminNewInscriptionEvent
  | AdminInscriptionConfirmedEvent
  | AdminInscriptionStatusEvent;

type Listener = (event: AdminRealtimeEvent) => void;

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

  publish(eventId: string, event: AdminRealtimeEvent): void {
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
