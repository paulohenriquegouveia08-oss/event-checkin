import { useEffect, useId, useState } from "react";
import * as api from "../../api/client";

// Mesma lógica de conversão do EventDetailPage: datetime-local trabalha em
// horário LOCAL do navegador, sem timezone — new Date(iso)/.toISOString()
// fecham o round-trip de forma consistente.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

// Espelha DEFAULT_SITE_CONTENT do backend (site-content.ts) — usado só
// pra preencher o formulário quando o evento ainda não tem nada
// customizado, refletindo exatamente o que está no ar agora.
const DEFAULT_TEXT = {
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
  pricingTitle: "Escolha sua categoria",
  partnersTitle: "Realização e apoio",
  partnersText: "Universidade Positivo e LSPK Tecnology apoiam o Pré-Copol 2026.",
  footerText: "3º COPOL — Congresso Odontológico Positivo Londrinense",
};

const DEFAULT_STEPS: api.SiteStep[] = [
  { title: "Inscreva-se", text: "Preencha seus dados e escolha sua categoria de participação." },
  { title: "Pagamento", text: "Siga as instruções enviadas por e-mail para confirmar sua vaga." },
  { title: "Credenciamento", text: "No dia do evento, retire seu QR Code e faça seu check-in na entrada." },
];

const DEFAULT_TIERS: api.PricingTier[] = [
  { key: "STUDENT_UP", label: "Aluno da Universidade Positivo", amount: 30 },
  { key: "STUDENT_OTHER", label: "Aluno de outras instituições", amount: 35 },
  { key: "PROFESSIONAL", label: "Profissional / Professor", amount: 50 },
];

type TextField = keyof typeof DEFAULT_TEXT;

