import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submissão de Trabalhos",
  description:
    "Envie seu trabalho para o COPOL 2026 — Congresso de Odontologia de Londrina. Arquivos em PDF ou DOCX.",
};

export default function TrabalhosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
