"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee } from "@/lib/api";
import estilos from "./inscricao.module.css";

/**
 * Página pública de inscrição.
 *
 * O evento vem pelo SLUG, e não por um id cravado aqui: id no código
 * sobrevive ao evento e aponta para o lugar errado no ano seguinte.
 *
 * Depois de inscrever, a pessoa é levada direto para o QR Code — sem
 * pedir que "entre de novo com o e-mail". Ela acabou de digitar o
 * e-mail; pedir outra vez seria burocracia inventada.
 */

const VERSAO_DO_TERMO = "1.0";

interface Evento {
  id: string;
  name: string;
  location: string | null;
  startDate: string;
  endDate: string;
  registrationsOpen: boolean;
  siteContent: Conteudo | null;
}

interface Conteudo {
  heroTitulo?: string;
  heroSubtitulo?: string;
  heroTexto?: string;
  local?: string;
  cargaHoraria?: string;
  realizacao?: string[];
  destaques?: { titulo: string; texto: string }[];
}

/** Máscara de CPF, aplicada enquanto digita. */
function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Valida o CPF pelos dígitos verificadores.
 *
 * Contar 11 dígitos não basta: "11111111111" tem onze. Um CPF inválido só
 * apareceria no dia do credenciamento, quando não dá mais para corrigir.
 */
function cpfValido(bruto: string): boolean {
  const cpf = bruto.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function InscricaoCliente({ slug }: { slug: string }) {
  const router = useRouter();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDaPagina, setErroDaPagina] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aceite, setAceite] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/publico/evento/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok || !corpo?.data) throw new Error(corpo?.error?.message ?? "Evento não encontrado");
        setEvento(corpo.data);
      })
      .catch((e) => setErroDaPagina(e instanceof Error ? e.message : "Não consegui carregar o evento"))
      .finally(() => setCarregando(false));
  }, [slug]);

  const c: Conteudo = evento?.siteContent ?? {};

  const dataFormatada = evento
    ? new Date(evento.startDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  const horaFormatada = evento
    ? new Date(evento.startDate).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!evento) return;
    setErro(null);

    if (!cpfValido(cpf)) {
      setErro("Confira o CPF — os dígitos não batem.");
      return;
    }
    if (!aceite) {
      setErro("É preciso aceitar o uso dos seus dados para concluir a inscrição.");
      return;
    }

    setEnviando(true);
    try {
      const r = await fetch("/api/publico/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: evento.id,
          // O backend guarda um nome só; o formulário pede separado
          // porque é como as pessoas esperam preencher.
          name: `${nome.trim()} ${sobrenome.trim()}`.replace(/\s+/g, " ").trim(),
          email: email.trim().toLowerCase(),
          document: cpf.replace(/\D/g, ""),
          phone: telefone.replace(/\D/g, "") || null,
          consentVersion: VERSAO_DO_TERMO,
        }),
      });

      const corpo = await r.json();
      if (!r.ok) {
        const detalhe =
          corpo?.error?.details?.fieldErrors &&
          Object.values(corpo.error.details.fieldErrors).flat().filter(Boolean).join(" ");
        throw new Error(detalhe || corpo?.error?.message || "Não consegui concluir a inscrição.");
      }

      // Já entra na área do participante: o QR Code aparece na sequência,
      // sem pedir para digitar o e-mail de novo.
      try {
        const login = await loginAttendee(email.trim().toLowerCase());
        if (login.data.token) {
          localStorage.setItem("attendee_token", login.data.token);
          localStorage.setItem("attendee_data", JSON.stringify(login.data.participant));
          router.push("/checkin");
          return;
        }
      } catch {
        // A inscrição JÁ está feita. Falhar aqui não pode parecer que
        // nada aconteceu — a tela abaixo explica o que fazer.
      }
      router.push(`/?inscrito=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui concluir a inscrição.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <main className={estilos.pagina}>
        <p className={estilos.aviso}>Carregando…</p>
      </main>
    );
  }

  if (erroDaPagina || !evento) {
    return (
      <main className={estilos.pagina}>
        <div className={estilos.cartao}>
          <h1 className={estilos.tituloErro}>Evento não encontrado</h1>
          <p className={estilos.texto}>{erroDaPagina}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={estilos.pagina}>
      <div className={estilos.faixaTopo} aria-hidden="true" />

      <section className={estilos.hero}>
        <p className={estilos.sobreTitulo}>{c.realizacao?.join(" · ") ?? "Inscrições abertas"}</p>
        <h1 className={estilos.titulo}>{c.heroTitulo ?? evento.name}</h1>
        {c.heroSubtitulo && <p className={estilos.subtitulo}>{c.heroSubtitulo}</p>}
        {c.heroTexto && <p className={estilos.texto}>{c.heroTexto}</p>}

        <ul className={estilos.fatos}>
          <li>
            <span className={estilos.fatoRotulo}>Data</span>
            <strong>
              {dataFormatada} · {horaFormatada}
            </strong>
          </li>
          <li>
            <span className={estilos.fatoRotulo}>Local</span>
            <strong>{c.local ?? evento.location ?? "A confirmar"}</strong>
          </li>
          <li>
            <span className={estilos.fatoRotulo}>Certificado</span>
            <strong>{c.cargaHoraria ?? "Com certificado"}</strong>
          </li>
        </ul>
      </section>

      {c.destaques && c.destaques.length > 0 && (
        <section className={estilos.destaques}>
          {c.destaques.map((d) => (
            <article key={d.titulo} className={estilos.destaque}>
              <h2>{d.titulo}</h2>
              <p>{d.texto}</p>
            </article>
          ))}
        </section>
      )}

      <section className={estilos.cartao} id="inscricao">
        <h2 className={estilos.tituloForm}>Faça sua inscrição</h2>

        {!evento.registrationsOpen ? (
          <p className={estilos.fechado}>
            As inscrições para este evento estão encerradas.
          </p>
        ) : (
          <form onSubmit={enviar} className={estilos.form} noValidate>
            <div className={estilos.dupla}>
              <label className={estilos.campo}>
                Nome
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoComplete="given-name"
                  placeholder="Maria"
                />
              </label>
              <label className={estilos.campo}>
                Sobrenome
                <input
                  value={sobrenome}
                  onChange={(e) => setSobrenome(e.target.value)}
                  required
                  autoComplete="family-name"
                  placeholder="Souza"
                />
              </label>
            </div>

            <label className={estilos.campo}>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                placeholder="maria@exemplo.com"
              />
              <small>É por ele que você acessa seu QR Code e o certificado.</small>
            </label>

            <div className={estilos.dupla}>
              <label className={estilos.campo}>
                CPF
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatarCpf(e.target.value))}
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </label>
              <label className={estilos.campo}>
                Telefone
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(41) 90000-0000"
                />
              </label>
            </div>

            <label className={estilos.aceite}>
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                Autorizo o uso dos meus dados para credenciamento, controle de presença e emissão
                do certificado deste evento.
              </span>
            </label>

            {erro && <p className={estilos.erro}>{erro}</p>}

            <button type="submit" className={estilos.botao} disabled={enviando}>
              {enviando ? "Enviando…" : "Confirmar inscrição"}
            </button>

            <p className={estilos.rodapeForm}>
              Já se inscreveu? <a href="/">Acesse seu QR Code</a>.
            </p>
          </form>
        )}
      </section>

      <div className={estilos.faixaRodape} aria-hidden="true" />
    </main>
  );
}
