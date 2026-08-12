import { prisma } from "../../database/prisma.js";
import type { CreateEventInput, UpdateEventInput } from "./events.schema.js";

export function createEvent(data: CreateEventInput) {
  return prisma.event.create({ data });
}

export function listEvents() {
  return prisma.event.findMany({ orderBy: { startDate: "desc" } });
}

export function listActiveEvents() {
  return prisma.event.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
}

export function findEventById(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

export function updateEvent(eventId: string, data: UpdateEventInput) {
  return prisma.event.update({ where: { id: eventId }, data });
}
