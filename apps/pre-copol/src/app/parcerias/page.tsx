import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MarcaPatrocinador } from "@/components/MarcaPatrocinador";
import { PATROCINADORES } from "@/lib/patrocinadores";

export const metadata: Metadata = {
  title: "Realização e Apoio",
  description:
    "Patrocinadores e parceiros do COPOL 2026: Integrale, Dental DSL e Radiotech Smart (cota Diamante), Universidade Positivo (Campus Londrina), Ecohub e LSPK Technology.",
  alternates: {
    canonical: "/parcerias/",
  },
  openGraph: {
    title: "Realização e Apoio | COPOL 2026 — Congresso de Odontologia de Londrina",
    description:
      "Patrocinadores e parceiros do COPOL 2026: Integrale, Dental DSL e Radiotech Smart (cota Diamante), Universidade Positivo, Ecohub e LSPK Technology.",
    url: "https://copol2026.com.br/parcerias/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Parcerias COPOL 2026",
      },
    ],
  },
};

// Parceiros com logo em imagem em cartão claro unificado, com fundo
// transparente para máxima legibilidade e padrão consistente em qualquer paleta.
interface LogoPartner {
  name: string;
  subtitle: string;
  src: string;
  width: number;
  card: "light" | "dark";
  url?: string;
}

const LOGO_PARTNERS: LogoPartner[] = [
  { name: "LSPK", subtitle: "LSPK Technology", src: "/partners/lspk.png", width: 200, card: "light", url: "https://www.instagram.com/lspktech" },
  { name: "Universidade Positivo", subtitle: "Campus Londrina", src: "/partners/positivo.png", width: 210, card: "light" },
  { name: "Ecohub", subtitle: "Ecossistema de Inovação", src: "/partners/ecohub.png", width: 180, card: "light" },
];

export default function ParceriasPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader eventTitle="Copol" />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.5 }} />
        <div className="container-page animate-fade-up" style={{ position: "relative", padding: "56px 24px 72px" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--gold)",
            }}
          >
            Patrocínio, realização e apoio
          </span>
          <h1 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", margin: "8px 0 16px" }}>Parcerias</h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 16, margin: "0 0 40px", maxWidth: 560, lineHeight: 1.6 }}>
            O Pré-Copol e o COPOL contam com o patrocínio e o apoio de instituições e empresas comprometidas com a
            excelência em Odontologia.
          </p>

          <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>Patrocinadores</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
              marginBottom: 48,
            }}
          >
            {PATROCINADORES.map((p) => (
              <a
                key={p.nome}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${p.nome} no Instagram`}
                className="hover:scale-[1.01]"
                style={{
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "center",
                  textDecoration: "none",
                  boxShadow: "var(--shadow-card)",
                  transition: "transform 0.2s ease",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: "#0E3634",
                  }}
                >
                  Cota {p.cota}
                </span>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                  <MarcaPatrocinador p={p} altura={44} largura={280} />
                </div>
                {/* O logo já traz a descrição escrita; sem ele, vai em texto. */}
                {!p.logo && (
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{p.descricao}</span>
                )}
              </a>
            ))}
          </div>

          <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>Realização e apoio</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {LOGO_PARTNERS.map((partner) => {
              const cardContent = (
                <>
                  <Image
                    src={partner.src}
                    alt={partner.name}
                    width={partner.width}
                    height={partner.width / 3.3}
                    style={{ width: partner.width, height: "auto" }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: partner.card === "dark" ? "var(--muted-foreground)" : "#4b5563",
                    }}
                  >
                    {partner.subtitle}
                  </p>
                </>
              );

              const cardStyle: React.CSSProperties = {
                background: partner.card === "dark" ? "#000000" : "#ffffff",
                border: partner.card === "dark" ? "1px solid var(--border)" : "none",
                borderRadius: 16,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                minHeight: 160,
                textAlign: "center",
                boxShadow: "var(--shadow-card)",
                textDecoration: "none",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                cursor: partner.url ? "pointer" : "default",
              };

              if (partner.url) {
                return (
                  <a
                    key={partner.name}
                    href={partner.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={cardStyle}
                    title={`${partner.name} no Instagram`}
                    className="hover:scale-[1.02]"
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <div key={partner.name} style={cardStyle}>
                  {cardContent}
                </div>
              );
            })}

            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 16,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: 160,
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>Novos parceiros</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>Em breve...</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 40, padding: 32, textAlign: "center" }}>
            <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Quer ser nosso parceiro?</p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>
              Entre em contato conosco para conhecer as oportunidades de parceria.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
