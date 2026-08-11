import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";

const STATUS_BADGE: Record<api.TerminalRecord["status"], string> = {
  PENDING: "badge-warning",
  ACTIVE: "badge-success",
  INACTIVE: "badge-danger",
};
const STATUS_LABEL: Record<api.TerminalRecord["status"], string> = {
  PENDING: "Aguardando ativação",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

export function TerminalsTab({ eventId }: { eventId: string }) {
  const [terminals, setTerminals] = useState<api.TerminalRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<api.TerminalRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function reload() {
    api
      .listTerminals(eventId)
      .then(setTerminals)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar terminais"));
  }

  useEffect(reload, [eventId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const terminal = await api.createTerminal(eventId, name);
      setJustCreated(terminal);
      setName("");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar terminal");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(terminal: api.TerminalRecord) {
    const confirmed = window.confirm(
      `Excluir o terminal "${terminal.name}"? O aparelho vinculado a ele vai se desconectar automaticamente ` +
        "na próxima vez que tentar falar com o servidor. O histórico de presenças já registradas por ele é mantido."
    );
    if (!confirmed) return;

    setError(null);
    setDeletingId(terminal.id);
    try {
      await api.deleteTerminal(eventId, terminal.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir terminal");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="stack">
      <form onSubmit={handleCreate} className="card">
        <div className="row">
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="term-name">Nome do terminal (ex.: Entrada Principal)</label>
            <input id="term-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Criando..." : "+ Criar terminal"}
          </button>
        </div>
      </form>

      {justCreated ? (
        <div className="card" style={{ borderColor: "var(--primary)" }}>
          <p style={{ margin: 0 }}>
            Terminal <strong>{justCreated.name}</strong> ({justCreated.identifier}) criado. Código de ativação
            (uso único, válido por 72h):
          </p>
          <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, margin: "12px 0" }}>
            {justCreated.activationCode}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Digite este código na tela de configuração inicial do app do terminal (M10 Pro). Ele não pode ser
            recuperado depois — se perder, crie um novo terminal.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setJustCreated(null)}>
            Fechar
          </button>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {terminals && terminals.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Identificador</th>
                <th>Status</th>
                <th>Último contato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="muted">{t.identifier}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </td>
                  <td className="muted">
                    {t.lastSeenAt ? new Date(t.lastSeenAt).toLocaleString("pt-BR") : "Nunca"}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(t)}
                      disabled={deletingId === t.id}
                    >
                      {deletingId === t.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : terminals ? (
        <p className="muted">Nenhum terminal cadastrado ainda.</p>
      ) : null}
    </div>
  );
}
