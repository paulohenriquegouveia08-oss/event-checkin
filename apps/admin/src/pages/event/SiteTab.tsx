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
  GripVerticalIcon,
  DesktopIcon,
  MobileIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  ArrowRightIcon,
  QuestionIcon,
  ChevronDownIcon,
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
    name: "Esmeralda & Dourado",
    theme: {
      primaryColor: "#10B981",
      accentColor: "#F59E0B",
      backgroundColor: "#064E3B",
      surfaceColor: "#047857",
      textColor: "#FFFFFF",
      textMutedColor: "#A7F3D0",
    },
  },
  {
    name: "Bordeaux & Ouro",
    theme: {
      primaryColor: "#F43F5E",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modo de visualização: Desktop ou Mobile
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");

  // Seção selecionada na preview para edição no Inspetor
  const [selectedSectionId, setSelectedSectionId] = useState<string>("hero");

  // Sub-aba ativa na barra lateral
  const [sidebarTab, setSidebarTab] = useState<"layers" | "inspector" | "theme" | "general">("layers");

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  // Drag and drop logic
  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSections = [...sections];
    const [movedItem] = newSections.splice(draggedIndex, 1);
    if (movedItem) {
      newSections.splice(targetIndex, 0, movedItem);
      newSections.forEach((s, idx) => {
        s.order = idx;
      });
      setSections(newSections);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function moveSection(index: number, direction: "up" | "down") {
    const newSections = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    const temp = newSections[index]!;
    newSections[index] = newSections[targetIndex]!;
    newSections[targetIndex] = temp;

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

  function selectSection(id: string) {
    setSelectedSectionId(id);
    setSidebarTab("inspector");
  }

  // Passos CRUD
  function addStep() {
    setSteps([...steps, { title: "Novo Passo", text: "Descrição da etapa..." }]);
  }
  function updateStep(idx: number, field: "title" | "text", val: string) {
    const updated = [...steps];
    if (updated[idx]) {
      updated[idx][field] = val;
      setSteps(updated);
    }
  }
  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  // Parceiros CRUD
  function addPartner() {
    setPartners([...partners, { name: "Nome da Organização", role: "Apoio" }]);
  }
  function updatePartner(idx: number, field: "name" | "role", val: string) {
    const updated = [...partners];
    if (updated[idx]) {
      updated[idx][field] = val;
      setPartners(updated);
    }
  }
  function removePartner(idx: number) {
    setPartners(partners.filter((_, i) => i !== idx));
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

      setNotice("Configurações do site salvas com sucesso! As alterações já estão ao vivo.");
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

  if (loading) return <p className="muted">Carregando construtor visual...</p>;

  const activeSection = sections.find((s) => s.id === selectedSectionId) || sections[0];

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* BARRA SUPERIOR: Modo de dispositivo, ações e status */}
      <div
        className="card spread"
        style={{
          padding: "12px 18px",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Construtor Visual do Site (WYSIWYG)</h2>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Clique em qualquer seção na preview para editar ou arraste para reordenar.
            </p>
          </div>
        </div>

        {/* Alternador Desktop / Mobile */}
        <div className="row" style={{ background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 8, gap: 4 }}>
          <button
            type="button"
            className={`btn-sm ${deviceMode === "desktop" ? "btn" : "btn-secondary"}`}
            onClick={() => setDeviceMode("desktop")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <DesktopIcon size={14} /> Desktop
          </button>
          <button
            type="button"
            className={`btn-sm ${deviceMode === "mobile" ? "btn" : "btn-secondary"}`}
            onClick={() => setDeviceMode("mobile")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <MobileIcon size={14} /> Celular
          </button>
        </div>

        {/* Botões de Ação */}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleResetDefaults} disabled={saving}>
            Restaurar Padrão
          </button>
          <button
            className="btn btn-sm"
            onClick={handleSaveAll}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <CheckIcon size={14} /> {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>

      {notice && <p className="badge badge-success" style={{ padding: "8px 14px", fontSize: 13 }}>{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      {/* ÁREA SPLIT-VIEW: SIDEBAR À ESQUERDA + LIVE CANVAS À DIREITA */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        
        {/* ==================== COLUNA ESQUERDA: SIDEBAR / INSPETOR ==================== */}
        <div
          className="card stack"
          style={{
            width: 360,
            flexShrink: 0,
            padding: 16,
            gap: 16,
            background: "var(--card)",
            maxHeight: "85vh",
            overflowY: "auto",
          }}
        >
          {/* Navegação da Sidebar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8 }}>
            <button
              type="button"
              className={`btn-sm ${sidebarTab === "layers" ? "btn" : "btn-secondary"}`}
              onClick={() => setSidebarTab("layers")}
              title="Estrutura e Ordem das Seções"
              style={{ padding: "6px 4px", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            >
              <LayersIcon size={14} /> Camadas
            </button>
            <button
              type="button"
              className={`btn-sm ${sidebarTab === "inspector" ? "btn" : "btn-secondary"}`}
              onClick={() => setSidebarTab("inspector")}
              title="Editar Elemento Selecionado"
              style={{ padding: "6px 4px", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            >
              <EditIcon size={14} /> Inspetor
            </button>
            <button
              type="button"
              className={`btn-sm ${sidebarTab === "theme" ? "btn" : "btn-secondary"}`}
              onClick={() => setSidebarTab("theme")}
              title="Cores Globais do Tema"
              style={{ padding: "6px 4px", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            >
              <PaletteIcon size={14} /> Tema
            </button>
            <button
              type="button"
              className={`btn-sm ${sidebarTab === "general" ? "btn" : "btn-secondary"}`}
              onClick={() => setSidebarTab("general")}
              title="Prazos de Inscrição"
              style={{ padding: "6px 4px", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            >
              <GearIcon size={14} /> Prazos
            </button>
          </div>

          {/* ABA 1: CAMADAS & REORDENAÇÃO (DRAG & DROP) */}
          {sidebarTab === "layers" && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="spread" style={{ alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>Seções da Página</strong>
                <span className="muted" style={{ fontSize: 11 }}>Arraste para reordenar</span>
              </div>

              <div className="stack" style={{ gap: 6 }}>
                {sections.map((sec, idx) => {
                  const isSelected = sec.id === selectedSectionId;
                  const isDragOver = dragOverIndex === idx;

                  return (
                    <div
                      key={sec.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onClick={() => selectSection(sec.id)}
                      className="spread"
                      style={{
                        padding: "8px 10px",
                        background: isSelected ? "rgba(56, 189, 248, 0.15)" : sec.enabled ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.03)",
                        border: isSelected ? "1.5px solid #38BDF8" : isDragOver ? "1.5px dashed #38BDF8" : "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "grab",
                        alignItems: "center",
                        opacity: sec.enabled ? 1 : 0.5,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--muted-foreground)", cursor: "grab" }}>
                          <GripVerticalIcon size={14} />
                        </span>
                        <div>
                          <strong style={{ fontSize: 12, display: "block", color: isSelected ? "#38BDF8" : "inherit" }}>
                            {sec.title}
                          </strong>
                          <span className="muted" style={{ fontSize: 10 }}>{sec.type}</span>
                        </div>
                      </div>

                      <div className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleSection(idx)}
                          title={sec.enabled ? "Ocultar seção" : "Ativar seção"}
                          style={{ padding: "4px 6px" }}
                        >
                          {sec.enabled ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, "up")}
                          style={{ padding: "4px 6px" }}
                        >
                          <MoveUpIcon size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={idx === sections.length - 1}
                          onClick={() => moveSection(idx, "down")}
                          style={{ padding: "4px 6px" }}
                        >
                          <MoveDownIcon size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA 2: INSPETOR DO ELEMENTO SELECIONADO */}
          {sidebarTab === "inspector" && activeSection && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="spread" style={{ alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <div>
                  <span className="badge" style={{ fontSize: 10, padding: "2px 8px" }}>{activeSection.type.toUpperCase()}</span>
                  <strong style={{ display: "block", fontSize: 14, marginTop: 4 }}>{activeSection.title}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleSection(sections.findIndex((s) => s.id === activeSection.id))}
                  style={{ fontSize: 11 }}
                >
                  {activeSection.enabled ? "Ocultar" : "Ativar"}
                </button>
              </div>

              {/* Cores específicas da seção */}
              <div className="card stack" style={{ padding: 10, gap: 8, background: "rgba(0,0,0,0.08)" }}>
                <strong style={{ fontSize: 11, color: "var(--muted-foreground)" }}>CORES DESTA SEÇÃO</strong>
                <div className="row" style={{ gap: 10 }}>
                  <label style={{ fontSize: 11, flex: 1 }}>
                    <span className="muted" style={{ display: "block", marginBottom: 2 }}>Fundo:</span>
                    <input
                      type="color"
                      value={activeSection.backgroundColor || theme.backgroundColor}
                      onChange={(e) =>
                        updateSectionStyle(
                          sections.findIndex((s) => s.id === activeSection.id),
                          "backgroundColor",
                          e.target.value
                        )
                      }
                      style={{ width: "100%", height: 30, padding: 0, border: "none", borderRadius: 4, cursor: "pointer" }}
                    />
                  </label>
                  <label style={{ fontSize: 11, flex: 1 }}>
                    <span className="muted" style={{ display: "block", marginBottom: 2 }}>Texto:</span>
                    <input
                      type="color"
                      value={activeSection.textColor || theme.textColor}
                      onChange={(e) =>
                        updateSectionStyle(
                          sections.findIndex((s) => s.id === activeSection.id),
                          "textColor",
                          e.target.value
                        )
                      }
                      style={{ width: "100%", height: 30, padding: 0, border: "none", borderRadius: 4, cursor: "pointer" }}
                    />
                  </label>
                </div>
              </div>

              {/* CAMPOS ESPECÍFICOS POR TIPO DE SEÇÃO */}
              {activeSection.type === "hero" && (
                <div className="stack" style={{ gap: 10 }}>
                  <label className="stack" style={{ gap: 2, fontSize: 11 }}>
                    <span>Título do Evento</span>
                    <input
                      type="text"
                      value={textFields.eventTitle}
                      onChange={(e) => setTextFields({ ...textFields, eventTitle: e.target.value })}
                    />
                  </label>
                  <label className="stack" style={{ gap: 2, fontSize: 11 }}>
                    <span>Ano</span>
                    <input
                      type="text"
                      value={textFields.eventYear}
                      onChange={(e) => setTextFields({ ...textFields, eventYear: e.target.value })}
                    />
                  </label>
                  <label className="stack" style={{ gap: 2, fontSize: 11 }}>
                    <span>Badge Superior</span>
                    <input
                      type="text"
                      value={textFields.heroBadge}
                      onChange={(e) => setTextFields({ ...textFields, heroBadge: e.target.value })}
                    />
                  </label>
                  <label className="stack" style={{ gap: 2, fontSize: 11 }}>
                    <span>Subtítulo</span>
                    <textarea
                      rows={3}
                      value={textFields.heroSubtitle}
                      onChange={(e) => setTextFields({ ...textFields, heroSubtitle: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {activeSection.type === "about" && (
                <div className="stack" style={{ gap: 10 }}>
                  <label className="stack" style={{ gap: 2, fontSize: 11 }}>
                    <span>Título da Seção</span>
                    <input
                      type="text"
                      value={textFields.aboutTitle}
                      onChange={(e) => setTextFields({ ...textFields, aboutTitle: e.target.value })}
                    />
                  </label>
                  <label className="stack" style={{ gap: 2, fontSize: 11 }}>
                    <span>Texto Descritivo</span>
                    <textarea
                      rows={6}
                      value={textFields.aboutText}
                      onChange={(e) => setTextFields({ ...textFields, aboutText: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {activeSection.type === "schedule" && (
                <div className="stack" style={{ gap: 8 }}>
                  <p className="muted" style={{ fontSize: 12 }}>
                    As palestras e horários são sincronizados automaticamente com a aba <strong>Programação</strong> deste evento.
                  </p>
                </div>
              )}

              {activeSection.type === "batches" && (
                <div className="stack" style={{ gap: 8 }}>
                  <p className="muted" style={{ fontSize: 12 }}>
                    Os valores e vagas são sincronizados automaticamente com a aba <strong>Lotes</strong> deste evento.
                  </p>
                </div>
              )}

              {activeSection.type === "steps" && (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="spread" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Etapas do Fluxo</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addStep} style={{ padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <PlusIcon size={12} /> Passo
                    </button>
                  </div>
                  {steps.map((step, idx) => (
                    <div key={idx} className="card stack" style={{ padding: 8, gap: 6, background: "rgba(0,0,0,0.05)" }}>
                      <div className="spread">
                        <span style={{ fontSize: 11, fontWeight: 700 }}>Passo {idx + 1}</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeStep(idx)} style={{ padding: "2px 4px" }}>
                          <TrashIcon size={10} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(idx, "title", e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <textarea
                        rows={2}
                        value={step.text}
                        onChange={(e) => updateStep(idx, "text", e.target.value)}
                        style={{ fontSize: 11 }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeSection.type === "partners" && (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="spread" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Marcas e Parceiros</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addPartner} style={{ padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <PlusIcon size={12} /> Marca
                    </button>
                  </div>
                  {partners.map((partner, idx) => (
                    <div key={idx} className="spread" style={{ padding: "6px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 6, gap: 6 }}>
                      <input
                        type="text"
                        value={partner.name}
                        onChange={(e) => updatePartner(idx, "name", e.target.value)}
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <input
                        type="text"
                        value={partner.role ?? ""}
                        placeholder="Papel"
                        onChange={(e) => updatePartner(idx, "role", e.target.value)}
                        style={{ width: 80, fontSize: 11 }}
                      />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => removePartner(idx)} style={{ padding: "2px 4px" }}>
                        <TrashIcon size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeSection.type === "faq" && (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="spread" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Dúvidas Frequentes</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addFaq} style={{ padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <PlusIcon size={12} /> Pergunta
                    </button>
                  </div>
                  {faqs.map((faq, idx) => (
                    <div key={idx} className="card stack" style={{ padding: 8, gap: 6, background: "rgba(0,0,0,0.05)" }}>
                      <div className="spread">
                        <span style={{ fontSize: 11, fontWeight: 700 }}>Dúvida #{idx + 1}</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFaq(idx)} style={{ padding: "2px 4px" }}>
                          <TrashIcon size={10} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => updateFaq(idx, "question", e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <textarea
                        rows={2}
                        value={faq.answer}
                        onChange={(e) => updateFaq(idx, "answer", e.target.value)}
                        style={{ fontSize: 11 }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: TEMA & CORES */}
          {sidebarTab === "theme" && (
            <div className="stack" style={{ gap: 12 }}>
              <strong style={{ fontSize: 13 }}>Paleta Global</strong>
              <div className="stack" style={{ gap: 8 }}>
                <ColorPickerField
                  label="Cor Primária (Botões e Destaques)"
                  value={theme.primaryColor}
                  onChange={(val) => setTheme({ ...theme, primaryColor: val })}
                />
                <ColorPickerField
                  label="Cor de Destaque (Dourado/Títulos)"
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
                  label="Texto Secundário"
                  value={theme.textMutedColor}
                  onChange={(val) => setTheme({ ...theme, textMutedColor: val })}
                />
              </div>

              <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                <strong style={{ fontSize: 12 }}>Temas Prontos:</strong>
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setTheme(p.theme)}
                    style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", fontSize: 11 }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
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
          )}

          {/* ABA 4: PRAZOS */}
          {sidebarTab === "general" && (
            <div className="stack" style={{ gap: 12 }}>
              <strong style={{ fontSize: 13 }}>Prazo de Inscrições</strong>
              <label className="row" style={{ gap: 8, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={deadlineEnabled}
                  onChange={(e) => setDeadlineEnabled(e.target.checked)}
                />
                <span>Definir prazo limite automático</span>
              </label>

              {deadlineEnabled && (
                <label className="stack" style={{ gap: 4, fontSize: 11 }}>
                  <span>Data e Hora Limite:</span>
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

        {/* ==================== COLUNA DIREITA: LIVE INTERACTIVE PREVIEW ==================== */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "#080E18",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: deviceMode === "mobile" ? "24px 12px" : "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflowX: "auto",
            minHeight: "85vh",
          }}
        >
          {/* Mockup Canvas */}
          <div
            style={{
              width: deviceMode === "mobile" ? "380px" : "100%",
              maxWidth: deviceMode === "mobile" ? "380px" : "960px",
              background: theme.backgroundColor,
              color: theme.textColor,
              borderRadius: deviceMode === "mobile" ? 32 : 12,
              border: deviceMode === "mobile" ? "8px solid #1E293B" : "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              overflow: "hidden",
              transition: "width 0.3s ease",
            }}
          >
            {/* Header Simulado do Site */}
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                background: theme.backgroundColor,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>
                  <span style={{ color: theme.accentColor }}>{textFields.eventTitle}</span> {textFields.eventYear}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: theme.textMutedColor }}>
                <span>Início</span>
                <span>Programação</span>
                <span>Lotes</span>
              </div>
            </div>

            {/* Renderização Interativa das Seções */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sections
                .filter((s) => s.enabled !== false)
                .map((sec, idx) => {
                  const isSelected = sec.id === selectedSectionId;
                  const isDragOver = dragOverIndex === idx;

                  return (
                    <div
                      key={sec.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onClick={() => selectSection(sec.id)}
                      style={{
                        position: "relative",
                        backgroundColor: sec.backgroundColor || "transparent",
                        color: sec.textColor || "inherit",
                        outline: isSelected
                          ? "2.5px solid #38BDF8"
                          : isDragOver
                          ? "2.5px dashed #38BDF8"
                          : "1px solid transparent",
                        outlineOffset: "-2px",
                        cursor: "pointer",
                        transition: "outline 0.15s ease",
                      }}
                    >
                      {/* Selo Flutuante indicando a Seção e Ação */}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 12,
                          zIndex: 10,
                          background: isSelected ? "#38BDF8" : "rgba(0,0,0,0.75)",
                          color: isSelected ? "#0F172A" : "#FFFFFF",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        }}
                      >
                        <GripVerticalIcon size={12} />
                        <span>{sec.title}</span>
                        {isSelected && <span style={{ opacity: 0.8 }}>· Editando</span>}
                      </div>

                      {/* CONTEÚDO VISUAL DE CADA SEÇÃO NO CANVAS */}
                      {sec.type === "hero" && (
                        <div style={{ padding: "54px 20px 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              fontSize: 11,
                              color: theme.accentColor,
                              fontWeight: 600,
                            }}
                          >
                            {textFields.heroBadge}
                          </span>
                          <h1 style={{ margin: 0, fontSize: deviceMode === "mobile" ? 28 : 44, fontWeight: 800, lineHeight: 1.1 }}>
                            <span style={{ color: theme.accentColor }}>{textFields.eventTitle}</span> {textFields.eventYear}
                          </h1>
                          <p style={{ margin: 0, maxWidth: 500, fontSize: deviceMode === "mobile" ? 13 : 15, color: theme.textMutedColor, lineHeight: 1.5 }}>
                            {textFields.heroSubtitle}
                          </p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: theme.textMutedColor }}>
                              <CalendarIcon size={12} color={theme.accentColor} /> 25 de Outubro de 2026
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: theme.textMutedColor }}>
                              <MapPinIcon size={12} color={theme.accentColor} /> Teatro Positivo
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            <span
                              style={{
                                background: `linear-gradient(135deg, ${theme.primaryColor}, #22B8A3)`,
                                color: "#04302C",
                                fontWeight: 700,
                                padding: "10px 20px",
                                borderRadius: 10,
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              Garanta sua vaga <ArrowRightIcon size={14} />
                            </span>
                            <span
                              style={{
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: theme.textColor,
                                padding: "10px 16px",
                                borderRadius: 10,
                                fontSize: 13,
                              }}
                            >
                              Ver Programação
                            </span>
                          </div>
                        </div>
                      )}

                      {sec.type === "about" && (
                        <div style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", maxWidth: 640, margin: "0 auto" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accentColor, textTransform: "uppercase" }}>Sobre</span>
                          <h2 style={{ fontSize: 22, margin: "6px 0 12px" }}>{textFields.aboutTitle}</h2>
                          <p style={{ fontSize: 13, color: theme.textMutedColor, lineHeight: 1.6, margin: 0 }}>
                            {textFields.aboutText}
                          </p>
                        </div>
                      )}

                      {sec.type === "schedule" && (
                        <div style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accentColor, textTransform: "uppercase" }}>Cronograma</span>
                          <h2 style={{ fontSize: 22, margin: "6px 0 16px" }}>Programação Oficial</h2>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 500, margin: "0 auto" }}>
                            <div style={{ padding: 12, background: theme.surfaceColor, borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.accentColor }}>
                                <ClockIcon size={12} /> 08:30
                              </span>
                              <strong>Credenciamento e Welcome Coffee</strong>
                            </div>
                            <div style={{ padding: 12, background: theme.surfaceColor, borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.accentColor }}>
                                <ClockIcon size={12} /> 09:30
                              </span>
                              <strong>Abertura Oficial e Palestra Magna</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {sec.type === "batches" && (
                        <div style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accentColor, textTransform: "uppercase" }}>Inscrições</span>
                          <h2 style={{ fontSize: 22, margin: "6px 0 16px" }}>Lotes & Valores</h2>
                          <div style={{ display: "grid", gridTemplateColumns: deviceMode === "mobile" ? "1fr" : "repeat(3, 1fr)", gap: 12, maxWidth: 640, margin: "0 auto" }}>
                            <div style={{ padding: 16, background: theme.surfaceColor, border: `2px solid ${theme.accentColor}`, borderRadius: 12, textAlign: "left" }}>
                              <span style={{ fontSize: 10, color: theme.accentColor, fontWeight: 700, textTransform: "uppercase" }}>1º Lote (Ativo)</span>
                              <div style={{ fontSize: 22, fontWeight: 800, color: theme.accentColor, margin: "4px 0" }}>R$ 100,00</div>
                              <span style={{ fontSize: 11, color: theme.textMutedColor }}>Vagas promocionais</span>
                            </div>
                            <div style={{ padding: 16, background: theme.surfaceColor, borderRadius: 12, textAlign: "left", opacity: 0.7 }}>
                              <span style={{ fontSize: 10, color: theme.textMutedColor, fontWeight: 700, textTransform: "uppercase" }}>2º Lote</span>
                              <div style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>R$ 150,00</div>
                              <span style={{ fontSize: 11, color: theme.textMutedColor }}>Próximo lote</span>
                            </div>
                            <div style={{ padding: 16, background: theme.surfaceColor, borderRadius: 12, textAlign: "left", opacity: 0.5 }}>
                              <span style={{ fontSize: 10, color: theme.textMutedColor, fontWeight: 700, textTransform: "uppercase" }}>3º Lote</span>
                              <div style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>R$ 200,00</div>
                              <span style={{ fontSize: 11, color: theme.textMutedColor }}>Lote final</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sec.type === "steps" && (
                        <div style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accentColor, textTransform: "uppercase" }}>Passo a Passo</span>
                          <h2 style={{ fontSize: 22, margin: "6px 0 16px" }}>{textFields.stepsTitle}</h2>
                          <div style={{ display: "grid", gridTemplateColumns: deviceMode === "mobile" ? "1fr" : `repeat(${Math.min(steps.length || 3, 3)}, 1fr)`, gap: 10, maxWidth: 640, margin: "0 auto" }}>
                            {(steps.length > 0 ? steps : [{ title: "Inscreva-se", text: "Preencha seus dados" }, { title: "Pague com Pix", text: "Confirmação instantânea" }, { title: "Check-in QR", text: "Apresente na entrada" }]).map((st, i) => (
                              <div key={i} style={{ padding: 14, background: theme.surfaceColor, borderRadius: 10, textAlign: "left" }}>
                                <span style={{ fontSize: 16, fontWeight: 800, color: theme.accentColor }}>0{i + 1}</span>
                                <strong style={{ display: "block", fontSize: 13, margin: "4px 0" }}>{st.title}</strong>
                                <span style={{ fontSize: 11, color: theme.textMutedColor }}>{st.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sec.type === "partners" && (
                        <div style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accentColor, textTransform: "uppercase" }}>Apoio</span>
                          <h2 style={{ fontSize: 20, margin: "6px 0 16px" }}>{textFields.partnersTitle}</h2>
                          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                            {(partners.length > 0 ? partners : [{ name: "Universidade Positivo", role: "Realização" }, { name: "LSPK Tecnology", role: "Apoio" }]).map((p, i) => (
                              <div key={i} style={{ padding: "10px 16px", background: theme.surfaceColor, borderRadius: 8, fontSize: 12 }}>
                                <strong>{p.name}</strong>
                                {p.role && <span style={{ display: "block", fontSize: 10, color: theme.accentColor }}>{p.role}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sec.type === "faq" && (
                        <div style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", maxWidth: 580, margin: "0 auto" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accentColor, textTransform: "uppercase" }}>Dúvidas</span>
                          <h2 style={{ fontSize: 20, margin: "6px 0 16px", textAlign: "center" }}>Perguntas Frequentes</h2>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {(faqs.length > 0 ? faqs : [{ question: "Como recebo meu QR Code?", answer: "Por e-mail após a confirmação do pagamento." }]).map((fq, i) => (
                              <div key={i} style={{ padding: 12, background: theme.surfaceColor, borderRadius: 8, fontSize: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <QuestionIcon size={12} color={theme.accentColor} /> {fq.question}
                                  </strong>
                                  <ChevronDownIcon size={14} />
                                </div>
                                <p style={{ margin: "6px 0 0", color: theme.textMutedColor, fontSize: 11, paddingLeft: 18 }}>
                                  {fq.answer}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Rodapé Simulado */}
            <div style={{ padding: "24px 20px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: theme.textMutedColor }}>
              <p style={{ margin: 0 }}>{textFields.footerText}</p>
            </div>
          </div>
        </div>
      </div>
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
    <label className="stack" style={{ gap: 4, fontSize: 11 }}>
      <span>{label}</span>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 28, height: 28, padding: 0, border: "none", borderRadius: 4, cursor: "pointer" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, fontFamily: "monospace", textTransform: "uppercase", fontSize: 12 }}
        />
      </div>
    </label>
  );
}
