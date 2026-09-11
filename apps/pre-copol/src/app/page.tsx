"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  listActiveEvents,
  getBatches,
  getSchedule,
  type EventData,
  type BatchItem,
  type ScheduleItem,
  type SiteSectionConfig,
  type SiteContent,
} from "@/lib/api";
import { COPOL_FALLBACK_SCHEDULE } from "@/lib/copol-schedule-data";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EventJsonLd } from "@/components/EventJsonLd";
import { handleLogoDoubleAction, handleLogoTouchEnd } from "@/lib/download-apk";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
  ClockIcon,
  QuestionIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  SparkleIcon,
} from "@/components/Icons";

const SCHEDULE_DAY_TABS = [
  { date: "2026-11-05", label: "Quinta 05/11", weekday: "Quinta-feira, 05 de Novembro" },
  { date: "2026-11-06", label: "Sexta 06/11", weekday: "Sexta-feira, 06 de Novembro" },
  { date: "2026-11-07", label: "Sábado 07/11", weekday: "Sábado, 07 de Novembro" },
];

function getCategoryBadgeStyle(type?: string | null): { bg: string; color: string; border: string } {
  const t = (type || "").toLowerCase().trim();
  if (t.includes("hands on") || t.includes("hands_on")) {
    return { bg: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "rgba(168, 85, 247, 0.35)" };
  }
  if (t.includes("palestra")) {
    return { bg: "rgba(45, 212, 191, 0.15)", color: "#2dd4bf", border: "rgba(45, 212, 191, 0.35)" };
  }
  if (t.includes("credenciamento") || t.includes("abertura")) {
    return { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.35)" };
  }
  if (t.includes("intervalo") || t.includes("almoço") || t.includes("almoco") || t.includes("coffee")) {
    return { bg: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.35)" };
  }
  if (t.includes("solenidade") || t.includes("cerimônia") || t.includes("cerimonia") || t.includes("coquetel") || t.includes("encerramento")) {
    return { bg: "rgba(236, 72, 153, 0.15)", color: "#f472b6", border: "rgba(236, 72, 153, 0.35)" };
  }
  return { bg: "rgba(255, 255, 255, 0.08)", color: "var(--muted-foreground)", border: "var(--border)" };
}

const DEFAULT_SECTIONS: SiteSectionConfig[] = [
  { id: "hero", type: "hero", title: "Início", enabled: true, order: 0 },
  { id: "about", type: "about", title: "Sobre o Evento", enabled: true, order: 1 },
  { id: "schedule", type: "schedule", title: "Programação Oficial", enabled: true, order: 2 },
  { id: "batches", type: "batches", title: "Lotes & Inscrição", enabled: true, order: 3 },
  { id: "steps", type: "steps", title: "Como Funciona", enabled: true, order: 4 },
  { id: "partners", type: "partners", title: "Realização e Apoio", enabled: true, order: 5 },
  { id: "faq", type: "faq", title: "Dúvidas Frequentes", enabled: true, order: 6 },
];

