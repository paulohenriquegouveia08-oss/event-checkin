import type { PrismaClient } from "@prisma/client";

/**
 * Catálogo de permissões do sistema — cada entrada corresponde a um ponto
 * real de checagem em algum endpoint (ver requirePermission() em
 * middleware/auth.ts e onde cada key é usada nas *.routes.ts). Definido em
 * código porque uma permissão só existe de fato se algo no backend
 * realmente a impõe; o que é 100% livre pra o ADMINISTRADOR configurar
 * pela UI é qual perfil tem qual permissão (tabela role_permissions),
 * não quais permissões existem.
 *
 * seedPermissions() é idempotente (upsert por key) — roda no boot do
 * backend, então adicionar uma permissão nova aqui já aparece no catálogo
 * pro admin atribuir, sem precisar de migration.
 */
export interface PermissionDef {
  key: string;
  description: string;
  category: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // Usuários
  { key: "users.view", description: "Ver lista de usuários", category: "Usuários" },
  { key: "users.create", description: "Criar usuário", category: "Usuários" },
  { key: "users.edit", description: "Editar usuário (nome, e-mail, perfil)", category: "Usuários" },
  { key: "users.delete", description: "Excluir usuário", category: "Usuários" },
  { key: "users.toggle_active", description: "Ativar/desativar usuário", category: "Usuários" },

  // Perfis e permissões
  { key: "roles.view", description: "Ver perfis e suas permissões", category: "Perfis" },
  { key: "roles.create", description: "Criar perfil novo", category: "Perfis" },
  { key: "roles.edit", description: "Editar nome/descrição de um perfil", category: "Perfis" },
  { key: "roles.delete", description: "Excluir perfil", category: "Perfis" },
  { key: "roles.manage_permissions", description: "Definir quais permissões cada perfil tem", category: "Perfis" },

  // Auditoria
  { key: "audit.view", description: "Consultar o histórico de ações administrativas", category: "Auditoria" },

  // Eventos
  { key: "events.view", description: "Ver eventos", category: "Eventos" },
  { key: "events.create", description: "Criar evento", category: "Eventos" },
  { key: "events.edit", description: "Editar evento (dados, status, conteúdo do site, inscrições)", category: "Eventos" },

  // Participantes
  { key: "participants.view", description: "Ver participantes de um evento", category: "Participantes" },
  { key: "participants.create", description: "Cadastrar participante (manual ou importação CSV)", category: "Participantes" },
  { key: "participants.edit", description: "Editar participante / gerar novo QR Code", category: "Participantes" },
  { key: "participants.delete", description: "Excluir participante", category: "Participantes" },

  // Terminais
  { key: "terminals.view", description: "Ver terminais de um evento", category: "Terminais" },
  { key: "terminals.create", description: "Criar terminal (gerar código de ativação)", category: "Terminais" },
  { key: "terminals.delete", description: "Excluir terminal", category: "Terminais" },

  // Relatórios e acompanhamento
  { key: "statistics.view", description: "Ver estatísticas do evento", category: "Relatórios" },
  { key: "reports.view", description: "Ver e exportar relatório de presença", category: "Relatórios" },
  { key: "monitor.view", description: "Acompanhar check-ins em tempo real", category: "Relatórios" },

  // Certificados
  { key: "certificates.view", description: "Ver status e estatísticas de certificados do evento", category: "Certificados" },
  { key: "certificates.issue", description: "Liberar, reprocessar e revogar certificados", category: "Certificados" },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

/**
 * Upsert idempotente do catálogo acima na tabela permissions — roda no
 * boot do backend (ver server.ts) pra o catálogo nunca ficar desatualizado
 * em relação ao código, sem precisar de um passo de deploy manual. Nunca
 * remove permissões antigas do banco automaticamente (evitaria quebrar
 * role_permissions em cascata sem querer); permissões descontinuadas
 * ficam órfãs no catálogo até uma limpeza manual deliberada.
 */
export async function syncPermissions(prisma: PrismaClient): Promise<void> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { description: p.description, category: p.category },
    });
  }
}
