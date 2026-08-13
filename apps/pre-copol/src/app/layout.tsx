import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pré-Copol 2026 — Inscrições Abertas",
  description:
    "Inscreva-se no Pré-Copol 2026, evento preparatório do 3º COPOL (Congresso Odontológico Positivo Londrinense). Tema: Toxina Botulínica — A Ciência por Trás do Resultado Natural.",
  icons: {
    icon: "/icon-mark.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