export function SiteTab({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"deadline" | "close" | "reopen" | "content" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [deadline, setDeadline] = useState("");

  const [text, setText] = useState<Record<TextField, string>>(DEFAULT_TEXT);
  const [steps, setSteps] = useState<api.SiteStep[]>(DEFAULT_STEPS);
  const [tiers, setTiers] = useState<api.PricingTier[]>(DEFAULT_TIERS);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    try {
      const data = await api.getEvent(eventId);
      setEvent(data);
      setDeadlineEnabled(!!data.registrationDeadline);
      setDeadline(data.registrationDeadline ? toDatetimeLocal(data.registrationDeadline) : "");

      const c = data.siteContent ?? {};
      setText({
        eventTitle: c.eventTitle || DEFAULT_TEXT.eventTitle,
        eventYear: c.eventYear || DEFAULT_TEXT.eventYear,
        heroBadge: c.heroBadge || DEFAULT_TEXT.heroBadge,
        heroSubtitle: c.heroSubtitle || DEFAULT_TEXT.heroSubtitle,
        aboutTitle: c.aboutTitle || DEFAULT_TEXT.aboutTitle,
        aboutText: c.aboutText || DEFAULT_TEXT.aboutText,
        stepsTitle: c.stepsTitle || DEFAULT_TEXT.stepsTitle,
        pricingTitle: c.pricingTitle || DEFAULT_TEXT.pricingTitle,
        partnersTitle: c.partnersTitle || DEFAULT_TEXT.partnersTitle,
        partnersText: c.partnersText || DEFAULT_TEXT.partnersText,
        footerText: c.footerText || DEFAULT_TEXT.footerText,
      });
      setSteps(c.steps && c.steps.length > 0 ? c.steps : DEFAULT_STEPS);
      setTiers(c.pricingTiers && c.pricingTiers.length > 0 ? c.pricingTiers : DEFAULT_TIERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar evento");
    }
  }

  function updateText(field: TextField, value: string) {
    setText((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveDeadline() {
    setBusy("deadline");
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateEvent(eventId, {
        registrationDeadline: deadlineEnabled && deadline ? fromDatetimeLocal(deadline) : null,
      });
      setEvent(updated);
      setNotice("Prazo de inscrição salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o prazo");
    } finally {
      setBusy(null);
    }
  }

  async function handleClose() {
    if (!confirm("Encerrar as inscrições agora? O formulário de inscrição do site deixa de aceitar novos inscritos imediatamente.")) return;
    setBusy("close");
    setError(null);
    try {
      setEvent(await api.closeRegistrations(eventId));
      setNotice("Inscrições encerradas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao encerrar inscrições");
    } finally {
      setBusy(null);
    }
  }

  async function handleReopen() {
    setBusy("reopen");
    setError(null);
    try {
      const updated = await api.reopenRegistrations(eventId);
      setEvent(updated);
      setDeadlineEnabled(!!updated.registrationDeadline);
      setDeadline(updated.registrationDeadline ? toDatetimeLocal(updated.registrationDeadline) : "");
      setNotice("Inscrições reabertas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reabrir inscrições");
    } finally {
      setBusy(null);
    }
  }

  function updateStep<K extends keyof api.SiteStep>(index: number, key: K, value: api.SiteStep[K]) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }
  function addStep() {
    if (steps.length >= 6) return;
    setSteps((prev) => [...prev, { title: "", text: "" }]);
  }
  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTier<K extends keyof api.PricingTier>(index: number, key: K, value: api.PricingTier[K]) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  }
  function addTier() {
    setTiers((prev) => [...prev, { key: "", label: "", amount: 0 }]);
  }
  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveContent() {
    setError(null);
    setNotice(null);

    const cleanTiers = tiers
      .map((t) => ({ key: t.key.trim(), label: t.label.trim(), amount: Number(t.amount) }))
      .filter((t) => t.key && t.label);

    if (cleanTiers.length === 0) {
      setError("Configure pelo menos uma categoria de inscrição com valor.");
      return;
    }
    const keyPattern = /^[a-zA-Z0-9_-]+$/;
    const invalidKey = cleanTiers.find((t) => !keyPattern.test(t.key));
    if (invalidKey) {
      setError(`A categoria "${invalidKey.key}" só pode ter letras, números, - e _ (sem espaços/acentos).`);
      return;
    }
    const duplicateKeys = new Set<string>();
    for (const t of cleanTiers) {
      if (duplicateKeys.has(t.key)) {
        setError(`A categoria "${t.key}" está duplicada.`);
        return;
      }
      duplicateKeys.add(t.key);
    }

    const cleanSteps = steps
      .map((s) => ({ title: s.title.trim(), text: s.text.trim() }))
      .filter((s) => s.title && s.text);

    if (cleanSteps.length === 0) {
      setError("Configure pelo menos um passo em \"Como funciona\".");
      return;
    }

    if (!text.eventTitle.trim() || !text.aboutText.trim()) {
      setError("Preencha ao menos o título do evento e o texto \"Sobre o evento\".");
      return;
    }

    setBusy("content");
    try {
      const updated = await api.updateEvent(eventId, {
        siteContent: {
          eventTitle: text.eventTitle.trim(),
          eventYear: text.eventYear.trim() || undefined,
          heroBadge: text.heroBadge.trim() || undefined,
          heroSubtitle: text.heroSubtitle.trim() || undefined,
          aboutTitle: text.aboutTitle.trim() || undefined,
          aboutText: text.aboutText.trim(),
          stepsTitle: text.stepsTitle.trim() || undefined,
          steps: cleanSteps,
          pricingTitle: text.pricingTitle.trim() || undefined,
          pricingTiers: cleanTiers,
          partnersTitle: text.partnersTitle.trim() || undefined,
          partnersText: text.partnersText.trim() || undefined,
          footerText: text.footerText.trim() || undefined,
        },
      });
      setEvent(updated);
      setTiers(cleanTiers);
      setSteps(cleanSteps);
      setNotice("Conteúdo do site salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o conteúdo do site");
    } finally {
      setBusy(null);
    }
  }

  if (!event) return <p className="muted">Carregando...</p>;

  return (
    <div className="stack" style={{ gap: 24 }}>
      {error ? <p className="error-text">{error}</p> : null}
      {notice ? <p style={{ color: "var(--success)", margin: 0, fontSize: 13 }}>{notice}</p> : null}

      {/* ---------- Status + encerrar/retomar ---------- */}
      <div className="card" style={{ padding: 20 }}>
        <div className="spread" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Inscrições</h3>
          <span className={`badge ${event.registrationsOpen ? "badge-success" : "badge-muted"}`}>
            {event.registrationsOpen ? "Abertas" : "Encerradas"}
          </span>
        </div>

        {event.registrationsClosedAt ? (
          <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            Encerradas manualmente em {new Date(event.registrationsClosedAt).toLocaleString("pt-BR")}.
          </p>
        ) : null}
        {!event.registrationsOpen && !event.registrationsClosedAt && event.registrationDeadline ? (
          <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            Encerradas automaticamente pelo prazo, em {new Date(event.registrationDeadline).toLocaleString("pt-BR")}.
            "Retomar" limpa esse prazo.
          </p>
        ) : null}

        <div className="row" style={{ gap: 10, marginBottom: 20 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleClose} disabled={busy !== null || !event.registrationsOpen}>
            {busy === "close" ? "Encerrando..." : "Encerrar inscrições"}
          </button>
          <button className="btn btn-sm" onClick={handleReopen} disabled={busy !== null || event.registrationsOpen}>
            {busy === "reopen" ? "Reabrindo..." : "Retomar inscrições"}
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <label className="row" style={{ gap: 8, marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={deadlineEnabled}
              onChange={(e) => setDeadlineEnabled(e.target.checked)}
              style={{ width: "auto", flexShrink: 0, padding: 0, background: "none", border: "none" }}
            />
            <span>Encerrar inscrições automaticamente numa data</span>
          </label>

          {deadlineEnabled ? (
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          ) : null}

          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm" onClick={handleSaveDeadline} disabled={busy !== null || (deadlineEnabled && !deadline)}>
              {busy === "deadline" ? "Salvando..." : "Salvar prazo"}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Conteúdo do site ---------- */}
      <div className="card" style={{ padding: 20 }}>
        <div className="spread" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Conteúdo do site (precopol.vercel.app)</h3>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "0 0 20px" }}>
          Tudo aqui aparece direto no site, sem precisar mexer em código. Campos deixados em branco usam o texto
          padrão que já está no ar.
        </p>

        <div className="stack" style={{ gap: 28 }}>
          {/* Cabeçalho / Hero */}
          <ContentSection title="Cabeçalho e topo da página">
            <FieldRow>
              <TextField label="Nome do evento (destaque dourado)" value={text.eventTitle} onChange={(v) => updateText("eventTitle", v)} />
              <TextField label="Ano / edição" value={text.eventYear} onChange={(v) => updateText("eventYear", v)} narrow />
            </FieldRow>
            <TextField
              label="Selo/badge acima do título"
              value={text.heroBadge}
              onChange={(v) => updateText("heroBadge", v)}
            />
            <TextAreaField
              label="Texto de abertura (tema do evento)"
              value={text.heroSubtitle}
              onChange={(v) => updateText("heroSubtitle", v)}
              rows={3}
            />
          </ContentSection>

          {/* Sobre */}
          <ContentSection title='Seção "Sobre o evento"'>
            <TextField label="Título da seção" value={text.aboutTitle} onChange={(v) => updateText("aboutTitle", v)} />
            <TextAreaField label="Texto" value={text.aboutText} onChange={(v) => updateText("aboutText", v)} rows={5} required />
          </ContentSection>

          {/* Como funciona */}
          <ContentSection title='Seção "Como funciona"'>
            <TextField label="Título da seção" value={text.stepsTitle} onChange={(v) => updateText("stepsTitle", v)} />
            <ListEditor
              label="Passos"
              onAdd={addStep}
              addDisabled={steps.length >= 6}
            >
              {steps.map((step, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <span className="muted" style={{ fontSize: 13, marginTop: 10, flexShrink: 0, width: 16 }}>
                    {i + 1}.
                  </span>
                  <div className="stack" style={{ gap: 6, flex: 1 }}>
                    <input
                      value={step.title}
                      onChange={(e) => updateStep(i, "title", e.target.value)}
                      placeholder="Título do passo"
                    />
                    <input
                      value={step.text}
                      onChange={(e) => updateStep(i, "text", e.target.value)}
                      placeholder="Descrição curta"
                    />
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeStep(i)}
                    type="button"
                    disabled={steps.length <= 1}
                    title="Remover passo"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </ListEditor>
          </ContentSection>

          {/* Investimento */}
          <ContentSection title='Seção "Investimento" (categorias e valores)'>
            <TextField label="Título da seção" value={text.pricingTitle} onChange={(v) => updateText("pricingTitle", v)} />
            <ListEditor label="Categorias e valores de inscrição" onAdd={addTier}>
              {tiers.map((tier, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "center" }}>
                  <input
                    value={tier.label}
                    onChange={(e) => updateTier(i, "label", e.target.value)}
                    placeholder="Nome da categoria"
                    style={{ flex: 2 }}
                  />
                  <input
                    value={tier.key}
                    onChange={(e) => updateTier(i, "key", e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                    placeholder="CHAVE_INTERNA"
                    title="Identificador interno, sem espaços ou acentos"
                    style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={tier.amount}
                    onChange={(e) => updateTier(i, "amount", Number(e.target.value))}
                    style={{ width: 100 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeTier(i)}
                    type="button"
                    disabled={tiers.length <= 1}
                    title="Remover categoria"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </ListEditor>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              A chave interna identifica a categoria nas inscrições já feitas — evite trocar a chave de uma
              categoria que já tem gente inscrita, só o nome/valor.
            </p>
          </ContentSection>

          {/* Parceiros */}
          <ContentSection title='Bloco "Realização e apoio" (na home)'>
            <TextField label="Título" value={text.partnersTitle} onChange={(v) => updateText("partnersTitle", v)} />
            <TextAreaField label="Texto" value={text.partnersText} onChange={(v) => updateText("partnersText", v)} rows={2} />
          </ContentSection>

          {/* Rodapé */}
          <ContentSection title="Rodapé">
            <TextField label="Texto do rodapé" value={text.footerText} onChange={(v) => updateText("footerText", v)} />
          </ContentSection>

          <div>
            <button className="btn" onClick={handleSaveContent} disabled={busy !== null}>
              {busy === "content" ? "Salvando..." : "Salvar conteúdo do site"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 10, paddingTop: 4 }}>
      <h4 style={{ margin: 0, fontSize: 13, color: "var(--gold, var(--primary))", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  narrow,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  narrow?: boolean;
}) {
  const id = useId();
  return (
    <div style={{ flex: narrow ? "0 0 100px" : 1 }}>
      <label htmlFor={id} className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
        {label}
        {required ? " *" : ""}
      </label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={{ width: "100%", resize: "vertical" }} />
    </div>
  );
}

function ListEditor({
  label,
  onAdd,
  addDisabled,
  children,
}: {
  label: string;
  onAdd: () => void;
  addDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="spread" style={{ marginBottom: 8 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          {label}
        </label>
        <button className="btn btn-secondary btn-sm" onClick={onAdd} type="button" disabled={addDisabled}>
          + Adicionar
        </button>
      </div>
      <div className="stack" style={{ gap: 8 }}>{children}</div>
    </div>
  );
}
