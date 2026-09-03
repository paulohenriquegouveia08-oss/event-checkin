import { useEffect, useState } from "react";
import * as api from "../../api/client";
import {
  PaletteIcon,
  LayersIcon,
  EditIcon,
  GearIcon,
  MoveUpIcon,
  MoveDownIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
} from "../../components/Icons";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

const DEFAULT_THEME: api.SiteTheme = {
  primaryColor: "#2DD4BF",
  accentColor: "#D4A853",
  backgroundColor: "#0E3634",
  surfaceColor: "#154B4C",
  textColor: "#F0FAF9",
  textMutedColor: "#9FC4C2",
};

const THEME_PRESETS = [
  {
    name: "COPOL Clássico (Turquesa & Ouro)",
    theme: {
      primaryColor: "#2DD4BF",
      accentColor: "#D4A853",
      backgroundColor: "#0E3634",
      surfaceColor: "#154B4C",
      textColor: "#F0FAF9",
      textMutedColor: "#9FC4C2",
    },
  },
  {
    name: "Azul Universitário",
    theme: {
      primaryColor: "#38BDF8",
      accentColor: "#FBBF24",
      backgroundColor: "#0F172A",
      surfaceColor: "#1E293B",
      textColor: "#F8FAFC",
      textMutedColor: "#94A3B8",
    },
  },
  {
    name: "Dark Slate & Teal",
    theme: {
      primaryColor: "#0D9488",
      accentColor: "#2DD4BF",
      backgroundColor: "#111827",
      surfaceColor: "#1F2937",
      textColor: "#FFFFFF",
      textMutedColor: "#9CA3AF",
    },
  },
  {
    name: "Bordeaux & Ouro",
    theme: {
      primaryColor: "#881337",
      accentColor: "#F59E0B",
      backgroundColor: "#1A0B10",
      surfaceColor: "#2B141C",
      textColor: "#FFFFFF",
      textMutedColor: "#D1D5DB",
    },
  },
];

const DEFAULT_SECTIONS: api.SiteSectionConfig[] = [
  { id: "hero", type: "hero", title: "Início / Apresentação", subtitle: "Destaque principal", enabled: true, order: 0 },
  { id: "about", type: "about", title: "Sobre o Evento", subtitle: "Apresentação e propósito", enabled: true, order: 1 },
  { id: "schedule", type: "schedule", title: "Programação Oficial", subtitle: "Cronograma das palestras", enabled: true, order: 2 },
  { id: "batches", type: "batches", title: "Lotes & Inscrição", subtitle: "Valores vigentes", enabled: true, order: 3 },
  { id: "steps", type: "steps", title: "Como Funciona", subtitle: "Passo a passo da inscrição", enabled: true, order: 4 },
  { id: "partners", type: "partners", title: "Realização e Apoio", subtitle: "Marcas apoiadoras", enabled: true, order: 5 },
  { id: "faq", type: "faq", title: "Dúvidas Frequentes", subtitle: "Perguntas comuns", enabled: true, order: 6 },
];

