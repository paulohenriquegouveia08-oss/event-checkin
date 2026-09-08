const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://137.131.233.254:3000";

export async function proxyRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Forward auth header if present
  if (options.headers && "Authorization" in options.headers) {
    headers["Authorization"] = options.headers["Authorization"] as string;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}

/**
 * O IP de quem está do outro lado, para repassar ao backend.
 *
 * POR QUE IMPORTA: o backend limita 100 requisições por minuto POR IP.
 * Estas chamadas saem do servidor do Next, não do navegador — sem
 * repassar, TODO MUNDO conta como o punhado de IPs de saída da Vercel,
 * dividindo o mesmo balde. Numa rajada de inscrições (o link cai num
 * grupo e cinquenta pessoas clicam juntas) o limite estoura e as pessoas
 * recebem erro 429 achando que o site quebrou.
 *
 * Com o IP repassado, cada pessoa tem o próprio limite — que ninguém
 * atinge sozinho — e o limite volta a servir para o que existe: conter
 * abuso de UMA origem.
 */
export function cabecalhosDeOrigem(request: { headers: Headers }): Record<string, string> {
  const ip =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  return ip ? { "x-forwarded-for": ip } : {};
}
