/**
 * Custom named events for SSE.
 */
export type SSEvents = {
  connected: { clientId: string; userId: string };
  notification: { message: string; timestamp: string };
};
