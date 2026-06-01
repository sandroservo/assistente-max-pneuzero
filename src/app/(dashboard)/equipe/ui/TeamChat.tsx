/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Chat interno do time: canal Geral + DMs entre vendedores.
 * Realtime via SSE em /api/team/stream. Browser notifications + beep ao receber.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Smile, Bell, BellOff, Users as UsersIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";
import { PushNotificationSetup } from "@/components/PushNotificationSetup";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  lastLoginAt: string | null;
}

interface TeamMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  dmKey: string | null;
  body: string;
  createdAt: string;
}

type ChannelId = { kind: "global" } | { kind: "dm"; peerId: string };

function channelKey(c: ChannelId, currentUserId: string): string {
  if (c.kind === "global") return "global";
  const sorted = [currentUserId, c.peerId].sort().join("_");
  return `dm:${sorted}`;
}

function dmKeyOf(c: ChannelId, currentUserId: string): string | null {
  if (c.kind === "global") return null;
  return [currentUserId, c.peerId].sort().join("_");
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Hoje";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function playBeep() {
  try {
    const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // sem áudio, segue sem som
  }
}

export function TeamChat({ currentUserId, currentUserName }: { currentUserId: string; currentUserName: string }) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [current, setCurrent] = useState<ChannelId>({ kind: "global" });
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, TeamMessage[]>>({});
  const [unread, setUnread] = useState<{ global: number; dm: Record<string, number> }>({ global: 0, dm: {} });
  const [body, setBody] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [sseStatus, setSseStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const tabFocused = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  const currentKey = channelKey(current, currentUserId);
  const currentMessages = messagesByChannel[currentKey] ?? [];

  // Fetch initial: users + unread + global history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [uRes, sRes, mRes] = await Promise.all([
        fetch("/api/team/users", { cache: "no-store" }),
        fetch("/api/team/seen", { cache: "no-store" }),
        fetch("/api/team/messages?channel=global&limit=50", { cache: "no-store" }),
      ]);
      if (cancelled) return;
      const uJson = await uRes.json().catch(() => ({}));
      const sJson = await sRes.json().catch(() => ({}));
      const mJson = await mRes.json().catch(() => ({}));
      setUsers(uJson.users ?? []);
      setUnread({ global: sJson.unread?.global ?? 0, dm: sJson.unread?.dm ?? {} });
      setMessagesByChannel((prev) => ({ ...prev, global: mJson.messages ?? [] }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Browser focus tracking
  useEffect(() => {
    const onFocus = () => { tabFocused.current = true; };
    const onBlur = () => { tabFocused.current = false; };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", () => {
      tabFocused.current = document.visibilityState === "visible";
    });
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);

  const requestNotif = useCallback(async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  }, []);

  // SSE
  useEffect(() => {
    const es = new EventSource("/api/team/stream");
    setSseStatus("connecting");
    es.addEventListener("ready", () => setSseStatus("open"));
    es.addEventListener("message", (e) => {
      const msg = JSON.parse((e as MessageEvent).data) as TeamMessage;
      const msgChannelKey = msg.dmKey ? `dm:${msg.dmKey}` : "global";
      setMessagesByChannel((prev) => {
        const arr = prev[msgChannelKey] ?? [];
        if (arr.some((m) => m.id === msg.id)) return prev; // dedupe
        return { ...prev, [msgChannelKey]: [...arr, msg] };
      });

      const isOwn = msg.authorId === currentUserId;
      const isCurrent = channelKey(currentRef.current, currentUserId) === msgChannelKey;
      const isFocused = tabFocused.current;

      if (!isOwn && (!isCurrent || !isFocused)) {
        // Som + notificação
        playBeep();
        if ("Notification" in window && Notification.permission === "granted") {
          const title = msg.dmKey ? `${msg.authorName} (PV)` : `${msg.authorName} (Geral)`;
          try {
            const n = new Notification(title, { body: msg.body.slice(0, 140), icon: "/assets/logo-transp.png" });
            n.onclick = () => window.focus();
          } catch { /* ignora */ }
        }
        // Bump unread
        setUnread((u) => {
          if (msg.dmKey) {
            return { ...u, dm: { ...u.dm, [msg.dmKey]: (u.dm[msg.dmKey] ?? 0) + 1 } };
          }
          return { ...u, global: u.global + 1 };
        });
      } else if (isCurrent && isFocused) {
        // Marca lido em background
        markSeen(currentRef.current);
      }
    });
    es.addEventListener("seen", () => {
      // futuro: sincronizar abas
    });
    es.onerror = () => setSseStatus("closed");
    return () => {
      es.close();
    };
  }, [currentUserId]);

  // Carrega histórico ao trocar canal
  useEffect(() => {
    const key = channelKey(current, currentUserId);
    if (messagesByChannel[key]) return;
    let cancelled = false;
    (async () => {
      const qs = current.kind === "global"
        ? "channel=global&limit=50"
        : `channel=dm&peer=${encodeURIComponent(current.peerId)}&limit=50`;
      const res = await fetch(`/api/team/messages?${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      setMessagesByChannel((prev) => ({ ...prev, [key]: json.messages ?? [] }));
    })();
    return () => {
      cancelled = true;
    };
  }, [current, currentUserId, messagesByChannel]);

  // Marca lido ao focar canal
  useEffect(() => {
    markSeen(current);
    // Zera unread local do canal atual
    setUnread((u) => {
      if (current.kind === "global") return { ...u, global: 0 };
      const dmKey = [currentUserId, current.peerId].sort().join("_");
      const next = { ...u.dm };
      delete next[dmKey];
      return { ...u, dm: next };
    });
  }, [current, currentUserId]);

  // Autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages.length, currentKey]);

  const send = useCallback(async () => {
    const text = body.trim();
    if (!text) return;
    setBody("");
    const payload: Record<string, unknown> = current.kind === "global"
      ? { channel: "global", body: text }
      : { channel: "dm", peer: current.peerId, body: text };
    try {
      await fetch("/api/team/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // SSE devolve a mensagem; não inserimos aqui pra evitar duplicate
    } catch (e) {
      console.error("send failed", e);
    }
  }, [body, current]);

  function markSeen(c: ChannelId) {
    const payload: Record<string, unknown> = c.kind === "global"
      ? { channel: "global" }
      : { channel: "dm", peer: c.peerId };
    fetch("/api/team/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => { /* ignora */ });
  }

  // Agrupa mensagens por dia
  const grouped = useMemo(() => {
    const out: { day: string; items: TeamMessage[] }[] = [];
    for (const m of currentMessages) {
      const day = fmtDay(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [currentMessages]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar do chat */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800">Chat da Equipe</h2>
            <button
              type="button"
              onClick={requestNotif}
              title={notifPerm === "granted" ? "Notificações in-app ativas" : "Permitir notificações in-app"}
              className="text-gray-500 hover:text-gray-800"
            >
              {notifPerm === "granted" ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          </div>
          <PushNotificationSetup className="border-t border-gray-100 pt-2 mt-2" />
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={() => setCurrent({ kind: "global" })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
              current.kind === "global" ? "bg-[#CC0000] text-white" : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="flex-1 text-left">Geral</span>
            {unread.global > 0 && current.kind !== "global" && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unread.global > 99 ? "99+" : unread.global}
              </span>
            )}
          </button>
        </div>

        <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          <UsersIcon className="w-3 h-3" />
          <span>Vendedores</span>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {users.length === 0 && (
            <li className="px-3 py-2 text-xs text-gray-400">Nenhum colega.</li>
          )}
          {users.map((u) => {
            const dmKey = [currentUserId, u.id].sort().join("_");
            const active = current.kind === "dm" && current.peerId === u.id;
            const unreadCount = unread.dm[dmKey] ?? 0;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setCurrent({ kind: "dm", peerId: u.id })}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                    active ? "bg-[#CC0000] text-white" : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                    active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                  )}>
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <span className="flex-1 text-left truncate">{u.name}</span>
                  {unreadCount > 0 && !active && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Conversa */}
      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">
              {current.kind === "global" ? "Geral" : users.find((u) => u.id === current.peerId)?.name ?? "Conversa"}
            </h3>
            <p className="text-xs text-gray-500">
              {current.kind === "global" ? "Canal do time inteiro" : "Mensagem privada"}
            </p>
          </div>
          <span className={cn(
            "text-xs flex items-center gap-1.5",
            sseStatus === "open" && "text-emerald-600",
            sseStatus === "connecting" && "text-amber-600",
            sseStatus === "closed" && "text-red-600",
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              sseStatus === "open" && "bg-emerald-500",
              sseStatus === "connecting" && "bg-amber-500",
              sseStatus === "closed" && "bg-red-500",
            )} />
            {sseStatus === "open" ? "Conectado" : sseStatus === "connecting" ? "Conectando" : "Desconectado"}
          </span>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-4">
          {grouped.length === 0 && (
            <p className="text-center text-sm text-gray-400">Sem mensagens ainda.</p>
          )}
          {grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="text-center">
                <span className="inline-block bg-white text-[11px] text-gray-500 px-3 py-1 rounded-full border border-gray-200">
                  {g.day}
                </span>
              </div>
              {g.items.map((m) => {
                const own = m.authorId === currentUserId;
                return (
                  <div key={m.id} className={cn("flex gap-2", own && "flex-row-reverse")}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                      own ? "bg-[#CC0000] text-white" : "bg-gray-200 text-gray-700"
                    )}>
                      {(own ? currentUserName : m.authorName).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      own ? "bg-[#CC0000] text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm"
                    )}>
                      {!own && current.kind === "global" && (
                        <p className="text-[11px] font-semibold mb-0.5 text-gray-500">{m.authorName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("text-[10px] mt-1", own ? "text-white/70" : "text-gray-400")}>{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="relative border-t border-gray-200 bg-white p-3">
          {emojiOpen && (
            <EmojiPicker
              onPick={(e) => setBody((b) => b + e)}
              onClose={() => setEmojiOpen(false)}
            />
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setEmojiOpen((o) => !o)}
              className="p-2 text-gray-500 hover:text-gray-800"
              title="Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Mensagem para a equipe…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CC0000]/30 max-h-32"
            />
            <button
              type="button"
              onClick={send}
              disabled={!body.trim()}
              className="p-2.5 rounded-xl bg-[#CC0000] text-white disabled:opacity-40 hover:bg-red-700 transition"
              title="Enviar (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
