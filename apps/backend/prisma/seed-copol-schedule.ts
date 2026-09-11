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
  type: "Hands On" | "Palestra" | "Credenciamento" | "Intervalo" | "Solenidade";
  order: number;
}

export const COPOL_OFFICIAL_SCHEDULE_ITEMS: CopolActivitySeed[] = [
  // ==========================================
  // QUINTA-FEIRA — 05/11/2026 (14 atividades)
  // ==========================================
  {
    date: "2026-11-05",
    startTime: "08:30",
    endTime: "09:00",
    title: "Credenciamento – Retirada de Crachás",
    speaker: null,
    location: "Foyer Principal",
    description: "Credenciamento – Retirada de Crachás",
    type: "Credenciamento",
    order: 0,
  },
  {
    date: "2026-11-05",
    startTime: "09:00",
    endTime: "10:00",
    title: "Cerimônia de Abertura – Coquetel de Boas-Vindas",
    speaker: null,
    location: "Auditório Principal",
    description: "Cerimônia de Abertura – Coquetel de Boas-Vindas",
    type: "Solenidade",
    order: 1,
  },
  {
    date: "2026-11-05",
    startTime: "10:00",
    endTime: "11:00",
    title: "Cristina Miura – Lucratividade para Recém-Formados",
    speaker: "Cristina Miura",
    location: "Auditório Principal",
    description: "Cristina Miura – Lucratividade para Recém-Formados",
    type: "Palestra",
    order: 2,
  },
  {
    date: "2026-11-05",
    startTime: "11:00",
    endTime: "12:00",
    title: "Prof. Dr. Letícia Lang – Odontologia Oncológica: o que o clínico precisa saber",
    speaker: "Prof. Dr. Letícia Lang",
    location: "Auditório Principal",
    description: "Prof. Dr. Letícia Lang – Odontologia Oncológica: o que o clínico precisa saber",
    type: "Palestra",
    order: 3,
  },
  {
    date: "2026-11-05",
    startTime: "12:00",
    endTime: "14:00",
    title: "Almoço",
    speaker: null,
    location: "Praça de Alimentação",
    description: "Almoço",
    type: "Intervalo",
    order: 4,
  },
  {
    date: "2026-11-05",
    startTime: "14:00",
    endTime: "15:00",
    title: "Hands On Carlos e Romanini",
    speaker: "Carlos e Romanini",
    location: "Sala Hands On 1",
    description: "Hands On Carlos e Romanini",
    type: "Hands On",
    order: 5,
  },
  {
    date: "2026-11-05",
    startTime: "15:00",
    endTime: "16:00",
    title: "Hands On Integrale",
    speaker: "Integrale",
    location: "Sala Hands On 2",
    description: "Hands On Integrale",
    type: "Hands On",
    order: 6,
  },
  {
    date: "2026-11-05",
    startTime: "16:00",
    endTime: "17:00",
    title: "Hands On Marcos Guskuma",
    speaker: "Marcos Guskuma",
    location: "Sala Hands On 1",
    description: "Hands On Marcos Guskuma",
    type: "Hands On",
    order: 7,
  },
  {
    date: "2026-11-05",
    startTime: "17:00",
    endTime: "18:00",
    title: "Hands On Marcela Clareamento",
    speaker: "Marcela",
    location: "Sala Hands On 2",
    description: "Hands On Marcela Clareamento",
    type: "Hands On",
    order: 8,
  },
  {
    date: "2026-11-05",
    startTime: "18:00",
    endTime: "19:00",
    title: "Coffee Break",
    speaker: null,
    location: "Área de Convivência",
    description: "Coffee Break",
    type: "Intervalo",
    order: 9,
  },
  {
    date: "2026-11-05",
    startTime: "19:00",
    endTime: "19:15",
    title: "Credenciamento – Retirada de Crachás",
    speaker: null,
    location: "Foyer Principal",
    description: "Credenciamento – Retirada de Crachás",
    type: "Credenciamento",
    order: 10,
  },
  {
    date: "2026-11-05",
    startTime: "19:15",
    endTime: "20:15",
    title: "Dra. Lázara – Palestra",
    speaker: "Dra. Lázara",
    location: "Auditório Principal",
    description: "Dra. Lázara – Palestra",
    type: "Palestra",
    order: 11,
  },
  {
    date: "2026-11-05",
    startTime: "20:15",
    endTime: "21:00",
    title: "Carlos Augusto – DTM",
    speaker: "Carlos Augusto",
    location: "Auditório Principal",
    description: "Carlos Augusto – DTM",
    type: "Palestra",
    order: 12,
  },
  {
    date: "2026-11-05",
    startTime: "20:15",
    endTime: "21:00",
    title: "Coquetel de Encerramento Dia 1",
    speaker: null,
    location: "Área de Convivência",
    description: "Coquetel de Encerramento Dia 1",
    type: "Solenidade",
    order: 13,
  },

  // ==========================================
  // SEXTA-FEIRA — 06/11/2026 (15 atividades)
  // ==========================================
  {
    date: "2026-11-06",
    startTime: "08:00",
    endTime: "08:30",
    title: "Recepção com DJ",
    speaker: null,
    location: "Foyer / Entrada",
    description: "Recepção com DJ",
    type: "Intervalo",
    order: 14,
  },
  {
    date: "2026-11-06",
    startTime: "08:30",
    endTime: "09:30",
    title: "Franciele Covalti – Tema a decidir",
    speaker: "Franciele Covalti",
    location: "Auditório Principal",
    description: "Franciele Covalti – Tema a decidir",
    type: "Palestra",
    order: 15,
  },
  {
    date: "2026-11-06",
    startTime: "09:30",
    endTime: "10:00",
    title: "Coffee Break",
    speaker: null,
    location: "Área de Convivência",
    description: "Coffee Break",
    type: "Intervalo",
    order: 16,
  },
  {
    date: "2026-11-06",
    startTime: "10:00",
    endTime: "11:00",
    title: "Dr. Giuliano Cesar – Periodontia",
    speaker: "Dr. Giuliano Cesar",
    location: "Auditório Principal",
    description: "Dr. Giuliano Cesar – Periodontia",
    type: "Palestra",
    order: 17,
  },
  {
    date: "2026-11-06",
    startTime: "11:00",
    endTime: "12:00",
    title: "Renata Longo – Odontopediatria",
    speaker: "Renata Longo",
    location: "Auditório Principal",
    description: "Renata Longo – Odontopediatria",
    type: "Palestra",
    order: 18,
  },
  {
    date: "2026-11-06",
    startTime: "12:00",
    endTime: "14:00",
    title: "Almoço",
    speaker: null,
    location: "Praça de Alimentação",
    description: "Almoço",
    type: "Intervalo",
    order: 19,
  },
  {
    date: "2026-11-06",
    startTime: "14:00",
    endTime: "15:00",
    title: "Hands On Radiotech",
    speaker: "Radiotech",
    location: "Sala Hands On 1",
    description: "Hands On Radiotech",
    type: "Hands On",
    order: 20,
  },
  {
    date: "2026-11-06",
    startTime: "15:00",
    endTime: "16:00",
    title: "Hands On Marcela – Diastema",
    speaker: "Marcela",
    location: "Sala Hands On 2",
    description: "Hands On Marcela – Diastema",
    type: "Hands On",
    order: 21,
  },
  {
    date: "2026-11-06",
    startTime: "15:30",
    endTime: "16:30",
    title: "Hands On Fotografia – Dra. Debora",
    speaker: "Dra. Debora",
    location: "Sala Hands On 3",
    description: "Hands On Fotografia – Dra. Debora",
    type: "Hands On",
    order: 22,
  },
  {
    date: "2026-11-06",
    startTime: "16:00",
    endTime: "17:00",
    title: "Hands On Angelus",
    speaker: "Angelus",
    location: "Sala Hands On 1",
    description: "Hands On Angelus",
    type: "Hands On",
    order: 23,
  },
  {
    date: "2026-11-06",
    startTime: "17:00",
    endTime: "18:00",
    title: "Hands On Integrale",
    speaker: "Integrale",
    location: "Sala Hands On 2",
    description: "Hands On Integrale",
    type: "Hands On",
    order: 24,
  },
  {
    date: "2026-11-06",
    startTime: "18:00",
    endTime: "19:00",
    title: "Coffee Break",
    speaker: null,
    location: "Área de Convivência",
    description: "Coffee Break",
    type: "Intervalo",
    order: 25,
  },
  {
    date: "2026-11-06",
    startTime: "19:00",
    endTime: "20:00",
    title: "Dr. Ricardo Navarro",
    speaker: "Dr. Ricardo Navarro",
    location: "Auditório Principal",
    description: "Dr. Ricardo Navarro",
    type: "Palestra",
    order: 26,
  },
  {
    date: "2026-11-06",
    startTime: "20:00",
    endTime: "21:00",
    title: "Dra. Gabriella Kayamori",
    speaker: "Dra. Gabriella Kayamori",
    location: "Auditório Principal",
    description: "Dra. Gabriella Kayamori",
    type: "Palestra",
    order: 27,
  },
  {
    date: "2026-11-06",
    startTime: "21:00",
    endTime: "22:00",
    title: "Encerramento com Coquetel Dia 2",
    speaker: null,
    location: "Área de Convivência",
    description: "Encerramento com Coquetel Dia 2",
    type: "Solenidade",
    order: 28,
  },

  // ==========================================
  // SÁBADO — 07/11/2026 (5 atividades)
  // ==========================================
  {
    date: "2026-11-07",
    startTime: "08:00",
    endTime: "09:30",
    title: "Abertura dos portões",
    speaker: null,
    location: "Entrada Principal",
    description: "Abertura dos portões",
    type: "Credenciamento",
    order: 29,
  },
  {
    date: "2026-11-07",
    startTime: "09:30",
    endTime: "10:00",
    title: "Coffee Break",
    speaker: null,
    location: "Área de Convivência",
    description: "Coffee Break",
    type: "Intervalo",
    order: 30,
  },
  {
    date: "2026-11-07",
    startTime: "10:00",
    endTime: "11:00",
    title: "Dra. Stephanie – Dentística",
    speaker: "Dra. Stephanie",
    location: "Auditório Principal",
    description: "Dra. Stephanie – Dentística",
    type: "Palestra",
    order: 31,
  },
  {
    date: "2026-11-07",
    startTime: "11:00",
    endTime: "12:00",
    title: "Joab Cabral – Estomatologia",
    speaker: "Joab Cabral",
    location: "Auditório Principal",
    description: "Joab Cabral – Estomatologia",
    type: "Palestra",
    order: 32,
  },
  {
    date: "2026-11-07",
    startTime: "12:00",
    endTime: "13:00",
    title: "Cerimônia de Encerramento",
    speaker: null,
    location: "Auditório Principal",
    description: "Cerimônia de Encerramento",
    type: "Solenidade",
    order: 33,
  },
];

