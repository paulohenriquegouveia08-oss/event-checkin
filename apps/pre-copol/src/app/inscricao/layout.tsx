import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscrições Online",
  description:
    "Garanta sua vaga no COPOL 2026 — Congresso de Odontologia de Londrina. Lotes promocionais para estudantes e profissionais da odontologia.",
  alternates: {
    canonical: "/inscricao/",
  },
  openGraph: {
    title: "Inscrições Online | COPOL 2026 — Congresso de Odontologia de Londrina",
    description:
      "Garanta sua vaga no COPOL 2026. Lotes promocionais e categorias para estudantes e profissionais da odontologia.",
    url: "https://copol2026.com.br/inscricao/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Inscrições COPOL 2026",
      },
    ],
  },
};

export default function InscricaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
