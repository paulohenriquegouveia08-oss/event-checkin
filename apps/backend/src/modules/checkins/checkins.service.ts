import { Prisma, type CheckIn, type CheckInSource } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import * as participantsRepository from "../participants/participants.repository.js";
import * as checkinsRepository from "./checkins.repository.js";
import { attendeeEventBus } from "../attendee/attendee.events.js";

export interface CheckInParticipantInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
}

export type CheckInOutcome =
  | { status: "CONFIRMED"; checkIn: CheckIn; participant: CheckInParticipantInfo }
  | { status: "ALREADY_CHECKED_IN"; checkIn: CheckIn; participant: CheckInParticipantInfo };

export interface PerformCheckInParams {
  eventId: string;
  qrToken: string;
  terminalId: string | null;
  source: CheckInSource;
  checkedInAt?: Date;
  localCheckInId?: string;
}

function isUniqueConflictOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

/**
 * Regra central de check-in, compartilhada pelo endpoint online
 * (POST /events/:eventId/checkins) e pela sincronização offline
 * (POST /terminals/sync). A duplicidade é resolvida pela constraint
 * UNIQUE(eventId, participantId) do banco — mesmo sob concorrência real
 * entre dois terminais, apenas um INSERT vence; o outro cai no catch
 * abaixo e é tratado como ALREADY_CHECKED_IN, não como erro.
 */
export async function performCheckIn(params: PerformCheckInParams): Promise<CheckInOutcome> {
  const { eventId, qrToken, terminalId, source, localCheckInId } = params;
  const checkedInAt = params.checkedInAt ?? new Date();

  // Idempotência de reenvio: se este exato registro offline já foi
  // sincronizado antes (retry de rede, por exemplo), devolve o resultado
  // já conhecido sem revalidar nada.
  if (terminalId && localCheckInId) {
    const existingByLocalId = await checkinsRepository.findByTerminalAndLocalId(terminalId, localCheckInId);
    if (existingByLocalId) {
      const participant = await participantsRepository.findParticipantById(eventId, existingByLocalId.participantId);
      return {
        status: "CONFIRMED",
        checkIn: existingByLocalId,
        participant: { id: participant!.id, name: participant!.name, email: participant!.email, phone: participant!.phone, document: participant!.document },
      };
    }
  }

  const participant = await participantsRepository.findParticipantByQrToken(qrToken);
  if (!participant || participant.eventId !== eventId || participant.revokedAt) {
    throw new NotFoundError("Credencial inválida");
  }
  if (participant.status !== "ACTIVE") {
    throw new ForbiddenError("Credencial inativa");
  }

  try {
    const checkIn = await checkinsRepository.createCheckIn({
      eventId,
      participantId: participant.id,
      terminalId,
      source,
      checkedInAt,
      localCheckInId: localCheckInId ?? null,
    });

    // Publish check-in event for SSE subscribers
    attendeeEventBus.publish(participant.id, {
      type: 'check_in',
      participantId: participant.id,
      participantName: participant.name,
      status: 'CONFIRMED',
      checkedInAt: checkedInAt.toISOString(),
    });

    return { status: "CONFIRMED", checkIn, participant: { id: participant.id, name: participant.name, email: participant.email, phone: participant.phone, document: participant.document } };
  } catch (error) {
    if (isUniqueConflictOn(error, "participantId")) {
      const existing = await checkinsRepository.findByEventAndParticipant(eventId, participant.id);
      if (existing) {
        // Publish already checked in event for SSE subscribers
        attendeeEventBus.publish(participant.id, {
          type: 'check_in',
          participantId: participant.id,
          participantName: participant.name,
          status: 'ALREADY_CHECKED_IN',
          checkedInAt: existing.checkedInAt.toISOString(),
        });

        return {
          status: "ALREADY_CHECKED_IN",
          checkIn: existing,
          participant: { id: participant.id, name: participant.name, email: participant.email, phone: participant.phone, document: participant.document },
        };
      }
    }
    if (isUniqueConflictOn(error, "localCheckInId") && terminalId && localCheckInId) {
      const existing = await checkinsRepository.findByTerminalAndLocalId(terminalId, localCheckInId);
      if (existing) {
        return { status: "CONFIRMED", checkIn: existing, participant: { id: participant.id, name: participant.name, email: participant.email, phone: participant.phone, document: participant.document } };
      }
    }
    throw new ConflictError("CHECKIN_CONFLICT", "Não foi possível registrar a presença. Tente novamente.");
  }
}

export async function getEventStatistics(eventId: string) {
  const [totalParticipants, totalCheckIns, byTerminal] = await Promise.all([
    participantsRepository.listParticipantsByEvent(eventId).then((rows) => rows.length),
    checkinsRepository.countByEvent(eventId),
    checkinsRepository.countByEventAndTerminal(eventId),
  ]);

  const attendancePercentage = totalParticipants > 0 ? (totalCheckIns / totalParticipants) * 100 : 0;

  return {
    totalRegistered: totalParticipants,
    totalCheckedIn: totalCheckIns,
    totalAbsent: totalParticipants - totalCheckIns,
    attendancePercentage: Number(attendancePercentage.toFixed(2)),
    checkInsByTerminal: byTerminal.map((row) => ({
      terminalId: row.terminalId,
      count: row._count._all,
    })),
  };
}
