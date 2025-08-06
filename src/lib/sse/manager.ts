import { formatSSE } from "./format";
import type { SSEClient, SSEEvent } from "./types";

/**
 * Manages SSE client connections and event broadcasting.
 */
export class SSEManager {
  private static defaultInstance: SSEManager;
  private readonly clientsById = new Map<string, SSEClient>();
  private readonly clientIdsByUser = new Map<string, Set<string>>(); // Track active user connections per client
  private readonly encoder = new TextEncoder();

  /**
   * Get the default singleton instance.
   */
  static get default(): SSEManager {
    if (!SSEManager.defaultInstance) {
      SSEManager.defaultInstance = new SSEManager();
    }
    return SSEManager.defaultInstance;
  }

  /**
   * Add a new client connection.
   * @param client The SSE client to add.
   */
  addClient(client: SSEClient): void {
    this.clientsById.set(client.clientId, client);
    if (!client.userId) {
      // If no userId, don't track in user map
      return;
    }

    // Add to user map if not present
    if (!this.clientIdsByUser.has(client.userId)) {
      this.clientIdsByUser.set(client.userId, new Set());
    }

    this.clientIdsByUser.get(client.userId)!.add(client.clientId);
  }

  /**
   * Remove a client connection.
   * @param clientId The ID of the client to remove.
   */
  removeClient(clientId: string): void {
    const client = this.clientsById.get(clientId);
    if (!client) {
      return;
    }

    // Clear heartbeat if it exists
    if (client.heartbeat) {
      clearInterval(client.heartbeat);
    }
    this.clientsById.delete(clientId); // then client from map

    if (!client.userId) {
      return;
    }

    // Now remove from user map
    const set = this.clientIdsByUser.get(client.userId);
    if (set) {
      set.delete(clientId);

      if (set.size === 0) {
        this.clientIdsByUser.delete(client.userId);
      }
    }
  }

  /**
   * Start a per-connection heartbeat to keep the connection alive.
   * @param clientId The ID of the client to start the heartbeat for.
   * @param ms The interval in milliseconds for the heartbeat. Defaults to 15000.
   */
  startHeartbeat(clientId: string, ms = 15000): void {
    const client = this.clientsById.get(clientId);
    if (!client) {
      return;
    }

    if (client.heartbeat) {
      clearInterval(client.heartbeat);
    }

    // Set up a heartbeat to keep the connection alive
    client.heartbeat = setInterval(() => {
      client.writer
        .write(this.encoder.encode(`: ping ${Date.now()}\n\n`))
        .catch(() => this.removeClient(clientId));
    }, ms);
  }

  /**
   * Send an event to a specific client.
   * @param clientId The ID of the client to send the event to.
   * @param event The SSE event to send.
   * @returns A promise that resolves when the event has been sent.
   */
  async sendToClient(clientId: string, event: SSEEvent): Promise<void> {
    const client = this.clientsById.get(clientId);
    if (!client) {
      return;
    }

    try {
      await client.writer.write(formatSSE(event));
    } catch {
      this.removeClient(clientId);
    }
  }

  /**
   * Send an event to all connections of a specific user.
   * @param userId The ID of the user to send the event to.
   * @param event The SSE event to send.
   * @returns A promise that resolves when all user's clients have been notified.
   */
  async sendToUser(userId: string, event: SSEEvent): Promise<void> {
    const ids = this.clientIdsByUser.get(userId);
    if (!ids) {
      return;
    }

    await Promise.all(
      Array.from(ids).map((cid) => this.sendToClient(cid, event)),
    );
  }

  /**
   * Broadcast an event to all connected clients.
   * @param event The SSE event to broadcast.
   * @returns A promise that resolves when all clients have been notified.
   */
  async broadcast(event: SSEEvent): Promise<void> {
    await Promise.all(
      Array.from(this.clientsById.keys()).map((cid) =>
        this.sendToClient(cid, event),
      ),
    );
  }

  /**
   * Get the number of connected clients.
   * @returns The count of connected clients.
   */
  clientsCount(): number {
    return this.clientsById.size;
  }

  /**
   * Get the number of connected users.
   * @returns The count of connected users.
   */
  usersCount(): number {
    return this.clientIdsByUser.size;
  }
}
