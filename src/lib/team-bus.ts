/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Pub/sub in-memory para SSE do chat interno (/equipe).
 * Cada subscriber filtra por organizationId (e por dmKey/recipientId se DM).
 * Funciona em single-instance — coerente com deploy atual (1 processo Node).
 */

export interface TeamBroadcast {
  type: "message" | "seen";
  organizationId: string;
  message?: {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar: string | null;
    dmKey: string | null; // null = canal global
    body: string;
    createdAt: string; // ISO
  };
  seen?: {
    userId: string;
    channelKey: string;
    lastSeenAt: string;
  };
}

type Listener = (event: TeamBroadcast) => void;

class TeamBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: TeamBroadcast): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch (err) {
        console.error("[team-bus] listener error:", err);
      }
    }
  }

  size(): number {
    return this.listeners.size;
  }
}

// Singleton (mantém entre HMR usando globalThis).
const g = globalThis as unknown as { __teamBus?: TeamBus };
export const teamBus: TeamBus = g.__teamBus ?? (g.__teamBus = new TeamBus());
