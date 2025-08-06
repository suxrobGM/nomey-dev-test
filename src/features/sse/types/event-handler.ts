/** Generic event map: event name -> payload type */
export type EventMap = Record<string, unknown>;

/** Parser type for event.data */
export type EventDataParser = (raw: string) => unknown;

/** Built-in (“reserved”) event handlers that aren't SSE named events */
export interface BaseEventHandlers {
  open?: () => void;
  error?: (e: Event) => void;
  /** Fires for default/unnamed SSE frames (no `event:` line) */
  message?: (data: unknown, ev: MessageEvent) => void;
}

/** Standard reserved events that are not user-defined */
export type ReservedEvents = "open" | "error" | "message";

/** Typed handlers for your named SSE events */
export type NamedEventHandlers<TEvents extends EventMap> = {
  [K in Exclude<keyof TEvents, ReservedEvents>]?: (
    data: TEvents[K],
    ev: MessageEvent,
  ) => void;
};

/** Combined event handlers: standard + named */
export type EventSourceHandlers<TEvents extends EventMap> = BaseEventHandlers &
  NamedEventHandlers<TEvents>;
