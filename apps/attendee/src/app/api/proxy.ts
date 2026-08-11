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
