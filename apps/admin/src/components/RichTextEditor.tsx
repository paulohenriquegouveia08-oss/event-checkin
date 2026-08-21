import { useEffect, useRef, useState } from "react";
import type { ParagraphSegment, ParagraphTokenKey } from "../api/client";

/**
 * Editor de texto rico pro parágrafo descritivo do certificado — like
 * Google Docs, mas só com o que o certificado realmente precisa: negrito,
 * itálico e cor por trecho selecionado, mais "chips" protegidos pros
 * valores dinâmicos (nome do evento, local, datas, carga horária), que
 * variam por participante e por isso nunca viram texto livre.
 *
 * Implementação: um <div contentEditable> + document.execCommand pra
 * bold/italic/foreColor. execCommand está formalmente deprecated, mas
 * continua funcionando em todo navegador evergreen e resolve exatamente
 * esse escopo (3 estilos, sem precisar de undo/redo/tabelas/etc.) sem
 * puxar uma dependência nova (TipTap/Slate/Quill) só pra isso. A
 * serialização de volta pra ParagraphSegment[] não depende de qual tag o
 * execCommand escolheu gerar — lê o estilo computado de cada nó de texto
 * (getComputedStyle), então funciona não importa como o navegador
 * aninhou <b>/<i>/<span>.
 *
 * Deliberadamente NÃO controlado pelo `value` depois da montagem inicial
 * (edição de contentEditable é DOM real, não estado React) — o
 * consumidor deve passar `key={algumIdentificadorDoEvento}` pra forçar
 * remontar com um valor novo quando trocar de evento (ver CertificatesTab).
 */

const TOKEN_LABELS: Record<ParagraphTokenKey, string> = {
  eventName: "Nome do evento",
  locationLabel: "Local",
  eventDateRange: "Datas do evento",
  workloadHours: "Carga horária",
};

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function rgbStringToHex(rgbString: string): string | undefined {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgbString);
  if (!match) return undefined;
  const [, r, g, b] = match;
  return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
}

function segmentsToHtml(segments: ParagraphSegment[], defaultColor: string): string {
  if (segments.length === 0) return "<span><br></span>";
  return segments
    .map((seg) => {
      const color = seg.color || defaultColor;
      const style = `color:${color};${seg.bold ? "font-weight:bold;" : ""}${seg.italic ? "font-style:italic;" : ""}`;
      if (seg.type === "token") {
        return `<span contenteditable="false" data-token="${seg.key}" class="rte-token" style="${style}">${escapeHtml(TOKEN_LABELS[seg.key])}</span>`;
      }
      return `<span style="${style}">${escapeHtml(seg.text)}</span>`;
    })
    .join("");
}

/** Lê o DOM atual do editor e devolve os segmentos correspondentes — usa
 * getComputedStyle em vez de inspecionar tags, então não importa se o
 * execCommand aninhou <b><i>...</i></b> ou gerou <span style="...">: o
 * resultado é sempre o mesmo. Runs adjacentes com formatação idêntica são
 * fundidos num só segmento, pra não gerar dezenas de segmentos triviais
 * a cada tecla digitada. */
function serialize(root: HTMLElement, defaultColor: string): ParagraphSegment[] {
  const segments: ParagraphSegment[] = [];

  function sameStyle(a: ParagraphSegment, bold: boolean, italic: boolean, color: string | undefined) {
    return a.bold === (bold || undefined) && a.italic === (italic || undefined) && (a.color ?? defaultColor) === (color ?? defaultColor);
  }

  function walk(node: ChildNode) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) return;
      const el = node.parentElement;
      const style = el ? window.getComputedStyle(el) : null;
      const bold = style ? parseInt(style.fontWeight, 10) >= 600 : false;
      const italic = style ? style.fontStyle === "italic" : false;
      const color = style ? rgbStringToHex(style.color) : undefined;

      const last = segments[segments.length - 1];
      if (last && last.type === "text" && sameStyle(last, bold, italic, color)) {
        last.text += text;
      } else {
        segments.push({
          type: "text",
          text,
          bold: bold || undefined,
          italic: italic || undefined,
          color: color && color !== defaultColor ? color : undefined,
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tokenKey = el.dataset.token as ParagraphTokenKey | undefined;
      if (tokenKey) {
        const style = window.getComputedStyle(el);
        const bold = parseInt(style.fontWeight, 10) >= 600;
        const italic = style.fontStyle === "italic";
        const color = rgbStringToHex(style.color);
        segments.push({
          type: "token",
          key: tokenKey,
          bold: bold || undefined,
          italic: italic || undefined,
          color: color && color !== defaultColor ? color : undefined,
        });
        return;
      }
      if (el.tagName === "BR") return;
      el.childNodes.forEach(walk);
    }
  }

  root.childNodes.forEach(walk);
  return segments;
}

