"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  listActiveEvents,
  getEvent,
  getBatches,
  createInscription,
  type EventData,
  type BatchItem,
  type InscriptionInput,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArrowRightIcon } from "@/components/Icons";
import { RESUMO_ACEITE, VERSAO_TERMOS } from "@/lib/termos";

export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionContent />
    </Suspense>
  );
}

function InscriptionContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "";
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [activeBatch, setActiveBatch] = useState<BatchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<InscriptionInput>({
    name: "",
    email: "",
    document: "",
    phone: "",
    institution: "",
    notes: "",
    consentVersion: VERSAO_TERMOS,
  });

  // O aceite fica FORA do `form` de proposito: ele nao e' um dado da
  // pessoa, e' a condicao para enviar. O que vai ao servidor e' a
  // versao do termo, nao um "true" solto.
  const [aceitou, setAceitou] = useState(false);

const FALLBACK_EVENT_ID = "f1b36d08-e85d-459b-8606-69119ab05a78";

const FALLBACK_BATCH: BatchItem = {
  id: "cc96d201-03a4-455c-bac2-070ffa0fee85",
  batchNumber: 1,
  name: "1º Lote — Promocional",
  price: 100,
  maxQuantity: 60,
  confirmedCount: 0,
  status: "ACTIVE",
  isActive: true,
  endDate: null,
};

