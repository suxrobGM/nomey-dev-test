"use client";

import { useEffect, useRef, useState } from "react";
import type { EventSourceState, SSEReadyState } from "../types";

/** Map event name -> payload type */
export type EventMap = Record<string, unknown>;

/**
 * Options for the useEventSource hook.
 */
interface UseEventSourceOptions<TEvents extends EventMap = EventMap> {
  /** Start immediately (default: true) */
  enabled?: boolean;
  /** Pass cookies for same-origin auth if needed */
  withCredentials?: boolean;
  /** Optional Last-Event-ID to resume a stream */
  lastEventId?: string;
  /** Custom parser for event.data (default: JSON.parse with fallback to string) */
  parse?: (raw: string) => unknown;
  /** Auto-reconnect config */
  reconnect?: {
    /** Enable automatic reconnection (default: true) */
    enabled?: boolean;
    /** Initial delay before reconnecting (default: 1000) */
    initialDelayMs?: number;
    /** Maximum delay between reconnect attempts (default: 15000) */
    maxDelayMs?: number;
    /** Maximum number of reconnect attempts (default: 10) */
    maxRetries?: number;
  };
  /**
   * Handlers for named events plus defaults.
   * Example: on: { demo: (data) => ..., message: (data)=>..., open: ()=>..., error: (e)=>... }
   */
  on?: Partial<{
    open: () => void;
    error: (e: Event) => void;
    message: (data: unknown, ev: MessageEvent) => void; // unnamed events
  }> & {
    [K in keyof TEvents]?: (data: TEvents[K], ev: MessageEvent) => void;
  };
}

interface UseEventSourceResponse {
  state: EventSourceState;
  connect: () => void;
  disconnect: () => void;
}

function defaultParser(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/**
 * Hook to manage a Server-Sent Events (SSE) connection and state.
 * This hook provides a simple interface to connect, disconnect, and handle events from an SSE endpoint.
 * @param url The SSE endpoint URL to connect to.
 * @template TEvents Optional type for event names and payloads.
 * @param opts Optional configuration for the SSE connection.
 * @returns An object containing the current state of the connection and methods to connect/disconnect.
 */
export function useEventSource<TEvents extends EventMap = EventMap>(
  url: string,
  opts?: UseEventSourceOptions<TEvents>,
): UseEventSourceResponse {
  const {
    enabled = true,
    withCredentials = false,
    lastEventId,
    parse = defaultParser,
    on,
    reconnect = {},
  } = opts ?? {};

  const {
    enabled: reconnectEnabled = true,
    initialDelayMs = 1000,
    maxDelayMs = 15000,
    maxRetries = 10,
  } = reconnect;

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);

  const [state, setState] = useState<EventSourceState>({
    connected: false,
    readyState: 0,
    lastEventId: lastEventId ?? null,
    lastEventName: null,
    lastData: null,
    error: null,
  });

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => disconnect();
  }, [enabled]);

  const cleanup = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  };

  const disconnect = () => {
    destroyedRef.current = true;
    cleanup();
    setState((s) => ({ ...s, connected: false, readyState: 2 })); // CLOSED
  };

  const scheduleReconnect = () => {
    if (!reconnectEnabled || destroyedRef.current) {
      return;
    }
    if (retryRef.current >= maxRetries) {
      return;
    }

    // Calculate exponential backoff delay with a cap at maxDelayMs
    // Example: 1000, 2000, 4000, ..., capped at maxDelayMs
    const delay = Math.min(
      initialDelayMs * Math.pow(2, retryRef.current),
      maxDelayMs,
    );
    retryRef.current += 1;
    timerRef.current = setTimeout(() => {
      connect(); // try again
    }, delay);
  };

  const connect = () => {
    console.log("Connecting to SSE:", url);

    destroyedRef.current = false;
    cleanup();

    const eventSource = new EventSource(url, { withCredentials });
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      retryRef.current = 0;
      console.log("EventSource opened:", url);

      setState((s) => ({ ...s, connected: true, readyState: 1, error: null }));
      on?.open?.();
    };

    eventSource.onerror = (e) => {
      console.log("EventSource error:", e);

      setState((s) => ({
        ...s,
        connected: false,
        readyState: eventSource.readyState as SSEReadyState,
        error: e,
      }));

      on?.error?.(e);

      if (eventSource.readyState === EventSource.CLOSED) {
        scheduleReconnect();
      }
    };

    // Default unnamed messages
    eventSource.onmessage = (ev) => {
      const data = parse(ev.data as string);
      console.log("Received unnamed event:", data);

      setState((s) => ({
        ...s,
        lastEventId: ev.lastEventId || s.lastEventId,
        lastEventName: "message",
        lastData: data,
      }));
      on?.message?.(data, ev);
    };

    // Proxy named events to typed handlers in opts.on
    if (on) {
      Object.keys(on).forEach((name) => {
        if (["open", "error", "message"].includes(name)) {
          return;
        }

        eventSource.addEventListener(name, (ev) => {
          const data = parse(ev.data as string);
          setState((s) => ({
            ...s,
            lastEventId: ev.lastEventId || s.lastEventId,
            lastEventName: name,
            lastData: data,
          }));
          // @ts-expect-error generic indexing into on
          on[name]?.(data, ev);
        });
      });
    }
  };

  return {
    state,
    connect,
    disconnect,
  };
}
