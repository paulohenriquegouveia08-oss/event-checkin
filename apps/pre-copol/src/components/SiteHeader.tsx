"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { handleLogoDoubleAction, handleLogoTouchEnd } from "@/lib/download-apk";

const LINKS = [
  // `soNoAmplo`: escondido no celular. "Eventos" aponta para a home, e
  // o logo ao lado ja faz isso — em tela estreita ele so roubava o
  // espaco de que o nome do evento precisava para nao ser truncado.
  { href: "/", label: "Eventos", soNoAmplo: true },
  { href: "/programacao/", label: "Programação" },
  { href: "/parcerias/", label: "Parcerias" },
];

interface Props {
  eventTitle?: string;
  eventYear?: string;
  subtitle?: string;
}

export function SiteHeader({ eventTitle = "Pré-Copol", eventYear = "2026", subtitle }: Props) {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--background)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="container-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Image
            src="/icon-mark.png"
            alt="COPOL — Congresso de Odontologia de Londrina"
            width={30}
            height={29}
            priority
            title="Dois cliques para baixar o app leitor de QR Code (APK)"
            style={{ display: "block", flexShrink: 0, cursor: "pointer", userSelect: "none" }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleLogoDoubleAction(e);
            }}
            onTouchEnd={handleLogoTouchEnd}
          />
          <Link href="/" style={{ textDecoration: "none", minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
                color: "var(--foreground)",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                // Sem estes dois, `minWidth: 0` no pai nao adianta: o
                // texto vaza da caixa e passa por baixo do menu. No
                // celular o titulo ficava escrito por cima dos links.
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ color: "var(--gold)" }}>{eventTitle}</span>
              {/* O ano sai no celular, como ja acontece com o subtitulo
                  logo abaixo: e' o pedaco menos essencial do nome, e
                  era ele que forcava o corte em "Pré-Copol 20…". */}
              <span className="hidden sm:inline"> {eventYear}</span>
            </div>
            <div
              className="hidden sm:block"
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle || "3º COPOL · Londrina"}
            </div>
          </Link>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`link-menu${link.soNoAmplo ? " hidden sm:inline-flex" : ""}`}
                style={{
                  borderRadius: 999,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  background: active ? "var(--primary)" : "transparent",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
