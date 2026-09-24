import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

/**
 * As fontes da marca LSPK: Space Grotesk (700/500) e IBM Plex Mono (500).
 *
 * Servidas pelo próprio Next (`next/font` baixa e hospeda junto do site),
 * e não pelo Google em tempo de execução: sem chamada externa no
 * carregamento, sem depender de um terceiro estar no ar, e sem o salto de
 * layout que acontece quando a fonte chega depois do texto.
 */
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--fonte-titulo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--fonte-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Credenciamento · LSPK",
  description: "Acesse seu QR Code, comprovante de presença e certificado.",
};

// Quase todo acesso é pelo celular, na fila da entrada. A barra do
// navegador na mesma cor do fundo evita a faixa branca em cima do site.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101214",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
