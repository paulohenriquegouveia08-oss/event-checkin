import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../api/client";
import { WebQrScanner } from "../components/scanner/WebQrScanner";
import { FeedbackOverlay, type FeedbackData } from "../components/scanner/FeedbackOverlay";
import { initAudio, playCheckInFeedback } from "../utils/audioFeedback";

const FEEDBACK_DURATION_MS = 1800;

export function CredenciamentoPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionCount, setSessionCount] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState<number | null>(null);

  const [manualMode, setManualMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);

  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!eventId) return;

    let mounted = true;

    // Carrega dados do evento e estatísticas
    Promise.all([
      api.getEvent(eventId),
      api.getStatistics(eventId).catch(() => null),
    ])
      .then(([ev, stats]) => {
        if (!mounted) return;
        setEvent(ev);
        if (stats) setTotalConfirmed(stats.totalCheckedIn);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Evento não encontrado");
        setLoading(false);
      });

    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [eventId]);

  async function handleScan(token: string) {
    if (processingRef.current || !eventId) return;
    processingRef.current = true;
    setPaused(true);

    // Destrava áudio do navegador
    initAudio();

    try {
      const outcome = await api.performAdminCheckIn(eventId, token);

      if (outcome.status === "CONFIRMED") {
        playCheckInFeedback("CONFIRMED");
        setSessionCount((prev) => prev + 1);
        setTotalConfirmed((prev) => (prev !== null ? prev + 1 : null));

        setFeedback({
          status: "CONFIRMED",
          participantName: outcome.participant.name,
          checkedInAt: outcome.checkedInAt,
        });
      } else {
        // ALREADY_CHECKED_IN
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
            message: "QR Code não encontrado ou pertence a outro evento.",
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
          message: err instanceof Error ? err.message : "Erro desconhecido.",
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

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg)",
          color: "var(--text-muted)",
        }}
      >
        <p>Carregando credenciamento...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg)",
          padding: 24,
          textAlign: "center",
          gap: 16,
        }}
      >
        <h2 style={{ color: "var(--danger)", margin: 0 }}>Erro ao abrir credenciamento</h2>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>{error ?? "Evento não localizado."}</p>
        <Link to="/eventos" className="btn btn-secondary">
          ← Voltar aos eventos
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Topo / Header estilo Terminal Mobile */}
      <header
        style={{
          padding: "12px 16px",
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            to={`/eventos/${event.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "var(--surface-alt)",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: 18,
              border: "1px solid var(--border)",
            }}
            title="Voltar ao evento"
          >
            ←
          </Link>
          <div>
            <h1
              style={{
                fontSize: "clamp(15px, 4vw, 18px)",
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.2,
                color: "var(--text)",
              }}
            >
              {event.name}
            </h1>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Credenciamento Web
            </span>
          </div>
        </div>

        {/* Indicador de Status e Contadores */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--success)",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              padding: "4px 10px",
              borderRadius: 999,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "var(--success)",
                display: "inline-block",
                boxShadow: "0 0 6px var(--success)",
              }}
            />
            ONLINE
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {sessionCount > 0 && (
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                +{sessionCount} nesta sessão ·{" "}
              </span>
            )}
            {totalConfirmed !== null ? `${totalConfirmed} no total` : ""}
          </div>
        </div>
      </header>

      {/* Área Central: Câmera ou Manual */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 16px 32px",
          position: "relative",
          width: "100%",
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

        {/* Feedback Overlay cobrindo a tela (exatamente como no APK) */}
        {feedback && (
          <FeedbackOverlay data={feedback} onDismiss={dismissFeedback} />
        )}
      </main>
    </div>
  );
}
