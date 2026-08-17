"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getEvent, createInscription, type EventData, type InscriptionInput, type PricingTier } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Rota por query string (?eventId=...), não segmento dinâmico
// ([eventId]) — mesmo motivo de /certificados: export estático (GitHub
// Pages) não tem como pré-gerar uma página por evento que ainda nem
// existe no momento do build.
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<InscriptionInput>({
    name: "",
    email: "",
    document: "",
    phone: "",
    category: "",
    institution: "",
    notes: "",
  });

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    getEvent(eventId)
      .then((data) => {
        setEvent(data);
        const firstTier = data.siteContent.pricingTiers[0];
        if (firstTier) setForm((prev) => ({ ...prev, category: firstTier.key }));
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

  const tiers: PricingTier[] = event?.siteContent.pricingTiers ?? [];
  const selectedTier = tiers.find((t) => t.key === form.category);

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

  if (!event.registrationsOpen) {
    return (
      <PageShell>
        <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 440, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
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
            As inscrições para este evento não estão mais disponíveis.
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
          <p style={{ margin: "0 0 32px", color: "var(--muted-foreground)" }}>{event.name}</p>

          <form onSubmit={handleSubmit} className="card animate-fade-up" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
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

            <Field label="Telefone">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                style={inputStyle}
              />
            </Field>

            <Field label="Categoria *">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tiers.map((tier) => (
                  <label
                    key={tier.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 16px",
                      background: form.category === tier.key ? "rgba(45, 212, 191, 0.08)" : "var(--background)",
                      border: `1px solid ${form.category === tier.key ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      fontSize: 14,
                      transition: "border-color 0.15s ease, background 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={tier.key}
                      checked={form.category === tier.key}
                      onChange={(e) => updateField("category", e.target.value)}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <span style={{ flex: 1 }}>{tier.label}</span>
                    <strong style={{ color: "var(--primary)" }}>R$ {tier.amount.toFixed(2).replace(".", ",")}</strong>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Instituição de ensino (opcional)">
              <input
                type="text"
                value={form.institution}
                onChange={(e) => updateField("institution", e.target.value)}
                placeholder="Nome da instituição"
                style={inputStyle}
              />
            </Field>

            <Field label="Observações (opcional)">
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Alguma informação adicional..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

            <div
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 18,
                fontSize: 14,
              }}
            >
              <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Resumo</p>
              <p style={{ margin: "0 0 4px", color: "var(--muted-foreground)" }}>Evento: {event.name}</p>
              <p style={{ margin: "0 0 10px", color: "var(--muted-foreground)" }}>Categoria: {selectedTier?.label}</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>
                R$ {selectedTier ? selectedTier.amount.toFixed(2).replace(".", ",") : "—"}
              </p>
            </div>

            {error ? <p style={{ color: "var(--destructive)", fontSize: 14, margin: 0 }}>{error}</p> : null}

            <button type="submit" disabled={submitting} className="btn-primary" style={{ width: "100%" }}>
              {submitting ? "Enviando..." : "Finalizar Inscrição"}
            </button>
          </form>
        </div>
      </main>

      <SiteFooter text={event.siteContent.footerText} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 14,
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--foreground)",
  outline: "none",
};
