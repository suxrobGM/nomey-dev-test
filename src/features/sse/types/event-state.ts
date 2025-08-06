/**
 * SSE Ready State type.
 * The following values are used:
 * 0 - CONNECTING: The connection is not yet open.
 * 1 - OPEN: The connection is open and ready to send/receive events.
 * 2 - CLOSED: The connection has been closed.
 */
export type SSEReadyState = 0 | 1 | 2;

/**
 * Represents the state of a Server-Sent Events (SSE) connection.
 */
export type EventSourceState = {
  connected: boolean;
  readyState: SSEReadyState;
  lastEventId: string | null;
  lastEventName: string | null;
  lastData: unknown;
  error: Event | null;
};
