import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const attendeeRepository = {
  async findParticipantByEmail(email: string) {
    const participants = await prisma.participant.findMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        event: { status: "ACTIVE" },
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
      orderBy: { event: { startDate: "desc" } },
    });

    return participants;
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
