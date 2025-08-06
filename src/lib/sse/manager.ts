import type { SSEClient } from "./client";
import type { SSEEvent } from "./types";

/**
 * Manages SSE client connections and event broadcasting.
 */
export class SSEManager {
  private static defaultInstance: SSEManager;
  private readonly clients = new Map<string, SSEClient>(); // clientId -> SSEClient
  private readonly clientIdsByUser = new Map<string, Set<string>>(); // userId -> Set of clientIds

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
    this.clients.set(client.id, client);
    if (!client.userId) {
      // If no userId, don't track in user map
      return;
    }

    // Add to user map if not present
    if (!this.clientIdsByUser.has(client.userId)) {
      this.clientIdsByUser.set(client.userId, new Set());
    }

    this.clientIdsByUser.get(client.userId)!.add(client.id);
  }

  /**
   * Remove a client connection.
   * @param clientId The ID of the client to remove.
   */
  async removeClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    this.clients.delete(clientId);

    if (client.userId) {
      const set = this.clientIdsByUser.get(client.userId);
      if (set) {
        set.delete(clientId);

        if (set.size === 0) {
          this.clientIdsByUser.delete(client.userId);
        }
      }
    }

    // close the writer to clean up the stream
    await client.close();
  }

  /**
   * Start a per-connection heartbeat to keep the connection alive.
   * @param clientId The ID of the client to start the heartbeat for.
   * @param ms The interval in milliseconds for the heartbeat. Defaults to 15000.
   */
  startHeartbeat(clientId: string, ms = 15000): void {
    this.clients.get(clientId)?.startHeartbeat(ms);
  }

  /**
   * Send an event to a specific client.
   * @param clientId The ID of the client to send the event to.
   * @param event The SSE event to send.
   * @returns A promise that resolves when the event has been sent.
   */
  async sendToClient(clientId: string, event: SSEEvent): Promise<void> {
    await this.clients.get(clientId)?.send(event);
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

    await Promise.all([...ids].map((cid) => this.sendToClient(cid, event)));
  }

  /**
   * Broadcast an event to all connected clients.
   * @param event The SSE event to broadcast.
   * @returns A promise that resolves when all clients have been notified.
   */
  async broadcast(event: SSEEvent): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.send(event)));
  }

  /**
   * Get the number of connected clients.
   * @returns The count of connected clients.
   */
  clientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get the number of connected users.
   * @returns The count of connected users.
   */
  usersCount(): number {
    return this.clientIdsByUser.size;
  }
}
