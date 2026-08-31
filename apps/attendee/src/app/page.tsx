"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAttendee, selectEvent, type ParticipantData } from "@/lib/api";
import { CreditosParceiros } from "@/components/CreditosParceiros";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ParticipantData[] | null>(null);

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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-400/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold">Event Check-in</h1>
          <p className="mt-2 text-sm text-[--muted-foreground]">
            Acesse seu QR code para marcar presença
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
                className="mb-1 block text-sm text-[--muted-foreground]"
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
                className="w-full rounded-lg border border-[--border] bg-[--muted] px-4 py-3 text-[--foreground] placeholder:text-[--muted-foreground] focus:border-teal-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-400 px-4 py-3 font-semibold text-black transition-colors hover:bg-teal-300 disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <p className="text-sm text-[--muted-foreground] text-center">
              Você está cadastrado em {events.length} eventos. Qual deseja acessar?
            </p>

            <div className="space-y-2">
              {events.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectEvent(p.id)}
                  disabled={loading}
                  className="w-full rounded-lg border border-[--border] bg-[--muted] px-4 py-3 text-left transition-colors hover:border-teal-400 hover:bg-teal-400/5 disabled:opacity-50"
                >
                  <p className="font-medium">{p.event.name}</p>
                  <p className="text-xs text-[--muted-foreground]">
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
              className="w-full text-sm text-[--muted-foreground] hover:text-[--foreground]"
            >
              Voltar
            </button>
          </div>
        )}

        <CreditosParceiros className="border-t border-[--border] pt-6 mt-8" />
      </div>
    </div>
  );
}
