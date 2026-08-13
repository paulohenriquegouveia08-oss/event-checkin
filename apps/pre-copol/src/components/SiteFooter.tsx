import Image from "next/image";

interface Props {
  text?: string;
}

export function SiteFooter({ text = "3º COPOL — Congresso Odontológico Positivo Londrinense" }: Props) {
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
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>{text}</p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", opacity: 0.7 }}>
          Copol | LSPK Tecnology
        </p>
      </div>
    </footer>
  );
}
