import { NextResponse, type NextRequest } from "next/server";
import { SSEManager, SSEClient } from "@/lib/sse";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  // Register and start heartbeat
  const client = new SSEClient(userId);
  SSEManager.default.addClient(client);
  SSEManager.default.startHeartbeat(client.id, 15000);

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  console.log(`SSE client connected: ${client.id}, user: ${userId}`);

  // Send initial handshake
  await client.send({
    event: "connected",
    data: { clientId: client.id, userId },
  });

  req.signal.addEventListener("abort", () => {
    SSEManager.default
      .removeClient(client.id)
      .then(() => console.log(`SSE disconnected: ${client.id}`))
      .catch((err) => console.error(`Error removing SSE client: ${err}`));
  });

  return new NextResponse(client.readable, { headers, status: 200 });
}
