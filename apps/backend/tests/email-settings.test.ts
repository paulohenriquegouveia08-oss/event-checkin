import { describe, expect, it } from "vitest";

import {
  emailSettingsSchema,
  formatarRemetente,
  resolveEmailSettings,
} from "../src/lib/email/email-settings.js";
import { escaparHtml, montarEmail } from "../src/lib/email/email-layout.js";
import { chaveDeIdempotencia } from "../src/lib/email/email.service.js";

describe("configuração de e-mail por evento", () => {
  it("evento sem configuração continua com os valores do COPOL", () => {
    // É a garantia de que a mudança não altera o evento que já envia
    // e-mail hoje: nulo no banco significa "como sempre foi".
    const s = resolveEmailSettings(null);
    expect(s.primaryColor).toBe("#0E3634");
    expect(s.accentColor).toBe("#C8A261");
    expect(s.fromEmail).toContain("@");
  });

  it("cada evento manda na própria marca e no próprio endereço", () => {
    const s = resolveEmailSettings({
      fromName: "Semantix 2026",
      fromEmail: "contato@semantix.com.br",
      primaryColor: "#101828",
      accentColor: "#7F56D9",
      siteUrl: "https://semantix.com.br",
    });
    expect(formatarRemetente(s)).toBe("Semantix 2026 <contato@semantix.com.br>");
    expect(s.primaryColor).toBe("#101828");
    expect(s.siteUrl).toBe("https://semantix.com.br");
  });

  it("configuração corrompida cai no padrão em vez de derrubar o envio", () => {
    // Um JSON inválido no banco não pode impedir o comprovante de sair.
    const s = resolveEmailSettings({ primaryColor: "verde", fromEmail: "isso-não-é-email" });
    expect(s.primaryColor).toBe("#0E3634");
    expect(s.fromEmail).toContain("@");
  });

  it("recusa cor e e-mail inválidos na hora de salvar", () => {
    expect(emailSettingsSchema.safeParse({ primaryColor: "#GGGGGG" }).success).toBe(false);
    expect(emailSettingsSchema.safeParse({ fromEmail: "sem-arroba" }).success).toBe(false);
    expect(emailSettingsSchema.safeParse({ fromEmail: "ok@dominio.com" }).success).toBe(true);
  });

  it("só o comprovante de inscrição sai sozinho por padrão", () => {
    // Ligar envio em massa sem alguém pedir seria o sistema decidindo
    // sobre a caixa de entrada de terceiros.
    const s = resolveEmailSettings(null);
    expect(s.autoSendReceipt).toBe(true);
    expect(s.autoSendCertificate).toBe(false);
    expect(s.autoSendAttendanceProof).toBe(false);
  });

  it("remetente sem nome sai só como endereço", () => {
    const s = resolveEmailSettings({ fromName: undefined, fromEmail: "a@b.com" });
    expect(formatarRemetente({ ...s, fromName: "" })).toBe("a@b.com");
  });
});

describe("montagem do HTML", () => {
  const base = resolveEmailSettings({ primaryColor: "#101828", accentColor: "#7F56D9" });

  it("usa as cores do evento, e não as do COPOL", () => {
    const html = montarEmail({
      settings: base, eventName: "Semantix", eyebrow: "X", subtitle: "Y", body: "<p>z</p>",
    });
    expect(html).toContain("#101828");
    expect(html).not.toContain("#0E3634");
  });

  it("escapa o que vem do banco", () => {
    // Nome de evento é texto editável no painel; sem escapar, um "<" no
    // nome quebraria o HTML do e-mail de todo mundo.
    expect(escaparHtml('Ana & "Bia" <b>')).toBe("Ana &amp; &quot;Bia&quot; &lt;b&gt;");
    const html = montarEmail({
      settings: base, eventName: '<script>alert(1)</script>', eyebrow: "X", subtitle: "Y", body: "",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("chave de idempotência", () => {
  it("é estável para o envio automático", () => {
    // O webhook de pagamento é reenviado pelo provedor. Sem chave
    // estável, a pessoa recebe o comprovante duas vezes.
    expect(chaveDeIdempotencia("receipt", "insc-1")).toBe(chaveDeIdempotencia("receipt", "insc-1"));
  });

  it("muda a cada reenvio pedido por alguém", () => {
    // Senão o botão "reenviar" do painel não faria nada, engolido pela
    // própria proteção contra duplicata.
    const a = chaveDeIdempotencia("receipt", "insc-1", true);
    const b = chaveDeIdempotencia("receipt", "insc-1", true);
    expect(a).not.toBe(b);
  });

  it("separa documentos diferentes do mesmo participante", () => {
    expect(chaveDeIdempotencia("proof", "e:p")).not.toBe(chaveDeIdempotencia("cert:v1", "e:p"));
  });

  it("respeita o teto de 256 caracteres do Resend", () => {
    expect(chaveDeIdempotencia("t".repeat(300), "x".repeat(300)).length).toBeLessThanOrEqual(256);
  });
});

describe("remetente de provedor gratuito", () => {
  it("gmail.com é recusado com explicação própria, não com 'verifique o domínio'", async () => {
    // O erro genérico sugere que bastaria verificar. Verificar gmail.com
    // exigiria criar DNS no domínio do Google — é impossível, não é uma
    // etapa pendente. Confundir as duas coisas custa dias de tentativa.
    const { conferirRemetente } = await import("../src/lib/email/dominios-verificados.js");
    const r = await conferirRemetente("alguem@gmail.com");
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/impossível/i);
  });
});
