import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import * as api from "../../api/client";
import { WebQrScanner } from "../../components/scanner/WebQrScanner";
import { FeedbackOverlay, type FeedbackData } from "../../components/scanner/FeedbackOverlay";
import { initAudio, playCheckInFeedback } from "../../utils/audioFeedback";

const FEEDBACK_DURATION_MS = 1800;

export function CredenciamentoTab({ eventId }: { eventId: string }) {
  const [manualMode, setManualMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleScan(token: string) {
    if (processingRef.current || !eventId) return;
    processingRef.current = true;
    setPaused(true);

    initAudio();

    try {
      const outcome = await api.performAdminCheckIn(eventId, token);

      if (outcome.status === "CONFIRMED") {
        playCheckInFeedback("CONFIRMED");
        setSessionCount((prev) => prev + 1);
        setFeedback({
          status: "CONFIRMED",
          participantName: outcome.participant.name,
          checkedInAt: outcome.checkedInAt,
        });
      } else {
        playCheckInFeedback("ALREADY_CHECKED_IN");
        setFeedback({
          status: "ALREADY_CHECKED_IN",
          participantName: outcome.participant.name,
          checkedInAt: outcome.checkedInAt,
        });
      }
    } catch (err) {
      if (err instanceof api.ApiError) {
        if (err.httpStatus === 404 || err.code === "NOT_FOUND") {
          playCheckInFeedback("INVALID_TOKEN");
          setFeedback({
            status: "INVALID_TOKEN",
            message: "QR Code não reconhecido ou pertence a outro evento.",
          });
        } else if (err.httpStatus === 403 || err.code === "FORBIDDEN") {
          playCheckInFeedback("PARTICIPANT_INACTIVE");
          setFeedback({
            status: "PARTICIPANT_INACTIVE",
            message: err.message || "Credencial inativa ou cancelada.",
          });
        } else {
          playCheckInFeedback("ERROR");
          setFeedback({
            status: "ERROR",
            message: err.message || "Falha na comunicação com o servidor.",
          });
        }
      } else {
        playCheckInFeedback("ERROR");
        setFeedback({
          status: "ERROR",
          message: err instanceof Error ? err.message : "Erro na leitura.",
        });
      }
    } finally {
      timerRef.current = setTimeout(() => {
        dismissFeedback();
      }, FEEDBACK_DURATION_MS);
    }
  }

  function dismissFeedback() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFeedback(null);
    setPaused(false);
    processingRef.current = false;
  }

  return (
    <div className="stack" style={{ position: "relative" }}>
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: 16,
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
            Credenciamento via Navegador
          </h3>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
            Use a câmera do seu celular ou computador para ler o QR Code dos crachás e comprovantes.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {sessionCount > 0 && (
            <span className="badge badge-success" style={{ fontSize: 13, padding: "6px 12px" }}>
              {sessionCount} confirmado(s) nesta sessão
            </span>
          )}
          <Link
            to={`/eventos/${eventId}/credenciamento`}
            className="btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            📱 Abrir em Tela Cheia (Modo Celular)
          </Link>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "16px 0",
        }}
      >
        <WebQrScanner
          onScan={handleScan}
          paused={paused}
          manualMode={manualMode}
          onToggleManual={() => {
            initAudio();
            setManualMode((v) => !v);
          }}
        />

        {feedback && (
          <FeedbackOverlay data={feedback} onDismiss={dismissFeedback} />
        )}
      </div>
    </div>
  );
}
