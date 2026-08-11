/**
 * Configuração do layout de impressão do relatório de presença.
 * Cada campo pode ser habilitado/desabilitado e ter alinhamento customizado.
 */
export interface PrintLayoutField {
  id: string;
  label: string;
  enabled: boolean;
  align: "left" | "center" | "right";
  bold: boolean;
  underline: boolean;
}

export interface PrintLayout {
  /** Largura do papel em mm (58 = padrão M10 Pro) */
  paperWidthMm: number;
  /** Largura do bitmap em pixels (384 = padrão 58mm) */
  bitmapWidthPx: number;
  /** Campos do relatório, na ordem de impressão */
  fields: PrintLayoutField[];
  /** Texto do cabeçalho customizado */
  headerText: string;
  /** Mostrar linha separadora entre cabeçalho e corpo */
  showHeaderSeparator: boolean;
  /** Texto do rodapé */
  footerText: string;
  /** Número de linhas antes do corte */
  feedBeforeCut: number;
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  paperWidthMm: 58,
  bitmapWidthPx: 384,
  headerText: "RELATÓRIO DE PRESENÇA",
  showHeaderSeparator: true,
  footerText: "Obrigado!",
  feedBeforeCut: 3,
  fields: [
    { id: "event", label: "Nome do Evento", enabled: true, align: "center", bold: true, underline: false },
    { id: "terminal", label: "Nome do Terminal", enabled: true, align: "center", bold: false, underline: false },
    { id: "separator1", label: "───", enabled: true, align: "center", bold: false, underline: false },
    { id: "participants_title", label: "Título Participantes", enabled: true, align: "left", bold: true, underline: false },
    { id: "participants_list", label: "Lista de Participantes", enabled: true, align: "left", bold: false, underline: false },
    { id: "separator2", label: "───", enabled: true, align: "center", bold: false, underline: false },
    { id: "total", label: "Total de Presenças", enabled: true, align: "left", bold: true, underline: false },
    { id: "datetime", label: "Data/Hora Geração", enabled: true, align: "center", bold: false, underline: false },
  ],
};

/** Chaves dos campos que são gerados dinamicamente (não editáveis como texto fixo) */
export const DYNAMIC_FIELDS = new Set([
  "event",
  "terminal",
  "participants_title",
  "participants_list",
  "total",
  "datetime",
]);
