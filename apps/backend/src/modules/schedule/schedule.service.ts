import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
import type { CreateScheduleItemInput, UpdateScheduleItemInput } from "./schedule.schema.js";

export async function listSchedule(eventId: string) {
  const items = await prisma.eventScheduleItem.findMany({
    where: { eventId },
    orderBy: [
      { date: "asc" },
      { order: "asc" },
      { startTime: "asc" },
    ],
  });

  return items.map((item) => ({
    id: item.id,
    eventId: item.eventId,
    date: item.date.toISOString().split("T")[0],
    startTime: item.startTime,
    endTime: item.endTime,
    title: item.title,
    speaker: item.speaker,
    location: item.location,
    description: item.description,
    type: item.type,
    order: item.order,
  }));
}

export async function createScheduleItem(eventId: string, input: CreateScheduleItemInput) {
  const item = await prisma.eventScheduleItem.create({
    data: {
      eventId,
      date: new Date(`${input.date}T00:00:00.000Z`),
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      title: input.title,
      speaker: input.speaker ?? null,
      location: input.location ?? null,
      description: input.description ?? null,
      type: input.type ?? null,
      order: input.order ?? 0,
    },
  });

  return {
    ...item,
    date: item.date.toISOString().split("T")[0],
  };
}

export async function updateScheduleItem(id: string, input: UpdateScheduleItemInput) {
  const existing = await prisma.eventScheduleItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Item da programação não encontrado");

  const item = await prisma.eventScheduleItem.update({
    where: { id },
    data: {
      date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : undefined,
      startTime: input.startTime ?? undefined,
      endTime: input.endTime !== undefined ? input.endTime : undefined,
      title: input.title ?? undefined,
      speaker: input.speaker !== undefined ? input.speaker : undefined,
      location: input.location !== undefined ? input.location : undefined,
      description: input.description !== undefined ? input.description : undefined,
      type: input.type !== undefined ? input.type : undefined,
      order: input.order !== undefined ? input.order : undefined,
    },
  });

  return {
    ...item,
    date: item.date.toISOString().split("T")[0],
  };
}

export async function deleteScheduleItem(id: string) {
  const existing = await prisma.eventScheduleItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Item da programação não encontrado");

  await prisma.eventScheduleItem.delete({ where: { id } });
}

export async function reorderScheduleItems(eventId: string, itemIds: string[]) {
  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.eventScheduleItem.updateMany({
        where: { id, eventId },
        data: { order: index },
      })
    )
  );

  return listSchedule(eventId);
}
