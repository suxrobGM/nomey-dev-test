"use client";

import type { SSEvents } from "@/types/events";
import { useEventSource } from "@/lib/sse/client";
import { Button } from "@/shared/components/ui/button";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

interface SSEDemoProps {
  userId?: string;
}

interface LogItem {
  id: number;
  at: string;
  level: "info" | "warn" | "error";
  msg: string;
  data?: unknown;
}

type EmitKind = "client" | "user" | "broadcast";

export function SSEDemo(props: SSEDemoProps): ReactElement {
  const { userId } = props;

  const logSeq = useRef(0);

  const [clientId, setClientId] = useState<string | null>(null);
  const [emitKind, setEmitKind] = useState<EmitKind>("broadcast");
  const [eventName, setEventName] = useState("notification");
  const [payload, setPayload] = useState('{"message":"Hello from UI"}');
  const [customUserId, setCustomUserId] = useState(userId ?? "");
  const [customClientId, setCustomClientId] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([]);

  const { state, connect, disconnect, subscribe } = useEventSource<SSEvents>({
    url: "/api/sse",
    query: { user_id: userId },
  });

  // Subscriptions demo
  useEffect(() => {
    // Named event: "connected" (sent by the server on handshake)
    const offConnected = subscribe("connected", (data) => {
      console.log("connected event:", data);
      setClientId(data.clientId);
      pushLog("info", "connected", data);
    });

    // Default unnamed messages
    const offMessage = subscribe("message", (data, ev) => {
      console.log("message event:", ev);

      pushLog("info", "message", { data, lastEventId: ev.lastEventId });
    });

    const offNotification = subscribe("notification", (data) => {
      console.log("notification event:", data);
      pushLog("info", "notification", data);
    });

    // Reserved helpers (property form)
    const offOpen = subscribe.open(() => {
      console.log("SSE opened");
      pushLog("info", "open");
    });

    const offErr = subscribe.error((e) => {
      pushLog("error", "error", { name: e.type });
    });

    // Cleanup subscriptions on unmount
    return () => {
      offConnected();
      offMessage();
      offOpen();
      offErr();
      offNotification();
    };
  }, [subscribe]);

  const statusText = useMemo(() => {
    if (state.connected) {
      return "🟢 Connected";
    }

    if (state.readyState === 0) {
      return "🔵 Not Connected";
    }
    return "🔴 Disconnected";
  }, [state.connected, state.readyState]);

  // Emit via POST /api/sse/emit
  const emit = useCallback(async () => {
    let parsed: unknown = payload;
    try {
      parsed = payload ? JSON.parse(payload) : null;
    } catch {
      // allow string payloads too
    }

    const body =
      emitKind === "broadcast"
        ? { kind: "broadcast" as const, event: eventName, payload: parsed }
        : emitKind === "user"
          ? {
              kind: "user" as const,
              userId: customUserId,
              event: eventName,
              payload: parsed,
            }
          : {
              kind: "client" as const,
              clientId: customClientId || clientId,
              event: eventName,
              payload: parsed,
            };

    try {
      const res = await fetch("/api/sse/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const json = await res.json();

      if (!res.ok) {
        pushLog("error", `emit failed: ${res.status}`, json);
      } else {
        pushLog("info", "emit ok", json);
      }
    } catch (e) {
      pushLog("error", "emit error", (e as Error)?.message);
    }
  }, [emitKind, eventName, payload, customUserId, customClientId, clientId]);

  const pushLog = (level: LogItem["level"], msg: string, data?: unknown) => {
    const item: LogItem = {
      id: ++logSeq.current,
      at: new Date().toLocaleTimeString(),
      level,
      msg,
      data,
    };
    setLogs((prev) => {
      const next = [...prev, item];
      // Cap to last 200 lines
      if (next.length > 200) {
        next.shift();
      }
      return next;
    });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">SSE Demo</div>
          <div className="text-muted-foreground text-sm">
            URL: <code>{state.url}</code>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            title={statusText}
            className={`inline-block h-2 w-2 rounded-full ${
              state.connected
                ? "bg-green-500"
                : state.readyState === 0
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-sm">{statusText}</span>
        </div>
      </div>

      {/* Connection controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={state.connected ? disconnect : connect}>
          {state.connected ? "Disconnect" : "Connect"}
        </Button>
        <div className="text-sm">
          <span className="font-medium">Client ID:</span>{" "}
          <code>{clientId ?? "— (waiting for 'connected')"}</code>
        </div>
        {userId && (
          <div className="text-sm">
            <span className="font-medium">User ID:</span> <code>{userId}</code>
          </div>
        )}
      </div>

      {/* Emit panel */}
      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-sm font-semibold">Emit an event</legend>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Kind</span>
            <select
              className="rounded border px-2 py-1"
              value={emitKind}
              onChange={(e) => setEmitKind(e.target.value as EmitKind)}
            >
              <option className="text-muted-foreground" value="broadcast">
                broadcast
              </option>
              <option className="text-muted-foreground" value="user">
                user
              </option>
              <option className="text-muted-foreground" value="client">
                client
              </option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Event name</span>
            <input
              className="rounded border px-2 py-1"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="notification"
            />
          </label>

          {emitKind === "user" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Target userId</span>
              <input
                className="rounded border px-2 py-1"
                value={customUserId}
                onChange={(e) => setCustomUserId(e.target.value)}
                placeholder="user-123"
              />
            </label>
          )}

          {emitKind === "client" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Target clientId</span>
              <input
                className="rounded border px-2 py-1"
                value={customClientId ?? clientId ?? ""}
                onChange={(e) => setCustomClientId(e.target.value)}
                placeholder="auto-fills when connected"
              />
            </label>
          )}
        </div>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-sm font-medium">Payload (JSON or string)</span>
          <textarea
            className="min-h-[80px] rounded border px-2 py-1 font-mono text-sm"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"message":"Hello"}'
          />
        </label>

        <div className="mt-3 flex gap-2">
          <Button onClick={emit}>Send</Button>
          <Button
            variant="secondary"
            onClick={() =>
              setPayload(
                JSON.stringify({ message: "Hello from UI", ts: Date.now() }),
              )
            }
          >
            Fill sample
          </Button>
        </div>
      </fieldset>

      {/* State snapshot */}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">
          Connection state
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <span className="font-medium">connected:</span>{" "}
            {String(state.connected)}
          </div>
          <div>
            <span className="font-medium">readyState:</span> {state.readyState}
          </div>
          <div>
            <span className="font-medium">lastEventId:</span>{" "}
            <code>{state.lastEventId ?? "—"}</code>
          </div>
          <div>
            <span className="font-medium">lastEventName:</span>{" "}
            <code>{state.lastEventName ?? "—"}</code>
          </div>
          <div className="sm:col-span-2">
            <span className="font-medium">lastData:</span>{" "}
            <code className="break-all">
              {state.lastData ? JSON.stringify(state.lastData) : "—"}
            </code>
          </div>
          {state.error && (
            <div className="text-red-600 sm:col-span-2">
              <span className="font-medium">SSE error, see console</span>
            </div>
          )}
        </div>
      </details>

      {/* Logs */}
      <div className="rounded-lg border">
        <div className="border-b px-3 py-2 font-semibold">Event log</div>
        <div className="max-h-64 overflow-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-muted-foreground p-3">No events yet…</div>
          ) : (
            <ul className="space-y-1 p-2">
              {logs.map((l) => (
                <li key={l.id} className="leading-5">
                  <span className="text-muted-foreground mr-2 text-xs">
                    {l.at}
                  </span>
                  <span
                    className={
                      l.level === "error"
                        ? "text-red-600"
                        : l.level === "warn"
                          ? "text-yellow-700"
                          : "text-green-700"
                    }
                  >
                    {l.msg}
                  </span>
                  {l.data !== undefined && (
                    <span className="ml-2 break-words">
                      {typeof l.data === "string"
                        ? l.data
                        : JSON.stringify(l.data)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
