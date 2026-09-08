"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee, selectEvent, type ParticipantData } from "@/lib/api";
import { CreditosParceiros } from "@/components/CreditosParceiros";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ParticipantData[] | null>(null);

  /**
   * Eventos com inscrição aberta.
   *
   * Esta tela é para quem JÁ se inscreveu: digita o e-mail e vê o QR.
   * Quem chega pelo link de divulgação ainda não está cadastrado, digita
   * o e-mail e recebe "não encontrado" — sem nenhuma saída na tela. O
   * aviso abaixo é essa saída.
   *
   * Buscado do servidor, e não cravado: um evento novo aparece sozinho.
   */
  const [abertos, setAbertos] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/publico/eventos-abertos")
      .then((r) => r.json())
      .then((c) => {
        const lista = Array.isArray(c?.data) ? c.data : [];
        setAbertos(
          lista
            .filter((e: { slug?: string; registrationsOpen?: boolean }) => e.slug && e.registrationsOpen)
            .map((e: { slug: string; name: string }) => ({ slug: e.slug, name: e.name })),
        );
      })
      .catch(() => setAbertos([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginAttendee(email);

      if (response.data.requiresEventSelection && response.data.events) {
        setEvents(response.data.events);
        setLoading(false);
        return;
      }

      localStorage.setItem("attendee_token", response.data.token!);
      localStorage.setItem(
        "attendee_data",
        JSON.stringify(response.data.participant)
      );
      router.push("/checkin");
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (participantId: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await selectEvent(participantId);
      localStorage.setItem("attendee_token", response.data.token!);
      localStorage.setItem(
        "attendee_data",
        JSON.stringify(response.data.participant)
      );
      router.push("/checkin");
    } catch (err: any) {
      setError(err.message ?? "Erro ao selecionar evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lspk-symbol.svg" alt="LSPK Technology" className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-bold">Credenciamento</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Acesse seu QR Code, comprovante de presença e certificado
          </p>
        </div>

        {!events ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm text-[var(--muted-foreground)]"
              >
                E-mail cadastrado
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Entrar"}
            </button>

            {abertos.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm">
                <p className="text-[var(--muted-foreground)]">Ainda não se inscreveu?</p>
                <ul className="mt-2 space-y-1">
                  {abertos.map((e) => (
                    <li key={e.slug}>
                      <a href={`/inscricao/${e.slug}`} className="font-semibold text-[var(--primary)] hover:underline">
                        Inscrever-se em {e.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <p className="text-sm text-[var(--muted-foreground)] text-center">
              Você está cadastrado em {events.length} eventos. Qual deseja acessar?
            </p>

            <div className="space-y-2">
              {events.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectEvent(p.id)}
                  disabled={loading}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 disabled:opacity-50"
                >
                  <p className="font-medium">{p.event.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {p.event.location || "Sem local definido"} •{" "}
                    {new Date(p.event.startDate).toLocaleDateString("pt-BR")}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setEvents(null);
                setEmail("");
                setError(null);
              }}
              className="w-full text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Voltar
            </button>
          </div>
        )}

        <CreditosParceiros className="border-t border-[var(--border)] pt-6 mt-8" />
      </div>
    </div>
  );
}
