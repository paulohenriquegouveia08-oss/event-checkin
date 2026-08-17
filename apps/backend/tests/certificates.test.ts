import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createAttendeeToken,
  createEndedTestEvent,
  createTestAdmin,
  createTestCheckIn,
  createTestEvent,
  createTestParticipant,
  createTestRole,
  createTestUserWithRole,
  resetDatabase,
} from "./helpers.js";
import { isEligible, resolveDisplayStatus } from "../src/modules/certificates/certificate-eligibility.service.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function loginAdmin(email = "admin@teste.com", password = "senha-forte-123") {
  await createTestAdmin(email, password);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().data.token as string;
}

describe("regra de elegibilidade (unidade)", () => {
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2999-01-01T00:00:00Z");

  it("não elegível enquanto o evento não terminou, mesmo com presença", () => {
    const result = isEligible({ event: { endDate: future }, hasCheckIn: true });
    expect(result).toEqual({ eligible: false, reason: "EVENT_NOT_ENDED" });
  });

  it("não elegível sem presença, mesmo com o evento encerrado", () => {
    const result = isEligible({ event: { endDate: past }, hasCheckIn: false });
    expect(result).toEqual({ eligible: false, reason: "NOT_PRESENT" });
  });

  it("elegível só quando evento encerrado E presença confirmada", () => {
    const result = isEligible({ event: { endDate: past }, hasCheckIn: true });
    expect(result).toEqual({ eligible: true, reason: null });
  });

  it("status GENERATED/REVOKED nunca regride mesmo se a elegibilidade recalculada mudar", () => {
    expect(resolveDisplayStatus({ eligibility: { eligible: false, reason: "NOT_PRESENT" }, persistedStatus: "GENERATED" })).toBe(
      "GENERATED"
    );
    expect(resolveDisplayStatus({ eligibility: { eligible: true, reason: null }, persistedStatus: "REVOKED" })).toBe("REVOKED");
    expect(resolveDisplayStatus({ eligibility: { eligible: true, reason: null }, persistedStatus: null })).toBe("ELIGIBLE");
    expect(resolveDisplayStatus({ eligibility: { eligible: false, reason: "EVENT_NOT_ENDED" }, persistedStatus: null })).toBe(
      "LOCKED"
    );
  });
});

describe("GET /events/:eventId/my-documents", () => {
  it("LOCKED (EVENT_NOT_ENDED) quando o evento ainda não terminou", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/my-documents`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const { certificate } = res.json().data;
    expect(certificate.status).toBe("LOCKED");
    expect(certificate.reason).toBe("EVENT_NOT_ENDED");
    expect(certificate.canDownload).toBe(false);
  });

  it("LOCKED (NOT_PRESENT) quando o evento terminou mas não houve check-in", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/my-documents`,
      headers: { authorization: `Bearer ${token}` },
    });

    const { certificate, attendanceProof } = res.json().data;
    expect(certificate.status).toBe("LOCKED");
    expect(certificate.reason).toBe("NOT_PRESENT");
    expect(attendanceProof.available).toBe(false);
  });

  it("ELIGIBLE (pode baixar) quando o evento terminou e há presença", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id);
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/my-documents`,
      headers: { authorization: `Bearer ${token}` },
    });

    const { certificate, attendanceProof } = res.json().data;
    expect(certificate.status).toBe("ELIGIBLE");
    expect(certificate.canDownload).toBe(true);
    expect(attendanceProof.available).toBe(true);
  });
});

describe("download do certificado", () => {
  it("403 ao tentar baixar sem ser elegível", async () => {
    const event = await createTestEvent(); // ainda não terminou
    const participant = await createTestParticipant(event.id);
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("200 + PDF quando elegível, e reaproveita o mesmo arquivo no segundo download", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id);
    const token = await createAttendeeToken(app, participant);

    const first = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.headers["content-type"]).toBe("application/pdf");
    expect(first.rawPayload.length).toBeGreaterThan(1000);

    const afterFirst = await prisma.certificate.findUnique({ where: { eventId_participantId: { eventId: event.id, participantId: participant.id } } });
    expect(afterFirst?.status).toBe("GENERATED");
    expect(afterFirst?.generatedAt).not.toBeNull();

    const second = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(second.statusCode).toBe(200);

    const afterSecond = await prisma.certificate.findUnique({ where: { eventId_participantId: { eventId: event.id, participantId: participant.id } } });
    // Não regenerou — mesmo generatedAt do primeiro download.
    expect(afterSecond?.generatedAt?.getTime()).toBe(afterFirst?.generatedAt?.getTime());

    // Auditoria: gerou uma vez, baixou duas.
    const logs = await prisma.auditLog.findMany({ where: { entityType: "Certificate" }, orderBy: { createdAt: "asc" } });
    expect(logs.filter((l) => l.action === "certificate.generated")).toHaveLength(1);
    expect(logs.filter((l) => l.action === "certificate.downloaded")).toHaveLength(2);
  });

  it("um participante nunca consegue baixar o certificado de outro (id sempre vem do token)", async () => {
    const event = await createEndedTestEvent();
    const a = await createTestParticipant(event.id, { name: "Participante A" });
    const b = await createTestParticipant(event.id, { name: "Participante B" });
    await createTestCheckIn(event.id, a.id);
    await createTestCheckIn(event.id, b.id);

    const tokenA = await createAttendeeToken(app, a);
    const tokenB = await createAttendeeToken(app, b);

    const resA = await app.inject({
      method: "GET",
      url: `/events/${event.id}/my-documents`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const resB = await app.inject({
      method: "GET",
      url: `/events/${event.id}/my-documents`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    // Não há parâmetro de participantId em nenhuma rota — o id vem só do
    // JWT verificado (ver requireAttendee) — então não existe "trocar o id
    // na URL" possível aqui. O teste confirma que cada token só resolve
    // pros próprios dados.
    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);

    await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    const certA = await prisma.certificate.findUnique({ where: { eventId_participantId: { eventId: event.id, participantId: a.id } } });
    const certB = await prisma.certificate.findUnique({ where: { eventId_participantId: { eventId: event.id, participantId: b.id } } });
    expect(certA?.status).toBe("GENERATED");
    expect(certB).toBeNull(); // baixar como A nunca cria/afeta o certificado de B
  });

  it("token de attendee de um evento não abre /my-documents de outro evento", async () => {
    const eventA = await createEndedTestEvent({ name: "Evento A" });
    const eventB = await createEndedTestEvent({ name: "Evento B" });
    const participant = await createTestParticipant(eventA.id);
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${eventB.id}/my-documents`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("certificado revogado não pode mais ser baixado", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id);
    const attendeeToken = await createAttendeeToken(app, participant);

    await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${attendeeToken}` },
    });
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
    });

    const adminToken = await loginAdmin();
    const revokeRes = await app.inject({
      method: "POST",
      url: `/certificates/${certificate.id}/revoke`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(revokeRes.statusCode).toBe(200);

    const retryDownload = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${attendeeToken}` },
    });
    expect(retryDownload.statusCode).toBe(403);
  });
});

