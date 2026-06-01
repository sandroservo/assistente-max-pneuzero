/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Componente que registra service worker, pede permissão e sobe subscription
 * de Web Push. Renderiza botão pra ativar/desativar + testar.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationSetup({ className }: { className?: string }) {
  const [supported, setSupported] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (ok) setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscribed(!!sub);
      })
      .catch(() => { /* ignora */ });
    return () => { cancelled = true; };
  }, [supported]);

  const activate = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") {
        setMsg("Permissão negada — habilite nas configurações do navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const vapid = await fetch("/api/push/vapid-key").then((r) => r.json());
      if (!vapid.publicKey) {
        setMsg("VAPID key não configurada no servidor.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      setSubscribed(true);
      setMsg("Notificações ativadas ✓");
    } catch (e) {
      console.error(e);
      setMsg("Erro ao ativar — tente de novo.");
    } finally {
      setBusy(false);
    }
  }, []);

  const deactivate = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Notificações desativadas.");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      const j = await r.json();
      setMsg(r.ok ? `Push enviado pra ${j.sent}/${j.total} device(s).` : j.error ?? "Falhou.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!supported) {
    return (
      <div className={cn("text-xs text-gray-400", className)}>
        Navegador não suporta Web Push.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        {subscribed ? (
          <BellRing className="w-4 h-4 text-emerald-600" />
        ) : (
          <BellOff className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-sm text-gray-700">
          Notificações de handoff: <strong>{subscribed ? "ativas" : perm === "denied" ? "bloqueadas pelo navegador" : "desligadas"}</strong>
        </span>
      </div>
      <div className="flex gap-2">
        {!subscribed && (
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className="text-xs px-3 py-1.5 bg-[#CC0000] text-white rounded hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Bell className="w-3 h-3" /> Ativar notificações
          </button>
        )}
        {subscribed && (
          <>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Enviar teste
            </button>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              Desativar
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  );
}
