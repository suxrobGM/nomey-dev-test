import type { SSEEvent } from "./types";

const encoder = new TextEncoder();

/**
 * Formats an SSE event into a Uint8Array.
 * @param sseEvent The SSE event object to format.
 * @returns The formatted SSE event as a Uint8Array.
 */
export function formatSSE(sseEvent: SSEEvent): Uint8Array {
  const { event, data, id, retry } = sseEvent;

  let chunk = "";
  if (id) chunk += `id: ${id}\n`;
  if (event) chunk += `event: ${event}\n`;
  if (retry) chunk += `retry: ${retry}\n`;
  if (data !== undefined) {
    const serialized = typeof data === "string" ? data : JSON.stringify(data);
    chunk += `data: ${serialized}\n`;
  }
  chunk += `\n`; // end of message
  return encoder.encode(chunk);
}

/**
 * Formats a comment for SSE.
 * @param data The comment text.
 * @returns The formatted comment as a Uint8Array.
 */
export function comment(data: string): Uint8Array {
  return encoder.encode(`: ${data}\n\n`);
}
