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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyCode(terminal: api.TerminalRecord) {
    if (!terminal.activationCode) return;
    navigator.clipboard.writeText(terminal.activationCode).then(() => {
      setCopiedId(terminal.id);
      setTimeout(() => setCopiedId((id) => (id === terminal.id ? null : id)), 1500);
    });
  }

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
      await api.createTerminal(eventId, name);
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

      {error ? <p className="error-text">{error}</p> : null}

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        O código de ativação de cada terminal fica sempre visível na coluna abaixo enquanto ele estiver "Aguardando
        ativação" — digite-o na tela de configuração inicial do app do terminal (M10 Pro).
      </p>

      {terminals && terminals.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Identificador</th>
                <th>Status</th>
                <th>Código de ativação</th>
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
                  <td>
                    {t.status === "PENDING" && t.activationCode ? (
                      <ActivationCodeCell terminal={t} copied={copiedId === t.id} onCopy={() => copyCode(t)} />
                    ) : (
                      <span className="muted">—</span>
                    )}
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

/** Código de ativação sempre visível na lista (não só na hora da criação)
 * — antes só aparecia num card que sumia ao fechar/recarregar a página,
 * mesmo o backend já devolvendo o código o tempo todo enquanto o
 * terminal está PENDING (só é apagado no momento da ativação). */
function ActivationCodeCell({
  terminal,
  copied,
  onCopy,
}: {
  terminal: api.TerminalRecord;
  copied: boolean;
  onCopy: () => void;
}) {
  const expired = terminal.activationCodeExpiresAt ? new Date(terminal.activationCodeExpiresAt) < new Date() : false;

  return (
    <div className="row" style={{ gap: 8, alignItems: "center" }}>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 1,
          color: expired ? "var(--danger)" : "var(--text)",
        }}
      >
        {terminal.activationCode}
      </span>
      <button className="btn btn-secondary btn-sm" onClick={onCopy} type="button" title="Copiar código">
        {copied ? "Copiado!" : "Copiar"}
      </button>
      {expired ? (
        <span className="badge badge-danger">Expirado — exclua e crie outro</span>
      ) : terminal.activationCodeExpiresAt ? (
        <span className="muted" style={{ fontSize: 12 }}>
          expira em {new Date(terminal.activationCodeExpiresAt).toLocaleString("pt-BR")}
        </span>
      ) : null}
    </div>
  );
}
