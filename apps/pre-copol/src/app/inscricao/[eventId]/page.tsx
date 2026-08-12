"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getEvent, createInscription, type EventData, type InscriptionInput } from "@/lib/api";

const CATEGORIES = [
  { value: "STUDENT_UP", label: "Aluno da Universidade Positivo", amount: 30 },
  { value: "STUDENT_OTHER", label: "Aluno de outras instituições", amount: 35 },
  { value: "PROFESSIONAL", label: "Profissional / Professor", amount: 50 },
] as const;

export default function InscriptionPage() {
  const { eventId } = useParams<{ eventId: string }>();
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
    category: "STUDENT_UP",
    institution: "",
    notes: "",
  });

  useEffect(() => {
    getEvent(eventId)
      .then(setEvent)
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
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  const selectedCategory = CATEGORIES.find((c) => c.value === form.category);

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Carregando...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ color: "var(--destructive)" }}>Evento não encontrado.</p>
        <Link href="/">← Voltar</Link>
      </div>
    );
  }

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
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Link href="/" style={{ color: "var(--muted-foreground)", fontSize: 13, textDecoration: "none" }}>
            ← Voltar
          </Link>
          <h1 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>Inscrição</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: 13 }}>
            {event.name}
          </p>
        </div>
      </header>

      {/* Form */}
      <main style={{ flex: 1, padding: "24px 24px 48px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              Nome completo *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Seu nome completo"
              required
              style={inputStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              E-mail *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="seu@email.com"
              required
              style={inputStyle}
            />
          </div>

          {/* CPF */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              CPF *
            </label>
            <input
              type="text"
              value={form.document}
              onChange={(e) => updateField("document", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              required
              style={inputStyle}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              Telefone
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => updateField("phone", formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              style={inputStyle}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              Categoria *
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: form.category === cat.value ? "var(--background)" : "var(--muted)",
                    border: `1px solid ${form.category === cat.value ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={form.category === cat.value}
                    onChange={(e) => updateField("category", e.target.value as InscriptionInput["category"])}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span style={{ flex: 1 }}>{cat.label}</span>
                  <strong style={{ color: "var(--primary)" }}>R$ {cat.amount},00</strong>
                </label>
              ))}
            </div>
          </div>

          {/* Institution */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              Instituição de ensino (opcional)
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => updateField("institution", e.target.value)}
              placeholder="Nome da instituição"
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted-foreground)", marginBottom: 6 }}>
              Observações (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Alguma informação adicional..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Summary */}
          <div
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              fontSize: 14,
            }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Resumo</p>
            <p style={{ margin: "0 0 4px" }}>Evento: {event.name}</p>
            <p style={{ margin: "0 0 4px" }}>Categoria: {selectedCategory?.label}</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>
              Valor: R$ {selectedCategory?.amount},00
            </p>
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: "var(--destructive)", fontSize: 14, margin: 0 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              border: "none",
              borderRadius: 8,
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Enviando..." : "Finalizar Inscrição"}
          </button>
        </form>
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  outline: "none",
};
