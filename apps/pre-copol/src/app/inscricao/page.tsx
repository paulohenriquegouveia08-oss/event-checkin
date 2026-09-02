"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getEvent,
  getBatches,
  createInscription,
  type EventData,
  type BatchItem,
  type InscriptionInput,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

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
  });

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    Promise.all([getEvent(eventId), getBatches(eventId).catch(() => ({ batches: [], activeBatch: null }))])
      .then(([eventData, batchData]) => {
        setEvent(eventData);
        setActiveBatch(batchData.activeBatch);
      })
      .catch(() => setError("Evento não encontrado"))
      .finally(() => setLoading(false));
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

    setSubmitting(true);
    try {
      const result = await createInscription(eventId, form);
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
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <p style={{ color: "var(--destructive)" }}>Evento não encontrado.</p>
          <Link href="/" className="btn-secondary">
            ← Voltar
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!event.registrationsOpen || (activeBatch && activeBatch.status === "CLOSED")) {
    return (
      <PageShell>
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 40,
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              padding: "8px 16px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--destructive)",
            }}
          >
            Inscrições encerradas
          </span>
          <h1 style={{ margin: "8px 0 0", fontSize: 22 }}>{event.name}</h1>
          <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
            As inscrições para este evento não estão mais disponíveis no momento.
          </p>
          <Link href="/" className="btn-secondary" style={{ marginTop: 8 }}>
            ← Voltar
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
            ← Voltar
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
                {activeBatch ? `R$ ${activeBatch.price.toFixed(2).replace(".", ",")}` : "R$ 100,00"}
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
              disabled={submitting}
              className="btn-primary"
              style={{ width: "100%", padding: 14, fontSize: 16, marginTop: 8 }}
            >
              {submitting ? "Gerando cobrança..." : "Avançar para Pagamento →"}
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
