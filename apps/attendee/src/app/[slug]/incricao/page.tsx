import { redirect } from "next/navigation";
import { InscricaoCliente } from "@/app/inscricao/[slug]/InscricaoCliente";

export const dynamic = "force-dynamic";

export default async function PaginaDeIncricao({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.toLowerCase().includes("copol")) {
    redirect("https://copol2026.com.br");
  }
  return <InscricaoCliente slug={slug} />;
}
