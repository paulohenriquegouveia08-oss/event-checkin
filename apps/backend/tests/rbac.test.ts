import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestRole, createTestUserWithRole, ensureAdminRole, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function login(email: string, password: string) {
  const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return response;
}

describe("POST /auth/login", () => {
  it("devolve perfil e permissões junto do token", async () => {
    const { user, password } = await createTestAdmin();
    const response = await login(user.email, password);

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.user.role.key).toBe("ADMINISTRADOR");
    expect(body.user.role.isSystem).toBe(true);
    expect(body.user.permissions).toBe("ALL");
  });

  it("rejeita usuário desativado com a mesma mensagem genérica (não vaza que a conta existe)", async () => {
    const { user, password } = await createTestAdmin();
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const response = await login(user.email, password);
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("E-mail ou senha inválidos");
  });

  it("registra lastLoginAt após login bem-sucedido", async () => {
    const { user, password } = await createTestAdmin();
    expect(user.lastLoginAt).toBeNull();

    await login(user.email, password);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.lastLoginAt).not.toBeNull();
  });
});

describe("requirePermission", () => {
  it("bloqueia (403) usuário cujo perfil não tem a permissão exigida", async () => {
    const role = await createTestRole("Convidado", []); // sem nenhuma permissão
    const { user, password } = await createTestUserWithRole(role.id, "convidado@teste.com");
    const loginResponse = await login(user.email, password);
    const token = loginResponse.json().data.token;

    const response = await app.inject({
      method: "GET",
      url: "/events",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("libera quando o perfil tem exatamente a permissão exigida", async () => {
    const role = await createTestRole("Só Ver Eventos", ["events.view"]);
    const { user, password } = await createTestUserWithRole(role.id, "leitor@teste.com");
    const loginResponse = await login(user.email, password);
    const token = loginResponse.json().data.token;

    const response = await app.inject({
      method: "GET",
      url: "/events",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it("perfil isSystem (ADMINISTRADOR) passa em qualquer permissão sem estar em role_permissions", async () => {
    const { user, password } = await createTestAdmin();
    const loginResponse = await login(user.email, password);
    const token = loginResponse.json().data.token;

    const response = await app.inject({
      method: "GET",
      url: "/users",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it("mudar as permissões de um perfil reflete imediatamente numa sessão já aberta (sem novo login)", async () => {
    const role = await createTestRole("Dinâmico", []);
    const { user, password } = await createTestUserWithRole(role.id, "dinamico@teste.com");
    const loginResponse = await login(user.email, password);
    const token = loginResponse.json().data.token;

    const before = await app.inject({ method: "GET", url: "/events", headers: { authorization: `Bearer ${token}` } });
    expect(before.statusCode).toBe(403);

    const eventsPermission = await prisma.permission.findUniqueOrThrow({ where: { key: "events.view" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: eventsPermission.id } });

    const after = await app.inject({ method: "GET", url: "/events", headers: { authorization: `Bearer ${token}` } });
    expect(after.statusCode).toBe(200);
  });

  it("usuário desativado no meio da sessão perde acesso mesmo com token ainda válido", async () => {
    const { user, password } = await createTestAdmin();
    const loginResponse = await login(user.email, password);
    const token = loginResponse.json().data.token;

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const response = await app.inject({ method: "GET", url: "/events", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
  });
});

describe("Roles CRUD", () => {
  async function adminToken() {
    const { user, password } = await createTestAdmin();
    const res = await login(user.email, password);
    return res.json().data.token as string;
  }

  it("cria perfil novo com key derivada do nome, sem nenhuma permissão por padrão", async () => {
    const token = await adminToken();
    const response = await app.inject({
      method: "POST",
      url: "/roles",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Coordenação do Evento", description: "Time operacional" },
    });

    expect(response.statusCode).toBe(201);
    const role = response.json().data;
    expect(role.key).toBe("COORDENACAO_DO_EVENTO");
    expect(role.isSystem).toBe(false);
    expect(role.permissionKeys).toEqual([]);
  });

  it("define permissões de um perfil via PUT /roles/:id/permissions", async () => {
    const token = await adminToken();
    const createResponse = await app.inject({
      method: "POST",
      url: "/roles",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Tester" },
    });
    const roleId = createResponse.json().data.id;

    const response = await app.inject({
      method: "PUT",
      url: `/roles/${roleId}/permissions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { permissionKeys: ["events.view", "participants.view"] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.permissionKeys.sort()).toEqual(["events.view", "participants.view"]);
  });

  it("rejeita permissão desconhecida (não deixa inventar permissão que não existe no catálogo)", async () => {
    const token = await adminToken();
    const createResponse = await app.inject({
      method: "POST",
      url: "/roles",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Tester2" },
    });
    const roleId = createResponse.json().data.id;

    const response = await app.inject({
      method: "PUT",
      url: `/roles/${roleId}/permissions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { permissionKeys: ["isso.nao.existe"] },
    });
    expect(response.statusCode).toBe(422);
  });

  it("não deixa excluir o perfil ADMINISTRADOR (isSystem)", async () => {
    const token = await adminToken();
    const adminRole = await ensureAdminRole();

    const response = await app.inject({
      method: "DELETE",
      url: `/roles/${adminRole.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("não deixa excluir perfil que ainda tem usuário vinculado", async () => {
    const token = await adminToken();
    const role = await createTestRole("Com Usuário");
    await createTestUserWithRole(role.id, "vinculado@teste.com");

    const response = await app.inject({
      method: "DELETE",
      url: `/roles/${role.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(409);
  });

  it("exclui perfil sem usuários vinculados normalmente", async () => {
    const token = await adminToken();
    const role = await createTestRole("Sem Usuário");

    const response = await app.inject({
      method: "DELETE",
      url: `/roles/${role.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(204);
  });
});

describe("Users CRUD", () => {
  async function adminSession() {
    const { user, password } = await createTestAdmin();
    const res = await login(user.email, password);
    return { token: res.json().data.token as string, adminUserId: user.id };
  }

  it("cria usuário vinculado a um perfil e consegue logar com ele depois", async () => {
    const { token } = await adminSession();
    const role = await createTestRole("Operador", ["events.view"]);

    const createResponse = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Operador Um", email: "operador@teste.com", password: "senha12345", roleId: role.id },
    });
    expect(createResponse.statusCode).toBe(201);

    const loginResponse = await login("operador@teste.com", "senha12345");
    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json().data.user.role.key).toBe(role.key);
  });

  it("rejeita e-mail duplicado", async () => {
    const { token } = await adminSession();
    const role = await createTestRole("Duplicado");
    await createTestUserWithRole(role.id, "existente@teste.com");

    const response = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Outro", email: "existente@teste.com", password: "senha12345", roleId: role.id },
    });
    expect(response.statusCode).toBe(409);
  });

  it("desativa usuário e ele deixa de conseguir logar", async () => {
    const { token } = await adminSession();
    const role = await createTestRole("Desativável");
    const { user } = await createTestUserWithRole(role.id, "desativar@teste.com", "senha12345");

    const response = await app.inject({
      method: "POST",
      url: `/users/${user.id}/toggle-active`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(200);

    const loginResponse = await login("desativar@teste.com", "senha12345");
    expect(loginResponse.statusCode).toBe(401);
  });

  it("não deixa o usuário desativar a própria conta", async () => {
    const { token, adminUserId } = await adminSession();
    const response = await app.inject({
      method: "POST",
      url: `/users/${adminUserId}/toggle-active`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(403);
  });

  it("não deixa o usuário excluir a própria conta", async () => {
    const { token, adminUserId } = await adminSession();
    const response = await app.inject({
      method: "DELETE",
      url: `/users/${adminUserId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("não deixa desativar o último usuário ativo com perfil ADMINISTRADOR", async () => {
    const { adminUserId } = await adminSession();

    // Um "gerente de usuários" comum (não-ADMINISTRADOR) que só tem
    // permissão pra ativar/desativar — usado aqui pra isolar a checagem
    // de "último ADMINISTRADOR" da checagem de "não pode desativar a
    // própria conta" (que é uma regra diferente, já coberta no teste acima).
    const managerRole = await createTestRole("Gerente de Usuários", ["users.toggle_active", "users.view"]);
    const { user: manager, password: managerPassword } = await createTestUserWithRole(
      managerRole.id,
      "gerente@teste.com"
    );
    const managerToken = (await login(manager.email, managerPassword)).json().data.token;

    // Só existe 1 usuário ADMINISTRADOR ativo (o do adminSession()) —
    // o gerente tentando desativá-lo deve ser bloqueado.
    const response = await app.inject({
      method: "POST",
      url: `/users/${adminUserId}/toggle-active`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(403);

    // Confirma que com um segundo ADMINISTRADOR ativo, a desativação do
    // primeiro já funciona normalmente.
    const adminRole = await ensureAdminRole();
    await createTestUserWithRole(adminRole.id, "segundo-admin@teste.com");

    const secondResponse = await app.inject({
      method: "POST",
      url: `/users/${adminUserId}/toggle-active`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { isActive: false },
    });
    expect(secondResponse.statusCode).toBe(200);
  });
});

describe("GET /audit-logs", () => {
  it("registra e lista ações administrativas sensíveis", async () => {
    const { user, password } = await createTestAdmin();
    const token = (await login(user.email, password)).json().data.token;

    await app.inject({
      method: "POST",
      url: "/roles",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Perfil Auditado" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/audit-logs",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const logs = response.json().data;
    expect(logs.some((l: { action: string }) => l.action === "role.create")).toBe(true);
  });
});
