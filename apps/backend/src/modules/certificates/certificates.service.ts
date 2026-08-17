import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { hasEventEnded } from "../../shared/br-date.js";
import * as repo from "./certificates.repository.js";
import { certificateFileKey, attendanceProofFileKey, certificateStorage } from "./certificate-storage.js";
import { renderCertificatePdf } from "./certificate-template.js";
import { renderAttendanceProofPdf } from "./attendance-proof-template.js";
import { isEligible, resolveDisplayStatus, type EligibilityResult } from "./certificate-eligibility.service.js";
import { resolveCertificateSettings } from "./certificate-settings.js";

async function loadEventOrThrow(eventId: string) {
  const event = await repo.findEventById(eventId);
  if (!event) throw new NotFoundError("Evento não encontrado");
  return event;
}

async function loadParticipantOrThrow(eventId: string, participantId: string) {
  const participant = await repo.findParticipantInEvent(eventId, participantId);
  if (!participant) throw new NotFoundError("Participante não encontrado neste evento");
  return participant;
}

function verificationUrl(code: string): string {
  return `${env.CERTIFICATE_VALIDATION_BASE_URL}/${code}`;
}

async function computeEligibility(eventId: string, participantId: string): Promise<{ eligibility: EligibilityResult; checkIn: Awaited<ReturnType<typeof repo.findCheckIn>> }> {
  const event = await loadEventOrThrow(eventId);
  const checkIn = await repo.findCheckIn(eventId, participantId);
  const eligibility = isEligible({ event, hasCheckIn: !!checkIn });
  return { eligibility, checkIn };
}

// --- Área do participante ---

/** GET /events/:eventId/my-documents — visão consolidada pro attendee.
 * eventId/participantId sempre vêm de request.attendee (JWT), nunca de
 * input do cliente (ver middleware/auth.ts requireAttendee). */
export async function getMyDocuments(eventId: string, participantId: string) {
  const participant = await loadParticipantOrThrow(eventId, participantId);
  const { eligibility, checkIn } = await computeEligibility(eventId, participantId);

  const certificate = await repo.findCertificate(eventId, participantId);
  const status = resolveDisplayStatus({ eligibility, persistedStatus: certificate?.status ?? null });

  return {
    qrCode: { available: participant.status === "ACTIVE" && !participant.revokedAt },
    attendanceProof: { available: !!checkIn },
    certificate: {
      status, // LOCKED | ELIGIBLE | GENERATED | REVOKED
      // ELIGIBLE já pode ser baixado (o PDF é gerado no primeiro download,
      // ver getOrGenerateCertificatePdf) — só LOCKED/REVOKED bloqueiam.
      canDownload: status === "ELIGIBLE" || status === "GENERATED",
      reason: eligibility.reason, // "EVENT_NOT_ENDED" | "NOT_PRESENT" | null
      generatedAt: certificate?.generatedAt ?? null,
    },
  };
}

/** Gera (na primeira vez) ou reaproveita (nas seguintes) o PDF do
 * certificado — nunca regenera um arquivo já existente em storage (ver
 * seção 9 do pedido). Lança ForbiddenError se não elegível ou revogado; a
 * rota nunca aceita eventId/participantId de fora do token verificado. */
export async function getOrGenerateCertificatePdf(eventId: string, participantId: string): Promise<{ buffer: Buffer; certificateId: string; regenerated: boolean }> {
  const event = await loadEventOrThrow(eventId);
  const participant = await loadParticipantOrThrow(eventId, participantId);
  const { eligibility } = await computeEligibility(eventId, participantId);

  const existing = await repo.findCertificate(eventId, participantId);
  if (existing?.status === "REVOKED") {
    throw new ForbiddenError("Este certificado foi revogado");
  }
  if (!eligibility.eligible) {
    const message = eligibility.reason === "EVENT_NOT_ENDED"
      ? "O certificado só fica disponível após o encerramento do evento"
      : "Certificado disponível apenas para quem teve presença confirmada";
    throw new ForbiddenError(message);
  }

  const fileKey = certificateFileKey(eventId, participantId);
  if (existing?.status === "GENERATED" && (await certificateStorage.exists(fileKey))) {
    return { buffer: await certificateStorage.read(fileKey), certificateId: existing.id, regenerated: false };
  }

  const certificate = await repo.ensureCertificate(eventId, participantId);
  const settings = resolveCertificateSettings(event.certificateSettings);

  const buffer = await renderCertificatePdf({
    participantName: participant.name,
    eventName: event.name,
    locationLabel: settings.locationLabel,
    eventStartDate: event.startDate,
    eventEndDate: event.endDate,
    workloadHours: settings.workloadHours,
    closingText: settings.closingText,
    verificationUrl: verificationUrl(certificate.verificationCode),
    templateAssetKey: settings.templateAssetKey,
  });

  await certificateStorage.save(fileKey, buffer);
  await repo.markCertificateGenerated(certificate.id, fileKey, settings.workloadHours);

  return { buffer, certificateId: certificate.id, regenerated: true };
}

