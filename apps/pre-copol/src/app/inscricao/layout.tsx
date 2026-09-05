import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscrições Online",
  description:
    "Formulário de inscrição do COPOL 2026 — Congresso de Odontologia de Londrina.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function InscricaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
