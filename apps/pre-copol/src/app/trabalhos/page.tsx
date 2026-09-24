"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createPublicSubmission,
  getSubmissionConfig,
  type SubmissionPublicConfig,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AlertTriangleIcon } from "@/components/Icons";

/**
 * Submissão de trabalhos pelo próprio autor.
 *
 * Um envio só: dados, autores e o arquivo. Se o evento cobra taxa, a
 * resposta já traz o Pix e o link do Mercado Pago, e a pessoa segue para
 * /trabalhos/pagamento — o trabalho só chega à comissão depois de pago.
 */

// Evento do COPOL que a organização gerencia no painel (indicado por ela).
// Fixo de propósito: procurar "o primeiro evento com copol no nome"
// depende da ordem da lista — há mais de um evento com COPOL no nome — e
// trabalho caindo no evento errado some da vista de quem avalia.
const COPOL_EVENT_ID = "01354410-f5ca-43a9-9d5c-8821ca44fdde";

const EXTENSOES_ACEITAS = [".pdf", ".docx"];

interface Autor {
  name: string;
  email: string;
  institution: string;
}

const autorVazio = (): Autor => ({ name: "", email: "", institution: "" });

function formatarReais(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      // "data:<tipo>;base64,XXXX" — o servidor quer só o depois da vírgula.
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 15,
  color: "var(--foreground)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--foreground)",
};

