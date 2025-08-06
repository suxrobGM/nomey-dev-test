import { NextResponse, type NextRequest } from "next/server";
import { SSEManager } from "@/lib/sse";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  const { userId } = await params;

  // Register and start heartbeat
  const client = SSEManager.default.createClient(userId);
  client.startHeartbeat();

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  console.log(`SSE client connected: ${client.id}, user ID: ${userId}`);

  // Send the handshake event after the response is sent
  queueMicrotask(() => {
    client
      .send({ data: { clientId: client.id, userId } })
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

  return new NextResponse(client.readable, { headers, status: 200 });
}
