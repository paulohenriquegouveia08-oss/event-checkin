import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import { formatEventDateRange, formatEventDateRangeShort } from "../../shared/br-date.js";
import { numberToWordsPtBr } from "../../shared/number-to-words-pt-br.js";
import type { ParagraphSegment } from "./certificate-settings.js";

// __dirname não existe em ESM — apps/backend roda com "type": "module".
const currentDir = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(currentDir, "..", "..", "..", "assets", "certificates");

export interface CertificateSignatory {
  name: string;
  role: string;
}

export interface CertificateData {
  participantName: string;
  eventName: string;
  locationLabel: string;
  eventStartDate: Date;
  eventEndDate: Date;
  workloadHours: number;
  // Parágrafo descritivo inteiro, como trechos de texto livre + tokens
  // dinâmicos (ver certificate-settings.ts) — os tokens são resolvidos
  // pra texto de verdade aqui dentro, em resolveParagraphTokenText().
  paragraphSegments: ParagraphSegment[];
  verificationUrl: string;
  templateAssetKey: string;
  signatories: CertificateSignatory[];
  // Hex "#RRGGBB" — vem de CertificateSettings (certificate-settings.ts),
  // sempre já resolvido (nunca undefined) por resolveCertificateSettings.
  primaryColor: string;
  textColor: string;
}

/** Converte "#RRGGBB" pra RGB 0–1 do pdf-lib. Nunca deveria receber algo
 * fora desse formato (certificateSettingsSchema já valida na entrada),
 * mas cai num cinza neutro em vez de quebrar a geração do PDF se vier
 * algo inesperado. */
