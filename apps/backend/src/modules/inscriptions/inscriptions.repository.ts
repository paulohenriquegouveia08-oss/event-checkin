import { prisma } from "../../database/prisma.js";
import type { InscriptionStatus } from "@prisma/client";

export interface CreateInscriptionParams {
  eventId: string;
  name: string;
  email: string;
  document: string;
  phone?: string;
  institution?: string;
  category: string;
  amount: number;
  notes?: string;
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
      notes: params.notes ?? null,
    },
  });
}

export function findInscriptionById(id: string) {
  return prisma.inscription.findUnique({ where: { id } });
}

export function listInscriptionsByEvent(eventId: string) {
  return prisma.inscription.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
}

export function updateInscriptionStatus(id: string, status: InscriptionStatus, paymentId?: string) {
  return prisma.inscription.update({
    where: { id },
    data: { status, paymentId: paymentId ?? undefined },
  });
}
