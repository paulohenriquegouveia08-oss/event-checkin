import { redirect } from "next/navigation";
import { InscricaoCliente } from "./InscricaoCliente";

export const dynamic = "force-dynamic";

export default async function PaginaDeInscricao({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.toLowerCase().includes("copol")) {
    redirect("https://copol2026.com.br");
  }
  return <InscricaoCliente slug={slug} />;
}
