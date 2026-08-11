import { NotFoundError } from "../../shared/errors.js";
import { generateQrToken } from "../../shared/tokens.js";
import * as participantsRepository from "./participants.repository.js";
import { analyzeImport, type ImportReport } from "./participants.import.js";
import type { CreateParticipantInput, UpdateParticipantInput } from "./participants.schema.js";

export async function createParticipant(eventId: string, input: CreateParticipantInput) {
  return participantsRepository.createParticipant({
    eventId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    document: input.document,
    qrToken: generateQrToken(),
  });
}

export async function listParticipants(eventId: string) {
  return participantsRepository.listParticipantsByEvent(eventId);
}

export async function listParticipantsForOfflineSync(eventId: string) {
  return participantsRepository.listParticipantsForOfflineSync(eventId);
}

export async function getParticipantOrThrow(eventId: string, participantId: string) {
  const participant = await participantsRepository.findParticipantById(eventId, participantId);
  if (!participant) {
    throw new NotFoundError("Participante não encontrado");
  }
  return participant;
}

export async function updateParticipant(eventId: string, participantId: string, input: UpdateParticipantInput) {
  await getParticipantOrThrow(eventId, participantId);
  return participantsRepository.updateParticipant(participantId, input);
}

export async function deleteParticipant(eventId: string, participantId: string) {
  await getParticipantOrThrow(eventId, participantId);
  await participantsRepository.deleteParticipant(participantId);
}

/** Revoga o token atual e gera um novo — o QR antigo deixa de validar
 * imediatamente (seção 9: "deve existir possibilidade de gerar um novo token"). */
export async function rotateQrToken(eventId: string, participantId: string) {
  await getParticipantOrThrow(eventId, participantId);
  return participantsRepository.updateParticipant(participantId, {
    qrToken: generateQrToken(),
    revokedAt: null,
  });
}

export async function importParticipants(eventId: string, csv: string, confirm: boolean): Promise<ImportReport & { imported: number }> {
  const report = await analyzeImport(eventId, csv);

  if (!confirm) {
    return { ...report, imported: 0 };
  }

  const validRows = report.rows.filter((r) => r.status === "valid");
  if (validRows.length > 0) {
    await participantsRepository.createManyParticipants(
      validRows.map((row) => ({
        eventId,
        name: row.name!,
        email: row.email,
        phone: row.phone,
        document: row.document,
        qrToken: generateQrToken(),
      }))
    );
  }

  return { ...report, imported: validRows.length };
}