export async function seedCopolSchedule() {
  console.log("Iniciando seed da Programação Oficial do COPOL (34 atividades)...");

  // Localiza o evento COPOL
  let event = await prisma.event.findFirst({
    where: {
      OR: [
        { slug: "copol" },
        { slug: "copol-2026" },
        { name: { contains: "COPOL", mode: "insensitive" } },
      ],
    },
  });

  if (!event) {
    event = await prisma.event.findFirst({
      where: { status: "PUBLISHED" },
    });
  }

  if (!event) {
    console.log("Nenhum evento COPOL encontrado. Criando evento base COPOL 2026...");
    event = await prisma.event.create({
      data: {
        name: "3º COPOL — Congresso Odontológico Positivo Londrinense",
        slug: "copol",
        description: "Congresso de Odontologia de Londrina",
        location: "Universidade Positivo — Campus Londrina",
        startDate: new Date("2026-11-05T08:00:00.000Z"),
        endDate: new Date("2026-11-07T18:00:00.000Z"),
        status: "PUBLISHED",
      },
    });
  }

  console.log(`Evento vinculado: "${event.name}" (ID: ${event.id})`);

  // Operação idempotente: remove itens antigos do evento e reinsere a grade oficial
  await prisma.eventScheduleItem.deleteMany({
    where: { eventId: event.id },
  });

  for (const item of COPOL_OFFICIAL_SCHEDULE_ITEMS) {
    await prisma.eventScheduleItem.create({
      data: {
        eventId: event.id,
        date: new Date(`${item.date}T00:00:00.000Z`),
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

  console.log(`✓ Grade oficial do COPOL seedada com sucesso: ${count} atividades cadastradas.`);
}

async function main() {
  try {
    await seedCopolSchedule();
  } catch (err) {
    console.error("Erro ao executar seed da programação:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("seed-copol-schedule")) {
  main();
}
