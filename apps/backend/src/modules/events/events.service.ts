import type { Event } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
import * as eventsRepository from "./events.repository.js";
import type { CreateEventInput, UpdateEventInput } from "./events.schema.js";
import { resolveSiteContent } from "./site-content.js";

/** Inscrições abertas = sem fechamento manual ativo E (sem prazo definido
 * OU prazo ainda não passou). Fechamento manual (registrationsClosedAt)
 * sempre prevalece, mesmo com prazo futuro — é o botão "Encerrar" do
 * admin. "Retomar" só limpa registrationsClosedAt; se o prazo automático
 * já passou, o evento continua fechado por causa dele. */
export function isRegistrationOpen(event: Pick<Event, "registrationDeadline" | "registrationsClosedAt">): boolean {
  if (event.registrationsClosedAt) return false;
  if (event.registrationDeadline && new Date() >= event.registrationDeadline) return false;
  return true;
}

/** Resposta pública (portal pre-copol) — inclui o campo computado
 * registrationsOpen e o siteContent já mesclado com os defaults, pra o
 * front-end não precisar conhecer os valores de fallback. */
function toPublicEvent(event: Event) {
  return {
    ...event,
    registrationsOpen: isRegistrationOpen(event),
    siteContent: resolveSiteContent(event.siteContent),
  };
}

/** Resposta admin — mesmo computado registrationsOpen, mas siteContent cru
 * (como está salvo, pode ter campos ausentes) pra o formulário de edição
 * distinguir "nunca customizado" de "customizado igual ao padrão". */
function toAdminEvent(event: Event) {
  return {
    ...event,
    registrationsOpen: isRegistrationOpen(event),
  };
}

export async function createEvent(input: CreateEventInput) {
  const event = await eventsRepository.createEvent(input);
  return toAdminEvent(event);
}

export async function listEvents() {
  const events = await eventsRepository.listEvents();
  return events.map(toAdminEvent);
}

export async function listActiveEvents() {
  const events = await eventsRepository.listActiveEvents();
  return events.map(toPublicEvent);
}

/**
 * O evento pelo endereço público (slug).
 *
 * Existe para a página de inscrição não precisar do UUID cravado no
 * front-end — um id no código é o tipo de coisa que sobrevive ao evento
 * e aponta para o lugar errado no ano seguinte.
 *
 * Devolve a forma PÚBLICA: nada de configuração interna, e apenas eventos
 * ativos. Um evento fechado responde 404 aqui de propósito.
 */
/**
 * Eventos com inscrição aberta, para o portal de credenciamento.
 *
 * Devolve só o mínimo — nome e endereço — porque é uma lista de links,
 * não uma vitrine.
 */
export async function listOpenRegistrationEvents() {
  const events = await eventsRepository.listEventsWithOpenRegistration();
  return events
    .filter((e) => isRegistrationOpen(e))
    .map((e) => ({ slug: e.slug, name: e.name, startDate: e.startDate }));
}

export async function getPublicEventBySlug(slug: string) {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || event.status !== "ACTIVE") {
    throw new NotFoundError("Evento não encontrado");
  }

  const publico = toPublicEvent(event);
  return {
    id: publico.id,
    name: publico.name,
    description: publico.description,
    location: publico.location,
    startDate: publico.startDate,
    endDate: publico.endDate,
    slug: publico.slug,
    timezone: publico.timezone,
    registrationsOpen: publico.registrationsOpen,
    // Cru, como está salvo: a página de inscrição usa campos próprios
    // (tema, destaques) que o resolvedor do site do COPOL não conhece e
    // descartaria.
    siteContent: event.siteContent,
  };
}

async function findEventOrThrow(eventId: string) {
  const event = await eventsRepository.findEventById(eventId);
  if (!event) {
    throw new NotFoundError("Evento não encontrado");
  }
  return event;
}

export async function getEventOrThrow(eventId: string) {
  const event = await findEventOrThrow(eventId);
  return toAdminEvent(event);
}

export async function getPublicEventOrThrow(eventId: string) {
  const event = await findEventOrThrow(eventId);
  return toPublicEvent(event);
}

export async function updateEvent(eventId: string, input: UpdateEventInput) {
  await findEventOrThrow(eventId);
  const event = await eventsRepository.updateEvent(eventId, input);
  return toAdminEvent(event);
}

export async function closeRegistrations(eventId: string) {
  await findEventOrThrow(eventId);
  const event = await eventsRepository.setRegistrationsClosedAt(eventId, new Date());
  return toAdminEvent(event);
}

/** "Retomar" sempre reabre de fato, não importa a causa do fechamento:
 * limpa o fechamento manual e, se o prazo automático já tiver passado,
 * limpa o prazo também (mantém se ainda for futuro — nesse caso as
 * inscrições já reabrem só com o fechamento manual limpo). */
export async function reopenRegistrations(eventId: string) {
  const current = await findEventOrThrow(eventId);
  const deadlineExpired = !!(current.registrationDeadline && new Date() >= current.registrationDeadline);

  const event = await eventsRepository.reopenRegistrations(eventId, deadlineExpired);
  return toAdminEvent(event);
}
