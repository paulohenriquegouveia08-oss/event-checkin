import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirmação de Inscrição",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ConfirmacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
