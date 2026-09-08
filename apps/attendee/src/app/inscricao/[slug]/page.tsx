import { InscricaoCliente } from "./InscricaoCliente";

export const dynamic = "force-dynamic";

export default async function PaginaDeInscricao({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <InscricaoCliente slug={slug} />;
}
