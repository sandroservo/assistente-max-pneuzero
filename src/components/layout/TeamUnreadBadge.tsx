/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Badge no menu lateral somando unread do chat interno.
 * Conta inicial via /api/team/seen + atualiza via SSE.
 */

"use client";

import { useEffect, useState } from "react";

export function TeamUnreadBadge({ className }: { className?: string }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/team/seen", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const dmSum = Object.values(json?.unread?.dm ?? {}).reduce((a: number, b) => a + (Number(b) || 0), 0);
        setTotal((json?.unread?.global ?? 0) + dmSum);
      } catch {
        // ignora
      }
    };

    fetchCount();

    const es = new EventSource("/api/team/stream");
    es.addEventListener("message", () => fetchCount());
    es.addEventListener("seen", () => fetchCount());
    es.onerror = () => { /* segue */ };

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  if (total <= 0) return null;
  return (
    <span className={className ?? "bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"}>
      {total > 99 ? "99+" : total}
    </span>
  );
}
