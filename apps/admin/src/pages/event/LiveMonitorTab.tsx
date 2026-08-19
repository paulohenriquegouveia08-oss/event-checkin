import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "../../api/client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3900";

export interface MonitorEvent {
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

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function LiveMonitorTab({ eventId }: { eventId: string }) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const logRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (autoScrollRef.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    setConnection("connecting");
    const url = `${API_URL}/events/${eventId}/monitor?token=${token}`;
    const es = new EventSource(url);

    es.onopen = () => setConnection("connected");

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "connected") return;
        setEvents((prev) => [...prev.slice(-199), data]); // keep last 200
      } catch {
        // ignore parse errors (heartbeats etc)
      }
    };

    es.onerror = () => {
      setConnection("disconnected");
      es.close();
    };

    return () => {
      es.close();
      setConnection("disconnected");
    };
  }, [eventId]);

  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  function handleScroll() {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }

  function clearLog() {
    setEvents([]);
  }

  const confirmed = events.filter((e) => e.status === "CONFIRMED").length;
  const duplicated = events.filter((e) => e.status === "ALREADY_CHECKED_IN").length;
  const rejected = events.filter((e) => e.status === "REJECTED").length;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 16 }}>
          <StatusDot status={connection} />
          <span className="muted" style={{ fontSize: 13 }}>
            {connection === "connected"
              ? "Conectado — aguardando check-ins..."
              : connection === "connecting"
              ? "Conectando..."
              : "Desconectado — reconectando..."}
          </span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="badge badge-success">{confirmed} OK</span>
          <span className="badge badge-warning">{duplicated} duplicado</span>
          <span className="badge badge-danger">{rejected} erro</span>
          {events.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={clearLog}>
              Limpar
            </button>
          )}
        </div>
      </div>

      <div
        ref={logRef}
        onScroll={handleScroll}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: events.length === 0 ? 32 : 0,
          minHeight: 320,
          maxHeight: 500,
          overflowY: "auto",
          display: "flex",
          // Faltava isso — sem flexDirection, o container caía no padrão
          // "row" do flexbox e cada check-in (LogEntry) empilhava do lado
          // do outro em vez de um embaixo do outro. Era por isso que
          // parecia "não atualizar": os itens ficavam espremidos de lado.
          flexDirection: "column",
          alignItems: events.length === 0 ? "center" : "stretch",
          justifyContent: events.length === 0 ? "center" : "flex-start",
        }}
      >
        {events.length === 0 ? (
          <p className="muted" style={{ margin: 0, textAlign: "center" }}>
            Nenhum check-in registrado ainda.
            <br />
            Escaneie um QR code para ver os eventos aqui.
          </p>
        ) : (
          events.map((ev, i) => <LogEntry key={i} event={ev} />)
        )}
      </div>
    </div>
  );
}

function LogEntry({ event }: { event: MonitorEvent }) {
  const time = new Date(event.checkedInAt).toLocaleTimeString("pt-BR");
  const isOk = event.status === "CONFIRMED";
  const isDup = event.status === "ALREADY_CHECKED_IN";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", minWidth: 64 }}>
        {time}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          minWidth: 80,
          color: isOk ? "var(--success)" : isDup ? "var(--warning)" : "var(--danger)",
        }}
      >
        {isOk ? "SUCESSO" : isDup ? "DUPLICADO" : "ERRO"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{event.participantName}</span>
        {event.participantEmail ? (
          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
            {event.participantEmail}
          </span>
        ) : null}
        {event.errorMessage ? (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--danger)" }}>{event.errorMessage}</p>
        ) : null}
      </div>
      <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
        {event.terminalName ?? "—"}
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === "connected" ? "var(--success)" : status === "connecting" ? "var(--warning)" : "var(--danger)";
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        background: color,
        display: "inline-block",
        animation: status === "connecting" ? "pulse 1.5s infinite" : undefined,
      }}
    />
  );
}
