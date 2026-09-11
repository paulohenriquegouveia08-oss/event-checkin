import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CopolActivitySeed {
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string | null;
  title: string;
  speaker: string | null;
  location: string | null;
  description: string | null;
  type: "Hands On" | "Palestra" | "Credenciamento" | "Intervalo" | "Solenidade" | "Recepção";
  order: number;
}

export const COPOL_OFFICIAL_SCHEDULE_ITEMS: CopolActivitySeed[] = [
  // QUINTA-FEIRA — 05/11/2026 (11 atividades)
  {
    date: "2026-11-05",
    startTime: "08:30",
    endTime: "09:00",
    title: "Credenciamento – Retirada de Crachás",
    speaker: null,
    location: null,
    description: null,
    type: "Credenciamento",
    order: 0,
  },
  {
    date: "2026-11-05",
    startTime: "09:00",
    endTime: "10:00",
    title: "Cerimônia de Abertura – Coquetel de Boas-Vindas",
    speaker: null,
    location: null,
    description: null,
    type: "Solenidade",
    order: 1,
  },
  {
    date: "2026-11-05",
    startTime: "10:00",
    endTime: "11:00",
    title: "Cristina Miura – Lucratividade para Recém-Formados",
    speaker: "Cristina Miura",
    location: null,
    description: null,
    type: "Palestra",
    order: 2,
  },
  {
    date: "2026-11-05",
    startTime: "11:00",
    endTime: "12:00",
    title: "Prof. Dr. Letícia Lang – Odontologia Oncológica: o que o clínico precisa saber",
    speaker: "Prof. Dr. Letícia Lang",
    location: null,
    description: null,
    type: "Palestra",
    order: 3,
  },
  {
    date: "2026-11-05",
    startTime: "12:00",
    endTime: "14:00",
    title: "Almoço",
    speaker: null,
    location: null,
    description: null,
    type: "Intervalo",
    order: 4,
  },
  {
    date: "2026-11-05",
    startTime: "14:00",
    endTime: "18:00",
    title: "Hands On – inscrições em breve.",
    speaker: null,
    location: null,
    description: "inscrições em breve.",
    type: "Hands On",
    order: 5,
  },
  {
    date: "2026-11-05",
    startTime: "18:00",
    endTime: "19:00",
    title: "Coffee Break",
    speaker: null,
    location: null,
    description: null,
    type: "Intervalo",
    order: 6,
  },
  {
    date: "2026-11-05",
    startTime: "19:00",
    endTime: "19:15",
    title: "Credenciamento – Retirada de Crachás",
    speaker: null,
    location: null,
    description: null,
    type: "Credenciamento",
    order: 7,
  },
  {
    date: "2026-11-05",
    startTime: "19:15",
    endTime: "20:15",
    title: "Dra. Lázara – Palestra",
    speaker: "Dra. Lázara",
    location: null,
    description: null,
    type: "Palestra",
    order: 8,
  },
  {
    date: "2026-11-05",
    startTime: "20:15",
    endTime: "21:00",
    title: "Carlos Augusto – DTM",
    speaker: "Carlos Augusto",
    location: null,
    description: null,
    type: "Palestra",
    order: 9,
  },
  {
    date: "2026-11-05",
    startTime: "20:15",
    endTime: "21:00",
    title: "Coquetel de Encerramento Dia 1",
    speaker: null,
    location: null,
    description: null,
    type: "Solenidade",
    order: 10,
  },

  // SEXTA-FEIRA — 06/11/2026 (11 atividades)
  {
    date: "2026-11-06",
    startTime: "08:00",
    endTime: "08:30",
    title: "Recepção com DJ",
    speaker: null,
    location: null,
    description: null,
    type: "Recepção",
    order: 0,
  },
  {
    date: "2026-11-06",
    startTime: "08:30",
    endTime: "09:30",
    title: "Franciele Covalti – Tema a decidir",
    speaker: "Franciele Covalti",
    location: null,
    description: "Tema a decidir",
    type: "Palestra",
    order: 1,
  },
  {
    date: "2026-11-06",
    startTime: "09:30",
    endTime: "10:00",
    title: "Coffee Break",
    speaker: null,
    location: null,
    description: null,
    type: "Intervalo",
    order: 2,
  },
  {
    date: "2026-11-06",
    startTime: "10:00",
    endTime: "11:00",
    title: "Dr. Giuliano Cesar – Periodontia",
    speaker: "Dr. Giuliano Cesar",
    location: null,
    description: null,
    type: "Palestra",
    order: 3,
  },
  {
    date: "2026-11-06",
    startTime: "11:00",
    endTime: "12:00",
    title: "Renata Longo – Odontopediatria",
    speaker: "Renata Longo",
    location: null,
    description: null,
    type: "Palestra",
    order: 4,
  },
  {
    date: "2026-11-06",
    startTime: "12:00",
    endTime: "14:00",
    title: "Almoço",
    speaker: null,
    location: null,
    description: null,
    type: "Intervalo",
    order: 5,
  },
  {
    date: "2026-11-06",
    startTime: "14:00",
    endTime: "18:00",
    title: "Hands On – inscrições em breve.",
    speaker: null,
    location: null,
    description: "inscrições em breve.",
    type: "Hands On",
    order: 6,
  },
  {
    date: "2026-11-06",
    startTime: "18:00",
    endTime: "19:00",
    title: "Coffee Break",
    speaker: null,
    location: null,
    description: null,
    type: "Intervalo",
    order: 7,
  },
  {
    date: "2026-11-06",
    startTime: "19:00",
    endTime: "20:00",
    title: "Dr. Ricardo Navarro",
    speaker: "Dr. Ricardo Navarro",
    location: null,
    description: null,
    type: "Palestra",
    order: 8,
  },
  {
    date: "2026-11-06",
    startTime: "20:00",
    endTime: "21:00",
    title: "Dra. Gabriella Kayamori",
    speaker: "Dra. Gabriella Kayamori",
    location: null,
    description: null,
    type: "Palestra",
    order: 9,
  },
  {
    date: "2026-11-06",
    startTime: "—",
    endTime: null,
    title: "Coquetel de Encerramento Dia 2",
    speaker: null,
    location: null,
    description: null,
    type: "Solenidade",
    order: 10,
  },

  // SÁBADO — 07/11/2026 (5 atividades)
  {
    date: "2026-11-07",
    startTime: "08:00",
    endTime: null,
    title: "Nikolas Barros",
    speaker: "Nikolas Barros",
    location: null,
    description: null,
    type: "Palestra",
    order: 0,
  },
  {
    date: "2026-11-07",
    startTime: "09:30",
    endTime: null,
    title: "Coffee Break",
    speaker: null,
    location: null,
    description: null,
    type: "Intervalo",
    order: 1,
  },
  {
    date: "2026-11-07",
    startTime: "10:00",
    endTime: null,
    title: "Dra. Stephanie – Dentística",
    speaker: "Dra. Stephanie",
    location: null,
    description: null,
    type: "Palestra",
    order: 2,
  },
  {
    date: "2026-11-07",
    startTime: "11:00",
    endTime: null,
    title: "Joab Cabral – Estomatologia",
    speaker: "Joab Cabral",
    location: null,
    description: null,
    type: "Palestra",
    order: 3,
  },
  {
    date: "2026-11-07",
    startTime: "—",
    endTime: null,
    title: "Cerimônia de Encerramento",
    speaker: null,
    location: null,
    description: null,
    type: "Solenidade",
    order: 4,
  },
];

