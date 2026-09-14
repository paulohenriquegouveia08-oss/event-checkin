import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Configura o evento do Ecohub para receber inscrições pelo site.
 *
 * O evento JÁ EXISTE (criado no painel) — este script apenas completa o
 * que falta para a página de inscrição e o credenciamento funcionarem:
 *   1. Define slug "ecohub";
 *   2. Remove eventuais lotes legados do COPOL;
 *   3. Cria e ativa o lote "Inscrição Gratuita" (R$ 0,00);
 *   4. Define o siteContent com tema (paleta do Ecohub), palestrante e destaques;
 *   5. Habilita os módulos inscription, checkin e certificate.
 *
 * Idempotente: pode ser rodado múltiplas vezes sem duplicar dados.
 *
 * Execução: `npm run seed:ecohub --workspace=apps/backend`
 */

const prisma = new PrismaClient();

const SLUG = "ecohub";
const LOTE_GRATUITO = "Inscrição Gratuita";

/**
 * Cores extraídas pixel a pixel da identidade oficial do Ecohub (ecohub-rodape.png):
 * - Verde esmeralda central (#0b8161)
 * - Gradiente temático que forma o arco-íris das letras do Ecohub
 */
const CONTEUDO_DO_SITE = {
  tema: {
    primaria: "#0b8161",
    primariaEscura: "#075a43",
    primariaClara: "#e8f5f1",
    acento: "#f7c915",
    // Cores das letras do Ecohub: 'e', 'c', 'o', 'h', 'u', 'b'
    gradiente: ["#f7c915", "#bdd10d", "#26a43a", "#33a2a4", "#0b8161", "#5a3088"],
  },
  heroTitulo: "Ecohub — Sistemas Multi-Agente",
  heroSubtitulo: "Transformando modelos de linguagem em agentes especialistas funcionais",
  heroTexto:
    "Palestra exclusiva com João Gilberto de Souza Piotto. Uma imersão prática sobre arquitetura, orquestração e implementação de agentes especialistas de Inteligência Artificial.",
  local: "Auditório da Universidade Positivo — Londrina",
  cargaHoraria: "2 horas de atividades complementares",
  realizacao: ["Ecohub", "Universidade Positivo", "LSPK Technology"],
  destaques: [
    {
      titulo: "Palestrante Especialista",
      texto: "João Gilberto de Souza Piotto demonstrando casos reais de transformação de LLMs em agentes funcionais.",
    },
    {
      titulo: "Certificado Digital",
      texto: "2 horas de atividades complementares com validação online e QR Code.",
    },
    {
      titulo: "Inscrição Gratuita",
      texto: "Acesso 100% gratuito. Inscrição confirmada na hora com geração imediata de QR Code para credenciamento.",
    },
  ],
};

async function main() {
  const evento = await prisma.event.findFirst({
    where: {
      OR: [
        { slug: SLUG },
        { name: { contains: "Multi-Agente", mode: "insensitive" } },
        { name: { contains: "Ecohub", mode: "insensitive" } },
      ],
    },
  });

  if (!evento) {
    console.error(`Evento do Ecohub não encontrado no banco de dados.`);
    process.exit(1);
  }

  console.log(`Evento encontrado: ${evento.name} (${evento.id})`);

  // 1. Slug público
  if (evento.slug !== SLUG) {
    await prisma.event.update({ where: { id: evento.id }, data: { slug: SLUG } });
    console.log(`✓ Slug configurado para: ${SLUG}`);
  } else {
    console.log(`— Slug já é: ${SLUG}`);
  }

  // 2. Limpeza de lotes pagos indevidos (caso tenham sido herdados do Copol)
  const lotesPagosSemInscricao = await prisma.eventBatch.findMany({
    where: {
      eventId: evento.id,
      price: { gt: 0 },
    },
  });

  for (const lote of lotesPagosSemInscricao) {
    const inscricoes = await prisma.inscription.count({ where: { batchId: lote.id } });
    if (inscricoes === 0) {
      await prisma.eventBatch.delete({ where: { id: lote.id } });
      console.log(`✓ Lote pago indevido removido: ${lote.name} (R$ ${lote.price})`);
    } else {
      await prisma.eventBatch.update({ where: { id: lote.id }, data: { isActive: false, isClosed: true } });
      console.log(`! Lote pago desativado por conter inscrições: ${lote.name}`);
    }
  }

  // 3. Lote gratuito e ativo
  const loteGratuitoExistente = await prisma.eventBatch.findFirst({
    where: { eventId: evento.id, price: 0 },
  });

  if (!loteGratuitoExistente) {
    await prisma.eventBatch.create({
      data: {
        eventId: evento.id,
        batchNumber: 1,
        name: LOTE_GRATUITO,
        price: 0,
        isActive: true,
        isClosed: false,
      },
    });
    console.log(`✓ Lote gratuito criado e ativado: ${LOTE_GRATUITO}`);
  } else {
    await prisma.eventBatch.update({
      where: { id: loteGratuitoExistente.id },
      data: { isActive: true, isClosed: false, name: LOTE_GRATUITO },
    });
    console.log(`— Lote gratuito já existente verificado e ativado`);
  }

  // 4. Conteúdo do site e identidade visual
  await prisma.event.update({
    where: { id: evento.id },
    data: {
      siteContent: CONTEUDO_DO_SITE,
      visibility: "PUBLIC",
      status: "ACTIVE",
    },
  });
  console.log(`✓ Conteúdo do site e paleta visual do Ecohub aplicados`);

  // 5. Módulos do evento
  for (const modulo of ["inscription", "checkin", "certificate"]) {
    await prisma.eventModule.upsert({
      where: { eventId_module: { eventId: evento.id, module: modulo } },
      create: { eventId: evento.id, module: modulo, enabledBy: null },
      update: {},
    });
  }
  console.log(`✓ Módulos inscription, checkin e certificate habilitados`);

  console.log(`\nConfiguração concluída com sucesso para o Ecohub!`);
  console.log(`Link público de inscrição: /inscricao/${SLUG}`);
}

main()
  .catch((e) => {
    console.error("Falha ao configurar Ecohub:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