const COLOR_PRESETS = ["#044544", "#1A1A1A", "#B91C1C", "#1D4ED8", "#B45309"];

export function RichTextEditor({
  value,
  onChange,
  defaultColor,
}: {
  value: ParagraphSegment[];
  onChange: (segments: ParagraphSegment[]) => void;
  defaultColor: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRangeRef = useRef<Range | null>(null);
  const [customColorOpen, setCustomColorOpen] = useState(false);

  // Só popula o DOM na montagem — depois disso o editor é dono do próprio
  // conteúdo (ver comentário no topo do arquivo).
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = segmentsToHtml(value, defaultColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emitChange() {
    if (!editorRef.current) return;
    onChange(serialize(editorRef.current, defaultColor));
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      lastRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && lastRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(lastRangeRef.current);
    }
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function applyBold() {
    focusEditor();
    document.execCommand("bold");
    emitChange();
  }

  function applyItalic() {
    focusEditor();
    document.execCommand("italic");
    emitChange();
  }

  function applyColor(hex: string) {
    restoreSelection();
    focusEditor();
    document.execCommand("foreColor", false, hex);
    emitChange();
    setCustomColorOpen(false);
  }

  function insertToken(key: ParagraphTokenKey) {
    restoreSelection();
    focusEditor();
    const html = `<span contenteditable="false" data-token="${key}" class="rte-token">${escapeHtml(TOKEN_LABELS[key])}</span>&nbsp;`;
    document.execCommand("insertHTML", false, html);
    emitChange();
  }

  // Evita que o mousedown no botão tire o foco/seleção do editor antes do
  // onClick rodar (senão bold/italic aplicariam numa seleção vazia).
  function preventBlur(e: React.MouseEvent) {
    e.preventDefault();
  }

  return (
    <div>
      <div
        className="row"
        style={{ gap: 6, marginBottom: 8, flexWrap: "wrap", padding: 8, background: "var(--surface-alt)", borderRadius: "var(--radius) var(--radius) 0 0", border: "1px solid var(--border)", borderBottom: "none" }}
      >
        <button type="button" className="btn btn-secondary btn-sm" style={{ fontWeight: 800 }} onMouseDown={preventBlur} onClick={applyBold} title="Negrito">
          B
        </button>
        <button type="button" className="btn btn-secondary btn-sm" style={{ fontStyle: "italic" }} onMouseDown={preventBlur} onClick={applyItalic} title="Itálico">
          I
        </button>

        <span style={{ width: 1, background: "var(--border)", margin: "2px 4px" }} />

        {COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            onMouseDown={preventBlur}
            onClick={() => applyColor(hex)}
            title={hex}
            style={{ width: 24, height: 24, borderRadius: 5, background: hex, border: "1px solid var(--border)", padding: 0, cursor: "pointer" }}
          />
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onMouseDown={preventBlur}
          onClick={() => {
            saveSelection();
            setCustomColorOpen((v) => !v);
          }}
          title="Outra cor"
        >
          🎨
        </button>
        {customColorOpen && (
          <input
            type="color"
            autoFocus
            defaultValue={defaultColor}
            style={{ width: 32, height: 28, padding: 0, cursor: "pointer" }}
            onChange={(e) => applyColor(e.target.value)}
          />
        )}

        <span style={{ width: 1, background: "var(--border)", margin: "2px 4px" }} />

        <span className="muted" style={{ fontSize: 12, alignSelf: "center", marginRight: 2 }}>
          Inserir:
        </span>
        {(Object.keys(TOKEN_LABELS) as ParagraphTokenKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className="btn btn-secondary btn-sm"
            onMouseDown={preventBlur}
            onClick={() => insertToken(key)}
          >
            + {TOKEN_LABELS[key]}
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        style={{
          minHeight: 120,
          padding: 12,
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: "0 0 var(--radius) var(--radius)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      />
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 11 }}>
        Selecione um trecho e use os botões acima pra formatar. Os blocos destacados (ex.: "Nome do evento") são
        valores que mudam por participante — não dá pra digitar dentro deles, só formatar, mover ou apagar.
      </p>
      <style>{`
        .rte-token {
          background: rgba(45, 212, 191, 0.18);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 6px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
