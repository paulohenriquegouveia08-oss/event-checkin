"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listActiveEvents, getSchedule, type EventData, type ScheduleItem } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CalendarIcon, MapPinIcon } from "@/components/Icons";

export default function SchedulePage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActiveEvents()
      .then(async (evts) => {
        setEvents(evts);
        const main = evts[0];
        if (main) {
          const items = await getSchedule(main.id).catch(() => []);
          setSchedule(items);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mainEvent = events[0];
  const content = mainEvent?.siteContent;

  // Agrupa os itens por data
  const groupedByDate: Record<string, ScheduleItem[]> = {};
  schedule.forEach((item) => {
    if (!groupedByDate[item.date]) groupedByDate[item.date] = [];
    groupedByDate[item.date]!.push(item);
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
      <SiteHeader eventTitle={content?.eventTitle} eventYear={content?.eventYear} />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.4 }} />

        <div className="container-page animate-fade-up" style={{ position: "relative", maxWidth: 760, padding: "48px 24px 80px" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
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
            <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 16, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
              Confira as palestras, credenciamento e atividades confirmadas para o {mainEvent?.name || "COPOL 2026"}.
            </p>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "var(--muted-foreground)" }}>Carregando programação...</p>
          ) : schedule.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 15 }}>
                A programação detalhada está sendo finalizada pela comissão organizadora e será publicada em breve.
              </p>
              <Link href="/" className="btn-secondary" style={{ marginTop: 20, display: "inline-block" }}>
                ← Voltar para o Início
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
              {dates.map((dateStr) => {
                const items = groupedByDate[dateStr] ?? [];
                return (
                  <div key={dateStr} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div
                      style={{
                        padding: "8px 16px",
                        background: "rgba(200, 162, 97, 0.1)",
                        borderRadius: 8,
                        borderLeft: "3px solid var(--gold)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--gold)",
                        textTransform: "capitalize",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <CalendarIcon size={16} /> {formatDateHeader(dateStr)}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="card"
                          style={{
                            padding: "20px 24px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            transition: "transform 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: "var(--primary)",
                                  background: "rgba(45, 212, 191, 0.08)",
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                }}
                              >
                                {item.startTime} {item.endTime ? `— ${item.endTime}` : ""}
                              </span>

                              {item.type && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    color: "var(--muted-foreground)",
                                    background: "var(--background)",
                                    border: "1px solid var(--border)",
                                    padding: "3px 8px",
                                    borderRadius: 999,
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

                          <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>{item.title}</h3>

                          {item.speaker && (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--gold)", fontWeight: 600 }}>
                              Palestrante: {item.speaker}
                            </p>
                          )}

                          {item.description && (
                            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
