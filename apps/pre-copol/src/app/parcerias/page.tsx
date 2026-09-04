import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

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
      <SiteHeader />

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
            Realização e apoio
          </span>
          <h1 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", margin: "8px 0 16px" }}>Parcerias</h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 16, margin: "0 0 40px", maxWidth: 560, lineHeight: 1.6 }}>
            O Pré-Copol e o COPOL contam com o apoio de instituições e empresas comprometidas com a excelência em
            Odontologia.
          </p>

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
