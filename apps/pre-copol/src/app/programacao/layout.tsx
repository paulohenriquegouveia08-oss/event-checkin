import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Programação Oficial",
  description:
    "Confira o cronograma completo de palestras, horários e palestrantes do COPOL 2026 — Congresso de Odontologia de Londrina.",
  alternates: {
    canonical: "/programacao/",
  },
  openGraph: {
    title: "Programação Oficial | COPOL 2026 — Congresso de Odontologia de Londrina",
    description:
      "Confira o cronograma completo de palestras e horários do COPOL 2026 — Congresso de Odontologia de Londrina.",
    url: "https://copol2026.com.br/programacao/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Programação COPOL 2026",
      },
    ],
  },
};

export default function ProgramacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
