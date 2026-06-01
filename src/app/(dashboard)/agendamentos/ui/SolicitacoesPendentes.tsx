/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Lista de solicitações pendentes de agendamento (criadas pela Luma).
 * Vendedor aprova ou recusa com motivo.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApptRequest {
  id: string;
  serviceName: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "cancelled_by_lead";
  notes: string | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
  lead: { id: string; name: string | null; phone: string; avatarUrl: string | null };
  resolvedBy: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<ApptRequest["status"], string> = {
  pending: "Aguardando equipe",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled_by_lead: "Cancelada pelo cliente",
};

const STATUS_COLOR: Record<ApptRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled_by_lead: "bg-gray-200 text-gray-600",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SolicitacoesPendentes() {
  const [items, setItems] = useState<ApptRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [tick, setTick] = useState(0);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/appointment-requests?status=${filter}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setItems(j.requests ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, tick]);

  const approve = useCallback(async (id: string) => {
    if (!confirm("Aprovar esta solicitação? Vou criar o agendamento e avisar o cliente no WhatsApp.")) return;
    setActingOn(id);
    try {
      const res = await fetch(`/api/appointment-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("Erro: " + (j.error ?? res.status));
      } else {
        setTick((t) => t + 1);
      }
    } finally {
      setActingOn(null);
    }
  }, []);

  const reject = useCallback(async (id: string) => {
    const note = prompt("Motivo da recusa (vai pro cliente):", "Esse horário não está disponível, posso sugerir outro?");
    if (!note?.trim()) return;
    setActingOn(id);
    try {
      const res = await fetch(`/api/appointment-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("Erro: " + (j.error ?? res.status));
      } else {
        setTick((t) => t + 1);
      }
    } finally {
      setActingOn(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={cn(
            "px-3 py-1 rounded",
            filter === "pending" ? "bg-[#CC0000] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          Pendentes
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1 rounded",
            filter === "all" ? "bg-[#CC0000] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          Todas
        </button>
      </div>

      {loading && <p className="text-center text-gray-500 py-12">Carregando…</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma solicitação {filter === "pending" ? "pendente" : ""}.</p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 text-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">{fmt(r.requestedAt)}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Link href={`/leads/${r.lead.id}`} className="font-semibold text-gray-800 hover:text-[#CC0000] truncate">
                    {r.lead.name || r.lead.phone}
                  </Link>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[r.status])}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{r.serviceName}</p>
                <a
                  href={`https://wa.me/${r.lead.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                >
                  <MessageCircle className="w-3 h-3" /> {r.lead.phone}
                </a>
                {r.notes && <p className="text-xs text-gray-500 italic mt-1">📝 {r.notes}</p>}
                {r.resolvedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    {r.resolvedBy?.name ?? "Equipe"} em {fmt(r.resolvedAt)}
                    {r.resolvedNote ? ` — ${r.resolvedNote}` : ""}
                  </p>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => approve(r.id)}
                    disabled={actingOn === r.id}
                    className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(r.id)}
                    disabled={actingOn === r.id}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" /> Recusar
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
