import Image from "next/image";
import type { Patrocinador } from "@/lib/patrocinadores";

/** Logo do patrocinador na altura pedida — ou o nome, se ainda não há logo. */
export function MarcaPatrocinador({ p, altura }: { p: Patrocinador; altura: number }) {
  if (p.logo) {
    return (
      <Image
        src={p.logo.src}
        alt={p.nome}
        width={p.logo.largura}
        height={p.logo.altura}
        style={{ height: altura, width: "auto" }}
      />
    );
  }
  return (
    <span
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 900,
        fontSize: altura,
        lineHeight: 1,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: p.cor,
      }}
    >
      {p.nome}
    </span>
  );
}
