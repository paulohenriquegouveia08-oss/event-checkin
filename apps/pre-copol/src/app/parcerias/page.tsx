"use client";

import Link from "next/link";

export default function ParceriasPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            <span style={{ color: "var(--gold)" }}>Pré-Copol</span> 2026
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: 14 }}>
            Inscrições abertas — Vagas limitadas!
          </p>
        </div>
      </header>

      {/* Nav */}
      <nav
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--background)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 24 }}>
          <Link href="/" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>
            Eventos
          </Link>
          <Link href="/parcerias" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
            Parcerias
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: "32px 24px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <h2 style={{ fontSize: 22, margin: "0 0 24px" }}>Parcerias</h2>

        <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: "0 0 32px" }}>
          O Pré-Copol e o COPOL contam com o apoio de instituições e empresas comprometidas com a excelência em Odontologia.
        </p>

        {/* Partners grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {/* LSPK */}
          <div
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              minHeight: 140,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--primary)",
                textAlign: "center",
              }}
            >
              LSPK
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
              LSPK Tecnology
            </p>
          </div>

          {/* Universidade Positivo */}
          <div
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              minHeight: 140,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--gold)",
                textAlign: "center",
              }}
            >
              Universidade Positivo
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
              Campus Londrina
            </p>
          </div>

          {/* Placeholder for future partners */}
          <div
            style={{
              background: "var(--muted)",
              border: "2px dashed var(--border)",
              borderRadius: 8,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 140,
              opacity: 0.6,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)", textAlign: "center" }}>
              Novos parceiros
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
              Em breve...
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 40,
            padding: 24,
            background: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted-foreground)" }}>
            Quer ser nosso parceiro?
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>
            Entre em contato conosco para conhecer as oportunidades de parceria.
          </p>
        </div>
      </main>

      {/* Footer */}
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
