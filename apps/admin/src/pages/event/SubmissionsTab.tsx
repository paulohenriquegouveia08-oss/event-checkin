import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";

const STATUS_LABEL: Record<api.SubmissionStatus, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Enviado",
  UNDER_REVIEW: "Em avaliação",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  WITHDRAWN: "Retirado",
};

const STATUS_BADGE: Record<api.SubmissionStatus, string> = {
  DRAFT: "badge-muted",
  SUBMITTED: "badge-warning",
  UNDER_REVIEW: "badge-warning",
  APPROVED: "badge-success",
  REJECTED: "badge-danger",
  WITHDRAWN: "badge-muted",
};

/** Converte o arquivo escolhido em base64 — é assim que o backend recebe. */
function lerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      // O FileReader devolve "data:application/pdf;base64,XXXX" — o backend
      // quer só o depois da vírgula.
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

export function SubmissionsTab({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<api.SubmissionSettings | null>(null);
  const [modalities, setModalities] = useState<api.CatalogItem[]>([]);
  const [topics, setTopics] = useState<api.CatalogItem[]>([]);
  const [lista, setLista] = useState<api.SubmissionRecord[]>([]);
  const [total, setTotal] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [novaModalidade, setNovaModalidade] = useState("");
  const [novaArea, setNovaArea] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [criando, setCriando] = useState(false);

  // Formulário de novo trabalho
  const [fTitulo, setFTitulo] = useState("");
  const [fResumo, setFResumo] = useState("");
  const [fPalavras, setFPalavras] = useState("");
  const [fModalidade, setFModalidade] = useState("");
  const [fArea, setFArea] = useState("");
  const [fAutorNome, setFAutorNome] = useState("");
  const [fAutorEmail, setFAutorEmail] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const [s, m, t, l] = await Promise.all([
        api.getSubmissionSettings(eventId),
        api.listModalities(eventId),
        api.listTopics(eventId),
        api.listSubmissions(eventId, {
          search: busca || undefined,
          status: filtroStatus || undefined,
        }),
      ]);
      setSettings(s);
      setModalities(m);
      setTopics(t);
      setLista(l.items);
      setTotal(l.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, busca, filtroStatus]);

  async function acao<T>(chave: string, fn: () => Promise<T>, sucesso: string) {
    setError(null);
    setAviso(null);
    setOcupado(chave);
    try {
      await fn();
      setAviso(sucesso);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na operação");
    } finally {
      setOcupado(null);
    }
  }

  async function criarTrabalho(e: FormEvent) {
    e.preventDefault();
    setCriando(true);
    setError(null);
    try {
      await api.createSubmission(eventId, {
        modalityId: fModalidade,
        topicId: fArea,
        title: fTitulo,
        abstract: fResumo,
        keywords: fPalavras
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        authors: [{ name: fAutorNome, email: fAutorEmail }],
      });
      setFTitulo("");
      setFResumo("");
      setFPalavras("");
      setFAutorNome("");
      setFAutorEmail("");
      setAviso("Trabalho cadastrado como rascunho. Anexe o PDF para poder enviar.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    } finally {
      setCriando(false);
    }
  }

  async function anexar(s: api.SubmissionRecord, file: File) {
    await acao(
      `file-${s.id}`,
      async () => api.uploadSubmissionFile(eventId, s.id, file.name, await lerBase64(file)),
      `Arquivo anexado a ${s.code}.`
    );
  }

  async function abrirPdf(s: api.SubmissionRecord) {
    try {
      const blob = await api.fetchSubmissionFile(eventId, s.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Libera a memória depois que o navegador já abriu a aba.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui abrir o PDF");
    }
  }

  const podeCadastrar = modalities.length > 0 && topics.length > 0;

  return (
    <div className="stack">
      {error && <p className="error-text">{error}</p>}
      {aviso && <p className="muted">{aviso}</p>}

      {/* ── prazo ── */}
      <section className="card">
        <h3>Prazo da chamada</h3>
        {settings && (
          <div className="stack">
            <div className="row">
              <label className="field">
                Abre em
                <input
                  type="datetime-local"
                  value={settings.opensAt ? settings.opensAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    setSettings({ ...settings, opensAt: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                Fecha em
                <input
                  type="datetime-local"
                  value={settings.closesAt ? settings.closesAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    setSettings({ ...settings, closesAt: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                Tamanho máximo do PDF (MB)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.maxFileSizeMb}
                  onChange={(e) =>
                    setSettings({ ...settings, maxFileSizeMb: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <p className="muted">
              Deixe em branco para não limitar: sem data de abertura a chamada já
              está aberta; sem fechamento, não fecha sozinha.
            </p>
            <button
              type="button"
              className="btn"
              disabled={ocupado === "settings"}
              onClick={() =>
                acao(
                  "settings",
                  () =>
                    api.updateSubmissionSettings(eventId, {
                      opensAt: settings.opensAt
                        ? new Date(settings.opensAt).toISOString()
                        : null,
                      closesAt: settings.closesAt
                        ? new Date(settings.closesAt).toISOString()
                        : null,
                      maxFileSizeMb: settings.maxFileSizeMb,
                    }),
                  "Prazo salvo."
                )
              }
            >
              Salvar prazo
            </button>
          </div>
        )}
      </section>

      {/* ── catálogo ── */}
      <section className="card">
        <h3>Modalidades e áreas temáticas</h3>
        <p className="muted">
          A modalidade é o formato (Pôster, Oral). A área é o assunto
          (Ortodontia, Saúde Coletiva). É preciso ter pelo menos uma de cada
          antes de cadastrar um trabalho.
        </p>

        <div className="row">
          <div className="stack" style={{ flex: 1 }}>
            <strong>Modalidades</strong>
            {modalities.length === 0 && <p className="muted">Nenhuma ainda.</p>}
            {modalities.map((m) => (
              <div key={m.id} className="spread">
                <span>
                  {m.name}{" "}
                  <span className="muted">
                    ({m.submissionCount}{" "}
                    {m.submissionCount === 1 ? "trabalho" : "trabalhos"})
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={ocupado === `m-${m.id}`}
                  onClick={() =>
                    acao(`m-${m.id}`, () => api.deleteModality(eventId, m.id), "Modalidade removida.")
                  }
                >
                  Excluir
                </button>
              </div>
            ))}
            <div className="row">
              <input
                type="text"
                value={novaModalidade}
                placeholder="Ex.: Pôster"
                onChange={(e) => setNovaModalidade(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm"
                disabled={!novaModalidade.trim() || ocupado === "nova-m"}
                onClick={() =>
                  acao(
                    "nova-m",
                    async () => {
                      await api.createModality(eventId, novaModalidade.trim());
                      setNovaModalidade("");
                    },
                    "Modalidade criada."
                  )
                }
              >
                Adicionar
              </button>
            </div>
          </div>

          <div className="stack" style={{ flex: 1 }}>
            <strong>Áreas temáticas</strong>
            {topics.length === 0 && <p className="muted">Nenhuma ainda.</p>}
            {topics.map((t) => (
              <div key={t.id} className="spread">
                <span>
                  {t.name}{" "}
                  <span className="muted">
                    ({t.submissionCount}{" "}
                    {t.submissionCount === 1 ? "trabalho" : "trabalhos"})
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={ocupado === `t-${t.id}`}
                  onClick={() =>
                    acao(`t-${t.id}`, () => api.deleteTopic(eventId, t.id), "Área removida.")
                  }
                >
                  Excluir
                </button>
              </div>
            ))}
            <div className="row">
              <input
                type="text"
                value={novaArea}
                placeholder="Ex.: Saúde Coletiva"
                onChange={(e) => setNovaArea(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm"
                disabled={!novaArea.trim() || ocupado === "nova-t"}
                onClick={() =>
                  acao(
                    "nova-t",
                    async () => {
                      await api.createTopic(eventId, novaArea.trim());
                      setNovaArea("");
                    },
                    "Área criada."
                  )
                }
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── novo trabalho ── */}
      <section className="card">
        <h3>Cadastrar trabalho</h3>
        {!podeCadastrar ? (
          <p className="muted">
            Cadastre pelo menos uma modalidade e uma área temática acima antes de
            lançar um trabalho.
          </p>
        ) : (
          <form onSubmit={criarTrabalho} className="stack">
            <label className="field">
              Título
              <input
                type="text"
                value={fTitulo}
                required
                minLength={5}
                onChange={(e) => setFTitulo(e.target.value)}
              />
            </label>
            <label className="field">
              Resumo
              <textarea
                rows={4}
                value={fResumo}
                required
                minLength={50}
                onChange={(e) => setFResumo(e.target.value)}
              />
              <small className="muted">Pelo menos 50 caracteres.</small>
            </label>
            <div className="row">
              <label className="field">
                Modalidade
                <select
                  value={fModalidade}
                  required
                  onChange={(e) => setFModalidade(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {modalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Área temática
                <select value={fArea} required onChange={(e) => setFArea(e.target.value)}>
                  <option value="">Selecione…</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              Palavras-chave
              <input
                type="text"
                value={fPalavras}
                required
                placeholder="cárie, saúde coletiva"
                onChange={(e) => setFPalavras(e.target.value)}
              />
              <small className="muted">Separe por vírgula.</small>
            </label>
            <div className="row">
              <label className="field">
                Autor
                <input
                  type="text"
                  value={fAutorNome}
                  required
                  onChange={(e) => setFAutorNome(e.target.value)}
                />
              </label>
              <label className="field">
                E-mail do autor
                <input
                  type="email"
                  value={fAutorEmail}
                  required
                  onChange={(e) => setFAutorEmail(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="btn" disabled={criando}>
              {criando ? "Cadastrando…" : "Cadastrar trabalho"}
            </button>
          </form>
        )}
      </section>

      {/* ── lista ── */}
      <section className="card">
        <h3>
          Trabalhos {total > 0 && <span className="muted">({total})</span>}
        </h3>

        <div className="row">
          <input
            type="search"
            placeholder="Buscar por título, autor ou protocolo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {carregando ? (
          <p className="muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="muted">
            {busca || filtroStatus
              ? "Nenhum trabalho com esse filtro."
              : "Nenhum trabalho cadastrado ainda."}
          </p>
        ) : (
          <div className="stack">
            {lista.map((s) => (
              <div key={s.id} className="card">
                <div className="spread">
                  <div>
                    <strong>{s.title}</strong>
                    <div className="muted">
                      <span className="monospace">{s.code}</span> · {s.modality.name} ·{" "}
                      {s.topic.name} · {s.authors.map((a) => a.name).join(", ")}
                    </div>
                  </div>
                  <span className={`badge ${STATUS_BADGE[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>

                <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                  {s.fileName ? (
                    <button type="button" className="btn btn-sm" onClick={() => abrirPdf(s)}>
                      Abrir PDF
                    </button>
                  ) : (
                    <label className="btn btn-sm" style={{ cursor: "pointer" }}>
                      Anexar PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) anexar(s, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}

                  {s.status === "DRAFT" && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!s.fileName || ocupado === `sub-${s.id}`}
                      title={!s.fileName ? "Anexe o PDF antes de enviar" : undefined}
                      onClick={() =>
                        acao(
                          `sub-${s.id}`,
                          () => api.submitSubmission(eventId, s.id),
                          `${s.code} enviado.`
                        )
                      }
                    >
                      Enviar
                    </button>
                  )}

                  {(s.status === "SUBMITTED" || s.status === "UNDER_REVIEW") && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={ocupado === `ap-${s.id}`}
                        onClick={() =>
                          acao(
                            `ap-${s.id}`,
                            () => api.decideSubmission(eventId, s.id, "APPROVED"),
                            `${s.code} aprovado.`
                          )
                        }
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={ocupado === `re-${s.id}`}
                        onClick={() =>
                          acao(
                            `re-${s.id}`,
                            () => api.decideSubmission(eventId, s.id, "REJECTED"),
                            `${s.code} reprovado.`
                          )
                        }
                      >
                        Reprovar
                      </button>
                    </>
                  )}

                  {s.status !== "WITHDRAWN" && s.status !== "APPROVED" && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={ocupado === `wd-${s.id}`}
                      onClick={() =>
                        acao(
                          `wd-${s.id}`,
                          () => api.withdrawSubmission(eventId, s.id),
                          `${s.code} retirado.`
                        )
                      }
                    >
                      Retirar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
