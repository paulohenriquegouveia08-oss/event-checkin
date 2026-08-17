import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import { formatEventDateRange, formatEventDateRangeShort } from "../../shared/br-date.js";
import { numberToWordsPtBr } from "../../shared/number-to-words-pt-br.js";

// __dirname não existe em ESM — apps/backend roda com "type": "module".
const currentDir = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(currentDir, "..", "..", "..", "assets", "certificates");

export interface CertificateData {
  participantName: string;
  eventName: string;
  locationLabel: string;
  eventStartDate: Date;
  eventEndDate: Date;
  workloadHours: number;
  closingText: string;
  verificationUrl: string;
  templateAssetKey: string;
}

// Coordenadas em pixel da imagem-base (1491×1055 — ver
// assets/certificates/README.md), levantadas a partir do certificado de
// referência fornecido. Só as áreas que este código preenche
// dinamicamente ficam mascaradas (em branco) na imagem-base; o resto
// (logos, ondas, título, signatários, moldura) é pixel-a-pixel o
// fornecido, como pedido ("não altere a identidade visual").
const IMG_W = 1491;
const IMG_H = 1055;
const TEAL: RGB = rgb(4 / 255, 69 / 255, 68 / 255);
const INK: RGB = rgb(0.1, 0.1, 0.1);

const NAME_BOX = { xLeft: 478, xRight: 1351, yBaseline: 372 }; // acima do traço em y≈406
const PARAGRAPH_BOX = { xLeft: 478, xRight: 1330, yTop: 470, lineHeight: 40 };
// xRight é o limite antes do logo da Universidade Positivo (começa ≈735px)
const DATE_CHIP = { x: 508, xRight: 722, yLine1: 973, yLine2: 1000 };
const QR_BOX = { xLeft: 1206, yTop: 946, size: 88 };

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
    const tokens = run.text.split(" ");
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
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

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
    color: TEAL,
  });

  // --- Parágrafo descritivo (evento/local/data/carga horária dinâmicos) ---
  const workloadWords = numberToWordsPtBr(data.workloadHours);
  const workloadLabel = workloadWords ? `${data.workloadHours} (${workloadWords})` : `${data.workloadHours}`;
  const dateRange = formatEventDateRange(data.eventStartDate, data.eventEndDate);

  const paragraphRuns: TextRun[] = [
    { text: "Participou do ", font: helvetica, size: 15, color: INK },
    { text: `${data.eventName},`, font: helveticaBold, size: 15, color: TEAL },
    {
      text:
        ` realizado em ${data.locationLabel}, nos dias ${dateRange}, com carga horária total de ` +
        `${workloadLabel} horas. ${data.closingText}`,
      font: helvetica,
      size: 15,
      color: INK,
    },
  ];
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
    color: TEAL,
  });
  const locationSize = fitFontSize(data.locationLabel, helvetica, dateChipMaxWidth, 11, 8);
  page.drawText(data.locationLabel, {
    x: toX(DATE_CHIP.x),
    y: toY(DATE_CHIP.yLine2),
    size: locationSize,
    font: helvetica,
    color: INK,
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
