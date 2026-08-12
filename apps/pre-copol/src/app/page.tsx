"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listActiveEvents, type EventData } from "@/lib/api";

export default function HomePage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActiveEvents()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            <span style={{ color: "var(--gold)" }}>Pré-Copol</span> 2026
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: 14 }}>
            Inscrições abertas — Vagas limitadas!
          </p>
        </div>
      </header>

      {/* Nav */}
      <nav
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--background)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 24 }}>
          <Link href="/" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
            Eventos
          </Link>
          <Link href="/parcerias" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>
            Parcerias
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: "32px 24px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 20px", color: "var(--muted-foreground)" }}>
          Eventos disponíveis
        </h2>

        {loading ? (
          <p style={{ color: "var(--muted-foreground)" }}>Carregando eventos...</p>
        ) : events.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>Nenhum evento disponível no momento.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          color: "var(--muted-foreground)",
          fontSize: 12,
        }}
      >
        Copol | LSPK Tecnology
      </footer>
    </div>
  );
}

function EventCard({ event }: { event: EventData }) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  return (
    <div
      style={{
        background: "var(--muted)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Title + Description */}
      <div>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{event.name}</h3>
        {event.description && (
          <p style={{ margin: "6px 0 0", color: "var(--muted-foreground)", fontSize: 14 }}>
            {event.description}
          </p>
        )}
      </div>

      {/* Countdown */}
      <Countdown targetDate={event.startDate} />

      {/* Info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <span>
            {start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            {" · "}
            {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" — "}
            {end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {event.location && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📍</span>
            <span>{event.location}</span>
          </div>
        )}
      </div>

      {/* Investment preview */}
      <div
        style={{
          background: "var(--background)",
          borderRadius: 6,
          padding: "12px 16px",
          fontSize: 13,
        }}
      >
        <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--gold)" }}>Investimento</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span>Alunos UP: <strong>R$ 30,00</strong></span>
          <span>Alunos outras: <strong>R$ 35,00</strong></span>
          <span>Profissionais: <strong>R$ 50,00</strong></span>
        </div>
      </div>

      <Link
        href={`/inscricao/${event.id}`}
        style={{
          display: "inline-block",
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          fontWeight: 700,
          padding: "12px 24px",
          borderRadius: 8,
          textAlign: "center",
          textDecoration: "none",
          fontSize: 15,
        }}
      >
        Inscreva-se
      </Link>
    </div>
  );
}

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; ended: boolean } | null>(null);

  useEffect(() => {
    function calc() {
      const target = new Date(targetDate).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        ended: false,
      });
    }

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  if (timeLeft.ended) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 16px",
          background: "rgba(34, 197, 94, 0.15)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--success)",
        }}
      >
        🔴 Evento em andamento
      </div>
    );
  }

  const blocks = [
    { value: timeLeft.days, label: "dias" },
    { value: timeLeft.hours, label: "horas" },
    { value: timeLeft.minutes, label: "min" },
    { value: timeLeft.seconds, label: "seg" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {blocks.map((block) => (
        <div
          key={block.label}
          style={{
            flex: "1 1 0",
            minWidth: 60,
            padding: "10px 8px",
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)", lineHeight: 1 }}>
            {String(block.value).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
            {block.label}
          </div>
        </div>
      ))}
    </div>
  );
}
