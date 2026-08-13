import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { getEventOrThrow } from "../events/events.service.js";
import { findTierAmount } from "../events/site-content.js";
import * as inscriptionsRepository from "./inscriptions.repository.js";
import type { CreateInscriptionInput } from "./inscriptions.schema.js";

export async function createInscription(eventId: string, input: CreateInscriptionInput) {
  const event = await getEventOrThrow(eventId);

  if (!event.registrationsOpen) {
    throw new ForbiddenError("As inscrições para este evento estão encerradas");
  }

  const amount = findTierAmount(event.siteContent, input.category);
  if (amount === null) {
    throw new ValidationError("Categoria de inscrição inválida para este evento");
  }

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
