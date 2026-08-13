import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ParticipantsTab } from "./event/ParticipantsTab";
import { TerminalsTab } from "./event/TerminalsTab";
import { StatisticsTab } from "./event/StatisticsTab";
import { LiveMonitorTab } from "./event/LiveMonitorTab";
import { ReportTab } from "./event/ReportTab";
import { SiteTab } from "./event/SiteTab";

type Tab = "participants" | "terminals" | "statistics" | "monitor" | "report" | "site";

const TABS: { key: Tab; label: string; permission: string }[] = [
  { key: "participants", label: "Participantes", permission: "participants.view" },
  { key: "terminals", label: "Terminais", permission: "terminals.view" },
  { key: "statistics", label: "Estatísticas", permission: "statistics.view" },
  { key: "monitor", label: "Monitor", permission: "monitor.view" },
  { key: "report", label: "Relatório", permission: "reports.view" },
  { key: "site", label: "Site", permission: "events.edit" },
];

// <input type="datetime-local"> trabalha em componentes de hora LOCAL do
// navegador (sem timezone). new Date(iso) e date.getHours()/etc também
// usam o timezone local do navegador — então essa conversão é consistente
// (não mistura com o timezone do servidor). Ao salvar, .toISOString()
// converte de volta pra um instante UTC não-ambíguo.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { hasPermission } = useAuth();
  const canEditEvent = hasPermission("events.edit");
  const visibleTabs = TABS.filter((t) => hasPermission(t.permission));
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setEditStartDate(toDatetimeLocal(event.startDate));
    setEditEndDate(toDatetimeLocal(event.endDate));
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!eventId || !editName.trim() || !editStartDate || !editEndDate) return;
    const startDate = fromDatetimeLocal(editStartDate);
    const endDate = fromDatetimeLocal(editEndDate);
    if (endDate < startDate) {
      setSaveError("A data de término não pode ser antes da data de início.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateEvent(eventId, {
        name: editName.trim(),
        location: editLocation.trim() || undefined,
        startDate,
        endDate,
      });
      setEvent(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  if (!eventId) return null;
  if (error) return <p className="error-text">{error}</p>;
  if (!event) return <p className="muted">Carregando...</p>;

  const activeTab = tab && visibleTabs.some((t) => t.key === tab) ? tab : (visibleTabs[0]?.key ?? null);

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
                <label className="stack" style={{ gap: 2, flex: 1 }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Início
                  </span>
                  <input
                    type="datetime-local"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </label>
                <label className="stack" style={{ gap: 2, flex: 1 }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Término
                  </span>
                  <input
                    type="datetime-local"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                </label>
              </div>
              {saveError ? <p className="error-text">{saveError}</p> : null}
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={handleSave}
                  disabled={saving || !editName.trim() || !editStartDate || !editEndDate}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={canEditEvent ? startEditing : undefined}
              style={canEditEvent ? { cursor: "pointer" } : undefined}
              title={canEditEvent ? "Clique para editar" : undefined}
            >
              <h1 style={{ fontSize: 22, margin: 0 }}>{event.name}</h1>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {new Date(event.startDate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} —{" "}
                {new Date(event.endDate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
          )}
        </div>
        {canEditEvent ? (
          <select value={event.status} onChange={(e) => handleStatusChange(e.target.value as api.EventRecord["status"])} style={{ width: 160 }}>
            <option value="ACTIVE">Ativo</option>
            <option value="CLOSED">Encerrado</option>
          </select>
        ) : (
          <span className={`badge ${event.status === "ACTIVE" ? "badge-success" : "badge-warning"}`}>
            {event.status === "ACTIVE" ? "Ativo" : "Encerrado"}
          </span>
        )}
      </div>

      {visibleTabs.length > 0 ? (
        <div className="row" style={{ borderBottom: "1px solid var(--border)" }}>
          {visibleTabs.map((t) => (
            <TabButton key={t.key} active={activeTab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabButton>
          ))}
        </div>
      ) : null}

      {activeTab === "participants" ? <ParticipantsTab eventId={eventId} /> : null}
      {activeTab === "terminals" ? <TerminalsTab eventId={eventId} /> : null}
      {activeTab === "statistics" ? <StatisticsTab eventId={eventId} /> : null}
      {activeTab === "monitor" ? <LiveMonitorTab eventId={eventId} /> : null}
      {activeTab === "report" ? <ReportTab eventId={eventId} /> : null}
      {activeTab === "site" ? <SiteTab eventId={eventId} /> : null}
      {!activeTab ? <p className="muted">Você não tem permissão para ver nenhuma aba deste evento.</p> : null}
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
