import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Validação de Certificado",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CertificadosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
