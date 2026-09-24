import Image from "next/image";
import type { Patrocinador } from "@/lib/patrocinadores";

/**
 * Logo do patrocinador — ou o nome, se ainda não há logo.
 *
 * `altura` fixa a altura (rodapé, ao lado dos outros logos). `largura`
 * deixa o logo ocupar até essa largura e encolher no celular (cartão da
 * página de Parcerias).
 */
export function MarcaPatrocinador({
  p,
  altura,
  largura,
}: {
  p: Patrocinador;
  altura: number;
  largura?: number;
}) {
  if (p.logo) {
    return (
      <Image
        src={p.logo.src}
        alt={p.nome}
        width={p.logo.largura}
        height={p.logo.altura}
        style={
          largura
            ? { width: "100%", maxWidth: largura, height: "auto" }
            : { height: altura, width: "auto" }
        }
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
