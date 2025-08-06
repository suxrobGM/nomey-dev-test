import { type NextRequest, NextResponse } from "next/server";
import { SSEManager } from "@/lib/sse";

type Body =
  | { kind: "broadcast"; event: string; payload: unknown; id?: string }
  | {
      kind: "user";
      userId: string;
      event: string;
      payload: unknown;
      id?: string;
    }
  | {
      kind: "client";
      clientId: string;
      event: string;
      payload: unknown;
      id?: string;
    };

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Body;
    if (!body || !("event" in body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (body.kind === "broadcast") {
      await SSEManager.default.broadcast({
        event: body.event,
        data: body.payload,
        id: body.id,
      });
    } else if (body.kind === "user") {
      await SSEManager.default.sendToUser(body.userId, {
        event: body.event,
        data: body.payload,
        id: body.id,
      });
    } else if (body.kind === "client") {
      await SSEManager.default.sendToClient(body.clientId, {
        event: body.event,
        data: body.payload,
        id: body.id,
      });
    } else {
      return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      counts: {
        clients: SSEManager.default.clientsCount(),
        users: SSEManager.default.usersCount(),
      },
    });
  } catch (e) {
    console.error("SSE emit error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
