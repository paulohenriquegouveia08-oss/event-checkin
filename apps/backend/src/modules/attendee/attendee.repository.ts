import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const attendeeRepository = {
  async findParticipantByEmailAndEvent(email: string, eventName: string) {
    const participant = await prisma.participant.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        event: {
          name: { equals: eventName, mode: "insensitive" },
          status: "ACTIVE",
        },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            location: true,
            startDate: true,
            endDate: true,
          },
        },
        checkIns: {
          select: {
            id: true,
            checkedInAt: true,
            terminal: {
              select: { name: true },
            },
          },
          orderBy: { checkedInAt: "desc" },
          take: 1,
        },
      },
    });

    return participant;
  },

  async getParticipantById(id: string) {
    return prisma.participant.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            location: true,
            startDate: true,
            endDate: true,
          },
        },
        checkIns: {
          select: {
            id: true,
            checkedInAt: true,
            terminal: {
              select: { name: true },
            },
          },
          orderBy: { checkedInAt: "desc" },
          take: 1,
        },
      },
    });
  },

  async getEventStats(eventId: string) {
    const [total, checkedIn] = await Promise.all([
      prisma.participant.count({
        where: { eventId, status: "ACTIVE" },
      }),
      prisma.checkIn.count({
        where: { event: { id: eventId }, participant: { status: "ACTIVE" } },
      }),
    ]);

    return {
      total,
      checkedIn,
      absent: total - checkedIn,
      percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
    };
  },
};
