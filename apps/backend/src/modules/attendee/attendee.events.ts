export interface CheckInEvent {
  type: 'check_in';
  participantId: string;
  participantName: string;
  status: 'CONFIRMED' | 'ALREADY_CHECKED_IN' | 'REJECTED';
  checkedInAt: string;
  terminalName?: string;
}

type Listener = (event: CheckInEvent) => void;

class AttendeeEventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(participantId: string, listener: Listener): () => void {
    if (!this.listeners.has(participantId)) {
      this.listeners.set(participantId, new Set());
    }
    this.listeners.get(participantId)!.add(listener);

    return () => {
      this.listeners.get(participantId)?.delete(listener);
      if (this.listeners.get(participantId)?.size === 0) {
        this.listeners.delete(participantId);
      }
    };
  }

  publish(participantId: string, event: CheckInEvent): void {
    const subs = this.listeners.get(participantId);
    if (subs) {
      subs.forEach((listener) => listener(event));
    }
  }

  getSubscriberCount(participantId: string): number {
    return this.listeners.get(participantId)?.size ?? 0;
  }
}

export const attendeeEventBus = new AttendeeEventBus();
