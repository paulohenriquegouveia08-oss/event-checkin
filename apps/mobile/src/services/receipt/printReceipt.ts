import ElginPrinter from "../../../modules/elgin-printer/src/ElginPrinterModule";
import type { CheckInResult, TerminalConfig } from "../../types/index";

/**
 * Imprime comprovante de presença na impressora térmica.
 * Chamado automaticamente após cada check-in confirmado.
 */
export async function printCheckInReceipt(
  config: TerminalConfig,
  result: CheckInResult
): Promise<void> {
  const connectResult = ElginPrinter.connect(0, "", "", 0);
  if (connectResult !== 0) return;

  try {
    ElginPrinter.initialize();

    // Cabeçalho
    ElginPrinter.printText("COMPROVANTE DE PRESENCA", 1, true, false);
    ElginPrinter.printText("─".repeat(32), 1, false, false);
    ElginPrinter.feedLines(1);

    // Evento
    ElginPrinter.printText("Evento:", 0, true, false);
    ElginPrinter.printText(config.eventName, 0, false, false);
    ElginPrinter.feedLines(1);

    // Participante
    ElginPrinter.printText("Participante:", 0, true, false);
    ElginPrinter.printText(result.participantName ?? "-", 0, false, false);
    ElginPrinter.feedLines(1);

    // Email
    if (result.participantEmail) {
      ElginPrinter.printText("E-mail:", 0, true, false);
      ElginPrinter.printText(result.participantEmail, 0, false, false);
      ElginPrinter.feedLines(1);
    }

    // CPF/Documento
    if (result.participantDocument) {
      ElginPrinter.printText("CPF:", 0, true, false);
      ElginPrinter.printText(result.participantDocument, 0, false, false);
      ElginPrinter.feedLines(1);
    }

    // Telefone
    if (result.participantPhone) {
      ElginPrinter.printText("Telefone:", 0, true, false);
      ElginPrinter.printText(result.participantPhone, 0, false, false);
      ElginPrinter.feedLines(1);
    }

    // Separador
    ElginPrinter.printText("─".repeat(32), 1, false, false);
    ElginPrinter.feedLines(1);

    // Data/hora
    ElginPrinter.printText("Data/Hora:", 0, true, false);
    const dt = result.checkedInAt ? new Date(result.checkedInAt) : new Date();
    ElginPrinter.printText(dt.toLocaleString("pt-BR"), 0, false, false);
    ElginPrinter.feedLines(1);

    // Terminal
    ElginPrinter.printText("Terminal:", 0, true, false);
    ElginPrinter.printText(config.terminalName, 0, false, false);
    ElginPrinter.feedLines(1);

    // Status
    ElginPrinter.printText("─".repeat(32), 1, false, false);
    if (result.status === "ALREADY_CHECKED_IN") {
      ElginPrinter.printText("JA REGISTRADO", 1, true, false);
    } else {
      ElginPrinter.printText("PRESENCA CONFIRMADA", 1, true, false);
    }
    ElginPrinter.feedLines(1);

    // Rodapé
    ElginPrinter.printText("─".repeat(32), 1, false, false);
    ElginPrinter.printText("Apresente este comprovante", 1, false, false);
    ElginPrinter.printText("se solicitado.", 1, false, false);
    ElginPrinter.feedLines(3);

    try { ElginPrinter.cutPaper(); } catch {}
  } finally {
    ElginPrinter.disconnect();
  }
}
