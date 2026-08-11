import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../api/client";
import { ParticipantsTab } from "./event/ParticipantsTab";
import { TerminalsTab } from "./event/TerminalsTab";
import { StatisticsTab } from "./event/StatisticsTab";

type Tab = "participants" | "terminals" | "statistics";

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [tab, setTab] = useState<Tab>("participants");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    api
      .getEvent(eventId)
      .then(setEvent)
      .catch((err) => setError(err instanceof Error ? err.message : "Evento não encontrado"));
  }, [eventId]);

  async function handleStatusChange(status: api.EventRecord["status"]) {
    if (!eventId) return;
    const updated = await api.updateEvent(eventId, { status });
    setEvent(updated);
  }

  if (!eventId) return null;
  if (error) return <p className="error-text">{error}</p>;
  if (!event) return <p className="muted">Carregando...</p>;

  return (
    <div className="stack">
      <Link to="/eventos" className="muted" style={{ fontSize: 13 }}>
        ← Eventos
      </Link>

      <div className="spread">
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>{event.name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {new Date(event.startDate).toLocaleDateString("pt-BR")} —{" "}
            {new Date(event.endDate).toLocaleDateString("pt-BR")}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <select value={event.status} onChange={(e) => handleStatusChange(e.target.value as api.EventRecord["status"])} style={{ width: 160 }}>
          <option value="ACTIVE">Ativo</option>
          <option value="CLOSED">Encerrado</option>
        </select>
      </div>

      <div className="row" style={{ borderBottom: "1px solid var(--border)" }}>
        <TabButton active={tab === "participants"} onClick={() => setTab("participants")}>
          Participantes
        </TabButton>
        <TabButton active={tab === "terminals"} onClick={() => setTab("terminals")}>
          Terminais
        </TabButton>
        <TabButton active={tab === "statistics"} onClick={() => setTab("statistics")}>
          Estatísticas
        </TabButton>
      </div>

      {tab === "participants" ? <ParticipantsTab eventId={eventId} /> : null}
      {tab === "terminals" ? <TerminalsTab eventId={eventId} /> : null}
      {tab === "statistics" ? <StatisticsTab eventId={eventId} /> : null}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="btn-sm"
      style={{
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        borderRadius: 0,
        padding: "10px 4px",
        marginRight: 20,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}
