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

  // Relogio proprio: a contagem do Pix precisa andar sozinha, sem depender
  // do polling de 15s.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, []);

  const pixReceiverName = statusData?.pixReceiverName || "Ana Laura de Matos Xavier";

  // Pagamento oficial e automático via Mercado Pago
  const codigoPix = statusData?.qrCodeContent ?? null;
  const temPixAutomatico = Boolean(codigoPix);

  const isCheckoutPro = Boolean(
    statusData?.paymentUrl &&
      (statusData.paymentUrl.includes("/checkout/") || statusData.paymentUrl.includes("pref_id"))
  );
  const linkCartao = isCheckoutPro
    ? statusData?.paymentUrl ?? null
    : codigoPix
      ? null
      : statusData?.paymentUrl ?? null;
  const temCartao = Boolean(linkCartao);
  const temCobrancaAutomatica = Boolean(codigoPix) || Boolean(linkCartao);

  function handleCopyPix() {
    if (!codigoPix) return;

    navigator.clipboard.writeText(codigoPix).then(() => {
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

  const expiraEm = statusData.paymentExpiresAt ? new Date(statusData.paymentExpiresAt).getTime() : null;
  const segundosRestantes = expiraEm === null ? null : Math.max(0, Math.floor((expiraEm - agora) / 1000));
  const horas = segundosRestantes !== null ? Math.floor(segundosRestantes / 3600) : 0;
  const minutos = segundosRestantes !== null ? Math.floor((segundosRestantes % 3600) / 60) : 0;
  const segundos = segundosRestantes !== null ? segundosRestantes % 60 : 0;
  const tempoRestante =
    segundosRestantes === null
      ? null
      : horas > 0
        ? `${String(horas).padStart(2, "0")}h ${String(minutos).padStart(2, "0")}m ${String(segundos).padStart(2, "0")}s`
        : `${String(minutos).padStart(2, "0")} : ${String(segundos).padStart(2, "0")}`;

  const effectiveName = statusData.name || participantName || "";
  const effectiveDoc = participantDocument ? ` - CPF ${participantDocument}` : "";

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
                  {temCartao ? "AGUARDANDO PAGAMENTO" : "AGUARDANDO PAGAMENTO VIA PIX"}
                </div>
                <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(24px, 4vw, 30px)", fontWeight: 800 }}>
                  {temCartao ? "Quase lá! Conclua o pagamento" : "Quase lá! Realize o pagamento via PIX"}
                </h1>
                <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
                  {temPixAutomatico
                    ? "Pague o Pix abaixo pelo app do seu banco. A confirmação é automática."
                    : temCartao
                      ? "Conclua o pagamento com cartão na página do Mercado Pago. A confirmação é automática."
                      : "Transfira o valor da inscrição para a chave PIX abaixo e envie o comprovante por e-mail."}
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

              {/* Aviso Importante sobre Inscrição e Hands-on */}
              <div
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "rgba(212, 168, 83, 0.08)",
                  border: "1px solid rgba(212, 168, 83, 0.35)",
                  color: "var(--foreground)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <AlertTriangleIcon size={20} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}>
                  <strong style={{ color: "var(--gold)" }}>IMPORTANTE:</strong> O valor da inscrição refere-se exclusivamente à participação no Congresso COPOL, contemplando palestras, feira e coffee break. As atividades Hands-on não estão inclusas neste valor e terão inscrições e valores específicos, a serem divulgados posteriormente.
                </p>
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

                {temPixAutomatico ? (
                  /* ---------- PIX AUTOMATICO (Mercado Pago) ---------- */
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                    {statusData.qrCodeBase64 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`data:image/png;base64,${statusData.qrCodeBase64}`}
                        alt="QR Code do Pix para pagar a inscrição"
                        width={220}
                        height={220}
                        style={{ width: 220, height: 220, background: "#fff", padding: 10, borderRadius: 12 }}
                      />
                    ) : null}

                    {/* Informação do recebedor no app do banco */}
                    <div
                      style={{
                        width: "100%",
                        background: "rgba(200, 162, 97, 0.08)",
                        border: "1px solid rgba(200, 162, 97, 0.25)",
                        borderRadius: 10,
                        padding: "12px 16px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--muted-foreground)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Nome que vai aparecer no app do seu banco:
                      </span>
                      <strong style={{ fontSize: 16, color: "var(--gold)" }}>
                        Ana Laura de Matos Xavier
                      </strong>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        (Conta oficial da organização vinculada ao Mercado Pago)
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
                      No app do seu banco, escolha <strong>Pix</strong> &rarr; <strong>Ler QR Code</strong>, ou
                      use o código copia e cola abaixo.
                    </p>

                    <div
                      style={{
                        width: "100%",
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "var(--foreground)",
                        wordBreak: "break-all",
                        textAlign: "left",
                        maxHeight: 96,
                        overflowY: "auto",
                      }}
                    >
                      {codigoPix}
                    </div>

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
                          <CheckIcon size={18} /> Código Pix copiado!
                        </>
                      ) : (
                        <>
                          <CopyIcon size={18} /> Copiar código Pix
                        </>
                      )}
                    </button>

                    {tempoRestante ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "var(--muted-foreground)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {segundosRestantes === 0 ? (
                          <strong style={{ color: "var(--destructive)" }}>Este código expirou.</strong>
                        ) : (
                          <>
                            <span>Este código expira em</span>
                            <strong
                              style={{
                                color: "var(--gold)",
                                fontFamily: "monospace",
                                fontSize: 14,
                                letterSpacing: horas > 0 ? "1.5px" : "3px",
                                background: "rgba(200, 162, 97, 0.12)",
                                padding: "3px 10px",
                                borderRadius: 6,
                                border: "1px solid rgba(200, 162, 97, 0.3)",
                              }}
                            >
                              {tempoRestante}
                            </strong>
                          </>
                        )}
                      </p>
                    ) : null}

                    {temCartao && (
                      <div style={{ width: "100%", marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "uppercase" }}>ou</span>
                          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        </div>

                        <a
                          href={linkCartao ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{
                            width: "100%",
                            padding: 14,
                            fontSize: 15,
                            fontWeight: 600,
                            textAlign: "center",
                            textDecoration: "none",
                            borderRadius: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          Pagar com Cartão de Crédito
                        </a>
                      </div>
                    )}
                  </div>
                ) : temCartao ? (
                  /* ---------- CARTAO (Checkout Pro) ---------- */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                    <a
                      href={linkCartao ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{
                        width: "100%",
                        padding: 16,
                        fontSize: 16,
                        fontWeight: 700,
                        textAlign: "center",
                        textDecoration: "none",
                        borderRadius: 8,
                        background: "var(--primary)",
                        color: "#000",
                      }}
                    >
                      Pagar com cartão
                    </a>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
                      Você será levado à página segura do Mercado Pago e volta para cá ao terminar.
                      {tempoRestante && segundosRestantes !== 0 ? (
                        <>
                          {" "}Este link expira em{" "}
                          <strong
                            style={{
                              color: "var(--gold)",
                              fontFamily: "monospace",
                              fontSize: 14,
                              letterSpacing: horas > 0 ? "1.5px" : "3px",
                              background: "rgba(200, 162, 97, 0.12)",
                              padding: "2px 8px",
                              borderRadius: 6,
                              border: "1px solid rgba(200, 162, 97, 0.3)",
                            }}
                          >
                            {tempoRestante}
                          </strong>.
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : (
                  /* Fallback de Segurança se a cobrança automática não carregou */
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: 12,
                      padding: "24px 20px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <AlertTriangleIcon size={36} color="#ef4444" />
                    <div>
                      <strong style={{ color: "#f87171", fontSize: 16, display: "block", marginBottom: 6 }}>
                        Cobrança Automática Indisponível
                      </strong>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        Não identificamos o QR Code oficial do Pix para esta inscrição.
                        Para garantir sua vaga com segurança e baixa automática instantânea,
                        por favor realize uma nova inscrição informando seus dados corretamente.
                      </p>
                    </div>
                    <Link
                      href="/inscricao"
                      className="btn-primary"
                      style={{
                        padding: "12px 24px",
                        fontSize: 14,
                        fontWeight: 700,
                        textDecoration: "none",
                        marginTop: 4,
                      }}
                    >
                      Refazer Inscrição
                    </Link>
                  </div>
                )}

                {/* Indicador de Atualização em Tempo Real */}
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
                    Assim que o pagamento for confirmado pelo banco, esta tela atualiza automaticamente em tempo real.
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

