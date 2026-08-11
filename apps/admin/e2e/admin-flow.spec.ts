import { test, expect } from "@playwright/test";

// Testa o painel contra um backend real rodando (ver apps/admin/e2e/README.md
// ou docs/installation.md) — não é um teste de unidade com mocks. Cobre o
// caminho crítico completo: login -> criar evento -> criar participante ->
// ver QR -> importar CSV -> criar terminal -> ver código de ativação ->
// estatísticas refletindo os check-ins reais.

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "troque-esta-senha";

test.describe.configure({ mode: "serial" });

test("fluxo completo do painel administrativo", async ({ page }) => {
  const eventName = `Evento E2E ${Date.now()}`;

  await test.step("login", async () => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
    await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/eventos$/);
  });

  await test.step("criar evento", async () => {
    await page.getByRole("button", { name: "+ Novo evento" }).click();
    await page.getByLabel("Nome do evento").fill(eventName);
    await page.getByLabel("Início").fill("2026-09-01T09:00");
    await page.getByLabel("Fim").fill("2026-09-03T18:00");
    await page.getByLabel("Local").fill("Centro de Convenções");
    await page.getByRole("button", { name: "Criar evento" }).click();
    await expect(page.getByRole("link", { name: eventName })).toBeVisible();
  });

  await test.step("abrir o evento criado", async () => {
    await page.getByRole("link", { name: eventName }).click();
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
  });

  await test.step("criar participante", async () => {
    await page.getByRole("button", { name: "+ Novo participante" }).click();
    await page.getByLabel("Nome").fill("Maria Teste E2E");
    await page.getByLabel("E-mail").fill("maria.e2e@example.com");
    await page.getByRole("button", { name: "Criar participante" }).click();
    await expect(page.getByText("Maria Teste E2E")).toBeVisible();
  });

  await test.step("ver QR Code do participante", async () => {
    await page.getByRole("button", { name: "Ver QR" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#credential-qr")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Maria Teste E2E" })).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar" }).click();
  });

  await test.step("gerar novo QR Code (rotacionar token)", async () => {
    await page.getByRole("button", { name: "Gerar novo QR" }).click();
    await expect(page.getByText("Maria Teste E2E")).toBeVisible();
    // Precisa checar isso explicitamente: a chamada pode falhar (500) sem
    // quebrar nada visualmente na tela se o erro não for de fato exibido.
    await expect(page.locator(".error-text")).toHaveCount(0);
  });

  await test.step("revogar e reativar participante", async () => {
    const row = page.getByRole("row", { name: /Maria Teste E2E/ });
    await row.getByRole("button", { name: "Revogar" }).click();
    await expect(row.getByText("Cancelado")).toBeVisible();
    await row.getByRole("button", { name: "Reativar" }).click();
    await expect(row.locator(".badge", { hasText: "Ativo" })).toBeVisible();
  });

  await test.step("importar participantes via CSV", async () => {
    await page.getByRole("button", { name: "Importar CSV" }).click();
    await page
      .locator("textarea")
      .fill("nome,email,telefone,documento\nJoão E2E,joao.e2e@example.com,43999999999,11122233344");
    await page.getByRole("button", { name: "Pré-visualizar" }).click();
    await expect(page.getByText("1 válidos")).toBeVisible();
    await page.getByRole("button", { name: /Confirmar importação/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "João E2E" })).toBeVisible();
  });

  await test.step("criar terminal e ver código de ativação", async () => {
    await page.getByRole("button", { name: "Terminais" }).click();
    await page.getByLabel(/Nome do terminal/).fill("Entrada E2E");
    await page.getByRole("button", { name: "+ Criar terminal" }).click();
    await expect(page.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Entrada E2E" })).toBeVisible();
  });

  await test.step("excluir o terminal", async () => {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("row", { name: /Entrada E2E/ }).getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("cell", { name: "Entrada E2E" })).toHaveCount(0);
  });

  await test.step("ver estatísticas do evento", async () => {
    await page.getByRole("button", { name: "Estatísticas" }).click();
    const registeredCard = page.locator(".card", { hasText: "Inscritos" });
    await expect(registeredCard).toBeVisible();
    await expect(registeredCard.getByText("2", { exact: true })).toBeVisible(); // Maria + João
  });
});

test("login com senha errada mostra erro e não navega", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill("senha-errada-de-proposito");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/inválid/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("rota protegida redireciona pro login sem sessão", async ({ page }) => {
  await page.goto("/eventos");
  await expect(page).toHaveURL(/\/login$/);
});
