import { emailService } from "../../lib/email/email.service.js";
import { resolveEmailSettings } from "../../lib/email/email-settings.js";
import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
import * as repo from "./certificates.repository.js";
import { getOrGenerateAttendanceProofPdf, getOrGenerateCertificatePdf } from "./certificates.service.js";

/**
 * Envio dos documentos por e-mail.
 *
 * Separado de certificates.service.ts porque é outra responsabilidade: lá
 * se decide QUEM tem direito e se gera o PDF; aqui só se entrega. Misturar
 * faria a regra de elegibilidade conviver com throttling de API externa.
 *
 * Reaproveita a geração existente de propósito — o PDF enviado é
 * byte a byte o mesmo que a pessoa baixa pelo portal. Um segundo caminho
 * de geração seria o caminho que ninguém confere.
 */

/**
 * O Resend aceita 10 requisições por segundo por equipe.
 *
 * Fica em 5 porque o limite é da EQUIPE, não desta rotina: um disparo em
 * massa consumindo a cota inteira faria o comprovante de inscrição de
 * quem está pagando naquele momento receber 429 e sumir. A metade deixa
 * espaço para o resto do sistema continuar existindo.
 */
const ENVIOS_POR_SEGUNDO = 5;
const INTERVALO_MS = Math.ceil(1000 / ENVIOS_POR_SEGUNDO);

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ResultadoIndividual {
  participantId: string;
  email: string | null;
  enviado: boolean;
  motivo?: string;
}

async function carregarEventoEParticipante(eventId: string, participantId: string) {
  const [event, participant] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId } }),
    prisma.participant.findFirst({ where: { id: participantId, eventId } }),
  ]);
  if (!event) throw new NotFoundError("Evento não encontrado");
  if (!participant) throw new NotFoundError("Participante não encontrado");
  return { event, participant };
}

/** Envia o certificado de UM participante. */
export async function enviarCertificadoPorEmail(
  eventId: string,
  participantId: string,
  opcoes: { reenvio?: boolean } = {},
): Promise<ResultadoIndividual> {
  const { event, participant } = await carregarEventoEParticipante(eventId, participantId);

  if (!participant.email) {
    return { participantId, email: null, enviado: false, motivo: "Participante sem e-mail cadastrado." };
  }

  // Passa pela geração normal: ela é quem confere elegibilidade,
  // revogação e se o PDF em cache está desatualizado. Enviar por fora
  // dela mandaria certificado a quem não tem direito.
  const { buffer, certificateId } = await getOrGenerateCertificatePdf(eventId, participantId);
  const certificado = await repo.findCertificate(eventId, participantId);

  const r = await emailService.sendCertificate(
    event,
    {
      to: participant.email,
      participantName: participant.name,
      workloadHours: certificado?.workloadHours ?? null,
      certificatePdfBuffer: buffer,
      verificationUrl: `${process.env.CERTIFICATE_VALIDATION_BASE_URL ?? ""}?code=${certificado?.verificationCode ?? ""}`,
      certificateId,
      // O hash do conteúdo entra na chave de idempotência: certificado
      // regerado porque o admin mudou a configuração PRECISA poder ser
      // reenviado, mesmo dentro das 24 h de proteção.
      contentHash: certificado?.settingsSnapshotHash ?? undefined,
    },
    opcoes,
  );

  return { participantId, email: participant.email, enviado: r.success, motivo: r.erro };
}

/** Envia o comprovante de presença de UM participante. */
export async function enviarComprovantePorEmail(
  eventId: string,
  participantId: string,
  opcoes: { reenvio?: boolean } = {},
): Promise<ResultadoIndividual> {
  const { event, participant } = await carregarEventoEParticipante(eventId, participantId);

  if (!participant.email) {
    return { participantId, email: null, enviado: false, motivo: "Participante sem e-mail cadastrado." };
  }

  // Também passa pela geração normal, que exige check-in.
  const { buffer } = await getOrGenerateAttendanceProofPdf(eventId, participantId);
  const checkIn = await repo.findCheckIn(eventId, participantId);

  const r = await emailService.sendAttendanceProof(
    event,
    {
      to: participant.email,
      participantName: participant.name,
      participantId,
      proofPdfBuffer: buffer,
      checkedInAt: checkIn?.checkedInAt ?? null,
    },
    opcoes,
  );

  return { participantId, email: participant.email, enviado: r.success, motivo: r.erro };
}

export interface ResultadoEmMassa {
  total: number;
  enviados: number;
  falharam: number;
  detalhes: ResultadoIndividual[];
}

/**
 * Dispara para vários participantes, um a um.
 *
 * Um a um, e não pelo envio em lote do Resend, porque o lote NÃO ACEITA
 * ANEXO — e o documento é justamente o anexo. Não é escolha de estilo: é
 * o que a API permite.
 *
 * Um erro individual não interrompe a fila: quem falhou aparece na lista
 * de volta com o motivo, e o resto continua. Parar no primeiro erro faria
 * um e-mail inválido no meio da lista impedir os duzentos seguintes.
 */
async function dispararEmMassa(
  participantIds: string[],
  enviarUm: (participantId: string) => Promise<ResultadoIndividual>,
): Promise<ResultadoEmMassa> {
  const detalhes: ResultadoIndividual[] = [];

  for (const participantId of participantIds) {
    try {
      detalhes.push(await enviarUm(participantId));
    } catch (erro) {
      detalhes.push({
        participantId,
        email: null,
        enviado: false,
        motivo: erro instanceof Error ? erro.message : "Falha desconhecida.",
      });
    }
    await esperar(INTERVALO_MS);
  }

  const enviados = detalhes.filter((d) => d.enviado).length;
  return { total: detalhes.length, enviados, falharam: detalhes.length - enviados, detalhes };
}

/** Certificado para todos que já podem baixar. */
export async function enviarCertificadosDoEvento(
  eventId: string,
  participantIds?: string[],
): Promise<ResultadoEmMassa> {
  const alvos = participantIds ?? (await idsComCertificadoLiberado(eventId));
  return dispararEmMassa(alvos, (id) => enviarCertificadoPorEmail(eventId, id, { reenvio: true }));
}

/** Comprovante de presença para todos que fizeram check-in. */
export async function enviarComprovantesDoEvento(
  eventId: string,
  participantIds?: string[],
): Promise<ResultadoEmMassa> {
  const alvos = participantIds ?? (await idsComCheckIn(eventId));
  return dispararEmMassa(alvos, (id) => enviarComprovantePorEmail(eventId, id, { reenvio: true }));
}

async function idsComCheckIn(eventId: string): Promise<string[]> {
  const linhas = await prisma.checkIn.findMany({
    where: { eventId },
    select: { participantId: true },
    distinct: ["participantId"],
  });
  return linhas.map((l) => l.participantId);
}

async function idsComCertificadoLiberado(eventId: string): Promise<string[]> {
  const { listParticipantsCertificateStatus } = await import("./certificates.service.js");
  const linhas = await listParticipantsCertificateStatus(eventId);
  return linhas.filter((l) => l.canDownload).map((l) => l.participantId);
}

/** Se o evento manda estes documentos sozinho. */
export function enviosAutomaticos(eventEmailSettings: unknown) {
  const s = resolveEmailSettings(eventEmailSettings);
  return { certificado: s.autoSendCertificate, comprovante: s.autoSendAttendanceProof };
}
