import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const STATUS_LABEL: Record<api.CertificateRowStatus, string> = {
  LOCKED: "Bloqueado",
  ELIGIBLE: "Elegível",
  GENERATED: "Gerado",
  REVOKED: "Revogado",
};

const STATUS_BADGE_CLASS: Record<api.CertificateRowStatus, string> = {
  LOCKED: "badge",
  ELIGIBLE: "badge badge-warning",
  GENERATED: "badge badge-success",
  REVOKED: "badge badge-danger",
};

export function CertificatesTab({ eventId }: { eventId: string }) {
  const { hasPermission } = useAuth();
  const canIssue = hasPermission("certificates.issue");

  const [stats, setStats] = useState<api.CertificateStats | null>(null);
  const [rows, setRows] = useState<api.CertificateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Participante de Teste");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function reload() {
    Promise.all([api.getCertificateStats(eventId), api.listCertificates(eventId)])
      .then(([s, list]) => {
        setStats(s);
        setRows(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar certificados"));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      await api.previewCertificate(eventId, previewName.trim() || "Participante de Teste");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Não foi possível gerar o certificado de teste");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleRelease() {
    setReleasing(true);
    setError(null);
    try {
      await api.releaseCertificates(eventId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível liberar os certificados");
    } finally {
      setReleasing(false);
    }
  }

  async function handleRevoke(certificateId: string) {
    setBusyRowId(certificateId);
    setError(null);
    try {
      await api.revokeCertificate(certificateId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível revogar o certificado");
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleReinstate(certificateId: string) {
    setBusyRowId(certificateId);
    setError(null);
    try {
      await api.reinstateCertificate(certificateId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível restaurar o certificado");
    } finally {
      setBusyRowId(null);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <p className="muted">Carregando...</p>;

  return (
    <div className="stack">
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Inscritos" value={stats.totalParticipants} />
        <StatCard label="Presentes" value={stats.present} color="var(--success)" />
        <StatCard label="Elegíveis" value={stats.eligible} color="var(--primary)" />
        <StatCard label="Gerados" value={stats.generated} color="var(--success)" />
        <StatCard label="Pendentes" value={stats.pending} color="var(--warning)" />
        <StatCard label="Revogados" value={stats.revoked} color="var(--danger)" />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Testar emissão</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          Gera e baixa um PDF de exemplo com o template atual — não depende do evento ter terminado nem de nenhuma
          presença confirmada, e não conta nas estatísticas nem fica salvo (o QR não valida, só é ilustrativo).
        </p>
        <div className="row" style={{ gap: 8 }}>
          <input
            value={previewName}
            onChange={(e) => setPreviewName(e.target.value)}
            placeholder="Nome de teste"
            style={{ flex: 1, maxWidth: 280 }}
          />
          <button className="btn btn-sm" onClick={handlePreview} disabled={previewing}>
            {previewing ? "Gerando..." : "Baixar certificado de teste"}
          </button>
        </div>
        {previewError && (
          <p className="error-text" style={{ marginBottom: 0 }}>
            {previewError}
          </p>
        )}
      </div>

      {!stats.eventEnded && (
        <p className="muted" style={{ margin: 0 }}>
          O evento ainda não terminou — os certificados serão liberados automaticamente para quem tiver presença
          confirmada assim que o evento encerrar.
        </p>
      )}

      {canIssue && stats.eventEnded && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={handleRelease} disabled={releasing}>
            {releasing ? "Liberando..." : "Liberar certificados"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={reload}>
            Recarregar
          </button>
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Certificados por participante</h2>
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhum certificado liberado ainda — participantes presentes aparecem aqui depois do encerramento do
            evento (ou ao clicar em "Liberar certificados").
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Status</th>
                <th>Gerado em</th>
                {canIssue && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.participantName}
                    {row.participantEmail && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 12 }}>
                          {row.participantEmail}
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={STATUS_BADGE_CLASS[row.status]}>{STATUS_LABEL[row.status]}</span>
                  </td>
                  <td className="muted">
                    {row.generatedAt ? new Date(row.generatedAt).toLocaleString("pt-BR") : "—"}
                  </td>
                  {canIssue && (
                    <td>
                      {row.status === "GENERATED" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRevoke(row.id)}
                          disabled={busyRowId === row.id}
                        >
                          {busyRowId === row.id ? "..." : "Revogar"}
                        </button>
                      )}
                      {row.status === "REVOKED" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleReinstate(row.id)}
                          disabled={busyRowId === row.id}
                        >
                          {busyRowId === row.id ? "..." : "Restaurar"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ flex: "1 1 120px", textAlign: "center" }}>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: color ?? "var(--text)" }}>{value}</p>
    </div>
  );
}
