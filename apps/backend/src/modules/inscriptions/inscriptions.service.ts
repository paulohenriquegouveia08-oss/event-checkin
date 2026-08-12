import { NotFoundError } from "../../shared/errors.js";
import * as inscriptionsRepository from "./inscriptions.repository.js";
import { getCategoryAmount, type CreateInscriptionInput } from "./inscriptions.schema.js";

export async function createInscription(eventId: string, input: CreateInscriptionInput) {
  const amount = getCategoryAmount(input.category);

  const inscription = await inscriptionsRepository.createInscription({
    eventId,
    name: input.name,
    email: input.email,
    document: input.document,
    phone: input.phone,
    institution: input.institution,
    category: input.category,
    amount,
    notes: input.notes,
  });

  return {
    id: inscription.id,
    eventId: inscription.eventId,
    name: inscription.name,
    email: inscription.email,
    status: inscription.status,
    amount: Number(inscription.amount),
    category: inscription.category,
  };
}

export async function getInscription(id: string) {
  const inscription = await inscriptionsRepository.findInscriptionById(id);
  if (!inscription) throw new NotFoundError("Inscrição não encontrada");
  return inscription;
}

export async function listInscriptions(eventId: string) {
  return inscriptionsRepository.listInscriptionsByEvent(eventId);
}