export async function seedCopolSchedule() {
  console.log("Iniciando seed da programacao oficial do COPOL (27 itens)...");

  let event = await prisma.event.findFirst({
    where: {
      OR: [
        { name: { contains: "COPOL", mode: "insensitive" } },
        { id: "copol-2026" },
      ],
    },
  });

  if (!event) {
    event = await prisma.event.findFirst({
      orderBy: { createdAt: "desc" },
    });
  }

  if (!event) {
    console.warn("Nenhum evento encontrado no banco para vincular a grade.");
    return;
  }

  console.log(`Vinculando ${COPOL_OFFICIAL_SCHEDULE_ITEMS.length} itens ao evento: ${event.name} (${event.id})`);

  await prisma.eventScheduleItem.deleteMany({
    where: { eventId: event.id },
  });

  for (const item of COPOL_OFFICIAL_SCHEDULE_ITEMS) {
    await prisma.eventScheduleItem.create({
      data: {
        eventId: event.id,
        date: new Date(`${item.date}T12:00:00.000Z`),
        startTime: item.startTime,
        endTime: item.endTime,
        title: item.title,
        speaker: item.speaker,
        location: item.location,
        description: item.description,
        type: item.type,
        order: item.order,
      },
    });
  }

  const count = await prisma.eventScheduleItem.count({
    where: { eventId: event.id },
  });

  console.log(`Sucesso: ${count} itens da programacao oficial cadastrados para o evento ${event.name}.`);
}

if (process.argv[1]?.includes("seed-copol-schedule")) {
  seedCopolSchedule()
    .catch((e) => {
      console.error("Erro no seed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
