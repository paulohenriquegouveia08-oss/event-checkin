"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * O botao de voltar do termo.
 *
 * Precisa carregar o `eventId` na URL porque o termo abre em ABA NOVA:
 * nao ha historico para voltar, e `/inscricao` sozinho e' um beco sem
 * saida — a tela busca o evento pela query string e, sem ela, mostra
 * "Evento nao encontrado".
 *
 * Componente de cliente isolado, e nao a pagina inteira: `useSearchParams`
 * exige cliente, e transformar a pagina toda em cliente tiraria do
 * servidor um texto que e' puramente estatico e que os buscadores
 * precisam ler.
 */
function Botao() {
  const eventId = useSearchParams().get("eventId");

  // Sem id, a inscricao nao tem para onde apontar. Mandar para a home,
  // onde a pessoa escolhe o evento, e' melhor que mandar para uma tela
  // que so sabe dizer que nao encontrou nada.
  const destino = eventId ? `/inscricao?eventId=${encodeURIComponent(eventId)}` : "/";

  return (
    <Link href={destino} className="btn-secondary">
      {eventId ? "Voltar à inscrição" : "Ir para o início"}
    </Link>
  );
}

export function VoltarParaInscricao() {
  // O fallback e' o mesmo botao sem id: durante a hidratacao ele ja
  // leva a algum lugar valido, em vez de aparecer do nada depois.
  return (
    <Suspense
      fallback={
        <Link href="/" className="btn-secondary">
          Ir para o início
        </Link>
      }
    >
      <Botao />
    </Suspense>
  );
}
