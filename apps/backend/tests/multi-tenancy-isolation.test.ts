import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { extractSubdomain } from "../src/middleware/tenant.js";
import { generateQrToken } from "../src/shared/tokens.js";
import { createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Multi-Tenancy & Subdomain Isolation", () => {
  describe("Subdomain Parser (extractSubdomain)", () => {
    it("extrai subdomínio corretamente em domínios de múltiplos níveis (.com.br)", () => {
      expect(extractSubdomain("copol.lspkeventos.com.br")).toBe("copol");
      expect(extractSubdomain("copol.lspkeventos.com.br:3000")).toBe("copol");
      expect(extractSubdomain("evento-a.lspkeventos.com.br")).toBe("evento-a");
      expect(extractSubdomain("congresso-2026.medicina.org.br")).toBe("congresso-2026");
    });

    it("extrai subdomínio em domínios simples (.com, .io)", () => {
      expect(extractSubdomain("copol.lspkeventos.com")).toBe("copol");
      expect(extractSubdomain("evento-b.app.io:8080")).toBe("evento-b");
    });

    it("extrai subdomínio em ambientes locais (.localhost, .local, .test)", () => {
      expect(extractSubdomain("copol.localhost")).toBe("copol");
      expect(extractSubdomain("copol.localhost:3000")).toBe("copol");
      expect(extractSubdomain("evento-a.local")).toBe("evento-a");
      expect(extractSubdomain("evento-b.test:4000")).toBe("evento-b");
    });

    it("remove prefixo www mantendo o subdomínio do evento", () => {
      expect(extractSubdomain("www.copol.lspkeventos.com.br")).toBe("copol");
      expect(extractSubdomain("www.copol.localhost:3000")).toBe("copol");
    });

    it("retorna null para domínios raiz, IPs e subdomínios reservados do sistema", () => {
      expect(extractSubdomain("lspkeventos.com.br")).toBeNull();
      expect(extractSubdomain("localhost")).toBeNull();
      expect(extractSubdomain("localhost:3000")).toBeNull();
      expect(extractSubdomain("127.0.0.1")).toBeNull();
      expect(extractSubdomain("127.0.0.1:3000")).toBeNull();
      expect(extractSubdomain("api.lspkeventos.com.br")).toBeNull();
      expect(extractSubdomain("admin.lspkeventos.com.br")).toBeNull();
      expect(extractSubdomain("www.lspkeventos.com.br")).toBeNull();
      expect(extractSubdomain("app.lspkeventos.com.br")).toBeNull();
    });
  });

  describe("Tenant Middleware Resolution via HTTP", () => {
    it("resolve tenantEvent via host com subdomínio", async () => {
      const event = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({
        where: { id: event.id },
        data: { slug: "copol" },
      });

      // Rota que expõe request.tenantEvent ou valida via endpoint
      const res = await app.inject({
        method: "GET",
        url: `/attendee/events/${event.id}/stats`,
        headers: {
          host: "copol.lspkeventos.com.br",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("resolve tenantEvent via header fallback x-event-slug", async () => {
      const event = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({
        where: { id: event.id },
        data: { slug: "copol" },
      });

      const res = await app.inject({
        method: "GET",
        url: `/attendee/events/${event.id}/stats`,
        headers: {
          host: "localhost:3000",
          "x-event-slug": "copol",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("resolve tenantEvent via header fallback x-event-id", async () => {
      const event = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({
        where: { id: event.id },
        data: { slug: "copol" },
      });

      const res = await app.inject({
        method: "GET",
        url: `/attendee/events/${event.id}/stats`,
        headers: {
          host: "localhost:3000",
          "x-event-id": event.id,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("rejeita requisição para stats de outro evento quando tenantEvent está resolvido", async () => {
      const eventA = await createTestEvent({ name: "Evento A" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "evento-a" } });

      const eventB = await createTestEvent({ name: "Evento B" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "evento-b" } });

      // Host aponta para evento A, mas requisita stats do evento B
      const res = await app.inject({
        method: "GET",
        url: `/attendee/events/${eventB.id}/stats`,
        headers: {
          host: "evento-a.lspkeventos.com.br",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    });
  });

  describe("Attendee Multi-Tenancy & Cross-Event Isolation", () => {
    it("mesmo e-mail cadastrado em eventos distintos pode existir sem colisão", async () => {
      const eventA = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "copol" } });

      const eventB = await createTestEvent({ name: "Semantix 2026" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "semantix" } });

      const email = "participante.comum@exemplo.com";

      const partA = await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Participante COPOL",
          email,
          document: "111.222.333-44",
          qrToken: generateQrToken(),
          status: "ACTIVE",
        },
      });

      const partB = await prisma.participant.create({
        data: {
          eventId: eventB.id,
          name: "Participante Semantix",
          email,
          document: "999.888.777-66",
          qrToken: generateQrToken(),
          status: "ACTIVE",
        },
      });

      expect(partA.id).toBeDefined();
      expect(partB.id).toBeDefined();
      expect(partA.id).not.toBe(partB.id);
      expect(partA.qrToken).not.toBe(partB.qrToken);
    });

    it("login via subdomínio retorna apenas o participante do evento atual", async () => {
      const eventA = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "copol" } });

      const eventB = await createTestEvent({ name: "Semantix 2026" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "semantix" } });

      const email = "duplo@exemplo.com";
      const qrA = generateQrToken();
      const qrB = generateQrToken();

      await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Duplo no COPOL",
          email,
          document: "111.111.111-11",
          qrToken: qrA,
          status: "ACTIVE",
        },
      });

      await prisma.participant.create({
        data: {
          eventId: eventB.id,
          name: "Duplo no Semantix",
          email,
          document: "222.222.222-22",
          qrToken: qrB,
          status: "ACTIVE",
        },
      });

      // Login no domínio do COPOL
      const resA = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: {
          host: "copol.lspkeventos.com.br",
        },
        payload: { email },
      });

      expect(resA.statusCode).toBe(200);
      const dataA = resA.json().data;
      expect(dataA.requiresEventSelection).toBeUndefined();
      expect(dataA.participant.name).toBe("Duplo no COPOL");
      expect(dataA.participant.qrToken).toBe(qrA);
      expect(dataA.participant.event.id).toBe(eventA.id);

      // Login no domínio da Semantix
      const resB = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: {
          host: "semantix.lspkeventos.com.br",
        },
        payload: { email },
      });

      expect(resB.statusCode).toBe(200);
      const dataB = resB.json().data;
      expect(dataB.requiresEventSelection).toBeUndefined();
      expect(dataB.participant.name).toBe("Duplo no Semantix");
      expect(dataB.participant.qrToken).toBe(qrB);
      expect(dataB.participant.event.id).toBe(eventB.id);
    });

    it("login com eventId no corpo restringe estritamente ao evento informado", async () => {
      const eventA = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "copol" } });

      const eventB = await createTestEvent({ name: "Semantix 2026" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "semantix" } });

      const email = "participante.body@exemplo.com";
      const qrA = generateQrToken();
      const qrB = generateQrToken();

      await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Pessoa no Evento A",
          email,
          qrToken: qrA,
          status: "ACTIVE",
        },
      });

      await prisma.participant.create({
        data: {
          eventId: eventB.id,
          name: "Pessoa no Evento B",
          email,
          qrToken: qrB,
          status: "ACTIVE",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/attendee/login",
        payload: { email, eventId: eventA.id },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.participant.name).toBe("Pessoa no Evento A");
      expect(res.json().data.participant.qrToken).toBe(qrA);
    });

    it("participante de um evento não é encontrado quando tenta logar no contexto de outro evento", async () => {
      const eventA = await createTestEvent({ name: "Evento A" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "evento-a" } });

      const eventB = await createTestEvent({ name: "Evento B" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "evento-b" } });

      const email = "so.no.evento.a@exemplo.com";
      await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Exclusivo A",
          email,
          qrToken: generateQrToken(),
          status: "ACTIVE",
        },
      });

      // Tenta logar apontando para o Evento B via subdomínio
      const resHost = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "evento-b.lspkeventos.com.br" },
        payload: { email },
      });
      expect(resHost.statusCode).toBe(404);

      // Tenta logar apontando para o Evento B via header x-event-slug
      const resHeader = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { "x-event-slug": "evento-b" },
        payload: { email },
      });
      expect(resHeader.statusCode).toBe(404);

      // Tenta logar apontando para o Evento B via body eventId
      const resBody = await app.inject({
        method: "POST",
        url: "/attendee/login",
        payload: { email, eventId: eventB.id },
      });
      expect(resBody.statusCode).toBe(404);
    });

    it("login global sem tenant retorna lista para seleção SEM vazar qrToken", async () => {
      const eventA = await createTestEvent({ name: "Evento A" });
      const eventB = await createTestEvent({ name: "Evento B" });

      const email = "selecao@exemplo.com";
      const qrA = generateQrToken();
      const qrB = generateQrToken();

      await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Pessoa A",
          email,
          qrToken: qrA,
          status: "ACTIVE",
        },
      });

      await prisma.participant.create({
        data: {
          eventId: eventB.id,
          name: "Pessoa B",
          email,
          qrToken: qrB,
          status: "ACTIVE",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/attendee/login",
        payload: { email },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.requiresEventSelection).toBe(true);
      expect(data.events).toHaveLength(2);

      // GARANTIA CRÍTICA: qrToken NUNCA é exposto na lista de seleção
      for (const ev of data.events) {
        expect(ev.qrToken).toBeUndefined();
      }
    });

    it("select-event rejeita participantId de outro evento se a requisição estiver em contexto de tenant", async () => {
      const eventA = await createTestEvent({ name: "Evento A" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "evento-a" } });

      const eventB = await createTestEvent({ name: "Evento B" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "evento-b" } });

      const partA = await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Pessoa A",
          email: "teste@exemplo.com",
          qrToken: generateQrToken(),
          status: "ACTIVE",
        },
      });

      // Enviando select-event para o contexto de Evento B com participant do Evento A
      const res = await app.inject({
        method: "POST",
        url: "/attendee/select-event",
        headers: {
          host: "evento-b.lspkeventos.com.br",
        },
        payload: { participantId: partA.id },
      });

      expect(res.statusCode).toBe(404);
    });

    it("QR token, documento e dados do participante do Evento A NÃO podem ser acessados via GET /attendee/me no contexto do Evento B", async () => {
      const eventA = await createTestEvent({ name: "COPOL 2026" });
      await prisma.event.update({ where: { id: eventA.id }, data: { slug: "copol" } });

      const eventB = await createTestEvent({ name: "Semantix 2026" });
      await prisma.event.update({ where: { id: eventB.id }, data: { slug: "semantix" } });

      const qrA = generateQrToken();
      const partA = await prisma.participant.create({
        data: {
          eventId: eventA.id,
          name: "Ana COPOL",
          email: "ana@copol.com",
          phone: "(11) 99999-0001",
          document: "123.456.789-00",
          qrToken: qrA,
          status: "ACTIVE",
        },
      });

      // Login legítimo no Evento A para obter token JWT do attendee
      const loginA = await app.inject({
        method: "POST",
        url: "/attendee/login",
        headers: { host: "copol.lspkeventos.com.br" },
        payload: { email: "ana@copol.com" },
      });

      expect(loginA.statusCode).toBe(200);
      const tokenA = loginA.json().data.token;
      expect(tokenA).toBeDefined();

      // Acesso sob o contexto legítimo (Evento A) deve funcionar
      const resOk = await app.inject({
        method: "GET",
        url: "/attendee/me",
        headers: {
          authorization: `Bearer ${tokenA}`,
          host: "copol.lspkeventos.com.br",
        },
      });

      expect(resOk.statusCode).toBe(200);
      expect(resOk.json().data.qrToken).toBe(qrA);
      expect(resOk.json().data.document).toBe("123.456.789-00");

      // Tentativa de acessar via contexto do Evento B (subdomínio da Semantix)
      const resBlockedSubdomain = await app.inject({
        method: "GET",
        url: "/attendee/me",
        headers: {
          authorization: `Bearer ${tokenA}`,
          host: "semantix.lspkeventos.com.br",
        },
      });

      expect(resBlockedSubdomain.statusCode).toBe(403);
      expect(resBlockedSubdomain.json().error.code).toBe("FORBIDDEN");

      // Tentativa de acessar via header x-event-slug do Evento B
      const resBlockedHeader = await app.inject({
        method: "GET",
        url: "/attendee/me",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "x-event-slug": "semantix",
        },
      });

      expect(resBlockedHeader.statusCode).toBe(403);
      expect(resBlockedHeader.json().error.code).toBe("FORBIDDEN");

      // Tentativa de acessar via header x-event-id do Evento B
      const resBlockedId = await app.inject({
        method: "GET",
        url: "/attendee/me",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "x-event-id": eventB.id,
        },
      });

      expect(resBlockedId.statusCode).toBe(403);
      expect(resBlockedId.json().error.code).toBe("FORBIDDEN");
    });
  });
});
