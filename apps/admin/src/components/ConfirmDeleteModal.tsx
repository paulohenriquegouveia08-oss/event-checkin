import { useState } from "react";
import * as api from "../api/client";

export interface ConfirmDeleteModalProps {
  eventId?: string;
  selectedId?: string;
  inscriptionId?: string;
  participantName: string;
  participantEmail?: string;
  loading?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onConfirm?: () => Promise<void> | void;
}

/**
 * Modal de confirmação de segurança para exclusão permanente de inscrições/participantes.
 * Exibe aviso explícito de que o registro será excluído permanentemente e não poderá ser recuperado.
 */
export function ConfirmDeleteModal({
  eventId,
  selectedId,
  inscriptionId,
  participantName,
  participantEmail,
  loading: externalLoading,
  onClose,
  onSuccess,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetId = selectedId || inscriptionId;
  const isDeleting = externalLoading ?? internalLoading;

  async function handleConfirm() {
    setError(null);

    // Se um handler customizado onConfirm foi passado, executa-o
    if (onConfirm) {
      try {
        await onConfirm();
        if (onSuccess) onSuccess();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao excluir inscrição");
      }
      return;
    }

    // Execução padrão via api.deleteInscription
    if (!eventId || !targetId) {
      setError("Identificador do evento ou da inscrição não informado.");
      return;
    }

    setInternalLoading(true);
    try {
      await api.deleteInscription(eventId, targetId);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir inscrição");
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000aa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="card stack"
        style={{ width: 460, maxWidth: "92vw", gap: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 18, color: "var(--danger)" }}>
          Excluir Inscrição Permanentemente
        </h3>

        {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}

        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Tem certeza que deseja excluir o cadastro de <strong>{participantName}</strong>
          {participantEmail ? ` (${participantEmail})` : ""}?
        </p>

        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#fca5a5",
          }}
        >
          <strong>Aviso de Segurança:</strong> O registro do participante será permanentemente
          excluído do banco de dados e <u>não poderá ser recuperado</u>. Qualquer ingresso,
          credencial com QR Code ou dados vinculados serão eliminados definitivamente.
        </div>

        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}