describe("comprovante de presença", () => {
  it("disponível assim que há check-in, mesmo com o evento ainda em andamento", async () => {
    const event = await createTestEvent(); // não terminou
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id, new Date());
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/attendance-proof/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
  });

  it("403 sem check-in", async () => {
    const event = await createTestEvent();
    const participant = await createTestParticipant(event.id);
    const token = await createAttendeeToken(app, participant);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/attendance-proof/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("validação pública do certificado", () => {
  it("404 pra código inexistente", async () => {
    const res = await app.inject({ method: "GET", url: "/public/certificates/cert_nao-existe" });
    expect(res.statusCode).toBe(404);
  });

  it("404 pra um certificado que ainda não foi gerado (LOCKED/ELIGIBLE)", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id);
    const token = await createAttendeeToken(app, participant);

    // consulta "meus documentos" não gera PDF nenhum — status fica ELIGIBLE
    await app.inject({ method: "GET", url: `/events/${event.id}/my-documents`, headers: { authorization: `Bearer ${token}` } });

    const adminToken = await loginAdmin();
    await app.inject({
      method: "POST",
      url: `/events/${event.id}/certificates/release`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
    });
    expect(certificate.status).toBe("LOCKED"); // release só cria a linha, não gera PDF

    const res = await app.inject({ method: "GET", url: `/public/certificates/${certificate.verificationCode}` });
    expect(res.statusCode).toBe(404);
  });

  it("200 com dados públicos mínimos depois de gerado; sinaliza revogado quando revogado", async () => {
    const event = await createEndedTestEvent({ name: "Evento Público" });
    const participant = await createTestParticipant(event.id, { name: "Fulano de Tal" });
    await createTestCheckIn(event.id, participant.id);
    const attendeeToken = await createAttendeeToken(app, participant);

    await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${attendeeToken}` },
    });
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
    });

    const res = await app.inject({ method: "GET", url: `/public/certificates/${certificate.verificationCode}` });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.valid).toBe(true);
    expect(data.participantName).toBe("Fulano de Tal");
    expect(data.eventName).toBe("Evento Público");

    const adminToken = await loginAdmin();
    await app.inject({
      method: "POST",
      url: `/certificates/${certificate.id}/revoke`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const afterRevoke = await app.inject({ method: "GET", url: `/public/certificates/${certificate.verificationCode}` });
    expect(afterRevoke.statusCode).toBe(200);
    expect(afterRevoke.json().data.revoked).toBe(true);
    expect(afterRevoke.json().data.valid).toBe(false);
  });
});

describe("GET /events/:eventId/certificates/preview", () => {
  it("gera o PDF de teste mesmo com o evento em andamento e sem nenhum participante presente", async () => {
    const event = await createTestEvent(); // não terminou
    const adminToken = await loginAdmin();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/preview?name=${encodeURIComponent("Fulano de Teste")}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.length).toBeGreaterThan(1000);
  });

  it("não cria nenhuma linha em Certificate nem mexe nas estatísticas", async () => {
    const event = await createTestEvent();
    const adminToken = await loginAdmin();

    await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/preview`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const count = await prisma.certificate.count({ where: { eventId: event.id } });
    expect(count).toBe(0);
  });

  it("exige a permissão certificates.view", async () => {
    const event = await createTestEvent();
    const roleWithoutPermission = await createTestRole("Sem Acesso", []);
    const { user, password } = await createTestUserWithRole(roleWithoutPermission.id, "sem-acesso@teste.com");
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
    const token = loginRes.json().data.token as string;

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/preview`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /events/:eventId — certificateSettings (texto do certificado)", () => {
  it("salva e reflete carga horária, local, texto e signatários customizados", async () => {
    const event = await createTestEvent();
    const adminToken = await loginAdmin();

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        certificateSettings: {
          workloadHours: 40,
          closingText: "Texto customizado de encerramento.",
          locationLabel: "Curitiba/PR",
          signatories: [{ name: "Fulano de Tal", role: "Diretor" }],
        },
      },
    });
    expect(patchRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: "GET",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.json().data.certificateSettings).toEqual({
      workloadHours: 40,
      closingText: "Texto customizado de encerramento.",
      locationLabel: "Curitiba/PR",
      signatories: [{ name: "Fulano de Tal", role: "Diretor" }],
    });
  });

  it("exige events.edit (certificates.issue sozinho não basta)", async () => {
    const event = await createTestEvent();
    const issueOnlyRole = await createTestRole("Emissor de Certificados", ["certificates.view", "certificates.issue"]);
    const { user, password } = await createTestUserWithRole(issueOnlyRole.id, "emissor@teste.com");
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
    const token = loginRes.json().data.token as string;

    const res = await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { certificateSettings: { workloadHours: 4 } },
    });
    expect(res.statusCode).toBe(403);
  });

  it("um certificado gerado depois da mudança usa a nova configuração (carga horária customizada)", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id);
    const adminToken = await loginAdmin();

    await app.inject({
      method: "PATCH",
      url: `/events/${event.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { certificateSettings: { workloadHours: 4, locationLabel: "Maringá/PR" } },
    });

    const attendeeToken = await createAttendeeToken(app, participant);
    const download = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${attendeeToken}` },
    });
    expect(download.statusCode).toBe(200);

    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
    });
    // Snapshot da carga horária vigente no momento da geração.
    expect(certificate.workloadHours).toBe(4);
  });
});

describe("administração", () => {
  it("bloqueia liberação de certificados antes do evento terminar", async () => {
    const event = await createTestEvent(); // não terminou
    const adminToken = await loginAdmin();

    const res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/certificates/release`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(422);
  });

  it("exige a permissão certificates.issue pra revogar (certificates.view não basta)", async () => {
    const event = await createEndedTestEvent();
    const participant = await createTestParticipant(event.id);
    await createTestCheckIn(event.id, participant.id);
    const attendeeToken = await createAttendeeToken(app, participant);
    await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${attendeeToken}` },
    });
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
    });

    const viewOnlyRole = await createTestRole("Auditor de Certificados", ["certificates.view"]);
    const { user, password } = await createTestUserWithRole(viewOnlyRole.id, "auditor@teste.com");
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
    const viewOnlyToken = loginRes.json().data.token as string;

    const res = await app.inject({
      method: "POST",
      url: `/certificates/${certificate.id}/revoke`,
      headers: { authorization: `Bearer ${viewOnlyToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("estatísticas contam presentes/elegíveis/gerados corretamente", async () => {
    const event = await createEndedTestEvent();
    const present1 = await createTestParticipant(event.id, { name: "P1" });
    const present2 = await createTestParticipant(event.id, { name: "P2" });
    await createTestParticipant(event.id, { name: "Ausente" }); // sem check-in
    await createTestCheckIn(event.id, present1.id);
    await createTestCheckIn(event.id, present2.id);

    const token1 = await createAttendeeToken(app, present1);
    await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/download`,
      headers: { authorization: `Bearer ${token1}` },
    });

    const adminToken = await loginAdmin();
    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/stats`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const stats = res.json().data;
    expect(stats.totalParticipants).toBe(3);
    expect(stats.present).toBe(2);
    expect(stats.eligible).toBe(2);
    expect(stats.generated).toBe(1);
    expect(stats.pending).toBe(1);
  });
});
