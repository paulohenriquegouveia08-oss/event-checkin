import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pré-Copol 2026 — Inscrições Abertas",
  description: "Inscreva-se no Pré-Copol 2026. Toxina Botulínica: A Ciência por Trás do Resultado Natural.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
