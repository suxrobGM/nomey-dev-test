/** Generic event map: event name -> payload type */
export type EventMap = Record<string, unknown>;

/** Standard reserved events that are not user-defined */
type ReservedEvents = "open" | "error" | "message";

/** Extract event names as string literals from an EventMap and reserved events */
export type EventKey<T extends EventMap> =
  | (Exclude<keyof T, ReservedEvents> & string)
  | ReservedEvents;

export type OpenHandler = () => void;
export type ErrorHandler = (e: Event) => void;
export type MessageHandler = (data: unknown, ev: MessageEvent) => void;
export type NamedHandler<T> = (data: T, ev: MessageEvent) => void;

// prettier-ignore
export type AnyHandler<TEvents extends EventMap, K extends string> =
  K extends "open" ? OpenHandler :
  K extends "error" ? ErrorHandler :
  K extends "message" ? MessageHandler :
  K extends keyof TEvents ? NamedHandler<TEvents[K]> :
  never;

export type UnsubscribeFn = () => void;

export type SubscribeFn<TEvents extends EventMap> = {
  // Named events
  <K extends EventKey<TEvents>>(
    event: K,
    handler: NamedHandler<TEvents[K]>,
  ): UnsubscribeFn;

  // Reserved events
  open: (handler: OpenHandler) => UnsubscribeFn;
  error: (handler: ErrorHandler) => UnsubscribeFn;
  message: (handler: MessageHandler) => UnsubscribeFn;
};
