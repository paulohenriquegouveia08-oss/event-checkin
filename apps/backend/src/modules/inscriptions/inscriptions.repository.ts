import { prisma } from "../../database/prisma.js";
import type { InscriptionStatus, PaymentMethod, PaymentProvider, Prisma } from "@prisma/client";

export interface CreateInscriptionParams {
  eventId: string;
  name: string;
  email: string;
  document: string;
  phone?: string | null;
  institution?: string | null;
  category: string;
  amount: number;
  batchId?: string | null;
  notes?: string | null;
  paymentUrl?: string | null;
  qrCodeBase64?: string | null;
  qrCodeContent?: string | null;
  paymentExpiresAt?: Date | null;
  /** Versao do termo aceito. Ver inscriptions.schema.ts. */
  consentVersion: string;
  consentAcceptedAt: Date;
  consentIp?: string | null;
  /** Inscrição em equipe (ver Event.siteContent.equipe). */
  teamName?: string | null;
  teamMembers?: string[];
}

/**
 * `db` permite rodar dentro de uma transação.
 *
 * A criação da inscrição precisa acontecer na MESMA transação que
 * reserva a vaga no lote — separadas, existe uma janela entre conferir
 * e criar, e é por essa janela que o lote é vendido além do teto.
 */
export function createInscription(
  db: Prisma.TransactionClient | typeof prisma,
  params: CreateInscriptionParams,
) {
  return db.inscription.create({
    data: {
      eventId: params.eventId,
      name: params.name,
      email: params.email,
      document: params.document,
      phone: params.phone ?? null,
      institution: params.institution ?? null,
      category: params.category,
      amount: params.amount,
      batchId: params.batchId ?? null,
      notes: params.notes ?? null,
      paymentUrl: params.paymentUrl ?? null,
      qrCodeBase64: params.qrCodeBase64 ?? null,
      qrCodeContent: params.qrCodeContent ?? null,
      paymentExpiresAt: params.paymentExpiresAt ?? null,
      consentVersion: params.consentVersion,
      consentAcceptedAt: params.consentAcceptedAt,
      consentIp: params.consentIp ?? null,
      teamName: params.teamName ?? null,
      teamMembers: params.teamMembers?.length
        ? { create: params.teamMembers.map((name, index) => ({ name, order: index })) }
        : undefined,
    },
  });
}

export function findInscriptionById(id: string) {
  return prisma.inscription.findUnique({
    where: { id },
    include: {
      event: true,
      batch: true,
    },
  });
}

export function updateInscriptionPayment(
  id: string,
  data: {
    /** Id do pagamento no gateway — permite consultar o status depois. */
    paymentId?: string | null;
    paymentUrl?: string | null;
    qrCodeBase64?: string | null;
    qrCodeContent?: string | null;
    paymentExpiresAt?: Date | null;
    /** Por onde foi cobrada; o relatório do admin usa para separar o que
     * foi conferido à mão do que veio de gateway. */
    paymentProvider?: PaymentProvider | null;
    paymentMethod?: PaymentMethod | null;
  }
) {
  return prisma.inscription.update({
    where: { id },
    data,
  });
}

export function listInscriptionsByEvent(eventId: string) {
  return prisma.inscription.findMany({
    where: { eventId },
    include: { batch: true },
    orderBy: { createdAt: "desc" },
  });
}

export function updateInscriptionStatus(id: string, status: InscriptionStatus, paymentId?: string) {
  return prisma.inscription.update({
    where: { id },
    data: { status, paymentId: paymentId ?? undefined },
  });
}
