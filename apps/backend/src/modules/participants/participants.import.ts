import { parse } from "csv-parse/sync";
import { ValidationError } from "../../shared/errors.js";
import * as participantsRepository from "./participants.repository.js";

export interface ImportRowResult {
  row: number;
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  status: "valid" | "invalid" | "duplicate";
  reason?: string;
}

export interface ImportReport {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rows: ImportRowResult[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDigits(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

/**
 * Faz o parse do CSV (colunas esperadas: nome,email,telefone,documento),
 * normaliza os campos e detecta duplicados — tanto dentro do próprio
 * arquivo quanto contra participantes já cadastrados no evento.
 * Nunca grava nada no banco; é usado tanto no preview quanto como primeira
 * etapa da confirmação da importação (seção 20 da especificação: "Nunca
 * importar cegamente").
 */
export async function analyzeImport(eventId: string, csvContent: string): Promise<ImportReport> {
  let records: Record<string, string>[];
  try {
    records = parse(csvContent, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    throw new ValidationError("CSV malformado", { message: (error as Error).message });
  }

  if (records.length === 0) {
    throw new ValidationError("CSV não contém nenhuma linha de dados");
  }

  const seenEmails = new Set<string>();
  const seenDocuments = new Set<string>();
  const rows: ImportRowResult[] = [];

  const normalized = records.map((record, index) => {
    const name = record.nome?.trim() || record.name?.trim();
    const emailRaw = (record.email ?? "").trim().toLowerCase();
    const email = emailRaw.length > 0 ? emailRaw : undefined;
    const phone = normalizeDigits(record.telefone ?? record.phone);
    const document = normalizeDigits(record.documento ?? record.document);
    return { row: index + 2, name, email, phone, document }; // +2: header é a linha 1
  });

  const existing = await participantsRepository.findExistingByEmailOrDocument(
    eventId,
    normalized.map((r) => r.email).filter((v): v is string => !!v),
    normalized.map((r) => r.document).filter((v): v is string => !!v)
  );
  const existingEmails = new Set(existing.map((e) => e.email).filter((v): v is string => !!v));
  const existingDocuments = new Set(existing.map((e) => e.document).filter((v): v is string => !!v));

  for (const candidate of normalized) {
    if (!candidate.name) {
      rows.push({ ...candidate, status: "invalid", reason: "Nome é obrigatório" });
      continue;
    }
    if (candidate.email && !EMAIL_REGEX.test(candidate.email)) {
      rows.push({ ...candidate, status: "invalid", reason: "E-mail inválido" });
      continue;
    }

    const duplicateInFile =
      (candidate.email && seenEmails.has(candidate.email)) ||
      (candidate.document && seenDocuments.has(candidate.document));
    const duplicateInEvent =
      (candidate.email && existingEmails.has(candidate.email)) ||
      (candidate.document && existingDocuments.has(candidate.document));

    if (duplicateInFile || duplicateInEvent) {
      rows.push({
        ...candidate,
        status: "duplicate",
        reason: duplicateInEvent ? "Já cadastrado neste evento" : "Duplicado dentro do próprio arquivo",
      });
      continue;
    }

    if (candidate.email) seenEmails.add(candidate.email);
    if (candidate.document) seenDocuments.add(candidate.document);
    rows.push({ ...candidate, status: "valid" });
  }

  return {
    totalRows: rows.length,
    validCount: rows.filter((r) => r.status === "valid").length,
    invalidCount: rows.filter((r) => r.status === "invalid").length,
    duplicateCount: rows.filter((r) => r.status === "duplicate").length,
    rows,
  };
}
