import { useId } from "react";

// Componentes de formulário reutilizados pelas telas de "conteúdo
// editável sem código" (SiteTab, CertificatesTab) — extraídos daqui pra
// não duplicar a mesma lógica de campo/label/seção em cada aba nova.

export function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 10, paddingTop: 4 }}>
      <h4 style={{ margin: 0, fontSize: 13, color: "var(--gold, var(--primary))", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
      {children}
    </div>
  );
}

export function TextField({
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

/** Seletor de cor (swatch nativo + hex editável à mão) — usado hoje nas
 * cores do certificado (CertificatesTab), mas genérico o bastante pra
 * qualquer outro campo de cor futuro. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div style={{ flex: "0 0 170px" }}>
      <label htmlFor={id} className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
        {label}
      </label>
      <div className="row" style={{ gap: 6 }}>
        <input
          id={id}
          type="color"
          // O <input type="color"> nativo exige um #RRGGBB válido — se o
          // admin estiver no meio de digitar o hex à mão (ex.: "#04"),
          // mantém o swatch no último valor válido em vez de quebrar.
          value={isValidHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 32, padding: 2, cursor: "pointer", flexShrink: 0 }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#000000"
          style={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}
        />
      </div>
    </div>
  );
}

export function TextAreaField({
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

export function ListEditor({
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