export function SiteTab({ eventId }: { eventId: string }) {
  const [, setEvent] = useState<api.EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sub-aba ativa
  const [subTab, setSubTab] = useState<"theme" | "sections" | "content" | "general">("theme");

  // Estado do Construtor
  const [theme, setTheme] = useState<api.SiteTheme>(DEFAULT_THEME);
  const [sections, setSections] = useState<api.SiteSectionConfig[]>(DEFAULT_SECTIONS);
  const [faqs, setFaqs] = useState<api.FaqItem[]>([]);
  const [partners, setPartners] = useState<api.PartnerItem[]>([]);
  const [steps, setSteps] = useState<api.SiteStep[]>([]);
  const [textFields, setTextFields] = useState({
    eventTitle: "Pré-Copol",
    eventYear: "2026",
    heroBadge: "3º COPOL · Congresso Odontológico Positivo Londrinense",
    heroSubtitle: "Toxina Botulínica: a ciência por trás do resultado natural.",
    aboutTitle: "Um encontro pra quem leva a odontologia a sério",
    aboutText: "O Pré-Copol 2026 é a abertura do 3º Congresso Odontológico Positivo Londrinense.",
    stepsTitle: "Da inscrição ao credenciamento",
    pricingTitle: "Escolha sua categoria",
    partnersTitle: "Realização e apoio",
    partnersText: "Universidade Positivo e parceiros apoiam o evento.",
    footerText: "3º COPOL — Todos os direitos reservados",
  });

  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEvent(eventId);
      setEvent(data);
      setDeadlineEnabled(!!data.registrationDeadline);
      setDeadline(data.registrationDeadline ? toDatetimeLocal(data.registrationDeadline) : "");

      const c = data.siteContent ?? {};
      if (c.theme) {
        let pColor = c.theme.primaryColor || DEFAULT_THEME.primaryColor;
        if (pColor.toUpperCase() === "#0E3634" || pColor.toUpperCase() === "#0B2928") {
          pColor = "#2DD4BF";
        }
        setTheme({ ...DEFAULT_THEME, ...c.theme, primaryColor: pColor });
      }
      if (c.sections && c.sections.length > 0) {
        setSections([...c.sections].sort((a, b) => a.order - b.order));
      } else {
        setSections(DEFAULT_SECTIONS);
      }
      if (c.faqs) setFaqs(c.faqs);
      if (c.partnersList) setPartners(c.partnersList);
      if (c.steps) setSteps(c.steps);

      setTextFields({
        eventTitle: c.eventTitle || "Pré-Copol",
        eventYear: c.eventYear || "2026",
        heroBadge: c.heroBadge || "3º COPOL · Congresso Odontológico Positivo Londrinense",
        heroSubtitle: c.heroSubtitle || "Toxina Botulínica: a ciência por trás do resultado natural.",
        aboutTitle: c.aboutTitle || "Um encontro pra quem leva a odontologia a sério",
        aboutText: c.aboutText || "O Pré-Copol 2026 é a abertura do 3º Congresso Odontológico Positivo Londrinense.",
        stepsTitle: c.stepsTitle || "Da inscrição ao credenciamento",
        pricingTitle: c.pricingTitle || "Escolha sua categoria",
        partnersTitle: c.partnersTitle || "Realização e apoio",
        partnersText: c.partnersText || "Universidade Positivo e parceiros apoiam o evento.",
        footerText: c.footerText || "3º COPOL — Todos os direitos reservados",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configurações do site");
    } finally {
      setLoading(false);
    }
  }

  // Funções de manipulação de seções
  function moveSection(index: number, direction: "up" | "down") {
    const newSections = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    const temp = newSections[index]!;
    newSections[index] = newSections[targetIndex]!;
    newSections[targetIndex] = temp;

    // Atualiza order
    newSections.forEach((s, idx) => {
      s.order = idx;
    });

    setSections(newSections);
  }

  function toggleSection(index: number) {
    const newSections = [...sections];
    const item = newSections[index];
    if (!item) return;
    item.enabled = !item.enabled;
    setSections(newSections);
  }

  function updateSectionStyle(index: number, field: "backgroundColor" | "textColor", value: string) {
    const newSections = [...sections];
    const item = newSections[index];
    if (!item) return;
    item[field] = value.trim() ? value : null;
    setSections(newSections);
  }

  // FAQ CRUD
  function addFaq() {
    setFaqs([...faqs, { question: "Nova Pergunta", answer: "Resposta aqui..." }]);
  }
  function updateFaq(idx: number, field: "question" | "answer", val: string) {
    const updated = [...faqs];
    if (updated[idx]) {
      updated[idx][field] = val;
      setFaqs(updated);
    }
  }
  function removeFaq(idx: number) {
    setFaqs(faqs.filter((_, i) => i !== idx));
  }

  // Salvar tudo
  async function handleSaveAll() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const siteContent: api.SiteContent = {
        theme,
        sections,
        faqs,
        partnersList: partners,
        steps,
        ...textFields,
      };

      await api.updateEvent(eventId, {
        siteContent,
        registrationDeadline: deadlineEnabled && deadline ? fromDatetimeLocal(deadline) : null,
      });

      setNotice("Configurações do site salvas com sucesso! O visual foi atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    if (!confirm("Deseja redefinir as cores e posições para o padrão oficial do COPOL?")) return;
    setTheme(DEFAULT_THEME);
    setSections(DEFAULT_SECTIONS);
  }

  if (loading) return <p className="muted">Carregando construtor do site...</p>;

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Topo com ações */}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Construtor do Site (White-Label)</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Personalize cores, organize a ordem das seções e altere todo o conteúdo do portal público.
          </p>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleResetDefaults} disabled={saving}>
            Restaurar Padrão
          </button>
          <button className="btn btn-sm" onClick={handleSaveAll} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CheckIcon size={14} /> {saving ? "Salvando..." : "Salvar Alterações do Site"}
          </button>
        </div>
      </div>

      {notice && <p className="badge badge-success" style={{ padding: "8px 14px", fontSize: 13 }}>{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      {/* Menu de Sub-Abas */}
      <div className="row" style={{ gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <button
          className={`btn-sm ${subTab === "theme" ? "btn" : "btn-secondary"}`}
          onClick={() => setSubTab("theme")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <PaletteIcon size={14} /> Cores e Tema
        </button>

        <button
          className={`btn-sm ${subTab === "sections" ? "btn" : "btn-secondary"}`}
          onClick={() => setSubTab("sections")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <LayersIcon size={14} /> Posição das Seções
        </button>

        <button
          className={`btn-sm ${subTab === "content" ? "btn" : "btn-secondary"}`}
          onClick={() => setSubTab("content")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <EditIcon size={14} /> Conteúdo das Seções
        </button>

        <button
          className={`btn-sm ${subTab === "general" ? "btn" : "btn-secondary"}`}
          onClick={() => setSubTab("general")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <GearIcon size={14} /> Prazos & Inscrições
        </button>
      </div>

      {/* SUB-ABA 1: CORES E TEMA */}
      {subTab === "theme" && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Paleta de Cores do Evento</h3>
            <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
              Altere a identidade visual completa do site público. As mudanças refletem instantaneamente no portal.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <ColorPickerField
                label="Cor Primária"
                value={theme.primaryColor}
                onChange={(val) => setTheme({ ...theme, primaryColor: val })}
              />
              <ColorPickerField
                label="Cor de Destaque (Dourado)"
                value={theme.accentColor}
                onChange={(val) => setTheme({ ...theme, accentColor: val })}
              />
              <ColorPickerField
                label="Fundo da Página"
                value={theme.backgroundColor}
                onChange={(val) => setTheme({ ...theme, backgroundColor: val })}
              />
              <ColorPickerField
                label="Fundo dos Cards"
                value={theme.surfaceColor}
                onChange={(val) => setTheme({ ...theme, surfaceColor: val })}
              />
              <ColorPickerField
                label="Texto Principal"
                value={theme.textColor}
                onChange={(val) => setTheme({ ...theme, textColor: val })}
              />
              <ColorPickerField
                label="Texto Suave"
                value={theme.textMutedColor}
                onChange={(val) => setTheme({ ...theme, textMutedColor: val })}
              />
            </div>
          </div>

          {/* Presets Rápidos */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Temas Predefinidos (1 Clique)</h4>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTheme(p.theme)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: p.theme.primaryColor,
                      border: `2px solid ${p.theme.accentColor}`,
                    }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: POSIÇÃO E ORDEM DAS SEÇÕES */}
      {subTab === "sections" && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Estrutura e Ordem da Página Inicial</h3>
            <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
              Use os botões de subir e descer para alterar a ordem em que as seções aparecem no site, ou oculte as que não deseja exibir.
            </p>

            <div className="stack" style={{ gap: 10 }}>
              {sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="spread"
                  style={{
                    padding: "12px 16px",
                    background: sec.enabled ? "var(--surface, #1e293b)" : "rgba(0,0,0,0.05)",
                    opacity: sec.enabled ? 1 : 0.6,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div className="row" style={{ gap: 12, alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, width: 24, textAlign: "center", color: "var(--muted-foreground)" }}>
                      {idx + 1}º
                    </span>
                    <div>
                      <strong style={{ fontSize: 14 }}>{sec.title}</strong>
                      <span className="muted" style={{ fontSize: 12, display: "block" }}>
                        Tipo: {sec.type}
                      </span>
                    </div>
                  </div>

                  {/* Cores individuais da seção */}
                  <div className="row" style={{ gap: 10, alignItems: "center" }}>
                    <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="muted">Fundo Seção:</span>
                      <input
                        type="color"
                        value={sec.backgroundColor || theme.backgroundColor}
                        onChange={(e) => updateSectionStyle(idx, "backgroundColor", e.target.value)}
                        style={{ width: 28, height: 28, padding: 0, border: "none", borderRadius: 4, cursor: "pointer" }}
                      />
                    </label>

                    <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="muted">Texto:</span>
                      <input
                        type="color"
                        value={sec.textColor || theme.textColor}
                        onChange={(e) => updateSectionStyle(idx, "textColor", e.target.value)}
                        style={{ width: 28, height: 28, padding: 0, border: "none", borderRadius: 4, cursor: "pointer" }}
                      />
                    </label>

                    {/* Botões de Ação */}
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleSection(idx)}
                        title={sec.enabled ? "Ocultar seção" : "Ativar seção"}
                        style={{ padding: "6px 8px" }}
                      >
                        {sec.enabled ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, "up")}
                        title="Subir seção"
                        style={{ padding: "6px 8px" }}
                      >
                        <MoveUpIcon size={14} />
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={idx === sections.length - 1}
                        onClick={() => moveSection(idx, "down")}
                        title="Descer seção"
                        style={{ padding: "6px 8px" }}
                      >
                        <MoveDownIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: CONTEÚDO DAS SEÇÕES */}
      {subTab === "content" && (
        <div className="stack" style={{ gap: 20 }}>
          {/* Header & Hero */}
          <div className="card stack" style={{ padding: 20, gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Seção Hero / Apresentação</h3>
            <div className="row" style={{ gap: 12 }}>
              <label className="stack" style={{ flex: 1, gap: 4, fontSize: 12 }}>
                <span>Título do Evento</span>
                <input
                  type="text"
                  value={textFields.eventTitle}
                  onChange={(e) => setTextFields({ ...textFields, eventTitle: e.target.value })}
                />
              </label>
              <label className="stack" style={{ width: 120, gap: 4, fontSize: 12 }}>
                <span>Ano</span>
                <input
                  type="text"
                  value={textFields.eventYear}
                  onChange={(e) => setTextFields({ ...textFields, eventYear: e.target.value })}
                />
              </label>
            </div>

            <label className="stack" style={{ gap: 4, fontSize: 12 }}>
              <span>Badge / Selo Superior</span>
              <input
                type="text"
                value={textFields.heroBadge}
                onChange={(e) => setTextFields({ ...textFields, heroBadge: e.target.value })}
              />
            </label>

            <label className="stack" style={{ gap: 4, fontSize: 12 }}>
              <span>Subtítulo do Hero</span>
              <textarea
                rows={2}
                value={textFields.heroSubtitle}
                onChange={(e) => setTextFields({ ...textFields, heroSubtitle: e.target.value })}
              />
            </label>
          </div>

          {/* Sobre o Evento */}
          <div className="card stack" style={{ padding: 20, gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Seção Sobre o Evento</h3>
            <label className="stack" style={{ gap: 4, fontSize: 12 }}>
              <span>Título</span>
              <input
                type="text"
                value={textFields.aboutTitle}
                onChange={(e) => setTextFields({ ...textFields, aboutTitle: e.target.value })}
              />
            </label>
            <label className="stack" style={{ gap: 4, fontSize: 12 }}>
              <span>Texto Descritivo</span>
              <textarea
                rows={5}
                value={textFields.aboutText}
                onChange={(e) => setTextFields({ ...textFields, aboutText: e.target.value })}
              />
            </label>
          </div>

          {/* Dúvidas Frequentes (FAQ) */}
          <div className="card stack" style={{ padding: 20, gap: 14 }}>
            <div className="spread" style={{ alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Perguntas Frequentes (FAQ)</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addFaq} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PlusIcon size={14} /> Adicionar Pergunta
              </button>
            </div>

            <div className="stack" style={{ gap: 12 }}>
              {faqs.map((faq, idx) => (
                <div key={idx} className="card stack" style={{ padding: 14, gap: 8, background: "rgba(0,0,0,0.02)" }}>
                  <div className="spread">
                    <input
                      type="text"
                      placeholder="Pergunta..."
                      value={faq.question}
                      onChange={(e) => updateFaq(idx, "question", e.target.value)}
                      style={{ flex: 1, marginRight: 10, fontWeight: 600 }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFaq(idx)}>
                      <TrashIcon size={14} />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Resposta..."
                    value={faq.answer}
                    onChange={(e) => updateFaq(idx, "answer", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé */}
          <div className="card stack" style={{ padding: 20, gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Texto do Rodapé</h3>
            <input
              type="text"
              value={textFields.footerText}
              onChange={(e) => setTextFields({ ...textFields, footerText: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* SUB-ABA 4: PRAZOS E INSCRIÇÕES */}
      {subTab === "general" && (
        <div className="card stack" style={{ padding: 20, gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Prazos de Inscrição Automáticos</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Defina uma data limite para as inscrições encerrarem automaticamente, se desejar.
          </p>

          <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={deadlineEnabled}
              onChange={(e) => setDeadlineEnabled(e.target.checked)}
            />
            <span>Ativar data e horário limite de inscrição</span>
          </label>

          {deadlineEnabled && (
            <label className="stack" style={{ gap: 4, maxWidth: 300, fontSize: 12 }}>
              <span>Data e Hora Limite</span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function ColorPickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <label className="stack" style={{ gap: 6, fontSize: 12 }}>
      <span>{label}</span>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, fontFamily: "monospace", textTransform: "uppercase" }}
        />
      </div>
    </label>
  );
}
