"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const inscriptionId = searchParams.get("id");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Inscrição Confirmada!</h1>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: "48px 24px",
          maxWidth: 600,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 24,
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
          }}
        >
          ✓
        </div>

        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Sua inscrição foi realizada!</h2>
          <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
            Você receberá um e-mail de confirmação com os próximos passos.
          </p>
        </div>

        {inscriptionId && (
          <div
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 20,
              width: "100%",
              fontSize: 14,
            }}
          >
            <p style={{ margin: "0 0 8px", color: "var(--muted-foreground)" }}>Código da inscrição:</p>
            <p style={{ margin: 0, fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--primary)" }}>
              {inscriptionId}
            </p>
          </div>
        )}

        <div
          style={{
            background: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
            width: "100%",
          }}
        >
          <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 14 }}>Próximos passos:</p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, textAlign: "left", color: "var(--muted-foreground)" }}>
            <li style={{ marginBottom: 8 }}>Realize o pagamento conforme as instruções enviadas por e-mail</li>
            <li style={{ marginBottom: 8 }}>Após a confirmação do pagamento, acesse o sistema de credenciamento</li>
            <li>Retire seu QR Code de acesso no dia do evento</li>
          </ol>
        </div>

        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            fontWeight: 700,
            padding: "12px 24px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Voltar para a página inicial
        </Link>
      </main>

      <footer
        style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          color: "var(--muted-foreground)",
          fontSize: 12,
        }}
      >
        Copol | LSPK Tecnology
      </footer>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--muted-foreground)" }}>Carregando...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
