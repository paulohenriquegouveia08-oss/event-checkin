import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";

const STATUS_LABEL: Record<api.EventRecord["status"], string> = {
  ACTIVE: "Ativo",
  CLOSED: "Encerrado",
};
const STATUS_BADGE: Record<api.EventRecord["status"], string> = {
  ACTIVE: "badge-success",
  CLOSED: "badge-warning",
};

export function EventsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("events.create");
  const [events, setEvents] = useState<api.EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    api
      .listEvents()
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar eventos"));
  }

  useEffect(reload, []);

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ fontSize: 22, margin: 0 }}>Eventos</h1>
        {canCreate ? (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Novo evento"}
          </button>
        ) : null}
      </div>

      {showForm && canCreate ? (
        <CreateEventForm
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {!events ? (
        <p className="muted">Carregando...</p>
      ) : events.length === 0 ? (
        <p className="muted">Nenhum evento cadastrado ainda.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Local</th>
                <th>Início</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Link to={`/eventos/${event.id}`}>{event.name}</Link>
                  </td>
                  <td className="muted">{event.location ?? "—"}</td>
                  <td className="muted">{new Date(event.startDate).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[event.status]}`}>{STATUS_LABEL[event.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createEvent({
        name,
        location: location || undefined,
        description: description || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label htmlFor="name">Nome do evento</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="startDate">Início</label>
          <input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="endDate">Fim</label>
          <input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="location">Local</label>
        <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="description">Descrição</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? "Criando..." : "Criar evento"}
      </button>
    </form>
  );
}
