"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getSubmissionStatus,
  regenerateSubmissionPayment,
  type SubmissionPublicStatus,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "@/components/Icons";

/**
 * Pagamento da taxa de submissão e acompanhamento do trabalho.
 *
 * O id vem pela query string (export estático não pré-gera página por
 * trabalho). Enquanto a taxa está pendente, consulta a situação a cada
 * poucos segundos: quem confirma é o webhook do Mercado Pago, e a página
 * só reflete — voltar do checkout não é prova de pagamento.
 */

const INTERVALO_MS = 6000;

const STATUS_TEXTO: Record<SubmissionPublicStatus["status"], string> = {
  DRAFT: "Aguardando pagamento",
  SUBMITTED: "Enviado para a comissão",
  UNDER_REVIEW: "Em avaliação",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  WITHDRAWN: "Retirado",
};

function formatarReais(v: number | null) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PagamentoTrabalhoPage() {
  return (
    <Suspense fallback={<Casca>Carregando…</Casca>}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const id = useSearchParams().get("id") ?? "";
  const [s, setS] = useState<SubmissionPublicStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const consultar = useCallback(async () => {
    try {
      setS(await getSubmissionStatus(id));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui consultar o trabalho.");
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void consultar();
  }, [id, consultar]);

  const pendente = s?.paymentStatus === "PENDING" && s.status !== "WITHDRAWN";

  useEffect(() => {
    if (!pendente) return;
    const t = setInterval(() => {
      setAgora(Date.now());
      void consultar();
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [pendente, consultar]);

  if (!id) {
    return (
      <Casca>
        <p>
          Nenhum trabalho informado. <Link href="/trabalhos/">Enviar um trabalho</Link>
        </p>
      </Casca>
    );
  }
  if (erro && !s) return <Casca>{erro}</Casca>;
  if (!s) return <Casca>Carregando…</Casca>;

  const vencido = !!s.paymentExpiresAt && new Date(s.paymentExpiresAt).getTime() < agora;

  async function copiar() {
    if (!s?.qrCodeContent) return;
    await navigator.clipboard.writeText(s.qrCodeContent);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  async function gerarNovoPix() {
    setGerando(true);
    try {
      setS(await regenerateSubmissionPayment(id));
      setAgora(Date.now());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui gerar um novo Pix.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Casca>
      <div className="card" style={{ padding: 28, width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted-foreground)" }}>
            Protocolo
          </span>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>{s.code}</div>
          <div style={{ marginTop: 4, color: "var(--foreground)" }}>{s.title}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted-foreground)" }}>
            Situação: <strong style={{ color: "var(--foreground)" }}>{STATUS_TEXTO[s.status]}</strong>
          </div>
        </div>

        {s.paymentStatus === "PENDING" && s.status !== "WITHDRAWN" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <strong>Taxa de submissão</strong>
              <strong style={{ fontSize: 22, color: "var(--gold)" }}>{formatarReais(s.feeAmount)}</strong>
            </div>

            {vencido ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
                  Este Pix venceu sem pagamento. Gere um novo para concluir o envio — seu trabalho continua guardado.
                </p>
                <button type="button" className="btn-primary" onClick={gerarNovoPix} disabled={gerando} style={{ padding: 14 }}>
                  {gerando ? "Gerando…" : "Gerar novo Pix"}
                </button>
              </div>
            ) : (
              <>
                {s.qrCodeBase64 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`data:image/png;base64,${s.qrCodeBase64}`}
                    alt="QR Code do Pix da taxa de submissão"
                    width={220}
                    height={220}
                    style={{ alignSelf: "center", width: 220, height: 220, background: "#fff", padding: 10, borderRadius: 12 }}
                  />
                ) : null}

                {s.qrCodeContent && (
                  <>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
                      No app do seu banco, escolha <strong>Pix</strong> → <strong>Ler QR Code</strong>, ou use o código copia e
                      cola:
                    </p>
                    <div
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        wordBreak: "break-all",
                        maxHeight: 96,
                        overflowY: "auto",
                      }}
                    >
                      {s.qrCodeContent}
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={copiar}
                      style={{
                        padding: 14,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: copiado ? "var(--success)" : undefined,
                      }}
                    >
                      {copiado ? (
                        <>
                          <CheckIcon size={18} /> Código Pix copiado!
                        </>
                      ) : (
                        <>
                          <CopyIcon size={18} /> Copiar código Pix
                        </>
                      )}
                    </button>
                  </>
                )}

                {s.paymentUrl && (
                  <a
                    href={s.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ padding: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
                  >
                    <ExternalLinkIcon size={16} /> Pagar no Mercado Pago (cartão)
                  </a>
                )}

                <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
                  Esta página atualiza sozinha quando o pagamento for aprovado.
                  {s.paymentExpiresAt
                    ? ` Pix válido até ${new Date(s.paymentExpiresAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}.`
                    : ""}
                </p>
              </>
            )}
          </>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckIcon size={20} color="#fff" />
            </div>
            <div>
              <strong>
                {s.paymentStatus === "PAID" ? "Pagamento aprovado — trabalho enviado!" : "Trabalho enviado!"}
              </strong>
              <p style={{ margin: "6px 0 0", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                Guarde o protocolo <strong>{s.code}</strong>. A comissão científica vai avaliar o trabalho e o resultado
                será comunicado aos autores.
              </p>
            </div>
          </div>
        )}

        {erro && <p style={{ margin: 0, color: "#fca5a5", fontSize: 13 }}>{erro}</p>}

        <Link href="/trabalhos/" style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
          Enviar outro trabalho
        </Link>
      </div>
    </Casca>
  );
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
