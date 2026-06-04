/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Pub/sub in-memory pra notificações in-app (toasts). Cobre eventos org-wide
 * que devem chegar a TODOS vendedores logados, independente da rota aberta.
 *
 * Tipos atuais:
 *  - lead_new: primeiro contato de lead no WhatsApp
 *  - appointment_request: Luma criou solicitação de agendamento
 *  - handoff: Luma transferiu pra humano
 *  - appointment_imminent: agendamento começa em ~30min
 */

export type NotifKind =
  | "lead_new"
  | "appointment_request"
  | "handoff"
  | "appointment_imminent";

export interface Notif {
  id: string;
  organizationId: string;
  kind: NotifKind;
  title: string;
  body?: string;
  url?: string; // rota que abre ao clicar
  at: string; // ISO
}

type Listener = (n: Notif) => void;

class NotifyBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(n: Notif): void {
    for (const l of this.listeners) {
      try {
        l(n);
      } catch (err) {
        console.error("[notify-bus] listener error:", err);
      }
    }
  }

  size(): number {
    return this.listeners.size;
  }
}

const g = globalThis as unknown as { __notifyBus?: NotifyBus };
export const notifyBus: NotifyBus = g.__notifyBus ?? (g.__notifyBus = new NotifyBus());

let counter = 0;
export function publishNotif(input: Omit<Notif, "id" | "at">): Notif {
  counter = (counter + 1) % 1_000_000;
  const n: Notif = {
    ...input,
    id: `${Date.now().toString(36)}-${counter}`,
    at: new Date().toISOString(),
  };
  notifyBus.publish(n);
  return n;
}
