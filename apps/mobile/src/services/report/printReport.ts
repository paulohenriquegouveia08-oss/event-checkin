import AsyncStorage from "@react-native-async-storage/async-storage";
import ElginPrinter from "../../../modules/elgin-printer/src/ElginPrinterModule";
import * as checkinsRepository from "../../database/checkinsRepository";
import { DEFAULT_PRINT_LAYOUT, type PrintLayout } from "./printLayout";
import type { TerminalConfig } from "../../types/index";

const STORAGE_KEY = "print_layout";
const ALIGN_MAP = { left: 0, center: 1, right: 2 } as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(): string {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function loadPrintLayout(): Promise<PrintLayout> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PRINT_LAYOUT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PRINT_LAYOUT };
}

export async function savePrintLayout(layout: PrintLayout): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

/**
 * Imprime o relatório de presença na impressora iMin D1.
 * @param allPeriod Se true, imprime todo o período. Se false, imprime só hoje.
 */
export async function printAttendanceReport(config: TerminalConfig, allPeriod = false): Promise<{ count: number }> {
  const layout = await loadPrintLayout();
  const checkIns = allPeriod
    ? await checkinsRepository.listConfirmed()
    : await checkinsRepository.listConfirmedToday();

  const connectResult = ElginPrinter.connect(0, "", "", 0);
  if (connectResult !== 0) {
    throw new Error("Não foi possível conectar à impressora térmica.");
  }

  try {
    ElginPrinter.initialize();

    for (const field of layout.fields) {
      if (!field.enabled) continue;

      switch (field.id) {
        case "event":
          ElginPrinter.printText(config.eventName, ALIGN_MAP[field.align], field.bold, field.underline);
          break;

        case "terminal":
          ElginPrinter.printText(config.terminalName, ALIGN_MAP[field.align], field.bold, field.underline);
          break;

        case "participants_title":
          ElginPrinter.printText(
            layout.headerText || "PARTICIPANTES",
            ALIGN_MAP[field.align],
            field.bold,
            field.underline
          );
          break;

        case "participants_list":
          if (checkIns.length === 0) {
            ElginPrinter.printText("Nenhuma presenca registrada.", 0, false, false);
          } else {
            for (const checkIn of checkIns) {
              ElginPrinter.printText(
                `${formatTime(checkIn.checkedInAt)}  ${checkIn.participantName}`,
                ALIGN_MAP[field.align],
                field.bold,
                field.underline
              );
            }
          }
          break;

        case "total":
          ElginPrinter.printText(`Total: ${checkIns.length} presenca(s)`, ALIGN_MAP[field.align], field.bold, field.underline);
          break;

        case "datetime":
          ElginPrinter.printText(formatDate(), ALIGN_MAP[field.align], field.bold, field.underline);
          break;

        case "separator1":
        case "separator2":
          ElginPrinter.printText("-".repeat(32), ALIGN_MAP[field.align], false, false);
          break;

        default:
          if (field.label && !field.id.startsWith("separator")) {
            ElginPrinter.printText(field.label, ALIGN_MAP[field.align], field.bold, field.underline);
          }
          break;
      }
    }

    if (layout.footerText) {
      ElginPrinter.feedLines(1);
      ElginPrinter.printText(layout.footerText, 1, false, false);
    }

    ElginPrinter.feedLines(layout.feedBeforeCut);
    try { ElginPrinter.cutPaper(); } catch {}
  } finally {
    ElginPrinter.disconnect();
  }

  return { count: checkIns.length };
}
