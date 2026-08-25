import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { QrCodeModal } from "../../components/QrCodeModal";
import { ImportCsvModal } from "../../components/ImportCsvModal";

const CERT_LABEL: Record<api.CertificateRowStatus, string> = {
  LOCKED: "Bloqueado",
  ELIGIBLE: "Liberado",
  GENERATED: "Emitido",
  REVOKED: "Revogado",
};

const CERT_BADGE_CLASS: Record<api.CertificateRowStatus, string> = {
  LOCKED: "badge",
  ELIGIBLE: "badge badge-success",
  GENERATED: "badge badge-success",
  REVOKED: "badge badge-danger",
};

export function ParticipantsTab({ eventId }: { eventId: string }) {
  const { hasPermission } = useAuth();
  const canIssue = hasPermission("certificates.issue");
  const canViewCertificates = hasPermission("certificates.view");

  const [participants, setParticipants] = useState<api.ParticipantRecord[] | null>(null);
  const [certificates, setCertificates] = useState<Record<string, api.ParticipantCertificateStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [qrTarget, setQrTarget] = useState<api.ParticipantRecord | null>(null);
  const [busyCertId, setBusyCertId] = useState<string | null>(null);

  function reload() {
    api
      .listParticipants(eventId)
      .then(setParticipants)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar participantes"));

    if (!canViewCertificates) return;
    api
      .listParticipantCertificates(eventId)
      .then((rows) => setCertificates(Object.fromEntries(rows.map((r) => [r.participantId, r]))))
      // Falha só na coluna de certificado não deve esconder a lista de
      // participantes — a coluna cai para "—" e o resto da aba segue.
      .catch(() => setCertificates({}));
  }

  useEffect(reload, [eventId, canViewCertificates]);

  async function handleReleaseCertificate(participant: api.ParticipantRecord) {
    const cert = certificates[participant.id];
    // Sem check-in a liberação contradiz a regra automática, então o
    // aviso é explícito — é exatamente o caso em que se quer ter certeza.
    const warning = cert && !cert.hasCheckIn ? "\n\nAtenção: esta pessoa NÃO tem check-in registrado neste evento." : "";
    if (!window.confirm(`Liberar o certificado de "${participant.name}"?${warning}`)) return;

    setError(null);
    setBusyCertId(participant.id);
    try {
      await api.releaseParticipantCertificate(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao liberar certificado");
    } finally {
      setBusyCertId(null);
    }
  }

  async function handleUndoRelease(participant: api.ParticipantRecord) {
    if (!window.confirm(`Cancelar a liberação manual do certificado de "${participant.name}"?`)) return;

    setError(null);
    setBusyCertId(participant.id);
    try {
      await api.undoReleaseParticipantCertificate(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar liberação");
    } finally {
      setBusyCertId(null);
    }
  }

  async function handleDownloadCertificate(participant: api.ParticipantRecord) {
    setError(null);
    setBusyCertId(participant.id);
    try {
      await api.downloadParticipantCertificate(eventId, participant.id);
      // O primeiro download é o que gera o PDF (status vira "Emitido"),
      // então recarrega para a coluna refletir isso.
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao baixar certificado");
    } finally {
      setBusyCertId(null);
    }
  }

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
                {canViewCertificates && <th>Certificado</th>}
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
                  {canViewCertificates && (
                    <td>
                      <CertificateCell
                        cert={certificates[p.id]}
                        busy={busyCertId === p.id}
                        canIssue={canIssue}
                        onRelease={() => handleReleaseCertificate(p)}
                        onUndoRelease={() => handleUndoRelease(p)}
                        onDownload={() => handleDownloadCertificate(p)}
                      />
                    </td>
                  )}
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

/** Coluna "Certificado" de um participante: o estado atual + as ações
 * que fazem sentido para esse estado.
 *
 * "Liberar" existe para o caso em que a regra automática (evento
 * encerrado + check-in) não cobre a realidade — a pessoa participou mas
 * o check-in não foi registrado, por exemplo. "Baixar" serve para o
 * admin reenviar o PDF por e-mail/WhatsApp quando a pessoa não consegue
 * baixar sozinha; o arquivo é idêntico ao que ela receberia. */
function CertificateCell({
  cert,
  busy,
  canIssue,
  onRelease,
  onUndoRelease,
  onDownload,
}: {
  cert: api.ParticipantCertificateStatus | undefined;
  busy: boolean;
  canIssue: boolean;
  onRelease: () => void;
  onUndoRelease: () => void;
  onDownload: () => void;
}) {
  if (!cert) return <span className="muted">—</span>;

  return (
    <div className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
      <span className={CERT_BADGE_CLASS[cert.status]}>{CERT_LABEL[cert.status]}</span>
      {cert.manuallyReleased && (
        <span className="muted" style={{ fontSize: 11 }}>
          liberado manualmente
        </span>
      )}
      {canIssue && (
        <div className="row" style={{ gap: 4 }}>
          {cert.canDownload && (
            <button className="btn btn-secondary btn-sm" onClick={onDownload} disabled={busy}>
              {busy ? "..." : "Baixar"}
            </button>
          )}
          {/* Revogado sai daqui de propósito: restaurar é ação da aba
              Certificados, para não haver dois caminhos divergentes. */}
          {cert.status !== "REVOKED" &&
            (cert.manuallyReleased ? (
              <button className="btn btn-secondary btn-sm" onClick={onUndoRelease} disabled={busy}>
                {busy ? "..." : "Cancelar liberação"}
              </button>
            ) : (
              !cert.canDownload && (
                <button className="btn btn-sm" onClick={onRelease} disabled={busy}>
                  {busy ? "..." : "Liberar"}
                </button>
              )
            ))}
        </div>
      )}
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
