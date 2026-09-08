import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Configura o evento da Semantix para receber inscrições pelo site.
 *
 * O evento JÁ EXISTE (foi criado no painel) — este script só completa o
 * que falta para o link público funcionar. Não cria evento nenhum: criar
 * um segundo "Semantix" seria pior que não fazer nada.
 *
 * Idempotente: rodar de novo não duplica lote nem sobrescreve o que já
 * está configurado à mão.
 *
 * `npm run seed:semantix --workspace=apps/backend`
 */

const prisma = new PrismaClient();

const SLUG = "semantix";
const LOTE_GRATUITO = "Inscrição gratuita";

/**
 * Cores tiradas da própria arte do certificado.
 *
 * Não são escolha de gosto: o roxo #55079B é o do título "CERTIFICADO" e
 * o da logo da Semantix, amostrados pixel a pixel. A página de inscrição
 * e o documento que a pessoa recebe depois precisam parecer o mesmo
 * evento.
 */
const CONTEUDO_DO_SITE = {
  tema: {
    primaria: "#55079B",
    primariaEscura: "#33055E",
    // A onda do rodapé da arte, da esquerda para a direita.
    gradiente: ["#7B2FD6", "#2E86E0", "#1BB8C4", "#6DC04B", "#F2C230"],
  },
  heroTitulo: "Semantix na UP",
  heroSubtitulo: "Carreira, Tecnologia e Oportunidades",
  heroTexto:
    "Uma imersão no mercado de dados e inteligência artificial, com oportunidades de carreira e estágio.",
  local: "Auditório da Universidade Positivo",
  cargaHoraria: "2 horas de atividades complementares",
  realizacao: ["Universidade Positivo", "Semantix", "Ecohub"],
  destaques: [
    { titulo: "Certificado", texto: "2 horas de atividades complementares, com validação online." },
    { titulo: "Mercado de dados", texto: "Um panorama de carreira em dados e inteligência artificial." },
    { titulo: "Vagas e estágio", texto: "Oportunidades apresentadas por quem contrata." },
  ],
};

async function main() {
  const evento = await prisma.event.findFirst({ where: { name: { equals: "Semantix", mode: "insensitive" } } });
  if (!evento) {
    console.error('Evento "Semantix" não encontrado. Crie-o no painel antes de rodar este script.');
    process.exit(1);
  }
  console.log(`Evento: ${evento.name} (${evento.id})`);

  // 1. Endereço público. Sem slug não há link para divulgar.
  if (!evento.slug) {
    await prisma.event.update({ where: { id: evento.id }, data: { slug: SLUG } });
    console.log(`✓ slug definido: ${SLUG}`);
  } else {
    console.log(`— slug já definido: ${evento.slug}`);
  }

  // 2. Modelo de certificado.
  if (!evento.certificateTemplateId) {
    const modelo = await prisma.certificateTemplate.findFirst({ where: { name: "Semantix 2026" } });
    if (modelo) {
      await prisma.event.update({ where: { id: evento.id }, data: { certificateTemplateId: modelo.id } });
      console.log(`✓ modelo de certificado vinculado: ${modelo.name}`);
    } else {
      console.warn('! Modelo "Semantix 2026" não encontrado — rode `npm run seed:modelos` antes.');
    }
  } else {
    console.log("— modelo de certificado já vinculado");
  }

  // 3. Lote GRATUITO e ativo.
  //
  // O evento veio com quatro lotes pagos herdados do COPOL, todos
  // inativos. Não são apagados: desativados eles não cobram nada, e
  // apagar dado que alguém cadastrou não é decisão de script.
  const jaTem = await prisma.eventBatch.findFirst({ where: { eventId: evento.id, name: LOTE_GRATUITO } });
  if (!jaTem) {
    const maior = await prisma.eventBatch.aggregate({
      where: { eventId: evento.id },
      _max: { batchNumber: true },
    });

    await prisma.$transaction([
      // Só um lote ativo por vez: `resolveActiveBatch` pega o ativo, e
      // dois ativos tornariam o preço uma questão de sorte.
      prisma.eventBatch.updateMany({ where: { eventId: evento.id }, data: { isActive: false } }),
      prisma.eventBatch.create({
        data: {
          eventId: evento.id,
          batchNumber: (maior._max.batchNumber ?? 0) + 1,
          name: LOTE_GRATUITO,
          price: 0,
          isActive: true,
        },
      }),
    ]);
    console.log(`✓ lote gratuito criado e ativado (os pagos ficaram inativos)`);
  } else {
    console.log("— lote gratuito já existe");
  }

  // 4. Conteúdo da página pública.
  if (!evento.siteContent) {
    await prisma.event.update({ where: { id: evento.id }, data: { siteContent: CONTEUDO_DO_SITE } });
    console.log("✓ conteúdo da página definido");
  } else {
    console.log("— já tem conteúdo de página; preservado");
  }

  // 5. Módulos, para as abas aparecerem no painel.
  for (const modulo of ["inscription", "checkin", "certificate"]) {
    await prisma.eventModule.upsert({
      where: { eventId_module: { eventId: evento.id, module: modulo } },
      create: { eventId: evento.id, module: modulo, enabledBy: null },
      update: {},
    });
  }
  console.log("✓ módulos inscription, checkin e certificate ligados");

  const inscritos = await prisma.inscription.count({ where: { eventId: evento.id } });
  console.log(`\nPronto. Inscrições hoje: ${inscritos}. Endereço público: /inscricao/${evento.slug ?? SLUG}`);
}

main()
  .catch((erro) => {
    console.error("Falha:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
