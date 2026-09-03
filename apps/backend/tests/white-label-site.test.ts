import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function loginAsAdmin() {
  const { user, password } = await createTestAdmin();
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password },
  });
  return response.json().data.token as string;
}

describe("White-Label — Construtor de Sites Dinâmico por Evento", () => {
  it("devolve tema padrão oficial e seções completas na rota pública", async () => {
    const event = await createTestEvent();

    const response = await app.inject({
      method: "GET",
      url: `/events/${event.id}/public`,
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.siteContent).toBeDefined();
    expect(data.siteContent.theme).toBeDefined();
    expect(data.siteContent.theme.primaryColor).toBe("#2DD4BF");
    expect(data.siteContent.theme.accentColor).toBe("#D4A853");
    expect(data.siteContent.sections).toHaveLength(7);
    expect(data.siteContent.sections[0].type).toBe("hero");
    expect(data.siteContent.sections[1].type).toBe("about");
    expect(data.siteContent.partnersText).toBe("Universidade Positivo, Ecohub e LSPK Tecnology apoiam o Pré-Copol 2026.");
    expect(data.siteContent.partnersList.some((p: any) => p.name === "Ecohub")).toBe(true);
  });

  it("permite ao administrador customizar cores, ordem de seções, ocultar seção e salvar FAQ", async () => {
    const token = await loginAsAdmin();
    const event = await createTestEvent();

    const customSiteContent = {
      theme: {
        primaryColor: "#38BDF8",
        accentColor: "#FBBF24",
        backgroundColor: "#0F172A",
        surfaceColor: "#1E293B",
        textColor: "#F8FAFC",
        textMutedColor: "#94A3B8",
      },
      sections: [
        {
          id: "batches",
          type: "batches",
          title: "Ingressos do Congresso",
          subtitle: "Garanta seu lote",
          enabled: true,
          order: 0, // Batches na primeira posição!
          backgroundColor: "#1E293B",
          textColor: "#FFFFFF",
        },
        {
          id: "hero",
          type: "hero",
          title: "Apresentação",
          enabled: true,
          order: 1,
        },
        {
          id: "about",
          type: "about",
          title: "Sobre Nós",
          enabled: false, // Seção Sobre OCULTA!
          order: 2,
        },
      ],
      faqs: [
        {
          question: "Qual o horário do credenciamento?",
          answer: "A partir das 08h00 no hall principal.",
        },
      ],
      eventTitle: "Congresso de Odontologia 2026",
      heroBadge: "Edição Especial UP",
    };

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        siteContent: customSiteContent,
      },
    });

    expect(updateResponse.statusCode).toBe(200);

    // Consulta na API pública (usada pelo site pré-copol)
    const publicResponse = await app.inject({
      method: "GET",
      url: `/events/${event.id}/public`,
    });

    expect(publicResponse.statusCode).toBe(200);
    const publicData = publicResponse.json().data;

    // Verifica que as cores customizadas foram salvas e retornadas
    expect(publicData.siteContent.theme.primaryColor).toBe("#38BDF8");
    expect(publicData.siteContent.theme.backgroundColor).toBe("#0F172A");

    // Verifica que a ordem das seções foi respeitada
    expect(publicData.siteContent.sections[0].type).toBe("batches");
    expect(publicData.siteContent.sections[0].title).toBe("Ingressos do Congresso");
    expect(publicData.siteContent.sections[0].backgroundColor).toBe("#1E293B");

    // Verifica que a seção sobre foi desabilitada
    const aboutSection = publicData.siteContent.sections.find((s: any) => s.type === "about");
    expect(aboutSection.enabled).toBe(false);

    // Verifica que os FAQs foram salvos
    expect(publicData.siteContent.faqs).toHaveLength(1);
    expect(publicData.siteContent.faqs[0].question).toBe("Qual o horário do credenciamento?");
    expect(publicData.siteContent.eventTitle).toBe("Congresso de Odontologia 2026");
  });
});
