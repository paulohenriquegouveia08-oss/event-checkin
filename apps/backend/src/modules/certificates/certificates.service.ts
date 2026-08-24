import { randomUUID, createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { hasEventEnded } from "../../shared/br-date.js";
import * as repo from "./certificates.repository.js";
import { certificateFileKey, attendanceProofFileKey, certificateStorage, signatureImageKey } from "./certificate-storage.js";
import { renderCertificatePdf, validateEmbeddableImage, type CertificateSignatory } from "./certificate-template.js";
import { renderAttendanceProofPdf } from "./attendance-proof-template.js";
import { isEligible, resolveDisplayStatus, type EligibilityResult } from "./certificate-eligibility.service.js";
import { resolveCertificateSettings, type CertificateSettings } from "./certificate-settings.js";

// --- Imagens de assinatura dos signatários ---

const SIGNATURE_IMAGE_FORMATS: Record<string, "png" | "jpeg"> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
};
const SIGNATURE_IMAGE_EXTENSIONS: Record<"png" | "jpeg", string> = { png: "png", jpeg: "jpg" };
const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

/** Recebe a imagem em base64 (o admin não manda multipart — ver
 * certificates.routes.ts), valida formato/tamanho e que os bytes
 * realmente decodificam como imagem (senão só quebraria muito depois, na
 * hora de gerar um certificado de verdade), e salva no mesmo storage já
 * usado pros PDFs gerados. */
export async function uploadSignatureImage(mimeType: string, dataBase64: string): Promise<{ key: string }> {
  const format = SIGNATURE_IMAGE_FORMATS[mimeType];
  if (!format) {
    throw new ValidationError("Formato de imagem não suportado — envie PNG ou JPEG.");
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) {
    throw new ValidationError("Arquivo de imagem vazio.");
  }
  if (buffer.length > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new ValidationError("Imagem muito grande — o limite é 2MB.");
  }
  try {
    await validateEmbeddableImage(buffer, format);
  } catch {
    throw new ValidationError("Não foi possível ler essa imagem — verifique se o arquivo não está corrompido.");
  }

  const filename = `${randomUUID()}.${SIGNATURE_IMAGE_EXTENSIONS[format]}`;
  const key = signatureImageKey(filename);
  await certificateStorage.save(key, buffer);
  return { key };
}

/** Serve de volta uma imagem já enviada — usada pelo <img> do admin pra
 * mostrar o preview de assinaturas já salvas (ver certificates.routes.ts,
 * autenticação por token na query string, mesmo padrão do SSE de
 * monitor, porque um <img src> não manda header Authorization). */
export async function getSignatureImage(filename: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const ext = filename.split(".").pop()?.toLowerCase();
  const format = ext === "png" ? "png" : ext === "jpg" || ext === "jpeg" ? "jpeg" : null;
  if (!format) throw new NotFoundError("Imagem não encontrada");

  const key = signatureImageKey(filename);
  if (!(await certificateStorage.exists(key))) throw new NotFoundError("Imagem não encontrada");
  const buffer = await certificateStorage.read(key);
  return { buffer, mimeType: format === "png" ? "image/png" : "image/jpeg" };
}

/** Carrega os bytes da imagem de assinatura de cada signatário (quando
 * tiver) pra passar pro template — mantém certificate-template.ts sem
 * nenhuma dependência de I/O, só recebe bytes prontos. Um arquivo que
 * sumiu do disco por fora do fluxo normal não pode derrubar a geração do
 * certificado inteiro: só sai sem a imagem desse signatário. */
async function resolveSignatoryImages(
  signatories: CertificateSettings["signatories"] & {}
): Promise<CertificateSignatory[]> {
  return Promise.all(
    (signatories ?? []).map(async (s): Promise<CertificateSignatory> => {
      if (!s.signatureImageKey) return { name: s.name, role: s.role };
      try {
        const buffer = await certificateStorage.read(s.signatureImageKey);
        const format: "png" | "jpeg" = s.signatureImageKey.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        return { name: s.name, role: s.role, signatureImageBytes: buffer, signatureImageFormat: format };
      } catch {
        return { name: s.name, role: s.role };
      }
    })
  );
}

/** Resume tudo que influencia o conteúdo visual do certificado (exceto o
 * nome do participante, que é individual) num hash — nome/datas do
 * evento e o certificateSettings já resolvido (com os defaults
 * aplicados, ver resolveCertificateSettings). Comparado contra o hash
 * salvo em Certificate.settingsSnapshotHash na hora do download: se o
 * admin mudou qualquer coisa (texto, signatário, cor, carga horária...)
 * desde a última geração, o hash não bate mais e o PDF em cache é
 * considerado desatualizado — ver getOrGenerateCertificatePdf. */
function computeCertificateContentHash(
  event: { name: string; startDate: Date; endDate: Date },
  settings: ReturnType<typeof resolveCertificateSettings>
): string {
  const payload = JSON.stringify({
    eventName: event.name,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    settings,
  });
  return createHash("sha256").update(payload).digest("hex");
}

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

// Query string (?code=...), não segmento de path (/codigo) — o site
// pre-copol passou a ser um export estático (GitHub Pages), e uma rota
// dinâmica de path exigiria conhecer todo código possível em build time
// (ver apps/pre-copol/src/app/certificados/page.tsx).
function verificationUrl(code: string): string {
  return `${env.CERTIFICATE_VALIDATION_BASE_URL}?code=${code}`;
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

/** Gera (na primeira vez), regenera (se a configuração do certificado
 * mudou desde a última geração — ver computeCertificateContentHash) ou
 * reaproveita (se nada mudou) o PDF do certificado. Lança ForbiddenError
 * se não elegível ou revogado; a rota nunca aceita eventId/participantId
 * de fora do token verificado. */
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

  const settings = resolveCertificateSettings(event.certificateSettings);
  const currentHash = computeCertificateContentHash(event, settings);

  const fileKey = certificateFileKey(eventId, participantId);
  const cacheIsFresh =
    existing?.status === "GENERATED" && existing.settingsSnapshotHash === currentHash && (await certificateStorage.exists(fileKey));
  if (cacheIsFresh) {
    return { buffer: await certificateStorage.read(fileKey), certificateId: existing.id, regenerated: false };
  }

  const certificate = await repo.ensureCertificate(eventId, participantId);

  const buffer = await renderCertificatePdf({
    participantName: participant.name,
    eventName: event.name,
    locationLabel: settings.locationLabel,
    eventStartDate: event.startDate,
    eventEndDate: event.endDate,
    workloadHours: settings.workloadHours,
    paragraphSegments: settings.paragraphSegments,
    verificationUrl: verificationUrl(certificate.verificationCode),
    templateAssetKey: settings.templateAssetKey,
    signatories: await resolveSignatoryImages(settings.signatories),
    primaryColor: settings.primaryColor,
    textColor: settings.textColor,
  });

  await certificateStorage.save(fileKey, buffer);
  await repo.markCertificateGenerated(certificate.id, fileKey, settings.workloadHours, currentHash);

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
    paragraphSegments: settings.paragraphSegments,
    verificationUrl: verificationUrl("preview"),
    templateAssetKey: settings.templateAssetKey,
    signatories: await resolveSignatoryImages(settings.signatories),
    primaryColor: settings.primaryColor,
    textColor: settings.textColor,
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
