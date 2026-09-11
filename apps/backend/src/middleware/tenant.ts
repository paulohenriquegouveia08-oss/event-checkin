import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../database/prisma.js";

export interface TenantEvent {
  id: string;
  slug: string;
}

declare module "fastify" {
  interface FastifyRequest {
    tenantEvent?: TenantEvent | null;
  }
}

const RESERVED_SUBDOMAINS = new Set([
  "api",
  "admin",
  "www",
  "app",
  "mail",
  "ftp",
  "smtp",
  "status",
  "auth",
]);

/**
 * Extracts subdomain from a host string (e.g. "copol.lspkeventos.com.br" -> "copol").
 * Supports:
 * - "copol.lspkeventos.com.br" -> "copol"
 * - "evento-a.lspkeventos.com.br" -> "evento-a"
 * - "copol.localhost" -> "copol"
 * - "copol.localhost:3000" -> "copol"
 * - "copol.example.com" -> "copol"
 * - "copol.internal" -> "copol"
 * - "copol.local" -> "copol"
 * - "www.copol.lspkeventos.com.br" -> "copol"
 * Returns null for root domains ("lspkeventos.com.br", "example.com", "localhost"), IP addresses, and reserved subdomains.
 */
export function extractSubdomain(host?: string | null): string | null {
  if (!host) return null;

  // Remove port if present: e.g. "copol.lspkeventos.com.br:3000" -> "copol.lspkeventos.com.br"
  const cleanHost = host.split(":")[0].toLowerCase().trim();

  // If IP address (IPv4 or IPv6), no subdomain
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) || cleanHost.startsWith("[")) {
    return null;
  }

  // Remove leading www. if present: e.g. "www.copol.lspkeventos.com.br" -> "copol.lspkeventos.com.br"
  const withoutWww = cleanHost.startsWith("www.") ? cleanHost.slice(4) : cleanHost;

  const parts = withoutWww.split(".");
  if (parts.length <= 1) {
    return null;
  }

  // Single-word root domains e.g. "copol.localhost", "copol.test", "copol.local", "copol.internal"
  if (parts.length === 2 && ["localhost", "local", "test", "internal"].includes(parts[1])) {
    const sub = parts[0];
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  // Common second-level domain ccTLDs (e.g. .com.br, .org.br, .co.uk)
  const isMultiPartTld =
    parts.length >= 3 &&
    /^(com|org|net|edu|gov|mil|art|ind|etc|co|nom)\.[a-z]{2}$/i.test(
      `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
    );

  let sub: string | null = null;
  if (isMultiPartTld) {
    // e.g. copol.lspkeventos.com.br -> parts: ['copol', 'lspkeventos', 'com', 'br'] (length 4)
    // root domain is lspkeventos.com.br (3 parts), subdomain is whatever comes before
    if (parts.length > 3) {
      sub = parts.slice(0, parts.length - 3).join(".");
    }
  } else {
    // e.g. copol.example.com -> parts: ['copol', 'example', 'com'] (length 3)
    // root domain is example.com (2 parts), subdomain is whatever comes before
    if (parts.length > 2) {
      sub = parts.slice(0, parts.length - 2).join(".");
    }
  }

  if (!sub || RESERVED_SUBDOMAINS.has(sub)) {
    return null;
  }

  return sub;
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const val = request.headers[name] ?? request.headers[name.toLowerCase()];
  if (!val) return undefined;
  if (Array.isArray(val)) return val[0];
  return typeof val === "string" ? val : undefined;
}

/**
 * Extracts and resolves the tenant Event from:
 * 1. Subdomain from `request.headers.host` (or `x-forwarded-host`)
 * 2. Fallback header `x-event-slug`
 * 3. Fallback header `x-event-id`
 */
export async function extractTenant(request: FastifyRequest): Promise<TenantEvent | null> {
  const hostHeader = (request.headers["x-forwarded-host"] || request.headers.host || "") as string;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const subdomain = extractSubdomain(host);

  if (subdomain) {
    const event = await prisma.event.findFirst({
      where: {
        slug: { equals: subdomain, mode: "insensitive" },
      },
      select: { id: true, slug: true },
    });
    if (event) {
      return { id: event.id, slug: event.slug ?? subdomain };
    }
  }

  // Fallback 1: x-event-slug
  const slugHeader = getHeader(request, "x-event-slug")?.trim();
  if (slugHeader) {
    const event = await prisma.event.findFirst({
      where: {
        slug: { equals: slugHeader, mode: "insensitive" },
      },
      select: { id: true, slug: true },
    });
    if (event) {
      return { id: event.id, slug: event.slug ?? slugHeader };
    }
  }

  // Fallback 2: x-event-id
  const idHeader = getHeader(request, "x-event-id")?.trim();
  if (idHeader) {
    const event = await prisma.event.findUnique({
      where: { id: idHeader },
      select: { id: true, slug: true },
    });
    if (event) {
      return { id: event.id, slug: event.slug ?? "" };
    }
  }

  return null;
}

/**
 * Tenant extraction middleware hook for Fastify.
 * Sets `request.tenantEvent = { id, slug }` if resolved, or `null` otherwise.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    request.tenantEvent = await extractTenant(request);
  } catch {
    request.tenantEvent = null;
  }
}
