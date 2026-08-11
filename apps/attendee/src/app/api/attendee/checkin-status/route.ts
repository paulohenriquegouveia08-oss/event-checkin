import { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://137.131.233.254:3000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const backendUrl = `${BACKEND_URL}/attendee/checkin-status?token=${encodeURIComponent(token)}`;

  const backendRes = await fetch(backendUrl, {
    headers: { Accept: "text/event-stream" },
  });

  if (!backendRes.ok || !backendRes.body) {
    return new Response(JSON.stringify({ error: "SSE connection failed" }), {
      status: backendRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reader = backendRes.body.getReader();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        controller.close();
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
