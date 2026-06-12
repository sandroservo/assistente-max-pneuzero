/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Botão "Assumir conversa" / "Liberar" — fila de atendimento.
 */

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Hand, UserX } from "lucide-react";

interface AssignButtonProps {
  leadId: string;
  assignedUser: { id: string; name: string; avatar: string | null } | null;
  onToast?: (msg: string) => void;
}

export default function AssignButton({ leadId, assignedUser, onToast }: AssignButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const me = session?.user?.id;
  const mine = !!assignedUser && me === assignedUser.id;

  const assume = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        onToast?.(json.message ?? "Outro vendedor já assumiu");
      } else if (res.ok) {
        onToast?.("Você assumiu a conversa");
        router.refresh();
      } else {
        onToast?.(json.error ?? "Falha ao assumir");
      }
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!confirm("Devolver esta conversa para a fila?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, { method: "DELETE" });
      if (res.ok) {
        onToast?.("Conversa liberada");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!assignedUser) {
    return (
      <button
        type="button"
        onClick={assume}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-50"
      >
        <Hand className="w-4 h-4" />
        {busy ? "Assumindo…" : "Assumir conversa"}
      </button>
    );
  }

  if (mine) {
    return (
      <button
        type="button"
        onClick={release}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 text-sm font-medium transition disabled:opacity-50"
      >
        <UserX className="w-4 h-4" />
        {busy ? "Liberando…" : "Devolver pra fila"}
      </button>
    );
  }

  return (
    <div className="w-full px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm flex items-center gap-2">
      <Hand className="w-4 h-4" />
      <span>Em atendimento por <strong>{assignedUser.name}</strong></span>
    </div>
  );
}