export default function TrabalhosPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SubmissionPublicConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPagina, setErroPagina] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [palavras, setPalavras] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [area, setArea] = useState("");
  const [autores, setAutores] = useState<Autor[]>([autorVazio()]);
  const [apresentador, setApresentador] = useState(0);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await getSubmissionConfig(COPOL_EVENT_ID));
      } catch (e) {
        setErroPagina(e instanceof Error ? e.message : "Não consegui carregar a chamada de trabalhos.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  function atualizarAutor(i: number, campo: keyof Autor, valor: string) {
    setAutores((lista) => lista.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
  }

  function removerAutor(i: number) {
    setAutores((lista) => lista.filter((_, j) => j !== i));
    // Mantém o apresentador apontando para a mesma pessoa.
    setApresentador((p) => (p === i ? 0 : p > i ? p - 1 : p));
  }

  function escolherArquivo(f: File | null) {
    setErro(null);
    if (!f || !config) {
      setArquivo(null);
      return;
    }
    const nome = f.name.toLowerCase();
    if (!EXTENSOES_ACEITAS.some((ext) => nome.endsWith(ext))) {
      setErro("Envie o trabalho em PDF ou DOCX (Word). Arquivos .doc antigos precisam ser salvos como .docx ou PDF.");
      setArquivo(null);
      return;
    }
    if (f.size > config.maxFileSizeMb * 1024 * 1024) {
      setErro(`O arquivo passa do limite de ${config.maxFileSizeMb} MB.`);
      setArquivo(null);
      return;
    }
    setArquivo(f);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setErro(null);

    const keywords = palavras
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (resumo.trim().length < 50) {
      setErro("O resumo precisa ter pelo menos 50 caracteres.");
      return;
    }
    if (keywords.length === 0) {
      setErro("Informe pelo menos uma palavra-chave.");
      return;
    }
    if (!arquivo) {
      setErro("Anexe o arquivo do trabalho (PDF ou DOCX).");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await createPublicSubmission(config.eventId, {
        modalityId: config.modalities.length > 0 ? modalidade : null,
        topicId: config.topics.length > 0 ? area : null,
        title: titulo.trim(),
        abstract: resumo.trim(),
        keywords,
        authors: autores.map((a, i) => ({
          name: a.name.trim(),
          email: a.email.trim().toLowerCase(),
          institution: a.institution.trim() || null,
          isPresenter: i === apresentador,
        })),
        fileName: arquivo.name,
        dataBase64: await lerBase64(arquivo),
      });
      router.push(`/trabalhos/pagamento/?id=${encodeURIComponent(resultado.id)}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o trabalho.");
      setEnviando(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "32px 16px 56px" }}>
        <div className="container-page" style={{ maxWidth: 760 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 30 }}>Submissão de Trabalhos</h1>
          <p style={{ margin: "0 0 24px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            Envie seu trabalho para avaliação da comissão científica. O arquivo pode ser em{" "}
            <strong>PDF</strong> ou <strong>DOCX</strong> (Word)
            {config ? `, com até ${config.maxFileSizeMb} MB` : ""}.
          </p>

          {carregando ? (
            <p style={{ color: "var(--muted-foreground)" }}>Carregando…</p>
          ) : erroPagina || !config ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ margin: 0 }}>{erroPagina ?? "Chamada de trabalhos indisponível."}</p>
            </div>
          ) : !config.aberta ? (
            <div className="card" style={{ padding: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <AlertTriangleIcon size={22} color="var(--warning)" />
              <div>
                <strong>Chamada de trabalhos fechada</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted-foreground)" }}>
                  {config.motivo ?? "O envio de trabalhos não está aberto no momento."}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={enviar} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {config.feeAmount !== null && (
                <div
                  style={{
                    background: "rgba(212, 168, 83, 0.1)",
                    border: "1px solid rgba(212, 168, 83, 0.35)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--gold)" }}>
                    Taxa de submissão: {formatarReais(config.feeAmount)} por trabalho.
                  </strong>{" "}
                  Ao enviar, você recebe o Pix e o link de pagamento do Mercado Pago (Pix ou cartão). O
                  trabalho segue para a comissão assim que o pagamento for aprovado.
                </div>
              )}

              <label style={labelStyle}>
                Título do trabalho *
                <input style={inputStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={5} maxLength={300} />
              </label>

              <label style={labelStyle}>
                Resumo *
                <textarea
                  style={{ ...inputStyle, minHeight: 140, resize: "vertical", fontFamily: "inherit" }}
                  value={resumo}
                  onChange={(e) => setResumo(e.target.value)}
                  required
                  maxLength={10000}
                />
                <small style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>
                  Pelo menos 50 caracteres ({resumo.trim().length}).
                </small>
              </label>

              <label style={labelStyle}>
                Palavras-chave *
                <input
                  style={inputStyle}
                  value={palavras}
                  onChange={(e) => setPalavras(e.target.value)}
                  placeholder="ex.: periodontia, saúde coletiva"
                  required
                />
                <small style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>Separe por vírgula.</small>
              </label>

              {(config.modalities.length > 0 || config.topics.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                  {config.modalities.length > 0 && (
                    <label style={labelStyle}>
                      Modalidade *
                      <select style={inputStyle} value={modalidade} onChange={(e) => setModalidade(e.target.value)} required>
                        <option value="">Selecione…</option>
                        {config.modalities.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {config.topics.length > 0 && (
                    <label style={labelStyle}>
                      Área temática *
                      <select style={inputStyle} value={area} onChange={(e) => setArea(e.target.value)} required>
                        <option value="">Selecione…</option>
                        {config.topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              <fieldset style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, margin: 0 }}>
                <legend style={{ padding: "0 6px", fontWeight: 700 }}>Autores</legend>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {autores.map((a, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{i === 0 ? "Autor principal" : `Coautor ${i}`}</strong>
                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                            <input type="radio" name="apresentador" checked={apresentador === i} onChange={() => setApresentador(i)} />
                            Apresentador
                          </label>
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => removerAutor(i)}
                              style={{ background: "none", border: "none", color: "var(--destructive)", cursor: "pointer", fontSize: 13 }}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                        <input
                          style={inputStyle}
                          placeholder="Nome completo *"
                          value={a.name}
                          onChange={(e) => atualizarAutor(i, "name", e.target.value)}
                          required
                          minLength={2}
                        />
                        <input
                          style={inputStyle}
                          type="email"
                          placeholder="E-mail *"
                          value={a.email}
                          onChange={(e) => atualizarAutor(i, "email", e.target.value)}
                          required
                        />
                        <input
                          style={inputStyle}
                          placeholder="Instituição"
                          value={a.institution}
                          onChange={(e) => atualizarAutor(i, "institution", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  {autores.length < 20 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setAutores((l) => [...l, autorVazio()])}
                      style={{ alignSelf: "flex-start" }}
                    >
                      + Adicionar coautor
                    </button>
                  )}
                  <small style={{ color: "var(--muted-foreground)" }}>
                    O Pix da taxa é emitido em nome do apresentador.
                  </small>
                </div>
              </fieldset>

              <label style={labelStyle}>
                Arquivo do trabalho (PDF ou DOCX) *
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
                  style={{ ...inputStyle, padding: 10 }}
                />
                {arquivo && (
                  <small style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>
                    {arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                )}
              </label>

              {erro && (
                <div
                  role="alert"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    color: "#fca5a5",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                  }}
                >
                  {erro}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={enviando} style={{ padding: 14, fontSize: 16 }}>
                {enviando
                  ? "Enviando…"
                  : config.feeAmount !== null
                    ? `Enviar trabalho e pagar ${formatarReais(config.feeAmount)}`
                    : "Enviar trabalho"}
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
