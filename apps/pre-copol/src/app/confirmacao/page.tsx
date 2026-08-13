"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const inscriptionId = searchParams.get("id");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.5 }} />
        <div
          className="container-page animate-fade-up"
          style={{
            position: "relative",
            padding: "64px 24px",
            maxWidth: 600,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 24,
          }}
        >
          <div
            className="animate-pulse-soft"
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              color: "var(--success)",
            }}
          >
            ✓
          </div>

          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "clamp(24px, 4vw, 30px)" }}>Inscrição confirmada!</h1>
            <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 15 }}>
              Você receberá um e-mail de confirmação com os próximos passos.
            </p>
          </div>

          {inscriptionId && (
            <div className="card" style={{ padding: 20, width: "100%" }}>
              <p style={{ margin: "0 0 8px", color: "var(--muted-foreground)", fontSize: 13 }}>Código da inscrição</p>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--primary)" }}>
                {inscriptionId}
              </p>
            </div>
          )}

          <div className="card" style={{ padding: 24, width: "100%", textAlign: "left" }}>
            <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 15 }}>Próximos passos</p>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 10 }}>
              <li>Realize o pagamento conforme as instruções enviadas por e-mail</li>
              <li>Após a confirmação do pagamento, acesse o sistema de credenciamento</li>
              <li>Retire seu QR Code de acesso no dia do evento</li>
            </ol>
          </div>

          <Link href="/" className="btn-primary">
            Voltar para a página inicial
          </Link>
        </div>
      </main>

      <SiteFooter />
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
