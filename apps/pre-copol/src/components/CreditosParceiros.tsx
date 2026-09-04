import Image from "next/image";

/**
 * Créditos de desenvolvimento e apoio, para o rodapé dos dois sistemas.
 *
 * Duas linhas, não uma, porque os papéis são diferentes: a LSPK
 * desenvolveu; o Ecohub e a Universidade Positivo apoiaram. Um bloco
 * único com os três logos lado a lado diria que fizeram a mesma coisa.
 *
 * Padrão visual consistente
 * -------------------------
 * Todas as marcas (desenvolvimento e apoio) são exibidas dentro de
 * cartões brancos arredondados para manter harmonia, legibilidade e
 * integridade visual das cores originais sobre o fundo escuro do rodapé.
 */

const APOIO = [
  { nome: "Ecohub", src: "/partners/ecohub-rodape.png", largura: 320, altura: 96 },
  { nome: "Universidade Positivo", src: "/partners/positivo-rodape.png", largura: 313, altura: 96 },
];

export function CreditosParceiros() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: 32,
        rowGap: 20,
      }}
    >
      <Credito rotulo="Desenvolvido por">
        <span
          style={{
            background: "#ffffff",
            borderRadius: 8,
            padding: "6px 10px",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Image
            src="/partners/lspk-rodape.png"
            alt="LSPK Technology"
            width={249}
            height={96}
            style={{ height: 20, width: "auto" }}
          />
        </span>
      </Credito>

      <Credito rotulo="Apoio">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {APOIO.map((p) => (
            <span
              key={p.nome}
              style={{
                background: "#ffffff",
                borderRadius: 8,
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Image
                src={p.src}
                alt={p.nome}
                width={p.largura}
                height={p.altura}
                style={{ height: 20, width: "auto" }}
              />
            </span>
          ))}
        </div>
      </Credito>
    </div>
  );
}

function Credito({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          opacity: 0.75,
        }}
      >
        {rotulo}
      </span>
      {children}
    </div>
  );
}
