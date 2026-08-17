"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicCertificate, type PublicCertificate } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/** Página pública de validação de certificado — o QR Code impresso no PDF
 * (ver certificate-template.ts, no backend) aponta pra cá. Sem login: o
 * "code" da URL é o verificationCode opaco do certificado, não o id da
 * linha no banco (ver seção 11 do pedido — nunca usar id sequencial numa
 * URL pública). Mostra só o mínimo necessário pra confirmar autenticidade,
 * sem dados sensíveis (sem e-mail, telefone, documento do participante). */
export default function CertificateValidationPage() {
  const { code } = useParams<{ code: string }>();
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicCertificate(code)
      .then(setCertificate)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.5 }} />
        <div
          className="container-page animate-fade-up"
          style={{
            position: "relative",
            padding: "64px 24px 96px",
            maxWidth: 560,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {loading && <p style={{ color: "var(--muted-foreground)" }}>Verificando certificado...</p>}

          {!loading && notFound && (
            <ResultCard
              tone="invalid"
              title="Certificado não encontrado"
              description="Não existe nenhum certificado emitido com este código. Se você chegou aqui escaneando um QR Code impresso, verifique se o documento não foi adulterado."
            />
          )}

          {!loading && certificate?.revoked && (
            <ResultCard
              tone="invalid"
              title="Certificado revogado"
              description="Este certificado foi revogado pela organização do evento e não é mais válido."
            />
          )}

          {!loading && certificate?.valid && (
            <div className="card" style={{ width: "100%", padding: 32, textAlign: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#22c55e",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
                Certificado válido
              </span>

              <div style={{ marginTop: 28, textAlign: "left", display: "flex", flexDirection: "column", gap: 18 }}>
                <Field label="Participante" value={certificate.participantName} />
                <Field label="Evento" value={certificate.eventName} />
                <Field
                  label="Data"
                  value={formatDateRange(certificate.eventStartDate, certificate.eventEndDate)}
                />
                {certificate.eventLocation && <Field label="Local" value={certificate.eventLocation} />}
                {certificate.workloadHours && <Field label="Carga horária" value={`${certificate.workloadHours} horas`} />}
                <Field label="Status" value="Válido" valueColor="#22c55e" />
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: valueColor ?? "var(--foreground)" }}>{value}</p>
    </div>
  );
}

function ResultCard({ tone, title, description }: { tone: "invalid"; title: string; description: string }) {
  const color = tone === "invalid" ? "#ef4444" : "#22c55e";
  return (
    <div className="card" style={{ width: "100%", padding: 32, textAlign: "center" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
        {title}
      </span>
      <p style={{ marginTop: 16, color: "var(--muted-foreground)", fontSize: 15, lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" };
  const startLabel = new Intl.DateTimeFormat("pt-BR", opts).format(start);
  const endLabel = new Intl.DateTimeFormat("pt-BR", opts).format(end);
  return startLabel === endLabel ? startLabel : `${startLabel} a ${endLabel}`;
}
