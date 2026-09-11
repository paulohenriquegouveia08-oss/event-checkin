"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listActiveEvents, getSchedule, type EventData, type ScheduleItem } from "@/lib/api";
import { COPOL_FALLBACK_SCHEDULE } from "@/lib/copol-schedule-data";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CalendarIcon, MapPinIcon, ClockIcon } from "@/components/Icons";

const DAY_TABS = [
  { id: "all", label: "Todos os Dias" },
  { id: "2026-11-05", label: "Quinta 05/11", weekday: "Quinta-feira, 05 de Novembro" },
  { id: "2026-11-06", label: "Sexta 06/11", weekday: "Sexta-feira, 06 de Novembro" },
  { id: "2026-11-07", label: "Sábado 07/11", weekday: "Sábado, 07 de Novembro" },
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

export default function SchedulePage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(COPOL_FALLBACK_SCHEDULE);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActiveEvents()
      .then(async (evts) => {
        setEvents(evts);
        const main = evts[0];
        if (main) {
          const items = await getSchedule(main.id).catch(() => []);
          if (items && items.length > 0) {
            setSchedule(items);
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
  const content = mainEvent?.siteContent;
  const effectiveSchedule = schedule && schedule.length > 0 ? schedule : COPOL_FALLBACK_SCHEDULE;

  // Filtra itens com base na aba selecionada
  const filteredSchedule = selectedDay === "all"
    ? effectiveSchedule
    : effectiveSchedule.filter((item) => {
        const itemDate = item.date ? item.date.split("T")[0] : "";
        return itemDate === selectedDay;
      });

  // Agrupa os itens por data
  const groupedByDate: Record<string, ScheduleItem[]> = {};
  filteredSchedule.forEach((item) => {
    const d = item.date ? item.date.split("T")[0]! : "2026-11-05";
    if (!groupedByDate[d]) groupedByDate[d] = [];
    groupedByDate[d]!.push(item);
  });

  const dates = Object.keys(groupedByDate).sort();

  function formatDateHeader(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader eventTitle={content?.eventTitle || "COPOL"} eventYear={content?.eventYear || "2026"} />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.4 }} />

        <div className="container-page animate-fade-up" style={{ position: "relative", maxWidth: 880, padding: "48px 24px 80px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "var(--gold)",
                fontWeight: 700,
              }}
            >
              CRONOGRAMA DO EVENTO
            </span>
            <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(28px, 4.5vw, 40px)", fontWeight: 800 }}>
              Programação Oficial
            </h1>
            <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 16, maxWidth: 580, marginLeft: "auto", marginRight: "auto" }}>
              Confira todas as palestras, hands on, credenciamento e momentos solenes confirmados para o {mainEvent?.name || "COPOL 2026"}.
            </p>
          </div>

          {/* Day Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 36,
              flexWrap: "wrap",
            }}
            role="tablist"
            aria-label="Filtro de dias do cronograma"
          >
            {DAY_TABS.map((tab) => {
              const isActive = selectedDay === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedDay(tab.id)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: isActive
                      ? "1px solid var(--gold)"
                      : "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                    background: isActive
                      ? "var(--gold)"
                      : "var(--card, rgba(255, 255, 255, 0.05))",
                    color: isActive ? "#0B2928" : "var(--foreground)",
                    boxShadow: isActive ? "0 4px 12px rgba(212, 168, 83, 0.25)" : "none",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "var(--muted-foreground)" }}>Carregando programação...</p>
          ) : dates.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 15 }}>
                Nenhuma atividade encontrada para o dia selecionado.
              </p>
              <button
                type="button"
                onClick={() => setSelectedDay("all")}
                className="btn-secondary"
                style={{ marginTop: 20 }}
              >
                Ver todos os dias
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
              {dates.map((dateStr) => {
                const items = groupedByDate[dateStr] ?? [];
                return (
                  <div key={dateStr} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div
                      style={{
                        padding: "10px 18px",
                        background: "rgba(200, 162, 97, 0.12)",
                        borderRadius: 8,
                        borderLeft: "4px solid var(--gold)",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--gold)",
                        textTransform: "capitalize",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <CalendarIcon size={18} /> {formatDateHeader(dateStr)} ({items.length} {items.length === 1 ? "atividade" : "atividades"})
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {items.map((item) => {
                        const badgeStyle = getCategoryBadgeStyle(item.type);
                        return (
                          <div
                            key={item.id}
                            className="card"
                            style={{
                              padding: "20px 24px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                              transition: "transform 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                {item.startTime && item.startTime !== "—" ? (
                                  <span
                                    style={{
                                      fontFamily: "monospace",
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "var(--gold)",
                                      background: "rgba(200, 162, 97, 0.1)",
                                      padding: "4px 10px",
                                      borderRadius: 6,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <ClockIcon size={13} />
                                    {item.startTime}{item.endTime ? `–${item.endTime}` : ""}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "var(--muted-foreground)",
                                      background: "rgba(255, 255, 255, 0.05)",
                                      padding: "4px 10px",
                                      borderRadius: 6,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <ClockIcon size={13} />
                                    Encerramento
                                  </span>
                                )}

                                {items.some((other) => other.id !== item.id && other.startTime === item.startTime && Boolean(item.startTime && item.startTime !== "—")) && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: "#60a5fa",
                                      background: "rgba(59, 130, 246, 0.12)",
                                      border: "1px solid rgba(59, 130, 246, 0.3)",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    Simultâneo
                                  </span>
                                )}

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
                                    }}
                                  >
                                    {item.type}
                                  </span>
                                )}
                              </div>

                              {item.location && (
                                <span style={{ fontSize: 13, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <MapPinIcon size={14} /> {item.location}
                                </span>
                              )}
                            </div>

                            <div>
                              <h3 style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>
                                {item.title}
                              </h3>

                              {item.speaker && !item.title.toLowerCase().startsWith(item.speaker.toLowerCase()) && (
                                <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--gold)", fontWeight: 600 }}>
                                  Palestrante: {item.speaker}
                                </p>
                              )}

                              {item.description && item.description !== item.title && (
                                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <Link href="/" className="btn-secondary" style={{ display: "inline-block" }}>
                  ← Voltar para a Página Inicial
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
