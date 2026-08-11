import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";
import { QrCodeModal } from "../../components/QrCodeModal";
import { ImportCsvModal } from "../../components/ImportCsvModal";

export function ParticipantsTab({ eventId }: { eventId: string }) {
  const [participants, setParticipants] = useState<api.ParticipantRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [qrTarget, setQrTarget] = useState<api.ParticipantRecord | null>(null);

  function reload() {
    api
      .listParticipants(eventId)
      .then(setParticipants)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar participantes"));
  }

  useEffect(reload, [eventId]);

  async function handleToggleStatus(participant: api.ParticipantRecord) {
    setError(null);
    try {
      const nextStatus = participant.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
      await api.updateParticipant(eventId, participant.id, { status: nextStatus });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status do participante");
    }
  }

  async function handleRotateToken(participant: api.ParticipantRecord) {
    setError(null);
    try {
      await api.rotateQrToken(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar novo QR Code");
    }
  }

  async function handleDelete(participant: api.ParticipantRecord) {
    const confirmed = window.confirm(
      `Excluir "${participant.name}"? O QR Code dele deixa de funcionar e o histórico de presença dele neste evento é apagado. Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setError(null);
    try {
      await api.deleteParticipant(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir participante");
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted" style={{ margin: 0 }}>
          {participants ? `${participants.length} participante(s)` : "Carregando..."}
        </p>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            Importar CSV
          </button>
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Novo participante"}
          </button>
        </div>
      </div>

      {showForm ? (
        <CreateParticipantForm
          eventId={eventId}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {participants && participants.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Status</th>
                <th>QR Code</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="muted">{p.email ?? "—"}</td>
                  <td>
                    <span className={`badge ${p.status === "ACTIVE" ? "badge-success" : "badge-danger"}`}>
                      {p.status === "ACTIVE" ? "Ativo" : "Cancelado"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setQrTarget(p)}>
                      Ver QR
                    </button>
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRotateToken(p)}>
                        Gerar novo QR
                      </button>
                      <button
                        className={`btn btn-sm ${p.status === "ACTIVE" ? "btn-danger" : ""}`}
                        onClick={() => handleToggleStatus(p)}
                      >
                        {p.status === "ACTIVE" ? "Revogar" : "Reativar"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : participants ? (
        <p className="muted">Nenhum participante cadastrado ainda.</p>
      ) : null}

      {qrTarget ? (
        <QrCodeModal participantName={qrTarget.name} qrToken={qrTarget.qrToken} onClose={() => setQrTarget(null)} />
      ) : null}
      {showImport ? (
        <ImportCsvModal
          eventId={eventId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateParticipantForm({ eventId, onCreated }: { eventId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createParticipant(eventId, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        document: document || undefined,
      });
      setName("");
      setEmail("");
      setPhone("");
      setDocument("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar participante");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="row">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="p-name">Nome</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="p-email">E-mail</label>
          <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="p-phone">Telefone</label>
          <input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="p-doc">Documento</label>
          <input id="p-doc" value={document} onChange={(e) => setDocument(e.target.value)} />
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? "Criando..." : "Criar participante"}
      </button>
    </form>
  );
}
