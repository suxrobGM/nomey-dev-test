/**
 * Represents a Server-Sent Event (SSE) message.
 */
export interface SSEEvent<T = unknown> {
  /** The type of event. */
  event: string;
  /** The data payload of the event. */
  data: T;
  /** The ID of the event for reconnection purposes. */
  id?: string;
  /** The reconnection time in milliseconds. */
  retry?: number;
}

/**
 * Represents a connected SSE client.
 */
export interface SSEClient {
  /** The unique ID of the client connection. */
  clientId: string;
  /** The user ID associated with the client, if authenticated. */
  userId?: string | null;
  /** The writable stream to send events to the client. */
  writer: WritableStreamDefaultWriter<Uint8Array>;
  /** Optional heartbeat interval to keep the connection alive. */
  heartbeat?: NodeJS.Timeout;
}
