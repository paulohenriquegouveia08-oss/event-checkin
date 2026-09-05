import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { EventJsonLd } from "@/components/EventJsonLd";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0E3634",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://copol2026.com.br"),
  title: {
    default: "COPOL 2026 — Congresso de Odontologia de Londrina",
    template: "%s | COPOL 2026 — Congresso de Odontologia de Londrina",
  },
  description:
    "Site oficial do COPOL 2026 — Congresso de Odontologia de Londrina (3º COPOL). Evento na Universidade Positivo — Campus Londrina com palestras sobre Toxina Botulínica, programação oficial e inscrições abertas.",
  keywords: [
    "COPOL",
    "COPOL Londrina",
    "Congresso de Odontologia de Londrina",
    "COPOL odontologia",
    "Pré-Copol 2026",
    "3º COPOL",
    "Congresso Odontológico Positivo Londrinense",
    "Toxina Botulínica odontologia",
    "Universidade Positivo Londrina",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://copol2026.com.br/",
    siteName: "COPOL — Congresso de Odontologia de Londrina",
    title: "COPOL 2026 — Congresso de Odontologia de Londrina",
    description:
      "Site oficial do COPOL 2026 — Congresso de Odontologia de Londrina (3º COPOL). Confira informações do evento, programação oficial, local e inscrições.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "COPOL 2026 — Congresso de Odontologia de Londrina",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "COPOL 2026 — Congresso de Odontologia de Londrina",
    description:
      "Site oficial do COPOL 2026 — Congresso de Odontologia de Londrina (3º COPOL).",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon-mark.png",
    apple: "/icon-mark.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <head>
        <EventJsonLd />
      </head>
      <body>{children}</body>
    </html>
  );
}
