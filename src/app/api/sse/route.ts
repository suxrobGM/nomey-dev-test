import { NextResponse, type NextRequest } from "next/server";
import { SSEManager } from "@/lib/sse/server";
import type { SSEvents } from "@/types/events";

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

/**
 * Create a new SSE client connection.
 * This will register the client and start a heartbeat to keep the connection alive.
 * The client will receive a handshake event with its ID and user ID (if provided).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("user_id");

  // Register and start heartbeat
  const client = SSEManager.default.createClient<SSEvents>({ userId });
  client.startHeartbeat();

  console.log(`SSE client connected: ${client.id}, user ID: ${userId}`);

  // Send the handshake event after the response is sent
  queueMicrotask(() => {
    client
      .send({ event: "connected", data: { clientId: client.id, userId } })
      .then(() => console.log(`SSE handshake sent for client: ${client.id}`))
      .catch((err) => console.error("Handshake send failed:", err));
  });

  // Cleanup when the request is aborted (client disconnects)
  req.signal.addEventListener("abort", () => {
    SSEManager.default
      .removeClient(client.id)
      .then(() => console.log(`SSE disconnected: ${client.id}`))
      .catch((err) => console.error(`Error removing SSE client: ${err}`));
  });

  return new NextResponse(client.readable, {
    headers: sseHeaders,
    status: 200,
  });
}
