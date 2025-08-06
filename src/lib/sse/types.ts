/**
 * Represents a Server-Sent Event (SSE) message.
 */
export interface SSEEvent<T = unknown> {
  /** The type of event. */
  event?: string;
  /** The data payload of the event. */
  data?: T;
  /** The ID of the event for reconnection purposes. */
  id?: string;
  /** The reconnection time in milliseconds. */
  retry?: number;
}
