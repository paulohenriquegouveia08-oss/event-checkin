import { prisma } from "../../database/prisma.js";
import type { CreateEventInput, UpdateEventInput } from "./events.schema.js";

export function createEvent(data: CreateEventInput) {
  return prisma.event.create({ data });
}

export function listEvents() {
  return prisma.event.findMany({ orderBy: { startDate: "desc" } });
}

/**
 * Os eventos que os sites públicos listam.
 *
 * FILTRA POR VISIBILIDADE, e isso faltava. O painel oferece a opção
 * "Privado — só quem tem o link direto" desde sempre, e ela não fazia
 * nada: a consulta devolvia todo evento ATIVO.
 *
 * O efeito real: o site do COPOL pega o primeiro evento desta lista. Com
 * o COPOL encerrado, o único ativo era a Semantix — e copol2026.com.br
 * passou a exibir os dados da Semantix, lotes e programação inclusive.
 * Ninguém mudou nada no site do COPOL; bastou existir outro evento.
 *
 * Quem tem o link direto continua entrando: `getPublicEventBySlug` olha
 * o status, não a visibilidade. Privado significa "não anuncie", e não
 * "bloqueie".
 */
export function listActiveEvents() {
  return prisma.event.findMany({
    where: { status: "ACTIVE", visibility: "PUBLIC" },
    orderBy: { startDate: "desc" },
  });
}

/**
 * Onde dá para se inscrever agora.
 *
 * Pergunta diferente da de cima, e por isso consulta própria: aquela é
 * "o que este site divulga", esta é "onde há inscrição aberta". O portal
 * de credenciamento precisa da segunda — ele não divulga evento nenhum,
 * só leva quem chegou até ele ao lugar certo.
 *
 * Sem slug fica de fora: sem endereço público não há para onde mandar.
 */
export function listEventsWithOpenRegistration() {
  return prisma.event.findMany({
    where: { status: "ACTIVE", slug: { not: null } },
    orderBy: { startDate: "asc" },
  });
}

export function findEventById(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

export function updateEvent(eventId: string, data: UpdateEventInput) {
  return prisma.event.update({ where: { id: eventId }, data });
}

export function setRegistrationsClosedAt(eventId: string, closedAt: Date | null) {
  return prisma.event.update({ where: { id: eventId }, data: { registrationsClosedAt: closedAt } });
}

export function reopenRegistrations(eventId: string, clearDeadline: boolean) {
  return prisma.event.update({
    where: { id: eventId },
    data: {
      registrationsClosedAt: null,
      ...(clearDeadline ? { registrationDeadline: null } : {}),
    },
  });
}
