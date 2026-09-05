import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { VoltarParaInscricao } from "./VoltarParaInscricao";
import { SiteFooter } from "@/components/SiteFooter";
import { CONTROLADOR, SECOES, VERSAO_TERMOS, VIGENTE_DESDE } from "@/lib/termos";

export const metadata: Metadata = {
  title: "Termo de Inscrição e Privacidade",
  description:
    "Condições de participação no 3º COPOL 2026 e como os seus dados pessoais são tratados, conforme a LGPD.",
  alternates: {
    canonical: "/termos/",
  },
  openGraph: {
    title: "Termo de Inscrição e Privacidade | COPOL 2026",
    description:
      "Condições de participação no 3º COPOL 2026 e como os seus dados pessoais são tratados, conforme a LGPD.",
    url: "https://copol2026.com.br/termos/",
  },
};

/**
 * O termo por extenso.
 *
 * Pagina propria, e nao um modal: a pessoa precisa poder ler com calma,
 * voltar depois, mandar o link para alguem e imprimir. Um texto legal
 * que so existe dentro de uma janela que fecha ao clicar fora nao
 * cumpre o papel.
 *
 * O formulario abre este link em aba nova, para o que ja foi digitado
 * nao se perder.
 */
export default function TermosPage() {
  const faltaPreencher = !CONTROLADOR.cnpj || !CONTROLADOR.emailEncarregado;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, padding: "48px 24px 72px" }}>
        <article style={{ maxWidth: 760, margin: "0 auto" }}>
          <header style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginBottom: 12 }}>
              Termo de inscrição e aviso de privacidade
            </h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: 14 }}>
              Versão {VERSAO_TERMOS} · Vigente desde {VIGENTE_DESDE}
            </p>
          </header>

          {/* Aviso visivel enquanto a identificacao do controlador nao
              for preenchida. Sem CNPJ e sem canal do encarregado, o
              documento nao atende ao art. 41 da LGPD — e esconder isso
              seria pior que mostrar. */}
          {faltaPreencher && (
            <div
              role="alert"
              style={{
                padding: "14px 18px",
                marginBottom: 32,
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                borderRadius: 8,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <strong>Pendente de preenchimento pela organização.</strong> A identificação
              do controlador (CNPJ) e o canal do encarregado pelo tratamento de dados
              ainda não foram informados. Preencha em{" "}
              <code style={{ fontSize: 13 }}>src/lib/termos.ts</code> antes de abrir as
              inscrições.
            </div>
          )}

          <section style={{ marginBottom: 36 }}>
            <h2 style={tituloSecao}>Quem trata os seus dados</h2>
            <p style={paragrafo}>{CONTROLADOR.nome}</p>
            {CONTROLADOR.cnpj && <p style={paragrafo}>CNPJ {CONTROLADOR.cnpj}</p>}
            {CONTROLADOR.endereco && <p style={paragrafo}>{CONTROLADOR.endereco}</p>}
            {CONTROLADOR.emailEncarregado && (
              <p style={paragrafo}>
                Encarregado pelo tratamento de dados:{" "}
                <a href={`mailto:${CONTROLADOR.emailEncarregado}`}>
                  {CONTROLADOR.emailEncarregado}
                </a>
              </p>
            )}
          </section>

          {SECOES.map((secao) => (
            <section key={secao.titulo} style={{ marginBottom: 36 }}>
              <h2 style={tituloSecao}>{secao.titulo}</h2>
              {secao.paragrafos.map((p, i) => (
                <p key={i} style={paragrafo}>
                  {p}
                </p>
              ))}
              {secao.itens && (
                <ul style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 8 }}>
                  {secao.itens.map((item, i) => (
                    <li key={i} style={{ ...paragrafo, margin: 0 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <footer
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ color: "var(--muted-foreground)", fontSize: 13, margin: 0 }}>
              Este texto é a versão {VERSAO_TERMOS}. Alterações futuras não afetam quem
              já se inscreveu: cada inscrição guarda a versão vigente na data do aceite.
            </p>
            <VoltarParaInscricao />
          </footer>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

const tituloSecao: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 12,
  lineHeight: 1.3,
};

const paragrafo: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.7,
  color: "var(--muted-foreground)",
  margin: "0 0 12px",
};
