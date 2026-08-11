import ElginPrinter from "../../../modules/elgin-printer/src/ElginPrinterModule";
import * as checkinsRepository from "../../database/checkinsRepository";
import type { TerminalConfig } from "../../types/index";

const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Imprime o relatório de presença na impressora térmica embutida do
 * M10 Pro (via módulo nativo modules/elgin-printer — ver docs/printer.md
 * para a investigação que fundamenta essa integração). Mesmo conteúdo do
 * PDF (attendanceReport.ts): nome do evento e do terminal no topo, depois
 * participante + horário.
 */
export async function printAttendanceReport(config: TerminalConfig): Promise<{ count: number }> {
  const checkIns = await checkinsRepository.listConfirmed();

  const connectResult = ElginPrinter.connect();
  if (connectResult !== 0) {
    throw new Error("Não foi possível conectar à impressora térmica do terminal.");
  }

  try {
    ElginPrinter.printText(config.eventName, ALIGN_CENTER, true, false);
    ElginPrinter.printText(config.terminalName, ALIGN_CENTER, false, false);
    ElginPrinter.printText("Relatório de presença", ALIGN_CENTER, false, true);
    ElginPrinter.feedLines(1);

    if (checkIns.length === 0) {
      ElginPrinter.printText("Nenhuma presença registrada.", ALIGN_LEFT, false, false);
    }
    for (const checkIn of checkIns) {
      ElginPrinter.printText(
        `${formatTime(checkIn.checkedInAt)}  ${checkIn.participantName}`,
        ALIGN_LEFT,
        false,
        false
      );
    }

    ElginPrinter.feedLines(1);
    ElginPrinter.printText(`Total: ${checkIns.length}`, ALIGN_LEFT, true, false);
    ElginPrinter.feedLines(3);
    ElginPrinter.cutPaper();
  } finally {
    ElginPrinter.disconnect();
  }

  return { count: checkIns.length };
}
