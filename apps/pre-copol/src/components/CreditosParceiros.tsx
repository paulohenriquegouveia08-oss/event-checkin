import Image from "next/image";

/**
 * Créditos de desenvolvimento e apoio, para o rodapé dos dois sistemas.
 *
 * Duas linhas, não uma, porque os papéis são diferentes: a LSPK
 * desenvolveu; o Ecohub e a Universidade Positivo apoiaram. Um bloco
 * único com os três logos lado a lado diria que fizeram a mesma coisa.
 *
 * Por que a LSPK aparece "solta" e as outras duas em cartão branco
 * ---------------------------------------------------------------
 * Não é inconsistência: é o que cada marca exige. A arte da LSPK é
 * branca e azul, feita para fundo escuro — sobre o verde do rodapé ela
 * lê direto (o fundo preto original foi removido). As artes do Ecohub e
 * da Positivo são escuras sobre transparente; no mesmo verde elas
 * praticamente desapareceriam, e recolori-las seria alterar marca de
 * terceiro. O cartão branco preserva as cores originais das duas.
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
        <Image
          src="/partners/lspk-rodape.png"
          alt="LSPK Tecnology"
          width={412}
          height={132}
          style={{ height: 30, width: "auto" }}
        />
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
