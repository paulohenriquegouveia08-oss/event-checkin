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
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
  ClockIcon,
  QuestionIcon,
  ChevronDownIcon,
  CheckIcon,
} from "@/components/Icons";

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
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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
          setSchedule(sData);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mainEvent = events[0];
  const registrationsOpen = mainEvent?.registrationsOpen ?? true;
  const content = mainEvent?.siteContent;

  const theme = content?.theme || {
    primaryColor: "#0E3634",
    accentColor: "#C8A261",
    backgroundColor: "#0B2928",
    surfaceColor: "#134543",
    textColor: "#FFFFFF",
    textMutedColor: "#94A3B8",
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
          --primary: ${theme.primaryColor};
          --gold: ${theme.accentColor};
          --background: ${theme.backgroundColor};
          --card: ${theme.surfaceColor};
          --foreground: ${theme.textColor};
          --muted-foreground: ${theme.textMutedColor};
        }
      `}</style>

      <SiteHeader eventTitle={eventTitle} eventYear={eventYear} />

      <main style={{ flex: 1 }}>
        {sections.map((sec) => {
          const sectionStyle: React.CSSProperties = {
            position: "relative",
            backgroundColor: sec.backgroundColor || undefined,
            color: sec.textColor || undefined,
          };

          switch (sec.type) {
            /* ---------- 1. HERO ---------- */
            case "hero":
              return (
                <section key={sec.id} style={{ ...sectionStyle, overflow: "hidden" }}>
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
                      <Image src="/icon-mark.png" alt="Logo" width={84} height={80} priority />
                    </div>

                    <span className="badge">{content?.heroBadge || "3º COPOL · Congresso Odontológico Positivo Londrinense"}</span>

                    <h1 style={{ margin: 0, fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.05 }}>
                      <span style={{ color: "var(--gold)" }}>{eventTitle}</span> {eventYear}
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
                        <Link href={`/inscricao?eventId=${mainEvent.id}`} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span>Garanta sua vaga</span>
                          <ArrowRightIcon size={16} />
                        </Link>
                      ) : null}
                      <Link href="/programacao" className="btn-secondary">
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
                <section key={sec.id} style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
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

            /* ---------- 3. PROGRAMAÇÃO PREVIEW ---------- */
            case "schedule":
              return (
                <section key={sec.id} style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                  <div className="container-page" style={{ maxWidth: 840 }}>
                    <div style={{ textAlign: "center", marginBottom: 36 }}>
                      <SectionEyebrow>Cronograma</SectionEyebrow>
                      <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 12px" }}>
                        {sec.title || "Programação Oficial"}
                      </h2>
                      <p style={{ color: "var(--muted-foreground)", margin: 0 }}>
                        {sec.subtitle || "Destaques das atividades e palestras confirmadas"}
                      </p>
                    </div>

                    {schedule.length === 0 ? (
                      <div className="card" style={{ padding: 32, textAlign: "center" }}>
                        <p className="muted" style={{ margin: 0 }}>Programação em fase final de confirmação pela organização.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {schedule.slice(0, 4).map((item) => (
                          <div key={item.id} className="card spread" style={{ padding: "16px 20px", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--gold)", background: "rgba(200, 162, 97, 0.1)", padding: "4px 8px", borderRadius: 6, fontSize: 13 }}>
                                <ClockIcon size={12} style={{ display: "inline", marginRight: 4 }} />
                                {item.startTime}
                              </span>
                              <div>
                                <strong style={{ fontSize: 15, display: "block" }}>{item.title}</strong>
                                {item.speaker && <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Palestrante: {item.speaker}</span>}
                              </div>
                            </div>
                            {item.location && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{item.location}</span>}
                          </div>
                        ))}

                        <div style={{ textAlign: "center", marginTop: 16 }}>
                          <Link href="/programacao" className="btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>Ver programação completa</span>
                            <ArrowRightIcon size={14} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );

            /* ---------- 4. LOTES & INSCRIÇÃO ---------- */
            case "batches":
              return (
                <section key={sec.id} style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
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

                          <div style={{ fontSize: 28, fontWeight: 800, color: b.isActive ? "var(--gold)" : "var(--foreground)" }}>
                            R$ {b.price.toFixed(2).replace(".", ",")}
                          </div>

                          <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", minHeight: 32 }}>
                            {b.batchNumber === 1
                              ? `${b.confirmedCount} de 60 vagas preenchidas`
                              : b.endDate
                              ? `Válido até ${new Date(b.endDate).toLocaleDateString("pt-BR")}`
                              : "Vagas limitadas"}
                          </p>

                          {b.isActive && mainEvent && registrationsOpen ? (
                            <Link href={`/inscricao?eventId=${mainEvent.id}`} className="btn-primary" style={{ width: "100%", textAlign: "center", padding: 10, fontSize: 14 }}>
                              Inscrever-se
                            </Link>
                          ) : (
                            <span style={{ fontSize: 12, textAlign: "center", color: "var(--muted-foreground)", padding: "10px 0" }}>
                              {b.status === "CLOSED" ? "Encerrado" : "Próximo Lote"}
                            </span>
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
                <section key={sec.id} style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
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
                <section key={sec.id} style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
                  <div className="container-page" style={{ maxWidth: 760, textAlign: "center" }}>
                    <SectionEyebrow>Realização e apoio</SectionEyebrow>
                    <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", margin: "8px 0 16px" }}>
                      {sec.title || content?.partnersTitle || "Realização e Apoio"}
                    </h2>
                    <p style={{ color: "var(--muted-foreground)", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
                      {content?.partnersText || "Universidade Positivo e parceiros apoiam o evento."}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
                      {(content?.partnersList || [{ name: "Universidade Positivo", role: "Realização" }, { name: "LSPK Tecnology", role: "Apoio Tecnológico" }]).map((p) => (
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
                <section key={sec.id} style={{ ...sectionStyle, padding: "64px 24px", borderTop: "1px solid var(--border)" }}>
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
                            onClick={() => setActiveFaq(isOpen ? null : idx)}
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
