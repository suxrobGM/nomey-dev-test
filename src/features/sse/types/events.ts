/**
 * Custom named events for SSE.
 */
export interface SSEvents {
  connected: { clientId: string; userId: string };
  notification: { message: string; timestamp: string };
}
