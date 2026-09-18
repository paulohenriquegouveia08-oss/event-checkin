import type { CSSProperties } from "react";
import type { CheckInFeedbackStatus } from "../../utils/audioFeedback";

export interface FeedbackData {
  status: CheckInFeedbackStatus;
  participantName?: string | null;
  checkedInAt?: string | null;
  message?: string | null;
}

interface Props {
  data: FeedbackData;
  onDismiss?: () => void;
}

const PRESETS: Record<
  CheckInFeedbackStatus,
  { symbol: string; title: string; background: string }
> = {
  CONFIRMED: {
    symbol: "✓",
    title: "PRESENÇA CONFIRMADA",
    background: "#16a34a", // Verde vibrante
  },
  ALREADY_CHECKED_IN: {
    symbol: "!",
    title: "PRESENÇA JÁ REGISTRADA",
    background: "#d97706", // Laranja/Âmbar atenção
  },
  INVALID_TOKEN: {
    symbol: "✕",
    title: "CREDENCIAL INVÁLIDA",
    background: "#dc2626", // Vermelho erro
  },
  PARTICIPANT_INACTIVE: {
    symbol: "✕",
    title: "CREDENCIAL INATIVA",
    background: "#dc2626", // Vermelho erro
  },
  ERROR: {
    symbol: "✕",
    title: "ERRO NA LEITURA",
    background: "#dc2626",
  },
};

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function FeedbackOverlay({ data, onDismiss }: Props) {
  const preset = PRESETS[data.status] ?? PRESETS.ERROR;

  return (
    <div
      onClick={onDismiss}
      style={
        {
          position: "absolute",
          inset: 0,
          backgroundColor: preset.background,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px 20px",
          color: "#ffffff",
          animation: "fadeIn 0.18s ease-out",
          cursor: "pointer",
          userSelect: "none",
        } as CSSProperties
      }
    >
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 76,
          fontWeight: 800,
          marginBottom: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        {preset.symbol}
      </div>

      <h2
        style={{
          fontSize: "clamp(22px, 5vw, 32px)",
          fontWeight: 800,
          letterSpacing: "1px",
          margin: "0 0 10px",
          textTransform: "uppercase",
          textShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {preset.title}
      </h2>

      {data.participantName ? (
        <p
          style={{
            fontSize: "clamp(20px, 4.5vw, 28px)",
            fontWeight: 700,
            margin: "0 0 10px",
            maxWidth: "90%",
            wordBreak: "break-word",
          }}
        >
          {data.participantName}
        </p>
      ) : null}

      {data.status === "ALREADY_CHECKED_IN" && data.checkedInAt ? (
        <p
          style={{
            fontSize: "clamp(16px, 3.5vw, 20px)",
            color: "rgba(255, 255, 255, 0.9)",
            margin: "4px 0 0",
          }}
        >
          Já registrado às <strong>{formatTime(data.checkedInAt)}</strong>
        </p>
      ) : null}

      {data.status === "CONFIRMED" && data.checkedInAt ? (
        <p
          style={{
            fontSize: "clamp(16px, 3.5vw, 20px)",
            color: "rgba(255, 255, 255, 0.9)",
            margin: "4px 0 0",
          }}
        >
          Registrado às <strong>{formatTime(data.checkedInAt)}</strong>
        </p>
      ) : null}

      {data.message ? (
        <p
          style={{
            fontSize: "15px",
            color: "rgba(255, 255, 255, 0.85)",
            marginTop: 8,
            maxWidth: "85%",
          }}
        >
          {data.message}
        </p>
      ) : null}

      <span
        style={{
          marginTop: 24,
          fontSize: "12px",
          opacity: 0.75,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Toque para avançar
      </span>
    </div>
  );
}
