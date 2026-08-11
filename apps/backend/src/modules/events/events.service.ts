import { NotFoundError } from "../../shared/errors.js";
import * as eventsRepository from "./events.repository.js";
import type { CreateEventInput, UpdateEventInput } from "./events.schema.js";

export async function createEvent(input: CreateEventInput) {
  return eventsRepository.createEvent(input);
}

export async function listEvents() {
  return eventsRepository.listEvents();
}

export async function getEventOrThrow(eventId: string) {
  const event = await eventsRepository.findEventById(eventId);
  if (!event) {
    throw new NotFoundError("Evento não encontrado");
  }
  return event;
}

export async function updateEvent(eventId: string, input: UpdateEventInput) {
  await getEventOrThrow(eventId);
  return eventsRepository.updateEvent(eventId, input);
}
