/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cliente SSE pra /api/notifications/stream + toasts in-app no canto.
 * Renderizar 1x no layout do dashboard. Funciona em qualquer rota.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, UserPlus, CalendarPlus, Headphones, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "lead_new" | "appointment_request" | "handoff" | "appointment_imminent";

interface Notif {
  id: string;
  organizationId: string;
  kind: Kind;
  title: string;
  body?: string;
  url?: string;
  at: string;
}

const ICON: Record<Kind, React.ComponentType<{ className?: string }>> = {
  lead_new: UserPlus,
  appointment_request: CalendarPlus,
  handoff: Headphones,
  appointment_imminent: Clock,
};

const ACCENT: Record<Kind, string> = {
  lead_new: "border-emerald-300 bg-emerald-50 text-emerald-700",
  appointment_request: "border-amber-300 bg-amber-50 text-amber-700",
  handoff: "border-red-300 bg-red-50 text-red-700",
  appointment_imminent: "border-blue-300 bg-blue-50 text-blue-700",
};

function playBeep() {
  try {
    type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
    const w = window as WebkitWindow;
    const AudioCtx = window.AudioContext || w.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    /* ignore */
  }
}

export function NotificationProvider() {
  const [toasts, setToasts] = useState<Notif[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("notif", (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as Notif;
        setToasts((arr) => [...arr, n].slice(-5));
        playBeep();
        // auto-dismiss 8s
        window.setTimeout(() => {
          setToasts((arr) => arr.filter((t) => t.id !== n.id));
        }, 8000);
      } catch {
        /* ignore parse error */
      }
    });
    es.onerror = () => { /* segue reconnect padrão */ };
    return () => es.close();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 max-w-sm pointer-events-none">
      {toasts.map((n) => {
        const Icon = ICON[n.kind] ?? Bell;
        const inner = (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border shadow-md p-3 pr-2 pointer-events-auto animate-in slide-in-from-bottom-4 duration-200",
              ACCENT[n.kind]
            )}
            onClick={() => dismiss(n.id)}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{n.title}</p>
              {n.body && <p className="text-xs mt-0.5 opacity-90 line-clamp-2">{n.body}</p>}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); dismiss(n.id); }}
              className="shrink-0 p-1 rounded hover:bg-black/5"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
        return n.url ? (
          <Link key={n.id} href={n.url} className="block">
            {inner}
          </Link>
        ) : (
          <div key={n.id}>{inner}</div>
        );
      })}
    </div>
  );
}