export async function getOrGenerateAttendanceProofPdf(
  eventId: string,
  participantId: string
): Promise<{ buffer: Buffer; regenerated: boolean }> {
  const event = await loadEventOrThrow(eventId);
  const participant = await loadParticipantOrThrow(eventId, participantId);
  const checkIn = await repo.findCheckIn(eventId, participantId);
  if (!checkIn) {
    throw new ForbiddenError("Comprovante disponível apenas após o check-in");
  }

  const fileKey = attendanceProofFileKey(eventId, participantId);
  const existing = await repo.findAttendanceProof(eventId, participantId);
  if (existing?.fileKey && (await certificateStorage.exists(fileKey))) {
    return { buffer: await certificateStorage.read(fileKey), regenerated: false };
  }

  const proof = await repo.ensureAttendanceProof(eventId, participantId);
  const buffer = await renderAttendanceProofPdf({
    participantName: participant.name,
    participantDocument: participant.document,
    eventName: event.name,
    eventLocation: event.location,
    checkedInAt: checkIn.checkedInAt,
    terminalName: checkIn.terminal?.name ?? null,
    verificationUrl: verificationUrl(proof.verificationCode),
  });

  await certificateStorage.save(fileKey, buffer);
  await repo.markAttendanceProofGenerated(proof.id, fileKey);
  return { buffer, regenerated: true };
}

// --- Validação pública ---

export async function getPublicCertificate(verificationCode: string) {
  const certificate = await repo.findCertificateByVerificationCode(verificationCode);
  if (!certificate || certificate.status === "LOCKED" || certificate.status === "ELIGIBLE") {
    // Não distingue "não existe" de "ainda não gerado" pro público — só
    // devolve dado de um certificado que já foi de fato emitido.
    throw new NotFoundError("Certificado não encontrado");
  }

  return {
    valid: certificate.status === "GENERATED",
    revoked: certificate.status === "REVOKED",
    participantName: certificate.participant.name,
    eventName: certificate.event.name,
    eventLocation: certificate.event.location,
    eventStartDate: certificate.event.startDate,
    eventEndDate: certificate.event.endDate,
    workloadHours: certificate.workloadHours,
    generatedAt: certificate.generatedAt,
  };
}

// --- Administração ---

/** Só pra rotular o ator nos logs de auditoria disparados pelo próprio
 * participante (ver certificates.routes.ts) — nunca usado pra autorização. */
export async function resolveParticipantActorEmail(eventId: string, participantId: string): Promise<string> {
  const participant = await repo.findParticipantInEvent(eventId, participantId);
  return participant?.email ?? `participante:${participantId}`;
}

/**
 * Gera um PDF de certificado "de teste" pro admin conferir o template
 * (nome, evento, data, QR) sem depender de o evento ter terminado nem de
 * presença confirmada — ao contrário de getOrGenerateCertificatePdf, esta
 * função NUNCA persiste nada (não cria/atualiza linha em Certificate, não
 * grava no storage, não conta nas estatísticas). O QR aponta pra um código
 * que nunca existirá em Certificate.verificationCode, então a página
 * pública de validação sempre mostra "não encontrado" pra ele — correto,
 * já que isto nunca foi de fato emitido pra ninguém.
 */
export async function generateTestCertificatePdf(eventId: string, participantName: string): Promise<Buffer> {
  const event = await loadEventOrThrow(eventId);
  const settings = resolveCertificateSettings(event.certificateSettings);

  return renderCertificatePdf({
    participantName,
    eventName: event.name,
    locationLabel: settings.locationLabel,
    eventStartDate: event.startDate,
    eventEndDate: event.endDate,
    workloadHours: settings.workloadHours,
    closingText: settings.closingText,
    verificationUrl: verificationUrl("preview"),
    templateAssetKey: settings.templateAssetKey,
  });
}

export async function getCertificateStats(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  const [totalParticipants, present, generated, revoked] = await Promise.all([
    repo.countParticipants(eventId),
    repo.countCheckIns(eventId),
    repo.countCertificatesByStatus(eventId, "GENERATED"),
    repo.countCertificatesByStatus(eventId, "REVOKED"),
  ]);

  const eligible = hasEventEnded(event.endDate) ? present : 0;
  const pending = Math.max(eligible - generated - revoked, 0);

  return { totalParticipants, present, eligible, generated, pending, revoked, eventEnded: hasEventEnded(event.endDate) };
}

export async function listCertificates(eventId: string) {
  await loadEventOrThrow(eventId);
  const rows = await repo.listCertificatesByEvent(eventId);
  return rows.map((row) => ({
    id: row.id,
    participantName: row.participant.name,
    participantEmail: row.participant.email,
    status: row.status,
    generatedAt: row.generatedAt,
    revokedAt: row.revokedAt,
  }));
}

/** "Liberar certificados" no admin: só marca quem já está presente como
 * elegível (cria a linha Certificate LOCKED se ainda não existir) — não
 * gera nenhum PDF aqui (ver seção 12 do pedido: geração é sob demanda, no
 * primeiro download). Exige que o evento já tenha terminado. */
export async function releaseEligibleCertificates(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  if (!hasEventEnded(event.endDate)) {
    throw new ValidationError("O evento ainda não terminou — certificados só podem ser liberados após o encerramento");
  }
  const created = await repo.ensureCertificatesForPresentParticipants(eventId);
  return { createdCount: created };
}

export async function revokeCertificate(certificateId: string) {
  const certificate = await findCertificateOrThrow(certificateId);
  if (certificate.status !== "GENERATED") {
    throw new ConflictError("CERTIFICATE_NOT_GENERATED", "Só é possível revogar um certificado já gerado");
  }
  return repo.markCertificateRevoked(certificateId);
}

export async function reinstateCertificate(certificateId: string) {
  const certificate = await findCertificateOrThrow(certificateId);
  if (certificate.status !== "REVOKED") {
    throw new ConflictError("CERTIFICATE_NOT_REVOKED", "Este certificado não está revogado");
  }
  return repo.markCertificateReinstated(certificateId);
}

async function findCertificateOrThrow(certificateId: string) {
  const certificate = await repo.findCertificateById(certificateId);
  if (!certificate) throw new NotFoundError("Certificado não encontrado");
  return certificate;
}
