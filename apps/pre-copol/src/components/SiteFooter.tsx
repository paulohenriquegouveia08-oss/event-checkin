import Image from "next/image";
import { CreditosParceiros } from "./CreditosParceiros";

interface Props {
  text?: string;
  footerText?: string;
}

export function SiteFooter({ text, footerText }: Props) {
  const displayText = footerText || text || "3º COPOL — Congresso Odontológico Positivo Londrinense";
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--background-deep)",
        padding: "40px 24px 28px",
      }}
    >
      <div
        className="container-page"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <Image src="/icon-mark.png" alt="" width={28} height={28} style={{ opacity: 0.85 }} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>{displayText}</p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", opacity: 0.7 }}>
          Copol | LSPK Technology
        </p>

        {/* Créditos de quem desenvolveu e de quem apoiou. Separado por
            uma linha fina para não competir com o nome do evento acima. */}
        <div
          style={{
            width: "100%",
            marginTop: 8,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
          }}
        >
          <CreditosParceiros />
        </div>
      </div>
    </footer>
  );
}
