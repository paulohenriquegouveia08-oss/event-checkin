"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listActiveEvents, type EventData } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function HomePage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActiveEvents()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mainEvent = events[0];
  const registrationsOpen = mainEvent?.registrationsOpen ?? true;
  const content = mainEvent?.siteContent ?? DEFAULT_CONTENT;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader eventTitle={content.eventTitle} eventYear={content.eventYear} />

      {/* ---------- Hero ---------- */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wave-bg" />
        <div
          className="container-page animate-fade-up"
          style={{
            position: "relative",
            zIndex: 1,
            padding: "72px 24px 56px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 24,
          }}
        >
          <div className="animate-float">
            <Image src="/icon-mark.png" alt="Ícone do COPOL" width={84} height={80} priority />
          </div>

          <span className="badge">{content.heroBadge}</span>

          <h1 style={{ margin: 0, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.05 }}>
            <span style={{ color: "var(--gold)" }}>{content.eventTitle}</span> {content.eventYear}
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 620,
              fontSize: "clamp(16px, 2.4vw, 20px)",
              color: "var(--muted-foreground)",
              lineHeight: 1.5,
            }}
          >
            {content.heroSubtitle}
          </p>

          {mainEvent ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
              <MetaChip icon="📅" text={formatDateRange(mainEvent.startDate, mainEvent.endDate)} />
              {mainEvent.location ? <MetaChip icon="📍" text={mainEvent.location} /> : null}
            </div>
          ) : null}

          {mainEvent ? <RegistrationStatus event={mainEvent} /> : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
            {mainEvent && registrationsOpen ? (
              <Link href={`/inscricao/${mainEvent.id}`} className="btn-primary">
                Garanta sua vaga →
              </Link>
            ) : null}
            <Link href="/parcerias" className="btn-secondary">
              Ver parcerias
            </Link>
          </div>

          {!loading && events.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)" }}>Nenhum evento disponível no momento.</p>
          ) : null}
        </div>
      </section>

      {/* ---------- Sobre ---------- */}
      <section style={{ padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
        <div className="container-page" style={{ maxWidth: 760 }}>
          <SectionEyebrow>Sobre o evento</SectionEyebrow>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 16px" }}>{content.aboutTitle}</h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 16, lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>
            {content.aboutText}
          </p>
        </div>
      </section>

      {/* ---------- Como funciona ---------- */}
      <section style={{ padding: "0 24px 64px" }}>
        <div className="container-page">
          <SectionEyebrow>Como funciona</SectionEyebrow>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 32px" }}>{content.stepsTitle}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {content.steps.map((step, i) => (
              <StepCard key={step.title} number={String(i + 1)} title={step.title} text={step.text} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Investimento ---------- */}
      <section style={{ padding: "0 24px 64px" }}>
        <div className="container-page">
          <SectionEyebrow>Investimento</SectionEyebrow>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 32px" }}>{content.pricingTitle}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {content.pricingTiers.map((tier) => (
              <div key={tier.key} className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 600 }}>{tier.label}</span>
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--primary)" }}>
                  R$ {Math.floor(tier.amount)}
                  <span style={{ fontSize: 16, fontWeight: 600 }}>,{String(Math.round((tier.amount % 1) * 100)).padStart(2, "0")}</span>
                </span>
              </div>
            ))}
          </div>

          {mainEvent && registrationsOpen ? (
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <Link href={`/inscricao/${mainEvent.id}`} className="btn-primary">
                Garanta sua vaga →
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- Parceiros teaser ---------- */}
      <section style={{ padding: "0 24px 72px" }}>
        <div className="container-page">
          <div
            className="card"
            style={{
              padding: 36,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <div>
              <SectionEyebrow>{content.partnersTitle}</SectionEyebrow>
              <p style={{ margin: "8px 0 0", color: "var(--muted-foreground)", maxWidth: 460 }}>{content.partnersText}</p>
            </div>
            <Link href="/parcerias" className="btn-secondary">
              Conhecer parcerias →
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter text={content.footerText} />
    </div>
  );
}

// Espelha DEFAULT_SITE_CONTENT do backend (site-content.ts) — usado só
// antes do evento carregar ou se a chamada falhar, pra a página nunca
// ficar com textos vazios.
const DEFAULT_CONTENT: EventData["siteContent"] = {
  eventTitle: "Pré-Copol",
  eventYear: "2026",
  heroBadge: "3º COPOL · Congresso Odontológico Positivo Londrinense",
  heroSubtitle:
    "Toxina Botulínica: a ciência por trás do resultado natural. Evento preparatório do 3º COPOL, reunindo " +
    "estudantes e profissionais da odontologia em Londrina.",
  aboutTitle: "Um encontro pra quem leva a odontologia a sério",
  aboutText:
    "O Pré-Copol 2026 é a abertura do 3º Congresso Odontológico Positivo Londrinense (COPOL), realizado na " +
    "Universidade Positivo — Campus Londrina. O evento tem como tema central a Toxina Botulínica, abordando a " +
    "ciência por trás do resultado natural na prática odontológica. É voltado a estudantes e profissionais da " +
    "odontologia que buscam atualização técnica e networking com a comunidade acadêmica de Londrina.",
  stepsTitle: "Da inscrição ao credenciamento",
  steps: [
    { title: "Inscreva-se", text: "Preencha seus dados e escolha sua categoria de participação." },
    { title: "Pagamento", text: "Siga as instruções enviadas por e-mail para confirmar sua vaga." },
    { title: "Credenciamento", text: "No dia do evento, retire seu QR Code e faça seu check-in na entrada." },
  ],
  pricingTitle: "Escolha sua categoria",
  pricingTiers: [
    { key: "STUDENT_UP", label: "Aluno da Universidade Positivo", amount: 30 },
    { key: "STUDENT_OTHER", label: "Aluno de outras instituições", amount: 35 },
    { key: "PROFESSIONAL", label: "Profissional / Professor", amount: 50 },
  ],
  partnersTitle: "Realização e apoio",
  partnersText: "Universidade Positivo e LSPK Tecnology apoiam o Pré-Copol 2026.",
  footerText: "3º COPOL — Congresso Odontológico Positivo Londrinense",
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--gold)",
      }}
    >
      {children}
    </span>
  );
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(45, 212, 191, 0.12)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 16,
        }}
      >
        {number}
      </div>
      <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)",
        fontSize: 14,
      }}
    >
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const startTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${startTime} — ${endTime}`;
}

/**
 * Decide o que mostrar no hero em função do estado das inscrições:
 * - Abertas + com prazo: contagem regressiva até o prazo ("Inscrições encerram em").
 * - Abertas sem prazo: contagem regressiva até o início do evento (comportamento antigo).
 * - Encerradas: aviso de encerramento + contagem regressiva até o início do evento.
 */
function RegistrationStatus({ event }: { event: EventData }) {
  if (!event.registrationsOpen) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--destructive)",
          }}
        >
          Inscrições encerradas
        </span>
        <Countdown targetDate={event.startDate} label="O evento começa em" />
      </div>
    );
  }

  if (event.registrationDeadline) {
    return <Countdown targetDate={event.registrationDeadline} label="Inscrições encerram em" accent="warning" />;
  }

  return <Countdown targetDate={event.startDate} />;
}

function Countdown({
  targetDate,
  label,
  accent,
}: {
  targetDate: string;
  label?: string;
  accent?: "warning";
}) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    ended: boolean;
  } | null>(null);

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
        className="animate-pulse-soft"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 20px",
          background: "rgba(34, 197, 94, 0.15)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 700,
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
  const color = accent === "warning" ? "var(--warning)" : "var(--primary)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {label ? (
        <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
      ) : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {blocks.map((block) => (
          <div
            key={block.label}
            className="card"
            style={{
              width: 84,
              padding: "16px 8px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {String(block.value).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {block.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
