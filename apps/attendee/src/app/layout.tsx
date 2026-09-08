import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credenciamento · LSPK",
  description: "Acesse seu QR Code, comprovante de presença e certificado.",
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