const FALLBACK_EVENT: EventData = {
  id: FALLBACK_EVENT_ID,
  name: "Copol",
  description: "3º Congresso Odontológico Positivo Londrinense",
  location: "Universidade Positivo",
  startDate: "2026-11-05T10:30:00.000Z",
  endDate: "2026-11-08T01:00:00.000Z",
  status: "ACTIVE",
  registrationDeadline: null,
  registrationsOpen: true,
  siteContent: {
    eventTitle: "Copol",
    eventYear: "2026",
    heroBadge: "3º COPOL · Congresso Odontológico Positivo Londrinense",
    heroSubtitle: "Um encontro para compartilhar conhecimento, experiências e inovação em Odontologia.",
    aboutTitle: "Conhecimento que transforma a Odontologia",
    aboutText: "O 3º COPOL reúne estudantes, professores e profissionais da Odontologia.",
    stepsTitle: "Da inscrição ao credenciamento",
    steps: [],
    pricingTitle: "Garanta sua participação",
    pricingTiers: [],
    partnersTitle: "Realização e apoio",
    partnersText: "Universidade Positivo",
    footerText: "3º COPOL",
  },
};

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        let targetId = eventId;
        if (!targetId) {
          const activeList = await listActiveEvents().catch(() => []);
          const copolEv =
            activeList.find((e) => e.slug === "copol" || e.name.toLowerCase().includes("copol")) ||
            activeList[0];
          if (copolEv) {
            targetId = copolEv.id;
          } else {
            targetId = FALLBACK_EVENT_ID;
          }
        }

        const [eventData, batchData] = await Promise.all([
          getEvent(targetId).catch(() => FALLBACK_EVENT),
          getBatches(targetId).catch(() => ({ batches: [FALLBACK_BATCH], activeBatch: FALLBACK_BATCH })),
        ]);

        if (isMounted) {
          setEvent(eventData || FALLBACK_EVENT);
          const resolvedActive =
            batchData.activeBatch ||
            batchData.batches.find((b) => b.isActive) ||
            FALLBACK_BATCH;
          setActiveBatch(resolvedActive);
        }
      } catch {
        if (isMounted) {
          setEvent(FALLBACK_EVENT);
          setActiveBatch(FALLBACK_BATCH);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  function updateField<K extends keyof InscriptionInput>(key: K, value: InscriptionInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function formatCpf(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.email.trim() || !form.document.trim()) {
      setError("Preencha nome, e-mail e CPF.");
      return;
    }

    // Barreira tambem aqui, alem do botao desabilitado: o `disabled` e'
    // conforto visual, nao garantia — some com um clique no inspetor.
    // Quem recusa de verdade e' o servidor, que exige consentVersion.
    if (!aceitou) {
      setError("É necessário aceitar o termo de inscrição para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const targetId = eventId || event?.id || FALLBACK_EVENT_ID;
      if (!targetId) {
        setError("Evento não identificado para inscrição.");
        setSubmitting(false);
        return;
      }
      const result = await createInscription(targetId, form);
      router.push(`/confirmacao?id=${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar inscrição.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <p style={{ color: "var(--muted-foreground)", textAlign: "center" }}>Carregando...</p>
      </PageShell>
    );
  }

  if (!event) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", padding: "40px 20px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Inscrições em Breve</h2>
          <p style={{ color: "var(--muted-foreground)", maxWidth: 460, margin: 0, lineHeight: 1.6 }}>
            Não encontramos um lote de inscrições aberto no momento. Acompanhe a programação oficial e as divulgações do COPOL 2026.
          </p>
          <Link href="/" className="btn-secondary" style={{ marginTop: 8 }}>
            Voltar para a página inicial
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!event.registrationsOpen || !activeBatch || activeBatch.status === "CLOSED") {
    return (
      <PageShell>
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 40,
            maxWidth: 460,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              color: "#f87171",
            }}
          >
            Lote Esgotado / Aguardando Próximo
          </span>
          <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{event.name}</h1>
          <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14, lineHeight: 1.6 }}>
            As vagas deste lote foram totalmente preenchidas. O próximo lote aguarda liberação manual pela organização do COPOL 2026.
          </p>
          <Link href="/#lotes" className="btn-primary" style={{ marginTop: 8 }}>
            ← Consultar Lotes
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader eventTitle={event.siteContent.eventTitle} eventYear={event.siteContent.eventYear} />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.5 }} />
        <div className="container-page" style={{ position: "relative", maxWidth: 640, padding: "48px 24px 64px" }}>
          <Link href="/" style={{ color: "var(--muted-foreground)", fontSize: 13, textDecoration: "none" }}>
            Voltar
          </Link>
          <h1 style={{ margin: "12px 0 4px", fontSize: "clamp(24px, 4vw, 32px)" }}>Inscrição</h1>
          <p style={{ margin: "0 0 24px", color: "var(--muted-foreground)" }}>{event.name}</p>

          {/* Banner do Lote Ativo */}
          <div
            className="animate-fade-up"
            style={{
              background: "rgba(200, 162, 97, 0.08)",
              border: "1px solid rgba(200, 162, 97, 0.3)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--gold)", fontWeight: 700 }}>
                LOTE ATUAL VIGENTE
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 800, color: "var(--foreground)" }}>
                {activeBatch?.name || "Inscrição Geral"}
              </h3>
              {activeBatch?.maxQuantity && (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
                  {activeBatch.confirmedCount} de {activeBatch.maxQuantity} vagas preenchidas
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "clamp(24px, 5vw, 28px)", fontWeight: 800, color: "var(--gold)", lineHeight: 1 }}>
                {activeBatch && activeBatch.price !== null ? `R$ ${activeBatch.price.toFixed(2).replace(".", ",")}` : "R$ 100,00"}
              </div>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginTop: 4 }}>
                Inscrição única
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="card animate-fade-up"
            style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}
          >
            <Field label="Nome completo *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Seu nome completo"
                required
                style={inputStyle}
              />
            </Field>

            <Field label="E-mail *">
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle}
              />
            </Field>

            <Field label="CPF *">
              <input
                type="text"
                value={form.document}
                onChange={(e) => updateField("document", formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                required
                style={inputStyle}
              />
            </Field>

            <Field label="Telefone com DDD *">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                style={inputStyle}
              />
            </Field>

            <Field label="Instituição de ensino (opcional)">
              <input
                type="text"
                value={form.institution ?? ""}
                onChange={(e) => updateField("institution", e.target.value)}
                placeholder="Ex: Universidade Positivo, UEL, etc."
                style={inputStyle}
              />
            </Field>

            <Field label="Observações (opcional)">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Alguma necessidade especial ou observação para a organização?"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </Field>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 16px",
                marginTop: 8,
                background: "var(--muted, rgba(255,255,255,0.03))",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              <input
                type="checkbox"
                checked={aceitou}
                onChange={(e) => setAceitou(e.target.checked)}
                required
                style={{ marginTop: 3, width: 17, height: 17, flexShrink: 0, cursor: "pointer" }}
              />
              <span>
                {RESUMO_ACEITE}{" "}
                {/* Aba nova: clicar para ler nao pode apagar o que a
                    pessoa ja digitou no formulario. */}
                <Link
                  // O id vai junto para o termo saber voltar. Como ele
                  // abre em aba nova, nao ha historico — sem isto o
                  // botao "voltar" caia numa tela sem evento.
                  href={`/termos?eventId=${encodeURIComponent(eventId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline", fontWeight: 500 }}
                >
                  Ler o termo completo
                </Link>
                .
              </span>
            </label>

            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 8,
                  color: "var(--destructive)",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !aceitou}
              className="btn-primary"
              style={{ width: "100%", padding: 14, fontSize: 16, marginTop: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <span>{submitting ? "Gerando cobrança..." : "Avançar para Pagamento"}</span>
              <ArrowRightIcon size={16} />
            </button>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 15,
  color: "var(--foreground)",
  outline: "none",
  transition: "border-color 0.15s ease",
};
