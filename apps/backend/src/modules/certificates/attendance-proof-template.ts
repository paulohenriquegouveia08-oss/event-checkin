import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { formatLongDate, formatTime } from "../../shared/br-date.js";

export interface AttendanceProofData {
  participantName: string;
  participantDocument: string | null;
  eventName: string;
  eventLocation: string | null;
  checkedInAt: Date;
  terminalName: string | null;
  verificationUrl: string;
}

const TEAL = rgb(4 / 255, 69 / 255, 68 / 255);
const INK = rgb(0.15, 0.15, 0.15);
const MUTED = rgb(0.45, 0.45, 0.45);
const BORDER = rgb(0.85, 0.87, 0.87);

/**
 * Comprovante de presença — documento independente do certificado (ver
 * seção 8 do pedido). Não usa a imagem de referência do certificado (essa
 * é especificamente o layout do certificado); em vez disso, é um layout
 * simples e vetorial próprio, no mesmo acento de cor (#044544) já usado no
 * certificado e na identidade visual do painel/portal do participante.
 */
export async function renderAttendanceProofPdf(data: AttendanceProofData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprovante de presença — ${data.eventName}`);
  pdf.setProducer("event-checkin");

  const page = pdf.addPage([595.28, 841.89]); // A4 retrato
  const { width, height } = page.getSize();
  const marginX = 56;

  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Cabeçalho
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: TEAL });
  page.drawText("COMPROVANTE DE PRESENÇA", { x: marginX, y: height - 55, size: 20, font: helveticaBold, color: rgb(1, 1, 1) });
  page.drawText(data.eventName, { x: marginX, y: height - 75, size: 12, font: helvetica, color: rgb(0.85, 0.95, 0.93) });

  let y = height - 150;
  const field = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: marginX, y, size: 9, font: helveticaBold, color: MUTED });
    y -= 18;
    page.drawText(value, { x: marginX, y, size: 13, font: helvetica, color: INK });
    y -= 34;
  };

  field("Participante", data.participantName);
  if (data.participantDocument) field("Documento", data.participantDocument);
  field("Evento", data.eventName);
  if (data.eventLocation) field("Local", data.eventLocation);
  field("Data do check-in", formatLongDate(data.checkedInAt));
  field("Horário do check-in", formatTime(data.checkedInAt));
  if (data.terminalName) field("Terminal de credenciamento", data.terminalName);

  // Selo de status
  y -= 10;
  page.drawRectangle({ x: marginX, y: y - 44, width: width - marginX * 2, height: 44, color: rgb(0.93, 0.97, 0.96), borderColor: BORDER, borderWidth: 1 });
  page.drawText("Presença confirmada no sistema de credenciamento", {
    x: marginX + 16,
    y: y - 28,
    size: 12,
    font: helveticaBold,
    color: TEAL,
  });

  // QR de validação, no rodapé
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, { margin: 0, width: 240 });
  const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrImage = await pdf.embedPng(qrBytes);
  const qrSize = 90;
  page.drawImage(qrImage, { x: marginX, y: 70, width: qrSize, height: qrSize });
  page.drawText("Verifique a autenticidade deste comprovante", {
    x: marginX + qrSize + 16,
    y: 70 + qrSize - 18,
    size: 10,
    font: helveticaBold,
    color: INK,
  });
  page.drawText("escaneando o QR Code ou acessando:", {
    x: marginX + qrSize + 16,
    y: 70 + qrSize - 33,
    size: 10,
    font: helvetica,
    color: MUTED,
  });
  page.drawText(data.verificationUrl, {
    x: marginX + qrSize + 16,
    y: 70 + qrSize - 48,
    size: 9,
    font: helvetica,
    color: TEAL,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