function hexToRgb(hex: string): RGB {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return rgb(0.1, 0.1, 0.1);
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// Coordenadas em pixel da imagem-base (1491×1055 — ver
// assets/certificates/README.md), levantadas a partir do certificado de
// referência fornecido. Só as áreas que este código preenche
// dinamicamente ficam mascaradas (em branco) na imagem-base; o resto
// (logos, ondas, título, signatários, moldura) é pixel-a-pixel o
// fornecido, como pedido ("não altere a identidade visual").
const IMG_W = 1491;
const IMG_H = 1055;

const NAME_BOX = { xLeft: 478, xRight: 1351, yBaseline: 372 }; // acima do traço em y≈406
const PARAGRAPH_BOX = { xLeft: 478, xRight: 1330, yTop: 470, lineHeight: 40 };
// xRight é o limite antes do logo da Universidade Positivo (começa ≈735px)
const DATE_CHIP = { x: 508, xRight: 722, yLine1: 973, yLine2: 1000 };
const QR_BOX = { xLeft: 1206, yTop: 946, size: 88 };

// As 3 colunas de signatários — nome (linhas 720-784) e cargo (793-878),
// preservando as linhas divisórias verticais (x≈749/1091) e o tracinho fixo
// sob o nome (y≈785-788), que ficam intactos na imagem-base (ver
// assets/certificates/README.md). O nome sempre fica acima do tracinho e
// o cargo sempre abaixo — não importa quantas linhas cada um ocupar.
const SIGNATORY_COLUMNS = [
  { xLeft: 475, xRight: 735 },
  { xLeft: 760, xRight: 1080 },
  { xLeft: 1100, xRight: 1385 },
];
const SIGNATORY_NAME_BOX = { yTop: 727, lineHeight: 27, maxLines: 2 };
const SIGNATORY_ROLE_BOX = { yTop: 808, lineHeight: 22, maxLines: 3 };

async function loadBackground(templateAssetKey: string): Promise<Buffer> {
  const path = join(ASSETS_DIR, `${templateAssetKey}-base.png`);
  try {
    return await readFile(path);
  } catch {
    // Nunca deixa a geração quebrar por um templateAssetKey inválido vindo
    // de Event.certificateSettings — cai no template padrão do COPOL.
    return readFile(join(ASSETS_DIR, "copol-2026-base.png"));
  }
}

interface TextRun {
  text: string;
  font: PDFFont;
  size: number;
  color: RGB;
}

/** Quebra uma sequência de "runs" (trechos com fonte/cor próprias) em
 * linhas que cabem em maxWidth, preservando a formatação de cada palavra.
 * Não existe suporte a rich text no pdf-lib — isso é o que permite o
 * parágrafo ter o nome do evento em destaque (negrito/verde) misturado
 * com o resto do texto em preto, como no certificado de referência. */
function wrapRuns(runs: TextRun[], maxWidth: number): TextRun[][] {
  const words: TextRun[] = [];
  for (const run of runs) {
    // Mesma normalização de wrapPlainText — evita quebrar em runtime se um
    // dos campos editáveis (ex.: closingText) vier com quebra de linha. Sem
    // trim(): os espaços nas pontas de alguns runs são o que garante o
    // espaçamento entre um run e o próximo (ex.: "Participou do " + nome).
    const tokens = run.text.replace(/\s+/g, " ").split(" ");
    tokens.forEach((token, i) => {
      const text = i < tokens.length - 1 ? `${token} ` : token;
      if (text.length > 0) words.push({ ...run, text });
    });
  }

  const lines: TextRun[][] = [];
  let current: TextRun[] = [];
  let currentWidth = 0;

  for (const word of words) {
    const width = word.font.widthOfTextAtSize(word.text, word.size);
    if (currentWidth + width > maxWidth && current.length > 0) {
      lines.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(word);
    currentWidth += width;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function drawRunsLine(page: PDFPage, line: TextRun[], x: number, y: number) {
  let cursor = x;
  for (const run of line) {
    page.drawText(run.text, { x: cursor, y, size: run.size, font: run.font, color: run.color });
    cursor += run.font.widthOfTextAtSize(run.text, run.size);
  }
}

function fitFontSize(text: string, font: PDFFont, maxWidth: number, preferredSize: number, minSize = 16): number {
  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

/** Quebra texto simples (uma única fonte/cor) em linhas que cabem em
 * maxWidth — versão sem "runs", usada pros signatários (nome/cargo têm
 * estilo único cada, ao contrário do parágrafo principal). */
function wrapPlainText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  // As fontes padrão do pdf-lib (WinAnsi) não conseguem codificar quebras
  // de linha literais — normaliza pra espaço antes de quebrar em palavras.
  // Defesa também contra texto colado de um textarea (ver CertificatesTab).
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Desenha texto centralizado horizontalmente numa coluna, quebrado em até
 * `maxLines` linhas, encolhendo a fonte se necessário pra respeitar esse
 * limite (evita estourar o espaço fixo entre nome/cargo/rodapé). */
function drawCenteredBlock(
  page: PDFPage,
  text: string,
  opts: {
    font: PDFFont;
    color: RGB;
    preferredSize: number;
    minSize: number;
    maxLines: number;
    columnXLeftPt: number;
    columnXRightPt: number;
    yTopPt: number;
    lineHeightPt: number;
  }
) {
  const maxWidth = opts.columnXRightPt - opts.columnXLeftPt;
  const centerX = (opts.columnXLeftPt + opts.columnXRightPt) / 2;

  let size = opts.preferredSize;
  let lines = wrapPlainText(text, opts.font, size, maxWidth);
  while (lines.length > opts.maxLines && size > opts.minSize) {
    size -= 1;
    lines = wrapPlainText(text, opts.font, size, maxWidth);
  }
  lines = lines.slice(0, opts.maxLines);

  let y = opts.yTopPt;
  for (const line of lines) {
    const width = opts.font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: centerX - width / 2, y, size, font: opts.font, color: opts.color });
    y -= opts.lineHeightPt;
  }
}

/**
 * Gera o PDF do certificado individual. Template visual = imagem de fundo
 * (fornecida pelo usuário, com as áreas dinâmicas apagadas — ver
 * assets/certificates/copol-2026-base.png); tudo que varia por
 * participante/evento é desenhado por cima como texto vetorial (nunca
 * rasterizado), incluindo o QR Code de validação. Página em A4 paisagem —
 * a imagem de referência já tem essa proporção (1491×1055 ≈ 297×210mm).
 */
export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado — ${data.eventName}`);
  pdf.setSubject(`Certificado de participação de ${data.participantName}`);
  pdf.setProducer("event-checkin");

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape, em pontos
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const scaleX = pageWidth / IMG_W;
  const scaleY = pageHeight / IMG_H;
  const toX = (xPx: number) => xPx * scaleX;
  const toY = (yPx: number) => pageHeight - yPx * scaleY;

  const backgroundBytes = await loadBackground(data.templateAssetKey);
  const backgroundImage = await pdf.embedPng(backgroundBytes);
  page.drawImage(backgroundImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  // Escolhe entre as 4 variantes da Helvetica conforme negrito/itálico do
  // segmento — é isso que permite o admin marcar qualquer trecho do
  // parágrafo (RichTextEditor) com qualquer combinação dos dois.
  function paragraphFont(bold?: boolean, italic?: boolean): PDFFont {
    if (bold && italic) return helveticaBoldOblique;
    if (bold) return helveticaBold;
    if (italic) return helveticaOblique;
    return helvetica;
  }

  // Cor de destaque (nome, nome do evento, título do chip de data, nomes
  // dos signatários) e cor do corpo do texto — configuráveis por evento
  // (ver certificate-settings.ts); antes eram valores fixos aqui no código.
  const primaryColor = hexToRgb(data.primaryColor);
  const textColor = hexToRgb(data.textColor);

  // --- Nome do participante ---
  const nameMaxWidthPx = NAME_BOX.xRight - NAME_BOX.xLeft;
  const nameFontSize = fitFontSize(data.participantName, timesBold, toX(nameMaxWidthPx) - toX(0), 30, 16);
  const nameWidth = timesBold.widthOfTextAtSize(data.participantName, nameFontSize);
  const nameCenterX = toX((NAME_BOX.xLeft + NAME_BOX.xRight) / 2);
  page.drawText(data.participantName, {
    x: nameCenterX - nameWidth / 2,
    y: toY(NAME_BOX.yBaseline),
    size: nameFontSize,
    font: timesBold,
    color: primaryColor,
  });

  // --- Parágrafo descritivo (evento/local/data/carga horária dinâmicos) ---
  const workloadWords = numberToWordsPtBr(data.workloadHours);
  const workloadLabel = workloadWords ? `${data.workloadHours} (${workloadWords})` : `${data.workloadHours}`;
  const dateRange = formatEventDateRange(data.eventStartDate, data.eventEndDate);

  // Cada token do parágrafo (ver certificate-settings.ts) resolve pro
  // valor de verdade deste certificado — o resto (todo trecho "text") já
  // vem como texto livre, exatamente como o admin escreveu no editor.
  const tokenValues: Record<string, string> = {
    eventName: data.eventName,
    locationLabel: data.locationLabel,
    eventDateRange: dateRange,
    // Só o número por extenso — a palavra "horas" fica como texto livre
    // logo depois do token no parágrafo padrão (buildDefaultParagraphSegments
    // em certificate-settings.ts), pra o admin poder editá-la/removê-la
    // como qualquer outro texto.
    workloadHours: workloadLabel,
  };

  const paragraphRuns: TextRun[] = data.paragraphSegments.map((segment) => ({
    text: segment.type === "token" ? tokenValues[segment.key] ?? "" : segment.text,
    font: paragraphFont(segment.bold, segment.italic),
    size: 15,
    color: segment.color ? hexToRgb(segment.color) : textColor,
  }));
  const paragraphMaxWidth = toX(PARAGRAPH_BOX.xRight) - toX(PARAGRAPH_BOX.xLeft);
  const lines = wrapRuns(paragraphRuns, paragraphMaxWidth);
  let lineY = toY(PARAGRAPH_BOX.yTop);
  for (const line of lines) {
    drawRunsLine(page, line, toX(PARAGRAPH_BOX.xLeft), lineY);
    lineY -= PARAGRAPH_BOX.lineHeight * scaleY;
  }

  // --- Chip de data/local (ícone de calendário já está na imagem-base) ---
  // Formato curto (o parágrafo acima já mostra a data por extenso) — ainda
  // assim protegido com fitFontSize, pra nunca colidir com o logo ao lado
  // não importa o tamanho do texto (nome de evento/local diferente no futuro).
  const dateChipMaxWidth = toX(DATE_CHIP.xRight) - toX(DATE_CHIP.x);
  const dateChipText = formatEventDateRangeShort(data.eventStartDate, data.eventEndDate);
  const dateChipSize = fitFontSize(dateChipText, helveticaBold, dateChipMaxWidth, 12, 8);
  page.drawText(dateChipText, {
    x: toX(DATE_CHIP.x),
    y: toY(DATE_CHIP.yLine1),
    size: dateChipSize,
    font: helveticaBold,
    color: primaryColor,
  });
  const locationSize = fitFontSize(data.locationLabel, helvetica, dateChipMaxWidth, 11, 8);
  page.drawText(data.locationLabel, {
    x: toX(DATE_CHIP.x),
    y: toY(DATE_CHIP.yLine2),
    size: locationSize,
    font: helvetica,
    color: textColor,
  });

  // --- Signatários (até 3 colunas fixas na imagem-base) ---
  data.signatories.slice(0, SIGNATORY_COLUMNS.length).forEach((signatory, i) => {
    const column = SIGNATORY_COLUMNS[i];
    const columnXLeftPt = toX(column.xLeft);
    const columnXRightPt = toX(column.xRight);

    drawCenteredBlock(page, signatory.name, {
      font: helveticaBold,
      color: primaryColor,
      preferredSize: 13,
      minSize: 9,
      maxLines: SIGNATORY_NAME_BOX.maxLines,
      columnXLeftPt,
      columnXRightPt,
      yTopPt: toY(SIGNATORY_NAME_BOX.yTop),
      lineHeightPt: SIGNATORY_NAME_BOX.lineHeight * scaleY,
    });

    drawCenteredBlock(page, signatory.role, {
      font: timesItalic,
      color: textColor,
      preferredSize: 11,
      minSize: 8,
      maxLines: SIGNATORY_ROLE_BOX.maxLines,
      columnXLeftPt,
      columnXRightPt,
      yTopPt: toY(SIGNATORY_ROLE_BOX.yTop),
      lineHeightPt: SIGNATORY_ROLE_BOX.lineHeight * scaleY,
    });
  });

  // --- QR Code de validação pública ---
  const qrPngDataUrl = await QRCode.toDataURL(data.verificationUrl, { margin: 0, width: 300 });
  const qrPngBytes = Buffer.from(qrPngDataUrl.split(",")[1], "base64");
  const qrImage = await pdf.embedPng(qrPngBytes);
  const qrSizePt = toX(QR_BOX.size);
  page.drawImage(qrImage, {
    x: toX(QR_BOX.xLeft),
    y: toY(QR_BOX.yTop) - qrSizePt,
    width: qrSizePt,
    height: qrSizePt,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
