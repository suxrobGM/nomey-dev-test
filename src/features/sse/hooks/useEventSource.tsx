"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EventMap,
  EventSourceState,
  EventReadyState,
  AnyHandler,
  UnsubscribeFn,
  SubscribeFn,
  EventKey,
  OpenHandler,
  ErrorHandler,
  MessageHandler,
  NamedHandler,
} from "../types";

/**
 * Options for the useEventSource hook.
 */
interface UseEventSourceOptions {
  /** Start immediately (default: false) */
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
}

/**
 * Return type for the useEventSource hook.
 */
interface UseEventSourceReturn<TEvents extends EventMap> {
  /** Current SSE connection state */
  state: EventSourceState;
  subscribe: SubscribeFn<TEvents>;
  /** Connect to the SSE endpoint */
  connect: () => void;
  /** Disconnect from the SSE endpoint */
  disconnect: () => void;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/**
 * Hook to manage a Server-Sent Events (SSE) connection and state.
 * This hook provides a simple interface to connect, disconnect, and handle events from an SSE endpoint.
 * It supports automatic reconnection with exponential backoff and allows for custom event handlers.
 *
 * @param url The SSE endpoint URL to connect to.
 * @template TEvents Optional type for event names and payloads.
 * @param opts Optional configuration for the SSE connection.
 * @returns An object containing the current state of the connection and methods to connect/disconnect.
 *
 * @example
 * // Custom named events
 * interface SSEvents {
 *   connected: { clientId: string; userId: string };
 * }
 *
 * // Automatically connect to an SSE endpoint
 * const { connected, connect, disconnect } = useEventSource<SSEvents>(`/api/sse/${userId}`, {
 *   on: {
 *     // Default handlers
 *     open: () => console.log("SSE opened"),
 *     message: (data) => console.log("Received message:", data),
 *     error: (e) => console.error("SSE error:", e),
 *
 *     // Custom named event handler
 *     connected: (data) => console.log("SSE connected:", data),
 *   },
 *  }
 */
export function useEventSource<TEvents extends EventMap = EventMap>(
  url: string,
  opts?: UseEventSourceOptions,
): UseEventSourceReturn<TEvents> {
  const {
    enabled = false,
    withCredentials = false,
    lastEventId,
    parse = parseJson,
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

  // One Set per event name (supports multiple listeners per event)
  const listenersRef = useRef<Map<string, Set<AnyHandler<TEvents, string>>>>(new Map()); // prettier-ignore

  // Track which named events have a browser-level listener wired
  const attachedNamesRef = useRef<Set<string>>(new Set());

  const [state, setState] = useState<EventSourceState>({
    connected: false,
    readyState: 0,
    lastEventId: lastEventId ?? null,
    lastEventName: null,
    lastData: null,
    error: null,
  });

  // Emit to all subscribers for a name
  const emit = useCallback((name: string, ...args: unknown[]) => {
    const set = listenersRef.current.get(name);
    if (!set) {
      return;
    }

    for (const fn of set) {
      try {
        // @ts-expect-error runtime dispatch, types ensured at subscribe sites
        fn(...args);
      } catch (err) {
        console.error(`Listener for "${name}" threw`, err);
      }
    }
  }, []);

  // Add/remove a listener from the Map
  const addListener = useCallback(
    (name: string, handler: AnyHandler<TEvents, string>): UnsubscribeFn => {
      let set = listenersRef.current.get(name);
      if (!set) {
        set = new Set();
        listenersRef.current.set(name, set);
      }
      set.add(handler);

      // If it's a named SSE event and we're connected, ensure a single dispatcher
      const isReserved =
        name === "open" || name === "error" || name === "message";

      if (
        !isReserved &&
        eventSourceRef.current &&
        !attachedNamesRef.current.has(name)
      ) {
        const dispatch = (ev: MessageEvent) => {
          const data = parse(ev.data as string);
          setState((s) => ({
            ...s,
            lastEventId: ev.lastEventId || s.lastEventId,
            lastEventName: name,
            lastData: data,
          }));
          emit(name, data, ev);
        };

        eventSourceRef.current.addEventListener(name, dispatch);
        attachedNamesRef.current.add(name);
      }

      return () => {
        const current = listenersRef.current.get(name);
        if (!current) {
          return;
        }

        current.delete(handler);

        if (current.size === 0) {
          listenersRef.current.delete(name);
        }
      };
    },
    [parse, emit],
  );

  // Build the typed subscribe() function with reserved helpers
  const subscribe = useMemo<SubscribeFn<TEvents>>(() => {
    // Generic callable that preserves K inference
    const core = <K extends EventKey<TEvents>>(
      event: K,
      handler: NamedHandler<TEvents[K]>,
    ): UnsubscribeFn =>
      addListener(event, handler as AnyHandler<TEvents, string>);

    // Attach reserved helpers
    const api = Object.assign(core, {
      open: (h: OpenHandler) =>
        addListener("open", h as unknown as AnyHandler<TEvents, string>),
      error: (h: ErrorHandler) =>
        addListener("error", h as unknown as AnyHandler<TEvents, string>),
      message: (h: MessageHandler) =>
        addListener("message", h as unknown as AnyHandler<TEvents, string>),
    }) satisfies SubscribeFn<TEvents>;

    return api;
  }, [addListener]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    attachedNamesRef.current.clear();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.warn("EventSource is already connected");
      return;
    }

    destroyedRef.current = false;
    cleanup();

    const eventSource = new EventSource(url, { withCredentials });
    eventSourceRef.current = eventSource;

    console.log("Connected to SSE:", url);

    eventSource.onopen = () => {
      retryRef.current = 0;
      setState((s) => ({ ...s, connected: true, readyState: 1, error: null }));
      emit("open");
    };

    eventSource.onerror = (e) => {
      console.error("EventSource error:", e);

      setState((s) => ({
        ...s,
        connected: false,
        readyState: eventSource.readyState as EventReadyState,
        error: e,
      }));

      emit("error", e);

      if (eventSource.readyState === EventSource.CLOSED) {
        scheduleReconnect();
      }
    };

    eventSource.onmessage = (ev) => {
      const data = parse(ev.data as string);

      setState((s) => ({
        ...s,
        lastEventId: ev.lastEventId || s.lastEventId,
        lastEventName: "message",
        lastData: data,
      }));
      emit("message", data, ev);
    };
  }, [url, withCredentials, cleanup, parse, emit]);

  const scheduleReconnect = useCallback(() => {
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

    console.log(
      `Reconnecting in ${delay}ms (attempt ${retryRef.current + 1}/${maxRetries})`,
    );
  }, [initialDelayMs, maxDelayMs, maxRetries, reconnectEnabled, connect]);

  const disconnect = useCallback(() => {
    destroyedRef.current = true;
    cleanup();
    setState((s) => ({ ...s, connected: false, readyState: 2 })); // CLOSED
  }, [cleanup]);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
    state,
    subscribe,
    connect,
    disconnect,
  };
}
