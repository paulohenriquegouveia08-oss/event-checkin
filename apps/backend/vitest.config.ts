import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Testes de integração batem no Postgres real (mesmo modelo dos
    // testes obrigatórios da especificação: duplicidade, concorrência).
    // Rodar em série evita que dois arquivos de teste disputem as mesmas
    // linhas/tabelas ao mesmo tempo.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