export default function HomePage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(COPOL_FALLBACK_SCHEDULE);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string>("2026-11-05");
  const [loading, setLoading] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Estados de integração com o Editor Admin (WYSIWYG Bridge)
  const [editorMode, setEditorMode] = useState(false);
  const [liveContent, setLiveContent] = useState<SiteContent | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  useEffect(() => {
    // Detecta se está sendo renderizado dentro do iframe do painel admin
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const isIframe = window.self !== window.top;
      if (isIframe || urlParams.get("editor") === "true") {
        setEditorMode(true);
      }
    }

    // Ouvinte para atualizações em tempo real enviadas pelo painel admin
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "SYNC_SITE_CONTENT" && event.data.payload) {
        setLiveContent(event.data.payload);
      }
      if (event.data?.type === "HIGHLIGHT_SECTION") {
        setSelectedSectionId(event.data.sectionId);
      }
      if (event.data?.type === "SYNC_SCHEDULE" && Array.isArray(event.data.payload)) {
        setSchedule(event.data.payload.length > 0 ? event.data.payload : COPOL_FALLBACK_SCHEDULE);
      }
    }

    window.addEventListener("message", handleMessage);

    // Notifica a janela pai (Admin) de que o site está montado e pronto
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "PREVIEW_READY" }, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    listActiveEvents()
      .then(async (evts) => {
        setEvents(evts);
        const main = evts[0];
        if (main) {
          const [bData, sData] = await Promise.all([
            getBatches(main.id).catch(() => ({ batches: [], activeBatch: null })),
            getSchedule(main.id).catch(() => []),
          ]);
          setBatches(bData.batches);
          if (sData && sData.length > 0) {
            setSchedule(sData);
          } else {
            setSchedule(COPOL_FALLBACK_SCHEDULE);
          }
        } else {
          setSchedule(COPOL_FALLBACK_SCHEDULE);
        }
      })
      .catch(() => {
        setSchedule(COPOL_FALLBACK_SCHEDULE);
      })
      .finally(() => setLoading(false));
  }, []);

  const mainEvent = events[0];
  const registrationsOpen = mainEvent?.registrationsOpen ?? true;
  const effectiveSchedule = schedule && schedule.length > 0 ? schedule : COPOL_FALLBACK_SCHEDULE;
  
  // Prioriza o conteúdo ao vivo enviado pelo editor do Admin
  const content = liveContent ?? mainEvent?.siteContent;

  let rawPrimary = content?.theme?.primaryColor || "#2DD4BF";
  if (rawPrimary.toUpperCase() === "#0E3634" || rawPrimary.toUpperCase() === "#0B2928") {
    rawPrimary = "#2DD4BF";
  }

  const theme = {
    primaryColor: rawPrimary,
    accentColor: content?.theme?.accentColor || "#D4A853",
    backgroundColor: content?.theme?.backgroundColor || "#0E3634",
    surfaceColor: content?.theme?.surfaceColor || "#154B4C",
    textColor: content?.theme?.textColor || "#F0FAF9",
    textMutedColor: content?.theme?.textMutedColor || "#9FC4C2",
  };

  const sections = (content?.sections && content.sections.length > 0 ? content.sections : DEFAULT_SECTIONS)
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.order - b.order);

  const eventTitle = content?.eventTitle || "Pré-Copol";
  const eventYear = content?.eventYear || "2026";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Injeção Dinâmica das Variáveis de Estilo do Tema */}
      <style>{`
        :root {
          --primary: ${theme.primaryColor} !important;
          --primary-foreground: #04302C !important;
          --gold: ${theme.accentColor} !important;
          --gold-soft: ${theme.accentColor} !important;
          --background: ${theme.backgroundColor} !important;
          --background-deep: ${theme.backgroundColor} !important;
          --card: ${theme.surfaceColor} !important;
          --muted: ${theme.surfaceColor} !important;
          --foreground: ${theme.textColor} !important;
          --muted-foreground: ${theme.textMutedColor} !important;
        }
      `}</style>

      {mainEvent?.startDate ? (
        <EventJsonLd
          name={`${eventTitle} ${eventYear} — Congresso de Odontologia de Londrina`}
          startDate={mainEvent.startDate}
          endDate={mainEvent.endDate}
          locationName={mainEvent.location || undefined}
        />
      ) : null}

      <SiteHeader
        eventTitle={eventTitle}
        eventYear={eventYear}
        subtitle={mainEvent?.location || undefined}
      />

      <main style={{ flex: 1 }}>
        {sections.map((sec) => {
          const isSelected = editorMode && selectedSectionId === sec.id;
          const sectionStyle: React.CSSProperties = {
            position: "relative",
            backgroundColor: sec.backgroundColor || undefined,
            color: sec.textColor || undefined,
          };

          const renderSectionContent = () => {
            switch (sec.type) {
              /* ---------- 1. HERO ---------- */
              case "hero":
                return (
                  <section style={{ ...sectionStyle, overflow: "hidden" }}>
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
                        <Image
                          src="/icon-mark.png"
                          alt="COPOL — Congresso de Odontologia de Londrina"
                          width={84}
                          height={80}
                          priority
                          title="Dois cliques para baixar o app leitor de QR Code (APK)"
                          style={{ cursor: "pointer", userSelect: "none" }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleLogoDoubleAction(e);
                          }}
                          onTouchEnd={handleLogoTouchEnd}
                        />
                      </div>

                      <span className="badge">{content?.heroBadge || "3º COPOL · Congresso Odontológico Positivo Londrinense"}</span>

                      <h1 style={{ margin: 0, fontSize: "clamp(34px, 5.5vw, 60px)", fontWeight: 800, lineHeight: 1.1 }}>
                        <span style={{ color: "var(--gold)" }}>{eventTitle}</span> {eventYear}
                        <span
                          style={{
                            display: "block",
                            fontSize: "clamp(18px, 2.8vw, 24px)",
                            fontWeight: 600,
                            color: "var(--foreground)",
                            marginTop: 8,
                            opacity: 0.95,
                          }}
                        >
                          Congresso de Odontologia de Londrina
                        </span>
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
                        {content?.heroSubtitle || "Toxina Botulínica: a ciência por trás do resultado natural."}
                      </p>

                      {mainEvent ? (
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
                          <MetaChip
                            icon={<CalendarIcon size={14} color="var(--gold)" />}
                            text={formatDateRange(mainEvent.startDate, mainEvent.endDate)}
                          />
                          {mainEvent.location ? (
                            <MetaChip
                              icon={<MapPinIcon size={14} color="var(--gold)" />}
                              text={mainEvent.location}
                            />
                          ) : null}
                        </div>
                      ) : null}

                      {mainEvent ? <RegistrationStatus event={mainEvent} /> : null}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
                        {mainEvent && registrationsOpen ? (
                          <Link
                            href={editorMode ? "#" : `/inscricao/?eventId=${mainEvent.id}`}
                            onClick={(e) => {
                              if (editorMode) e.preventDefault();
                            }}
                            className="btn-primary"
                            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                          >
                            <span>Garanta sua vaga</span>
                            <ArrowRightIcon size={16} />
                          </Link>
                        ) : null}
                        <Link
                          href={editorMode ? "#" : "/programacao/"}
                          onClick={(e) => {
                            if (editorMode) e.preventDefault();
                          }}
                          className="btn-secondary"
                        >
                          Ver Programação
                        </Link>
                      </div>

                      {!loading && events.length === 0 ? (
                        <p style={{ color: "var(--muted-foreground)" }}>Nenhum evento disponível no momento.</p>
                      ) : null}
                    </div>
                  </section>
                );

              /* ---------- 2. SOBRE ---------- */
              case "about":
                return (
                  <section style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                    <div className="container-page" style={{ maxWidth: 760 }}>
                      <SectionEyebrow>Sobre o evento</SectionEyebrow>
                      <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 16px" }}>
                        {sec.title || content?.aboutTitle || "Um encontro pra quem leva a odontologia a sério"}
                      </h2>
                      <p style={{ color: "var(--muted-foreground)", fontSize: 16, lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>
                        {content?.aboutText ||
                          "O Pré-Copol 2026 é a abertura do 3º Congresso Odontológico Positivo Londrinense (COPOL)."}
                      </p>
                    </div>
                  </section>
                );

              /* ---------- 3. PROGRAMAÇÃO INTERATIVA COM ABAS ---------- */
              case "schedule": {
                const dayItems = effectiveSchedule.filter((item) => {
                  const itemDate = item.date ? item.date.split("T")[0] : "";
                  return itemDate === selectedScheduleDay;
                });

                return (
                  <section style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                    <div className="container-page" style={{ maxWidth: 880 }}>
                      <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <SectionEyebrow>Cronograma Oficial</SectionEyebrow>
                        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 12px", fontWeight: 800 }}>
                          {sec.title || "Programação Oficial"}
                        </h2>
                        <p style={{ color: "var(--muted-foreground)", margin: 0, fontSize: 16 }}>
                          {sec.subtitle || "Acompanhe todas as palestras, hands on e momentos do evento"}
                        </p>
                      </div>

                      {/* Day Tabs */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 10,
                          marginBottom: 32,
                          flexWrap: "wrap",
                        }}
                        role="tablist"
                        aria-label="Dias do evento"
                      >
                        {SCHEDULE_DAY_TABS.map((tab) => {
                          const isActive = selectedScheduleDay === tab.date;
                          return (
                            <button
                              key={tab.date}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => setSelectedScheduleDay(tab.date)}
                              style={{
                                padding: "10px 22px",
                                borderRadius: 10,
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                border: isActive
                                  ? "1px solid var(--gold)"
                                  : "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                                background: isActive
                                  ? "var(--gold)"
                                  : "var(--card, rgba(255, 255, 255, 0.05))",
                                color: isActive ? "#0B2928" : "var(--foreground)",
                                boxShadow: isActive ? "0 4px 14px rgba(212, 168, 83, 0.25)" : "none",
                              }}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Schedule Items List */}
                      {dayItems.length === 0 ? (
                        <div className="card" style={{ padding: 36, textAlign: "center" }}>
                          <p className="muted" style={{ margin: 0 }}>
                            Nenhuma atividade cadastrada para este dia na grade.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {dayItems.map((item) => {
                            const badgeStyle = getCategoryBadgeStyle(item.type);
                            return (
                              <div
                                key={item.id}
                                className="card"
                                style={{
                                  padding: "18px 22px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 10,
                                  transition: "transform 0.15s ease, border-color 0.15s ease",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <span
                                      style={{
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        color: "var(--gold)",
                                        background: "rgba(200, 162, 97, 0.12)",
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        fontSize: 13,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <ClockIcon size={13} />
                                      {item.startTime}
                                      {item.endTime ? ` – ${item.endTime}` : ""}
                                    </span>

                                    {item.type && (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          textTransform: "uppercase",
                                          letterSpacing: "0.5px",
                                          padding: "3px 10px",
                                          borderRadius: 999,
                                          background: badgeStyle.bg,
                                          color: badgeStyle.color,
                                          border: `1px solid ${badgeStyle.border}`,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {item.type}
                                      </span>
                                    )}
                                  </div>

                                  {item.location && (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: "var(--muted-foreground)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <MapPinIcon size={13} />
                                      {item.location}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <strong style={{ fontSize: 16, display: "block", lineHeight: 1.35, color: "var(--foreground)" }}>
                                    {item.title}
                                  </strong>

                                  {item.speaker && !item.title.toLowerCase().startsWith(item.speaker.toLowerCase()) && (
                                    <span
                                      style={{
                                        fontSize: 13,
                                        color: "var(--gold)",
                                        fontWeight: 600,
                                        display: "block",
                                        marginTop: 4,
                                      }}
                                    >
                                      Palestrante: {item.speaker}
                                    </span>
                                  )}

                                  {item.description && item.description !== item.title && (
                                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          <div style={{ textAlign: "center", marginTop: 20 }}>
                            <Link
                              href={editorMode ? "#" : "/programacao/"}
                              onClick={(e) => {
                                if (editorMode) e.preventDefault();
                              }}
                              className="btn-secondary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
                            >
                              <span>Ver programação completa</span>
                              <ArrowRightIcon size={14} />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              }

              /* ---------- 4. LOTES & INSCRIÇÃO ---------- */
              case "batches":
                return (
                  <section style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                    <div className="container-page" style={{ maxWidth: 900 }}>
                      <div style={{ textAlign: "center", marginBottom: 36 }}>
                        <SectionEyebrow>Inscrições</SectionEyebrow>
                        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 12px" }}>
                          {sec.title || "Lotes e Inscrições"}
                        </h2>
                        <p style={{ color: "var(--muted-foreground)", margin: 0 }}>
                          {sec.subtitle || "Aproveite os valores promocionais dos lotes antecipados"}
                        </p>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                        {batches.map((b) => (
                          <div
                            key={b.id}
                            className="card"
                            style={{
                              padding: 24,
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                              border: b.isActive ? "2px solid var(--gold)" : "1px solid var(--border)",
                              position: "relative",
                              background: b.isActive ? "rgba(200, 162, 97, 0.05)" : "var(--card)",
                            }}
                          >
                            {b.isActive && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: -11,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  background: "var(--gold)",
                                  color: "#0B2928",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "2px 10px",
                                  borderRadius: 999,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Lote Atual
                              </span>
                            )}

                            <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "uppercase", fontWeight: 700 }}>
                              {b.name}
                            </span>

                            {b.status === "UPCOMING" || b.price === null ? (
                              <div style={{ height: 38, display: "flex", alignItems: "center", gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: "var(--gold)",
                                    filter: "blur(6px)",
                                    userSelect: "none",
                                    letterSpacing: "1.5px",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1,
                                    textShadow: "0 0 14px rgba(200, 162, 97, 0.65)",
                                  }}
                                >
                                  R$ 150,00
                                </span>
                                <SparkleIcon
                                  size={15}
                                  color="var(--gold)"
                                  className="sparkle-icon"
                                  style={{ filter: "drop-shadow(0 0 4px var(--gold))" }}
                                />
                              </div>
                            ) : (
                              <div style={{ height: 38, display: "flex", alignItems: "center", fontSize: 28, fontWeight: 800, color: b.isActive ? "var(--gold)" : "var(--foreground)" }}>
                                R$ {b.price.toFixed(2).replace(".", ",")}
                              </div>
                            )}

                            <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", minHeight: 32 }}>
                              {b.isActive && b.batchNumber === 1
                                ? `${b.confirmedCount} de 60 vagas preenchidas`
                                : b.status === "UPCOMING"
                                ? b.startDate
                                  ? `Abertura prevista: ${new Date(b.startDate).toLocaleDateString("pt-BR")}`
                                  : "Aguarde a abertura deste lote"
                                : b.endDate
                                ? `Válido até ${new Date(b.endDate).toLocaleDateString("pt-BR")}`
                                : b.status === "CLOSED"
                                ? "Lote encerrado"
                                : "Vagas limitadas"}
                            </p>

                            {b.isActive && mainEvent && registrationsOpen ? (
                              <Link
                                href={editorMode ? "#" : `/inscricao?eventId=${mainEvent.id}`}
                                onClick={(e) => {
                                  if (editorMode) e.preventDefault();
                                }}
                                className="btn-primary"
                                style={{ width: "100%", textAlign: "center", padding: 10, fontSize: 14 }}
                              >
                                Inscrever-se
                              </Link>
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  textAlign: "center",
                                  padding: 10,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  background: "rgba(255, 255, 255, 0.04)",
                                  color: b.status === "CLOSED" ? "var(--muted-foreground)" : "var(--gold)",
                                  border: b.status === "CLOSED" ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(200, 162, 97, 0.25)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                }}
                              >
                                {b.status === "CLOSED" ? (
                                  <span>Encerrado</span>
                                ) : (
                                  <>
                                    <SparkleIcon size={13} color="var(--gold)" className="sparkle-icon" />
                                    <span>Em breve</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );

              /* ---------- 5. COMO FUNCIONA (STEPS) ---------- */
              case "steps":
                return (
                  <section style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                    <div className="container-page">
                      <SectionEyebrow>Como funciona</SectionEyebrow>
                      <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 32px" }}>
                        {sec.title || content?.stepsTitle || "Da inscrição ao credenciamento"}
                      </h2>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                        {(content?.steps || []).map((step, i) => (
                          <StepCard key={step.title} number={String(i + 1)} title={step.title} text={step.text} />
                        ))}
                      </div>
                    </div>
                  </section>
                );

              /* ---------- 6. PARCEIROS ---------- */
              case "partners":
                return (
                  <section style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                    <div className="container-page" style={{ maxWidth: 760, textAlign: "center" }}>
                      <SectionEyebrow>Realização e apoio</SectionEyebrow>
                      <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 16px" }}>
                        {sec.title || content?.partnersTitle || "Realização e Apoio"}
                      </h2>
                      <p style={{ color: "var(--muted-foreground)", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
                        {content?.partnersText || "Universidade Positivo, Ecohub e LSPK Technology apoiam o Pré-Copol 2026."}
                      </p>

                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
                        {(content?.partnersList || [
                          { name: "Universidade Positivo", role: "Realização" },
                          { name: "Ecohub", role: "Apoio" },
                          { name: "LSPK Technology", role: "Tecnologia e Apoio" },
                        ]).map((p) => (
                          <div key={p.name} className="card" style={{ padding: "16px 24px", minWidth: 200, textAlign: "center" }}>
                            <strong style={{ fontSize: 16, display: "block" }}>{p.name}</strong>
                            {p.role && <span style={{ fontSize: 12, color: "var(--gold)" }}>{p.role}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );

              /* ---------- 7. FAQ (PERGUNTAS FREQUENTES) ---------- */
              case "faq":
                const faqList = content?.faqs && content.faqs.length > 0 ? content.faqs : [];
                return (
                  <section style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                    <div className="container-page" style={{ maxWidth: 760 }}>
                      <div style={{ textAlign: "center", marginBottom: 36 }}>
                        <SectionEyebrow>Dúvidas</SectionEyebrow>
                        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 12px" }}>
                          {sec.title || "Perguntas Frequentes"}
                        </h2>
                        <p style={{ color: "var(--muted-foreground)", margin: 0 }}>
                          {sec.subtitle || "Tire suas dúvidas sobre inscrições, pagamentos e certificados"}
                        </p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {faqList.map((faq, idx) => {
                          const isOpen = activeFaq === idx;
                          return (
                            <div
                              key={idx}
                              className="card"
                              style={{
                                padding: "16px 20px",
                                cursor: "pointer",
                                transition: "background 0.15s ease",
                              }}
                              onClick={(e) => {
                                if (!editorMode) {
                                  setActiveFaq(isOpen ? null : idx);
                                }
                              }}
                            >
                              <div className="spread" style={{ alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <QuestionIcon size={16} color="var(--gold)" />
                                  <strong style={{ fontSize: 15 }}>{faq.question}</strong>
                                </div>
                                <ChevronDownIcon
                                  size={18}
                                  style={{
                                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s ease",
                                  }}
                                />
                              </div>
                              {isOpen && (
                                <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6, paddingLeft: 26 }}>
                                  {faq.answer}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );

              default:
                return null;
            }
          };

          return (
            <div
              key={sec.id}
              data-section-id={sec.id}
              onClick={(e) => {
                if (editorMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedSectionId(sec.id);
                  if (typeof window !== "undefined" && window.parent) {
                    window.parent.postMessage({ type: "SECTION_SELECTED", sectionId: sec.id }, "*");
                  }
                }
              }}
              style={{
                position: "relative",
                outline: isSelected
                  ? "2.5px solid #38BDF8"
                  : editorMode
                  ? "1px dashed rgba(56, 189, 248, 0.35)"
                  : "none",
                outlineOffset: "-2px",
                cursor: editorMode ? "pointer" : "inherit",
                transition: "outline 0.15s ease",
              }}
            >
              {/* Badge indicativo no modo editor */}
              {editorMode && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 16,
                    zIndex: 40,
                    background: isSelected ? "#38BDF8" : "rgba(15, 23, 42, 0.85)",
                    color: isSelected ? "#0F172A" : "#FFFFFF",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                  }}
                >
                  <GripVerticalIcon size={12} />
                  <span>{sec.title}</span>
                  {isSelected && <span style={{ opacity: 0.85 }}>· Selecionada</span>}
                </div>
              )}

              {renderSectionContent()}
            </div>
          );
        })}
      </main>

      <SiteFooter footerText={content?.footerText} />
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--gold)",
        fontWeight: 700,
        marginBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

function MetaChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        background: "rgba(200, 162, 97, 0.08)",
        border: "1px solid rgba(200, 162, 97, 0.25)",
        borderRadius: 999,
        fontSize: 13,
        color: "var(--foreground)",
      }}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}

function RegistrationStatus({ event }: { event: EventData }) {
  const isOpen = event.registrationsOpen;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: isOpen ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
        border: `1px solid ${isOpen ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
        color: isOpen ? "var(--success)" : "var(--destructive)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isOpen ? "var(--success)" : "var(--destructive)",
        }}
      />
      <span>{isOpen ? "Inscrições Abertas" : "Inscrições Encerradas"}</span>
    </div>
  );
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div
      className="card"
      style={{
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 20,
          fontWeight: 800,
          color: "var(--gold)",
          opacity: 0.8,
        }}
      >
        {number.padStart(2, "0")}
      </span>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        {text}
      </p>
    </div>
  );
}

function formatDateRange(startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = start.toLocaleDateString("pt-BR", { month: "long" });
  const year = start.getFullYear();

  if (start.toDateString() === end.toDateString()) {
    return `${startDay} de ${month} de ${year}`;
  }

  return `${startDay} a ${endDay} de ${month} de ${year}`;
}
