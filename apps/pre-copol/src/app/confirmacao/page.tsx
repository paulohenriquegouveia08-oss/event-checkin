"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPaymentStatus, type InscriptionPaymentStatus } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<PageShell loading />}>
      <ConfirmationContent />
    </Suspense>
  );
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const inscriptionId = searchParams.get("id") ?? "";

  const [statusData, setStatusData] = useState<InscriptionPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inscriptionId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function checkStatus() {
      try {
        const data = await getPaymentStatus(inscriptionId);
        if (isMounted) {
          setStatusData(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Erro ao consultar status");
          setLoading(false);
        }
      }
    }

    checkStatus();

    // Polling a cada 3 segundos enquanto status for PENDING
    const interval = setInterval(() => {
      if (statusData?.status !== "CONFIRMED") {
        checkStatus();
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [inscriptionId, statusData?.status]);

  function handleCopyPix() {
    const code = statusData?.qrCodeContent || statusData?.paymentUrl || "";
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (loading) {
    return <PageShell loading />;
  }

  if (error || !statusData) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <p style={{ color: "var(--destructive)", fontSize: 16 }}>{error ?? "Inscrição não encontrada."}</p>
          <Link href="/" className="btn-secondary" style={{ marginTop: 16 }}>
            ← Voltar para o Início
          </Link>
        </div>
      </PageShell>
    );
  }

  const isConfirmed = statusData.status === "CONFIRMED";
  const formattedAmount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(statusData.amount);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.5 }} />
        <div
          className="container-page animate-fade-up"
          style={{
            position: "relative",
            padding: "48px 24px 64px",
            maxWidth: 580,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 24,
          }}
        >
          {isConfirmed ? (
            /* ---------- ESTADO: CONFIRMADO / PAGO ---------- */
            <>
              <div
                className="animate-pulse-soft"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "2px solid rgba(34, 197, 94, 0.4)",
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
                <span
                  style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "var(--success)",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  PAGAMENTO APROVADO
                </span>
                <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800 }}>
                  Inscrição Confirmada!
                </h1>
                <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 15, lineHeight: 1.5 }}>
                  Você já é um participante oficial do 3º COPOL.
                </p>
              </div>

              <div className="card" style={{ padding: 24, width: "100%", textAlign: "left" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--foreground)" }}>Comprovante e Acesso</h3>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Enviamos o seu <strong>Comprovante Oficial com o QR Code de Entrada</strong> para o seu e-mail cadastrado.
                  No dia do evento, basta apresentar o QR Code do e-mail diretamente no leitor da portaria.
                </p>
                <div style={{ background: "var(--background)", padding: "12px 16px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>Código da Inscrição: </span>
                  <strong style={{ fontFamily: "monospace", color: "var(--primary)" }}>{statusData.id}</strong>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: "100%", justifyContent: "center" }}>
                <Link href="/" className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
                  Voltar para a Página Inicial
                </Link>
              </div>
            </>
          ) : (
            /* ---------- ESTADO: AGUARDANDO PAGAMENTO ---------- */
            <>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(200, 162, 97, 0.12)",
                    color: "var(--gold)",
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", animation: "pulse 1.5s infinite" }} />
                  AGUARDANDO PAGAMENTO
                </div>
                <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(24px, 4vw, 30px)", fontWeight: 800 }}>
                  Quase lá! Conclua o pagamento
                </h1>
                <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
                  Escaneie o QR Code ou copie o código Pix abaixo. O sistema identificará o pagamento automaticamente.
                </p>
              </div>

              {/* Card de Pagamento */}
              <div
                className="card"
                style={{
                  padding: 28,
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 18,
                  border: "1px solid rgba(200, 162, 97, 0.3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 14 }}>{statusData.category}</span>
                  <strong style={{ fontSize: 18, color: "var(--gold)" }}>{formattedAmount}</strong>
                </div>

                {/* Exibição do QR Code */}
                {statusData.qrCodeBase64 ? (
                  <div
                    style={{
                      background: "#FFFFFF",
                      padding: 16,
                      borderRadius: 16,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      display: "inline-block",
                    }}
                  >
                    <img
                      src={statusData.qrCodeBase64.startsWith("data:") ? statusData.qrCodeBase64 : `data:image/png;base64,${statusData.qrCodeBase64}`}
                      alt="QR Code Pix"
                      width={220}
                      height={220}
                      style={{ display: "block", borderRadius: 8 }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 220,
                      height: 220,
                      background: "var(--background)",
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--muted-foreground)",
                      fontSize: 13,
                    }}
                  >
                    Carregando QR Code...
                  </div>
                )}

                {/* Botões de Ação */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      padding: 14,
                      fontSize: 15,
                      background: copied ? "var(--success)" : "var(--primary)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {copied ? "✓ Código Pix Copiado!" : "Copiar Código Pix (Copia e Cola)"}
                  </button>

                  {statusData.paymentUrl && (
                    <a
                      href={statusData.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{
                        width: "100%",
                        padding: 12,
                        textAlign: "center",
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <span>Abrir no App PicPay</span> ↗
                    </a>
                  )}
                </div>

                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
                  Assim que você pagar, esta tela será atualizada automaticamente em alguns segundos.
                </p>
              </div>

              <Link href="/" style={{ color: "var(--muted-foreground)", fontSize: 13, textDecoration: "none" }}>
                ← Voltar para a página inicial
              </Link>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function PageShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {loading ? <p style={{ color: "var(--muted-foreground)" }}>Carregando dados da inscrição...</p> : children}
      </main>
      <SiteFooter />
    </div>
  );
}
