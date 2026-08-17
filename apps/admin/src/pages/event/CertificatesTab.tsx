import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ContentSection, ListEditor, TextAreaField, TextField } from "../../components/FormFields";

// Espelha DEFAULT_CERTIFICATE_SETTINGS do backend
// (certificate-settings.ts) — preenche o formulário com o que já está no
// ar quando o evento ainda não tem nada customizado.
const DEFAULT_SETTINGS = {
  workloadHours: 16,
  closingText: "O evento proporcionou atualização científica e integração entre profissionais e acadêmicos da odontologia.",
  locationLabel: "Londrina/PR",
};
const DEFAULT_SIGNATORIES: api.CertificateSignatory[] = [
  { name: "Gustavo Nascimento De Souza Pinto", role: "Coordenador do Evento" },
  { name: "Pablo Guilherme Caldarelli", role: "Coordenador Geral do Campus Coordenador do Curso de Odontologia" },
  { name: "Amanda Vessoni Barbosa Kasuya", role: "Coordenador Adjunta do Curso de Odontologia." },
];
const MAX_SIGNATORIES = 3;

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
  // Salvar o texto do certificado é uma edição do próprio Event
  // (Event.certificateSettings, via PATCH /events/:eventId) — mesma
  // permissão que já protege a aba Site, não certificates.issue.
  const canEditSettings = hasPermission("events.edit");

  const [stats, setStats] = useState<api.CertificateStats | null>(null);
  const [rows, setRows] = useState<api.CertificateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Participante de Teste");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [workloadHours, setWorkloadHours] = useState(DEFAULT_SETTINGS.workloadHours);
  const [closingText, setClosingText] = useState(DEFAULT_SETTINGS.closingText);
  const [locationLabel, setLocationLabel] = useState(DEFAULT_SETTINGS.locationLabel);
  const [signatories, setSignatories] = useState<api.CertificateSignatory[]>(DEFAULT_SIGNATORIES);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  function reload() {
    Promise.all([api.getCertificateStats(eventId), api.listCertificates(eventId)])
      .then(([s, list]) => {
        setStats(s);
        setRows(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar certificados"));
  }

  function loadSettings() {
    api
      .getEvent(eventId)
      .then((event) => {
        const c = event.certificateSettings ?? {};
        setWorkloadHours(c.workloadHours || DEFAULT_SETTINGS.workloadHours);
        setClosingText(c.closingText || DEFAULT_SETTINGS.closingText);
        setLocationLabel(c.locationLabel || DEFAULT_SETTINGS.locationLabel);
        setSignatories(c.signatories && c.signatories.length > 0 ? c.signatories : DEFAULT_SIGNATORIES);
      })
      .catch((err) => setSettingsError(err instanceof Error ? err.message : "Falha ao carregar configurações do certificado"));
  }

  useEffect(() => {
    reload();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function updateSignatory<K extends keyof api.CertificateSignatory>(index: number, key: K, value: api.CertificateSignatory[K]) {
    setSignatories((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }
  function addSignatory() {
    if (signatories.length >= MAX_SIGNATORIES) return;
    setSignatories((prev) => [...prev, { name: "", role: "" }]);
  }
  function removeSignatory(index: number) {
    setSignatories((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveSettings() {
    setSettingsError(null);
    setSettingsNotice(null);

    if (!locationLabel.trim()) {
      setSettingsError("Preencha o local exibido no certificado.");
      return;
    }
    if (!workloadHours || workloadHours <= 0) {
      setSettingsError("A carga horária precisa ser maior que zero.");
      return;
    }
    const cleanSignatories = signatories
      .map((s) => ({ name: s.name.trim(), role: s.role.trim() }))
      .filter((s) => s.name && s.role);
    if (cleanSignatories.length === 0) {
      setSettingsError("Configure pelo menos um signatário.");
      return;
    }

    setSavingSettings(true);
    try {
      await api.updateEvent(eventId, {
        certificateSettings: {
          workloadHours,
          closingText: closingText.trim() || undefined,
          locationLabel: locationLabel.trim(),
          signatories: cleanSignatories,
        },
      });
      setSignatories(cleanSignatories);
      setSettingsNotice("Configurações do certificado salvas.");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Falha ao salvar as configurações do certificado");
    } finally {
      setSavingSettings(false);
    }
  }

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

      {canEditSettings && (
      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Texto do certificado</h2>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 12 }}>
          Nome do participante, nome do evento e as datas vêm automaticamente do evento — só o que está aqui embaixo
          precisa ser configurado à parte. O layout (logo, título, ondas, logos de apoio) continua fixo.
        </p>

        <div className="stack" style={{ gap: 24 }}>
          <ContentSection title="Parágrafo descritivo">
            <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
              <TextField label="Local (ex.: Cidade/UF)" value={locationLabel} onChange={setLocationLabel} />
              <div style={{ flex: "0 0 140px" }}>
                <label className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Carga horária (horas)
                </label>
                <input
                  type="number"
                  min={1}
                  value={workloadHours}
                  onChange={(e) => setWorkloadHours(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <TextAreaField
              label='Texto de fechamento (depois de "...carga horária total de X horas.")'
              value={closingText}
              onChange={setClosingText}
              rows={2}
            />
          </ContentSection>

          <ContentSection title="Signatários (até 3, aparecem no rodapé)">
            <ListEditor label="Signatários" onAdd={addSignatory} addDisabled={signatories.length >= MAX_SIGNATORIES}>
              {signatories.map((signatory, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <div className="stack" style={{ gap: 6, flex: 1 }}>
                    <input
                      value={signatory.name}
                      onChange={(e) => updateSignatory(i, "name", e.target.value)}
                      placeholder="Nome"
                    />
                    <input
                      value={signatory.role}
                      onChange={(e) => updateSignatory(i, "role", e.target.value)}
                      placeholder="Cargo"
                    />
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeSignatory(i)}
                    type="button"
                    disabled={signatories.length <= 1}
                    title="Remover signatário"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </ListEditor>
          </ContentSection>

          {settingsError && <p className="error-text" style={{ margin: 0 }}>{settingsError}</p>}
          {settingsNotice && (
            <p style={{ color: "var(--success)", margin: 0, fontSize: 13 }}>{settingsNotice}</p>
          )}

          <div>
            <button className="btn btn-sm" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? "Salvando..." : "Salvar texto do certificado"}
            </button>
          </div>
        </div>
      </div>
      )}

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
