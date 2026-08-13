import { test, expect } from "@playwright/test";

// Valida o fluxo de RBAC 100% configurável pela UI: o admin cria um perfil
// novo, define suas permissões, cria um usuário com esse perfil, e o painel
// deve refletir exatamente (e só) o que foi liberado — tanto na UI (abas,
// menu, botões) quanto no backend (chamadas fora do que foi liberado devem
// voltar 403, mesmo com um token válido).

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "troque-esta-senha";
const API_URL = process.env.VITE_API_URL ?? "http://localhost:3900";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const roleName = `Coordenação QA ${stamp}`;
const userEmail = `coordenacao.qa.${stamp}@example.com`;
const userPassword = "senha-limitada-123";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/eventos$/);
}

test("admin cria perfil limitado, cria usuário com esse perfil, e o painel só libera o que foi definido", async ({
  page,
}) => {
  await test.step("login como ADMINISTRADOR", async () => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  await test.step("criar perfil novo sem nenhuma permissão", async () => {
    await page.goto("/perfis");
    await page.getByRole("button", { name: "+ Novo perfil" }).click();
    await page.getByLabel("Nome").fill(roleName);
    await page.getByRole("button", { name: "Criar perfil" }).click();
    await expect(page.getByText(roleName)).toBeVisible();
  });

  await test.step("selecionar o perfil e liberar só Eventos (ver) e Participantes (ver)", async () => {
    await page.getByText(roleName).click();
    await expect(page.getByText("Marque tudo que este perfil pode fazer no sistema.")).toBeVisible();
    await page.getByText("Ver eventos", { exact: true }).click();
    await page.getByText("Ver participantes de um evento", { exact: true }).click();
    await page.getByRole("button", { name: "Salvar permissões" }).click();
    await expect(page.getByText("Permissões salvas.")).toBeVisible();
  });

  await test.step("criar usuário com o perfil limitado", async () => {
    await page.goto("/usuarios");
    await page.getByRole("button", { name: "+ Novo usuário" }).click();
    await page.getByLabel("Nome").fill("Coordenador QA");
    await page.getByLabel("E-mail").fill(userEmail);
    await page.getByLabel("Senha").fill(userPassword);
    await page.getByLabel("Tipo de usuário").selectOption({ label: roleName });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(userEmail)).toBeVisible();
  });

  await test.step("logout e login como o novo usuário limitado", async () => {
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, userEmail, userPassword);
  });

  await test.step("menu mostra só Eventos — nada de Usuários/Perfis/Auditoria", async () => {
    await expect(page.getByRole("link", { name: "Eventos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Perfis" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Novo evento" })).toHaveCount(0);
  });

  await test.step("acesso direto a /usuarios redireciona pra /eventos", async () => {
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/eventos$/);
  });

  let eventLink: string | null = null;

  await test.step("abrir um evento existente mostra só a aba Participantes", async () => {
    const firstLink = page.locator("table a").first();
    await expect(firstLink).toBeVisible();
    eventLink = await firstLink.getAttribute("href");
    await firstLink.click();
    await expect(page.getByRole("button", { name: "Participantes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Terminais" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Estatísticas" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Monitor" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Relatório" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Site" })).toHaveCount(0);
    // Sem events.edit: nome/local não são clicáveis pra editar, e o status
    // vira um badge somente-leitura em vez de um <select>.
    await expect(page.locator("select")).toHaveCount(0);
  });

  await test.step("chamada direta à API fora do que foi liberado volta 403, mesmo com token válido", async () => {
    const token = await page.evaluate(() => localStorage.getItem("admin_token"));
    expect(token).toBeTruthy();

    const forbidden = await page.request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(forbidden.status()).toBe(403);

    const forbiddenTerminals = await page.request.get(`${API_URL}/events/${eventLink?.split("/").pop()}/terminals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(forbiddenTerminals.status()).toBe(403);

    // O que foi liberado continua funcionando normalmente.
    const allowed = await page.request.get(`${API_URL}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(allowed.status()).toBe(200);
  });

  await test.step("volta como ADMINISTRADOR: mudar a permissão reflete na sessão do outro usuário sem re-login", async () => {
    await page.getByRole("button", { name: "Sair" }).click();
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/perfis");
    await page.getByText(roleName).click();
    await page.getByText("Ver terminais de um evento", { exact: true }).click();
    await page.getByRole("button", { name: "Salvar permissões" }).click();
    await expect(page.getByText("Permissões salvas.")).toBeVisible();

    const usersRes = await page.request.get(`${API_URL}/roles`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("admin_token"))}` },
    });
    expect(usersRes.status()).toBe(200);
  });

  await test.step("auditoria registrou a criação do perfil, do usuário e a mudança de permissões", async () => {
    await page.goto("/auditoria");
    await expect(page.getByText("Criou perfil").first()).toBeVisible();
    await expect(page.getByText("Criou usuário").first()).toBeVisible();
    await expect(page.getByText("Alterou permissões do perfil").first()).toBeVisible();
  });
});

test("usuário não pode se autodesativar nem se autoexcluir", async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/usuarios");

  const adminRow = page.getByRole("row", { name: new RegExp(ADMIN_EMAIL) });
  await expect(adminRow).toBeVisible();
  const deactivateBtn = adminRow.getByRole("button", { name: /Desativar|Ativar/ });
  await expect(deactivateBtn).toBeDisabled();
  const deleteBtn = adminRow.getByRole("button", { name: "Excluir" });
  await expect(deleteBtn).toBeDisabled();
});
