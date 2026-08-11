import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Este é um monorepo com npm workspaces onde outro workspace (o app
    // mobile, Expo/React Native) fixa uma versão exata de React diferente
    // da instalada localmente aqui. Isso faz o npm manter duas cópias de
    // "react" em disco (uma hospedada na raiz, outra local a este
    // workspace) — sem isso, dependências como qrcode.react podem acabar
    // resolvendo hooks de uma cópia e o app rodando com outra ("Invalid
    // hook call"). `dedupe` força o Vite a sempre usar uma única cópia
    // (a mais próxima deste projeto) para todo o grafo de módulos.
    dedupe: ["react", "react-dom"],
    alias: {
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
    },
  },
});
