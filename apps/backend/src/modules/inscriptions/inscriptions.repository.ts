import { prisma } from "../../database/prisma.js";
import type { InscriptionStatus } from "@prisma/client";

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
}

export function createInscription(params: CreateInscriptionParams) {
  return prisma.inscription.create({
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
    paymentUrl?: string | null;
    qrCodeBase64?: string | null;
    qrCodeContent?: string | null;
    paymentExpiresAt?: Date | null;
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
