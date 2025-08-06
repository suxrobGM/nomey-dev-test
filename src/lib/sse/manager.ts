import { SSEClient } from "./client";
import type { SSEEvent } from "./types";

/**
 * Manages SSE client connections and event broadcasting.
 */
export class SSEManager {
  private static defaultInstance: SSEManager;

  // clientId -> client
  private readonly clientsById = new Map<string, SSEClient>();

  // userId -> set of clientIds
  private readonly clientIdsByUser = new Map<string, Set<string>>();

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
   * Create a new SSE client for a user.
   * @param userId The ID of the user to create the client for.
   * @returns A new SSEClient instance.
   */
  createClient(userId: string): SSEClient {
    const client = new SSEClient(userId);
    this.addClient(client);
    return client;
  }

  /**
   * Register an existing client.
   * @param client An instance of SSEClient to register.
   */
  addClient(client: SSEClient): void {
    this.clientsById.set(client.id, client);

    let set = this.clientIdsByUser.get(client.userId);
    if (!set) {
      set = new Set<string>();
      this.clientIdsByUser.set(client.userId, set);
    }
    set.add(client.id);
    console.log(`SSE client added: ${client.id}, user: ${client.userId}`);
  }

  /**
   * Remove a client connection.
   * @param clientId The ID of the client to remove.
   */
  async removeClient(clientId: string): Promise<void> {
    const client = this.clientsById.get(clientId);
    if (!client) {
      return;
    }

    // Clean indexes first
    this.clientsById.delete(clientId);

    const set = this.clientIdsByUser.get(client.userId);
    if (set) {
      set.delete(clientId);
      if (set.size === 0) this.clientIdsByUser.delete(client.userId);
    }

    // Close the stream last
    await client.close();
    console.log(`SSE client removed: ${clientId}`);
  }

  /**
   * Start a per-connection heartbeat to keep the connection alive.
   * @param clientId The ID of the client to start the heartbeat for.
   * @param ms The interval in milliseconds for the heartbeat. Defaults to 15000.
   */
  startHeartbeat(clientId: string, ms = 15000): void {
    this.clientsById.get(clientId)?.startHeartbeat(ms);
    console.log(`Heartbeat started for client: ${clientId}`);
  }

  /**
   * Send an event to the specified client.
   * @param clientId The ID of the client to send the event to.
   * @param event The SSE event to send.
   * @returns A promise that resolves when the client has been notified.
   */
  async sendToClient(clientId: string, event: SSEEvent): Promise<void> {
    const client = this.clientsById.get(clientId);
    if (!client) {
      return;
    }

    await client.send(event);
    console.log(`Event sent to client: ${clientId}, event: ${event.event}`);
  }

  /**
   * Send an event to all clients associated with a user.
   * @param userId The ID of the user to send the event to.
   * @param event The SSE event to send.
   * @returns A promise that resolves when all clients have been notified.
   */
  async sendToUser(userId: string, event: SSEEvent): Promise<void> {
    const ids = this.clientIdsByUser.get(userId);
    if (!ids?.size) {
      console.warn(`No clients found for user ID: ${userId}`);
      return;
    }

    await Promise.all(
      [...ids].map((cid) => this.clientsById.get(cid)?.send(event)),
    );

    console.log(`Event sent to user: ${userId}, event: ${event.event}`);
  }

  /**
   * Broadcast an event to all connected clients.
   * @param event The SSE event to broadcast.
   * @returns A promise that resolves when all clients have been notified.
   */
  async broadcast(event: SSEEvent): Promise<void> {
    await Promise.all([...this.clientsById.values()].map((c) => c.send(event)));
    console.log(`Broadcast event: ${event.event}, data:`, event.data);
  }

  /**
   * Get the number of connected clients.
   * @returns The count of connected clients.
   */
  clientsCount(): number {
    return this.clientsById.size;
  }

  /**
   * Get the number of unique users with connected clients.
   * @returns The count of unique users.
   */
  usersCount(): number {
    return this.clientIdsByUser.size;
  }
}
