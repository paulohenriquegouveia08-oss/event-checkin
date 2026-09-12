"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getPaymentStatus,
  getInscription,
  type InscriptionPaymentStatus,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  CheckIcon,
  CopyIcon,
  MailIcon,
  AlertTriangleIcon,
  XCircleIcon,
} from "@/components/Icons";

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
  const [participantName, setParticipantName] = useState<string>("");
  const [participantDocument, setParticipantDocument] = useState<string>("");
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
          if (data.name) {
            setParticipantName(data.name);
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Erro ao consultar status");
          setLoading(false);
        }
      }
    }

    // Busca detalhes da inscrição para obter nome e CPF do participante
    getInscription(inscriptionId)
      .then((ins) => {
        if (isMounted) {
          if (ins?.name) setParticipantName(ins.name);
          if (ins?.document) setParticipantDocument(ins.document);
        }
      })
      .catch(() => {
        // Ignora silenciosamente fallback
      });

    checkStatus();

    // Polling suave a cada 15 segundos enquanto status for PENDING
    const interval = setInterval(() => {
      if (statusData?.status !== "CONFIRMED" && statusData?.status !== "CANCELLED") {
        checkStatus();
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [inscriptionId, statusData?.status]);

  const pixKey = statusData?.pixKey || "terceirocopol@gmail.com";
  const pixKeyType = statusData?.pixKeyType || "E-mail";
  const pixReceiverName =
    statusData?.pixReceiverName || "3º COPOL — Congresso Odontológico Positivo Londrinense";

  function handleCopyPix() {
    if (!pixKey) return;

    navigator.clipboard.writeText(pixKey).then(() => {
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
          <p style={{ color: "var(--destructive)", fontSize: 16 }}>
            {error ?? "Inscrição não encontrada."}
          </p>
          <Link href="/" className="btn-secondary" style={{ marginTop: 16 }}>
            ← Voltar para o Início
          </Link>
        </div>
      </PageShell>
    );
  }

  const isConfirmed = statusData.status === "CONFIRMED";
  const isCancelled = statusData.status === "CANCELLED";
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(statusData.amount);

  const effectiveName = statusData.name || participantName || "";
  const effectiveDoc = participantDocument ? ` - CPF ${participantDocument}` : "";
  const codeSnippet = (statusData.id || "").substring(0, 8).toUpperCase();

  const emailSubject = `Comprovante de Pagamento - Inscrição #${codeSnippet} - ${effectiveName}${effectiveDoc}`;
  const emailBody = `Olá Organização do 3º COPOL,\n\nSegue em anexo o comprovante de pagamento via PIX para confirmação da minha inscrição:\n\n• Nome Completo do Participante: ${effectiveName}\n• CPF do Participante: ${participantDocument || "(informar seu CPF aqui)"}\n• Código da Inscrição: ${statusData.id}\n• Categoria / Lote: ${statusData.category}\n• Valor da Inscrição: ${formattedAmount}\n• Conta utilizada no pagamento: ( ) Própria conta  ( ) Conta de terceiro (Nome do titular: ________________)\n\nO comprovante bancário está em anexo neste e-mail. Aguardo a confirmação da minha vaga!\n\nAtenciosamente,\n${effectiveName}`;
  const mailtoHref = `mailto:terceirocopol@gmail.com?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody)}`;

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
          {isCancelled ? (
            /* ---------- ESTADO: CANCELADO ---------- */
            <>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "2px solid rgba(239, 68, 68, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--destructive)",
                }}
              >
                <XCircleIcon size={44} />
              </div>

              <div>
                <span
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    color: "var(--destructive)",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  INSCRIÇÃO CANCELADA
                </span>
                <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800 }}>
                  Inscrição Cancelada
                </h1>
                <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 15, lineHeight: 1.5 }}>
                  Esta inscrição não está mais ativa no sistema.
                </p>
              </div>

              <div
                className="card"
                style={{
                  padding: 24,
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#fca5a5",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Esta inscrição foi cancelada pela organização ou o prazo para envio do comprovante de pagamento expirou.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ color: "var(--muted-foreground)" }}>Código da Inscrição:</span>
                    <strong style={{ fontFamily: "monospace", color: "var(--foreground)" }}>
                      {statusData.id}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ color: "var(--muted-foreground)" }}>Categoria:</span>
                    <span style={{ color: "var(--foreground)" }}>{statusData.category}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                    <span style={{ color: "var(--muted-foreground)" }}>Valor do Lote:</span>
                    <strong style={{ color: "var(--foreground)" }}>{formattedAmount}</strong>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Caso tenha realizado o pagamento via PIX ou acredite que se trata de um engano, por favor entre em contato com a organização pelo e-mail{" "}
                  <a href="mailto:terceirocopol@gmail.com" style={{ color: "var(--gold)", textDecoration: "underline" }}>
                    terceirocopol@gmail.com
                  </a>{" "}
                  informando o código da sua inscrição.
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: "100%", justifyContent: "center" }}>
                <Link href="/inscricao" className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
                  Realizar Nova Inscrição
                </Link>
                <Link href="/" className="btn-secondary" style={{ flex: 1, textAlign: "center" }}>
                  Página Inicial
                </Link>
              </div>
            </>
          ) : isConfirmed ? (
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
                  color: "var(--success)",
                }}
              >
                <CheckIcon size={44} />
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

              <div
                className="card"
                style={{
                  padding: 24,
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "var(--foreground)" }}>
                    Comprovante e Acesso ao Evento
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Enviamos o seu <strong>Comprovante Oficial com o QR Code de Entrada</strong> para o seu e-mail cadastrado.
                    No dia do evento, basta apresentar o QR Code diretamente no leitor da portaria.
                  </p>
                </div>

                {statusData.qrToken && (
                  <div
                    style={{
                      alignSelf: "center",
                      background: "#FFFFFF",
                      padding: 16,
                      borderRadius: 16,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        statusData.qrToken
                      )}`}
                      alt="QR Code de Check-in"
                      width={180}
                      height={180}
                      style={{ display: "block", borderRadius: 4 }}
                    />
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#666" }}>
                      {statusData.qrToken.substring(0, 16)}...
                    </span>
                  </div>
                )}

                <div
                  style={{
                    background: "var(--background)",
                    padding: "12px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--muted-foreground)" }}>Código da Inscrição: </span>
                    <strong style={{ fontFamily: "monospace", color: "var(--primary)" }}>
                      {statusData.id}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted-foreground)" }}>Categoria: </span>
                    <strong style={{ color: "var(--foreground)" }}>{statusData.category}</strong>
                  </div>
                  {effectiveName && (
                    <div>
                      <span style={{ color: "var(--muted-foreground)" }}>Participante: </span>
                      <strong style={{ color: "var(--foreground)" }}>{effectiveName}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: "100%", justifyContent: "center" }}>
                <Link href="/" className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
                  Voltar para a Página Inicial
                </Link>
              </div>
            </>
          ) : (
            /* ---------- ESTADO: AGUARDANDO PAGAMENTO (PIX MANUAL) ---------- */
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
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  AGUARDANDO PAGAMENTO VIA PIX
                </div>
                <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(24px, 4vw, 30px)", fontWeight: 800 }}>
                  Quase lá! Realize o pagamento via PIX
                </h1>
                <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
                  Transfira o valor da inscrição para a chave PIX abaixo e envie o comprovante por e-mail.
                </p>
              </div>

              {/* Banner de Aviso Explícito (Verbatim) */}
              <div
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#fca5a5",
                  fontSize: 14,
                  lineHeight: 1.5,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <AlertTriangleIcon size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: "#f87171", display: "block", marginBottom: 2 }}>Atenção:</strong>
                  <span>
                    Sua vaga está pré-garantida! No entanto, caso o pagamento não seja confirmado pela organização, a inscrição será cancelada.
                  </span>
                </div>
              </div>

              {/* Card de Pagamento PIX */}
              <div
                className="card"
                style={{
                  padding: 28,
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  border: "1px solid rgba(200, 162, 97, 0.3)",
                }}
              >
                {/* Cabeçalho do Valor e Categoria */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 16,
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        display: "block",
                      }}
                    >
                      Lote / Categoria
                    </span>
                    <strong style={{ fontSize: 16, color: "var(--foreground)" }}>
                      {statusData.category}
                    </strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        display: "block",
                      }}
                    >
                      Valor a Pagar
                    </span>
                    <strong style={{ fontSize: 22, color: "var(--gold)" }}>
                      {formattedAmount}
                    </strong>
                  </div>
                </div>

                {/* Dados da Conta / Chave PIX */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
                  <div
                    style={{
                      background: "var(--background)",
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          display: "block",
                        }}
                      >
                        Beneficiário / Titular
                      </span>
                      <strong style={{ fontSize: 14, color: "var(--foreground)" }}>
                        {pixReceiverName}
                      </strong>
                    </div>

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          display: "block",
                        }}
                      >
                        Chave PIX ({pixKeyType})
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: "var(--gold)",
                            wordBreak: "break-all",
                          }}
                        >
                          {pixKey}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão Copiar Chave Pix */}
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
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    {copied ? (
                      <>
                        <CheckIcon size={18} /> Chave PIX Copiada!
                      </>
                    ) : (
                      <>
                        <CopyIcon size={18} /> Copiar Chave Pix
                      </>
                    )}
                  </button>
                </div>

                {/* Seção de Envio de Comprovante */}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 18,
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    width: "100%",
                  }}
                >
                  <div>
                    <h4 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--foreground)", fontWeight: 700 }}>
                      Instruções para Envio do Comprovante
                    </h4>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                      Após realizar a transferência via PIX no seu banco, envie o comprovante para{" "}
                      <strong style={{ color: "var(--foreground)" }}>terceirocopol@gmail.com</strong> para darmos baixa e confirmarmos sua vaga.
                    </p>
                  </div>

                  {/* Card de Orientação Importante / Facilitação da Confirmação */}
                  <div
                    style={{
                      background: "rgba(45, 212, 191, 0.08)",
                      border: "1px solid rgba(45, 212, 191, 0.25)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>💡</span>
                      <strong style={{ fontSize: 13, color: "var(--primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Para facilitar a confirmação do seu pagamento:
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
                      No e-mail do comprovante, informe sempre o seu <strong>Nome Completo</strong> e <strong>CPF</strong> cadastrados na inscrição.
                    </p>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        background: "rgba(0, 0, 0, 0.25)",
                        padding: "8px 12px",
                        borderRadius: 6,
                        lineHeight: 1.5,
                        borderLeft: "3px solid var(--gold)",
                      }}
                    >
                      <strong style={{ color: "var(--gold)" }}>⚠️ Pagou usando a conta de outra pessoa (mãe, pai ou terceiro)?</strong>
                      <br />
                      Como o comprovante sairá com o nome do titular da conta bancária, informar o <strong>seu Nome e CPF</strong> no e-mail é fundamental para que nossa equipe localize seu cadastro rapidamente e aprove sua inscrição sem atrasos!
                    </div>
                  </div>

                  {/* Botão Enviar Comprovante por E-mail */}
                  <a
                    href={mailtoHref}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      padding: 14,
                      fontSize: 15,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      textDecoration: "none",
                      background: "var(--primary)",
                      color: "#000",
                      borderRadius: 8,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <MailIcon size={18} color="#000" />
                    <span>Abrir E-mail Pré-Preenchido com Meus Dados</span>
                  </a>
                  <p style={{ margin: "-4px 0 0", fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
                    O botão acima abrirá seu e-mail com seu Nome, CPF e Código de Inscrição já preenchidos automaticamente.
                  </p>
                </div>

                {/* Indicador de Polling em Tempo Real */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
                    Assim que a organização confirmar seu pagamento, esta tela será atualizada automaticamente em tempo real.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  Código da Inscrição:{" "}
                  <code style={{ fontFamily: "monospace", color: "var(--primary)" }}>{statusData.id}</code>
                </span>
                <Link href="/" style={{ color: "var(--muted-foreground)", fontSize: 13, textDecoration: "none" }}>
                  ← Voltar para a página inicial
                </Link>
              </div>
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

