import { useEffect, useRef, useState, type ChangeEvent } from "react";
import * as api from "../api/client";

/**
 * Biblioteca de modelos de certificado.
 *
 * A arte de cada evento era um arquivo dentro do repositório e as posições
 * eram constantes no código — um evento novo exigia programador e um
 * deploy. Aqui a arte é enviada, as posições são marcadas CLICANDO na
 * prévia, e o modelo fica disponível para escolher em qualquer evento.
 */

interface Ponto {
  x: number;
  y: number;
}

type Marcando = "nomeEsquerda" | "nomeDireita" | "nomeBase" | "qr" | null;

export function CertificateTemplatesPage() {
  const [modelos, setModelos] = useState<api.CertificateTemplateRecord[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Formulário de novo modelo
  // Id do modelo em edição. Null = criando um novo.
  //
  // Editar precisa existir: apagar um modelo EM USO é recusado (e deve
  // ser), então sem edição uma coordenada marcada errada num modelo já
  // escolhido por um evento ficaria impossível de corrigir pela tela.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<{ base64: string; url: string; largura: number; altura: number } | null>(null);
  const [marcando, setMarcando] = useState<Marcando>(null);
  const [nomeEsq, setNomeEsq] = useState<number | null>(null);
  const [nomeDir, setNomeDir] = useState<number | null>(null);
  const [nomeBase, setNomeBase] = useState<number | null>(null);
  const [qr, setQr] = useState<Ponto | null>(null);
  const [tamanhoQr, setTamanhoQr] = useState(120);
  const [fonte, setFonte] = useState<"serifada" | "sem-serifa">("sem-serifa");

  const imgRef = useRef<HTMLImageElement>(null);

  function carregar() {
    api
      .listCertificateTemplates()
      .then(setModelos)
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar os modelos"));
  }

  useEffect(carregar, []);

  function editar(m: api.CertificateTemplateRecord) {
    setErro(null);
    setAviso(null);
    setEditandoId(m.id);
    setNome(m.name);
    setDescricao(m.description ?? "");

    // A arte vem do servidor; `base64` fica vazio porque ela só é
    // reenviada se a pessoa escolher outro arquivo.
    setArquivo({
      base64: "",
      url: api.certificateTemplateImageUrl(m.id),
      largura: m.imageWidth,
      altura: m.imageHeight,
    });

    const l = (m.layout ?? {}) as {
      nome?: { xEsquerda: number; xDireita: number; yBase: number; fonte?: string };
      qr?: { xEsquerda: number; yTopo: number; tamanho: number } | null;
    };
    setNomeEsq(l.nome?.xEsquerda ?? null);
    setNomeDir(l.nome?.xDireita ?? null);
    setNomeBase(l.nome?.yBase ?? null);
    setFonte(l.nome?.fonte === "serifada" ? "serifada" : "sem-serifa");
    setQr(l.qr ? { x: l.qr.xEsquerda, y: l.qr.yTopo } : null);
    setTamanhoQr(l.qr?.tamanho ?? 120);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setDescricao("");
    setArquivo(null);
    setNomeEsq(null);
    setNomeDir(null);
    setNomeBase(null);
    setQr(null);
    setMarcando(null);
  }

  function aoEscolherArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setErro(null);

    if (f.type !== "image/png") {
      setErro("Envie a arte em PNG. JPEG perde qualidade em texto e linhas finas.");
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = String(leitor.result);
      const img = new Image();
      img.onload = () => {
        setArquivo({
          // O backend espera base64 puro, sem o prefixo "data:...".
          base64: dataUrl.split(",")[1] ?? "",
          url: dataUrl,
          largura: img.naturalWidth,
          altura: img.naturalHeight,
        });
        // Coordenadas antigas não valem para uma arte nova.
        setNomeEsq(null);
        setNomeDir(null);
        setNomeBase(null);
        setQr(null);
      };
      img.src = dataUrl;
    };
    leitor.readAsDataURL(f);
  }

  /**
   * Converte o clique na prévia para pixel da imagem original.
   *
   * A prévia é exibida menor que a arte; sem esta conversão, as
   * coordenadas seriam as da tela de quem clicou — e cada pessoa
   * marcaria um lugar diferente conforme o tamanho do navegador.
   */
  function aoClicarNaPrevia(ev: React.MouseEvent<HTMLImageElement>) {
    if (!marcando || !arquivo || !imgRef.current) return;
    const caixa = imgRef.current.getBoundingClientRect();
    const x = Math.round(((ev.clientX - caixa.left) / caixa.width) * arquivo.largura);
    const y = Math.round(((ev.clientY - caixa.top) / caixa.height) * arquivo.altura);

    if (marcando === "nomeEsquerda") setNomeEsq(x);
    if (marcando === "nomeDireita") setNomeDir(x);
    if (marcando === "nomeBase") setNomeBase(y);
    if (marcando === "qr") setQr({ x, y });
    setMarcando(null);
  }

  const prontoParaSalvar =
    nome.trim() !== "" && arquivo !== null && nomeEsq !== null && nomeDir !== null && nomeBase !== null && !salvando;

  async function salvar() {
    if (!arquivo || nomeEsq === null || nomeDir === null || nomeBase === null) return;
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      const layout = {
          nome: {
            xEsquerda: Math.min(nomeEsq, nomeDir),
            xDireita: Math.max(nomeEsq, nomeDir),
            yBase: nomeBase,
            alinhamento: "esquerda",
            fonte,
          },
          // Nulo = a arte já traz. É o caso comum: quase toda arte pronta
          // já vem com o texto, a data e as assinaturas impressos.
          paragrafo: null,
          chipData: null,
          assinaturas: null,
          qr: qr ? { xEsquerda: qr.x, yTopo: qr.y, tamanho: tamanhoQr } : null,
      };

      if (editandoId) {
        await api.updateCertificateTemplate(editandoId, {
          name: nome.trim(),
          description: descricao.trim() || null,
          layout,
          // A arte só é reenviada se outro arquivo foi escolhido — trocar
          // só as coordenadas não deve exigir subir a imagem de novo.
          ...(arquivo.base64 ? { mimeType: "image/png", dataBase64: arquivo.base64 } : {}),
        });
        setAviso(
          "Modelo atualizado. Os certificados dos eventos que usam este modelo serão refeitos no próximo download.",
        );
      } else {
        await api.createCertificateTemplate({
          name: nome.trim(),
          description: descricao.trim() || undefined,
          mimeType: "image/png",
          dataBase64: arquivo.base64,
          layout,
        });
        setAviso("Modelo salvo. Já pode ser escolhido em qualquer evento.");
      }

      limparFormulario();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o modelo");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(m: api.CertificateTemplateRecord) {
    setErro(null);
    setAviso(null);
    try {
      await api.deleteCertificateTemplate(m.id);
      setAviso(`"${m.name}" removido.`);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  const botaoMarcar = (chave: Marcando, rotulo: string, valor: string) => (
    <button
      type="button"
      className={marcando === chave ? "botao botao--forte" : "botao botao--fraco"}
      onClick={() => setMarcando(marcando === chave ? null : chave)}
    >
      {rotulo}: {valor}
    </button>
  );

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <h1>Modelos de certificado</h1>
          <p className="dica">
            Envie a arte uma vez e escolha o modelo em qualquer evento. As posições são
            marcadas clicando na prévia — nada precisa ser medido à mão.
          </p>
        </div>
      </header>

      {erro && <p className="aviso aviso--erro">{erro}</p>}
      {aviso && <p className="aviso aviso--ok">{aviso}</p>}

      <section className="secaoAvisos">
        <h2 className="tituloSecao">{editandoId ? "Editar modelo" : "Novo modelo"}</h2>
        {editandoId && (
          <p className="muted">
            Alterar as posições aqui refaz os certificados dos eventos que usam este modelo
            no próximo download. Quem já baixou continua com o arquivo antigo.
          </p>
        )}

        <label className="campo">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Semantix 2026" />
        </label>

        <label className="campo">
          Descrição
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Arte da Semantix — nome e QR desenhados por cima"
          />
        </label>

        <label className="campo">
          Arte (PNG)
          <input type="file" accept="image/png" onChange={aoEscolherArquivo} />
          <small className="muted">
            Envie a arte <strong>sem o nome de exemplo</strong> — o nome real é desenhado por
            cima, e os dois apareceriam sobrepostos.
            {editandoId && " Deixe em branco para manter a arte atual e mexer só nas posições."}
          </small>
        </label>

        {arquivo && (
          <>
            <p className="muted">
              {arquivo.largura}×{arquivo.altura}px. Clique num botão abaixo e depois no ponto
              da arte.
            </p>

            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {botaoMarcar("nomeEsquerda", "Início do nome", nomeEsq === null ? "—" : `x ${nomeEsq}`)}
              {botaoMarcar("nomeDireita", "Fim do nome", nomeDir === null ? "—" : `x ${nomeDir}`)}
              {botaoMarcar("nomeBase", "Linha de base", nomeBase === null ? "—" : `y ${nomeBase}`)}
              {botaoMarcar("qr", "Canto do QR", qr === null ? "sem QR" : `${qr.x},${qr.y}`)}
            </div>

            {qr && (
              <label className="campo">
                Tamanho do QR (px)
                <input
                  type="number"
                  min={40}
                  max={600}
                  value={tamanhoQr}
                  onChange={(e) => setTamanhoQr(Number(e.target.value))}
                />
              </label>
            )}

            <label className="campo">
              Fonte do nome
              <select value={fonte} onChange={(e) => setFonte(e.target.value as typeof fonte)}>
                <option value="sem-serifa">Sem serifa</option>
                <option value="serifada">Serifada</option>
              </select>
              <small className="muted">Escolha a que combina com a arte.</small>
            </label>

            <div style={{ position: "relative", border: "1px solid var(--linha)", borderRadius: "0.5rem", overflow: "hidden" }}>
              <img
                ref={imgRef}
                src={arquivo.url}
                alt="Prévia da arte"
                onClick={aoClicarNaPrevia}
                style={{ display: "block", width: "100%", cursor: marcando ? "crosshair" : "default" }}
              />
              {/* Marcas do que já foi definido, na escala da prévia. */}
              {nomeBase !== null && (
                <div
                  style={{
                    position: "absolute",
                    left: `${((Math.min(nomeEsq ?? 0, nomeDir ?? 0)) / arquivo.largura) * 100}%`,
                    width: nomeEsq !== null && nomeDir !== null
                      ? `${(Math.abs(nomeDir - nomeEsq) / arquivo.largura) * 100}%`
                      : "2px",
                    top: `${(nomeBase / arquivo.altura) * 100}%`,
                    height: "2px",
                    background: "var(--acento)",
                  }}
                />
              )}
              {qr && (
                <div
                  style={{
                    position: "absolute",
                    left: `${(qr.x / arquivo.largura) * 100}%`,
                    top: `${(qr.y / arquivo.altura) * 100}%`,
                    width: `${(tamanhoQr / arquivo.largura) * 100}%`,
                    aspectRatio: "1",
                    border: "2px solid var(--acento)",
                  }}
                />
              )}
            </div>
          </>
        )}

        <div className="row" style={{ gap: "0.6rem" }}>
          <button className="botao botao--forte" disabled={!prontoParaSalvar} onClick={() => void salvar()}>
            {salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar modelo"}
          </button>
          {editandoId && (
            <button className="botao botao--fraco" onClick={limparFormulario} disabled={salvando}>
              Cancelar
            </button>
          )}
        </div>
      </section>

      <section className="secaoAvisos">
        <h2 className="tituloSecao">Modelos salvos ({modelos.length})</h2>
        {modelos.length === 0 ? (
          <p className="dica">Nenhum modelo ainda. Eventos sem modelo usam o certificado padrão.</p>
        ) : (
          <ul className="lista">
            {modelos.map((m) => (
              <li key={m.id} className="item">
                <img
                  src={api.certificateTemplateImageUrl(m.id)}
                  alt={m.name}
                  style={{ width: "100%", borderRadius: "0.4rem", border: "1px solid var(--linha)" }}
                />
                <div className="item__id">
                  <strong>{m.name}</strong>
                  <code>
                    {m.imageWidth}×{m.imageHeight}px
                  </code>
                </div>
                {m.description && <span className="item__resultado">{m.description}</span>}
                <div className="item__linha">
                  <span className="muted">
                    {m.eventosUsando === 0
                      ? "não usado"
                      : `${m.eventosUsando} evento(s)`}
                  </span>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <button className="botao botao--fraco" onClick={() => editar(m)}>
                      Editar
                    </button>
                    <button
                      className="botao botao--fraco"
                      disabled={m.eventosUsando > 0}
                      title={
                        m.eventosUsando > 0
                          ? "Em uso — troque o modelo desses eventos antes. Para corrigir a arte ou as posições, use Editar."
                          : undefined
                      }
                      onClick={() => void apagar(m)}
                    >
                      Remover
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
