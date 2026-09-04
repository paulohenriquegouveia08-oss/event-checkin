import Image from "next/image";

/**
 * Créditos de desenvolvimento e apoio.
 *
 * Gêmeo do componente de mesmo nome no app `pre-copol`. São dois apps
 * Next separados, sem pacote compartilhado entre eles — o código é o
 * mesmo, escrito no vocabulário de cada um (aqui Tailwind, lá estilo
 * inline). Ao mexer em um, mexa no outro.
 *
 * Duas linhas porque os papéis são diferentes: a LSPK desenvolveu; o
 * Ecohub e a Universidade Positivo apoiaram.
 *
 * Padrão visual consistente: todas as marcas em cartões brancos arredondados
 * para máxima legibilidade e harmonia sobre o fundo escuro.
 */

const APOIO = [
  { nome: "Ecohub", src: "/partners/ecohub-rodape.png", largura: 320, altura: 96 },
  { nome: "Universidade Positivo", src: "/partners/positivo-rodape.png", largura: 313, altura: 96 },
];

export function CreditosParceiros({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-5 ${className}`}
    >
      <div className="flex flex-col items-center gap-2">
        <Rotulo>Desenvolvido por</Rotulo>
        <a
          href="https://www.instagram.com/lspktech"
          target="_blank"
          rel="noopener noreferrer"
          title="LSPK Technology no Instagram"
          className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 transition-transform hover:scale-105 cursor-pointer"
        >
          <Image
            src="/partners/lspk-rodape.png"
            alt="LSPK Technology"
            width={249}
            height={96}
            className="h-[18px] w-auto"
          />
        </a>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Rotulo>Apoio</Rotulo>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {APOIO.map((p) => (
            <span
              key={p.nome}
              className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5"
            >
              <Image
                src={p.src}
                alt={p.nome}
                width={p.largura}
                height={p.altura}
                className="h-[18px] w-auto"
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[--muted-foreground] opacity-75">
      {children}
    </span>
  );
}
