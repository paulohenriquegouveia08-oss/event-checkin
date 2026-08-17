import type { NextConfig } from "next";

// Export estático — hospedado no GitHub Pages (domínio próprio
// copol2026.com.br via CNAME), sem servidor Node por trás. O site já não
// tinha nenhuma rota de API nem dado renderizado no servidor (tudo busca
// do backend no cliente, ver src/lib/api.ts) — só precisou trocar as duas
// rotas dinâmicas por segmento ([eventId]/[code]) por query string, já
// que export estático não tem como pré-gerar uma página por evento ou
// certificado que ainda nem existe no momento do build.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    // Sem servidor de Image Optimization no GitHub Pages.
    unoptimized: true,
  },
};

export default nextConfig;
