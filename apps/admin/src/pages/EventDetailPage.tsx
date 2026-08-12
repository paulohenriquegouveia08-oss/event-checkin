import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../api/client";
import { ParticipantsTab } from "./event/ParticipantsTab";
import { TerminalsTab } from "./event/TerminalsTab";
import { StatisticsTab } from "./event/StatisticsTab";
import { LiveMonitorTab } from "./event/LiveMonitorTab";
import { ReportTab } from "./event/ReportTab";

type Tab = "participants" | "terminals" | "statistics" | "monitor" | "report";

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [tab, setTab] = useState<Tab>("participants");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [saving, setSaving] = useState(false);

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

  function startEditing() {
    if (!event) return;
    setEditName(event.name);
    setEditLocation(event.location ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!eventId || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateEvent(eventId, {
        name: editName.trim(),
        location: editLocation.trim() || undefined,
      });
      setEvent(updated);
      setEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
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
        <div style={{ flex: 1 }}>
          {editing ? (
            <div className="stack" style={{ gap: 8 }}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do evento"
                autoFocus
              />
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Local / Endereço"
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm" onClick={handleSave} disabled={saving || !editName.trim()}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div onClick={startEditing} style={{ cursor: "pointer" }} title="Clique para editar">
              <h1 style={{ fontSize: 22, margin: 0 }}>{event.name}</h1>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {new Date(event.startDate).toLocaleDateString("pt-BR")} —{" "}
                {new Date(event.endDate).toLocaleDateString("pt-BR")}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
          )}
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
        <TabButton active={tab === "monitor"} onClick={() => setTab("monitor")}>
          Monitor
        </TabButton>
        <TabButton active={tab === "report"} onClick={() => setTab("report")}>
          Relatório
        </TabButton>
      </div>

      {tab === "participants" ? <ParticipantsTab eventId={eventId} /> : null}
      {tab === "terminals" ? <TerminalsTab eventId={eventId} /> : null}
      {tab === "statistics" ? <StatisticsTab eventId={eventId} /> : null}
      {tab === "monitor" ? <LiveMonitorTab eventId={eventId} /> : null}
      {tab === "report" ? <ReportTab eventId={eventId} /> : null}
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
