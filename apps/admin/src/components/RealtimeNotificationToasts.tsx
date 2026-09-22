import { useEffect } from "react";

export interface RealtimeInscriptionNotification {
  id: string;
  name: string;
  email: string;
  category: string;
  amount: number;
  paymentMethod?: string | null;
  createdAt: string;
  gratuita?: boolean;
}

export function RealtimeNotificationToasts({
  notifications,
  onDismiss,
}: {
  notifications: RealtimeInscriptionNotification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 380,
        width: "calc(100vw - 40px)",
        pointerEvents: "none",
      }}
    >
      {notifications.map((item) => (
        <ToastItem key={item.id} notification={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  notification,
  onDismiss,
}: {
  notification: RealtimeInscriptionNotification;
  onDismiss: () => void;
}) {
  const AUTO_DISMISS_MS = 9000;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isFree = notification.gratuita || notification.amount === 0;

  return (
    <div
      role="alert"
      style={{
        pointerEvents: "auto",
        background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
        border: "1.5px solid #10b981",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.55), 0 0 16px rgba(16, 185, 129, 0.35)",
        padding: "14px 16px",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
        animation: "slideInFromRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Cabeçalho com indicador verde piscante */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#34d399",
              boxShadow: "0 0 8px #34d399",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              color: "#a7f3d0",
              textTransform: "uppercase",
            }}
          >
            Nova Inscrição
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "#a7f3d0",
            cursor: "pointer",
            fontSize: 16,
            padding: "0 4px",
            lineHeight: 1,
            opacity: 0.8,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
          title="Fechar notificação"
        >
          ✕
        </button>
      </div>

      {/* Nome do Participante */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#ffffff",
          marginTop: 6,
          lineHeight: 1.25,
          wordBreak: "break-word",
        }}
      >
        {notification.name}
      </div>

      {/* E-mail */}
      <div
        style={{
          fontSize: 12,
          color: "#d1fae5",
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
          wordBreak: "break-all",
        }}
      >
        <span style={{ fontSize: 13 }}>✉️</span>
        <span>{notification.email}</span>
      </div>

      {/* Data e Horário */}
      <div
        style={{
          fontSize: 11,
          color: "#a7f3d0",
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12 }}>🕒</span>
        <span>
          {new Date(notification.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}{" "}
          • {new Date(notification.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>

      {/* Método de Pagamento e Lote */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid rgba(16, 185, 129, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {isFree ? (
          <span
            style={{
              background: "#059669",
              color: "#ffffff",
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              boxShadow: "0 0 10px rgba(5, 150, 105, 0.4)",
            }}
          >
            🟢 Gratuito / Isento
          </span>
        ) : notification.paymentMethod === "CARD" ? (
          <span
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ecfdf5",
              border: "1px solid rgba(16, 185, 129, 0.45)",
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            💳 Cartão • R$ {notification.amount.toFixed(2).replace(".", ",")}
          </span>
        ) : (
          <span
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ecfdf5",
              border: "1px solid rgba(16, 185, 129, 0.45)",
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            📱 Pix • R$ {notification.amount.toFixed(2).replace(".", ",")}
          </span>
        )}

        <span
          style={{
            fontSize: 11,
            color: "#6ee7b7",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 150,
          }}
          title={notification.category}
        >
          {notification.category}
        </span>
      </div>

      {/* Barra sutil de contagem de tempo */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 3,
          background: "rgba(52, 211, 153, 0.6)",
          width: "100%",
          animation: `toastCountdown ${AUTO_DISMISS_MS}ms linear forwards`,
        }}
      />
    </div>
  );
}
