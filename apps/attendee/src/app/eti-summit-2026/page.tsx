"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee } from "@/lib/api";
import { CreditosParceiros } from "@/components/CreditosParceiros";

export const dynamic = "force-dynamic";

/**
 * ETI Summit 2026 — Semana Acadêmica de Tecnologia e Engenharia.
 *
 * Reúne, num só lugar, o link de inscrição das três atividades da semana.
 * Data/horário vêm do backend (mesma fonte da home) — só o slug, o nome
 * curto pra exibição e o resumo de uma linha de cada atividade são fixos
 * aqui, porque são o que dá identidade a ESTA página específica.
 */
const ATIVIDADES: { slug: string; nome: string; resumo: string }[] = [
  { slug: "ecohub", nome: "Sistemas Multi-Agente", resumo: "Arquitetura e orquestração de agentes de IA" },
  { slug: "wmbarros", nome: "HTML, CSS e JavaScript", resumo: "Interfaces e tratativas de dados na prática" },
  { slug: "maratona", nome: "Maratona de Programação", resumo: "Equipes de até 5 pessoas · Bloco B" },
];

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function diaEHora(iso?: string): { dia: string; hora: string } {
  if (!iso) return { dia: "—", hora: "" };
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const mesIndex = Number(get("month")) - 1;
  const hh = Number(get("hour"));
  const mm = get("minute");
  return {
    dia: `${get("day")} ${MESES[mesIndex] ?? ""}`,
    hora: mm === "00" ? `${hh}H` : `${hh}H${mm}`,
  };
}

export default function EtiSummitPage() {
  const router = useRouter();
  const [datas, setDatas] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/publico/eventos-abertos")
      .then((r) => r.json())
      .then((corpo) => {
        const lista: { slug: string; startDate?: string }[] = Array.isArray(corpo?.data) ? corpo.data : [];
        const mapa: Record<string, string> = {};
        for (const e of lista) if (e.slug && e.startDate) mapa[e.slug] = e.startDate;
        setDatas(mapa);
      })
      .catch(() => {});
  }, []);

  async function acessar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const limpo = email.trim().toLowerCase();
      const resposta = await loginAttendee(limpo);
      if (resposta.data.token && resposta.data.participant) {
        localStorage.setItem("attendee_token", resposta.data.token);
        localStorage.setItem("attendee_data", JSON.stringify(resposta.data.participant));
        router.push("/checkin");
        return;
      }
      // Mais de um evento vinculado a este e-mail: a home já sabe listar
      // e deixar escolher — não duplica essa tela aqui.
      router.push(`/?email=${encodeURIComponent(limpo)}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Nenhum evento encontrado para este e-mail.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <header className="cartao space-y-3 p-7 text-center">
          <p className="mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
            Universidade Positivo Londrina
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">ETI Summit 2026</h1>
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Semana Acadêmica de Tecnologia e Engenharia
          </p>
          <p className="text-base font-bold text-[var(--primary)]">22 a 26 de setembro</p>
          <p className="mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--muted-foreground)] opacity-80">
            EcoHub · Universidade Positivo · LSPK Technology
          </p>
        </header>

        <div className="cartao space-y-2 border-[var(--warning)]/30 bg-[var(--warning)]/5 p-5">
          <p className="mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--warning)]">
            Orientação aos professores
          </p>
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            As atividades acadêmicas seguem o planejamento de cada docente, especialmente em caso de
            avaliações.
          </p>
          <p className="text-sm font-semibold leading-relaxed text-[var(--foreground)]">
            Sempre que pedagogicamente viável, incentive e aproveite a participação dos alunos.
          </p>
        </div>

        <form onSubmit={acessar} className="cartao space-y-4 p-6">
          <div>
            <h2 className="text-base font-bold">Já participou de um evento?</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Acesse seu QR Code, comprovante de presença e certificado.
            </p>
          </div>

          {erro && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {erro}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-[var(--muted-foreground)]">
              E-mail cadastrado
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              autoCapitalize="none"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-[var(--primary)] px-4 py-3.5 font-bold text-[var(--primary-foreground)] shadow-[0_10px_24px_-12px_rgba(59,91,255,0.9)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {enviando ? "Buscando…" : "Acessar meus registros"}
          </button>
        </form>

        <div className="space-y-3">
          <p className="mono px-1 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            Inscreva-se · vagas limitadas
          </p>

          {ATIVIDADES.map((a) => {
            const { dia, hora } = diaEHora(datas[a.slug]);
            return (
              <a
                key={a.slug}
                href={`/inscricao/${a.slug}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-4 transition hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="shrink-0 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/15 px-2.5 py-1.5 text-center">
                    <div className="mono text-xs font-bold text-blue-300">{dia}</div>
                    <div className="mono text-[0.65rem] text-blue-300/80">{hora}</div>
                  </div>
                  <div className="min-w-0">
                    {/* Sem truncate: no celular cortava "Maratona de Programa…". */}
                    <h3 className="text-base font-bold leading-snug text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {a.nome}
                    </h3>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--muted-foreground)]">{a.resumo}</p>
                  </div>
                </div>
                <span aria-hidden="true" className="shrink-0 text-lg text-[var(--primary)]">
                  →
                </span>
              </a>
            );
          })}
        </div>

        <div className="cartao space-y-1 p-6 text-center">
          <p className="mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
            Uma semana para conectar
          </p>
          <p className="text-lg font-bold">tecnologia, inovação e sustentabilidade.</p>
          <p className="text-xs text-[var(--muted-foreground)]">Inscrições e credenciamento em um só lugar.</p>
        </div>

        <CreditosParceiros className="border-t border-[var(--border)] pt-6" />
      </div>
    </div>
  );
}
