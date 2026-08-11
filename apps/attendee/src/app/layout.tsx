import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Check-in",
  description: "Portal do participante - Acesse seu QR code para check-in",
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
