import { NextResponse, type NextRequest } from "next/server";
import { SSEManager, formatSSE, comment } from "@/lib/sse";
import * as crypto from "crypto";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const clientId = crypto.randomUUID();

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  // Register and start heartbeat
  SSEManager.default.addClient({ clientId, userId, writer });
  SSEManager.default.startHeartbeat(clientId, 15000);

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial handshake
  await writer.write(comment(`connected ${clientId}`));
  await writer.write(
    formatSSE({ event: "connected", data: { clientId, userId } }),
  );

  // Handle client disconnect via AbortSignal
  const abort = req.signal;

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  abort.addEventListener("abort", async () => {
    try {
      SSEManager.default.removeClient(clientId);
      await writer.close();
    } catch {
      // already closed
    }
  });

  return new NextResponse(stream.readable, { headers, status: 200 });
}
