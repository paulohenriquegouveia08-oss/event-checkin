"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Eventos" },
  { href: "/programacao", label: "Programação" },
  { href: "/parcerias", label: "Parcerias" },
];

interface Props {
  eventTitle?: string;
  eventYear?: string;
}

export function SiteHeader({ eventTitle = "Pré-Copol", eventYear = "2026" }: Props) {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(14, 54, 52, 0.85)",
        backdropFilter: "blur(10px)",
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
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}>
          <Image src="/icon-mark.png" alt="" width={30} height={29} priority style={{ display: "block", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--foreground)", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              <span style={{ color: "var(--gold)" }}>{eventTitle}</span> {eventYear}
            </div>
            <div
              className="hidden sm:block"
              style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
            >
              3º COPOL · Londrina
            </div>
          </div>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 13,
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
