/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * UI de agendamentos: lista por dia, filtros e criar/editar/cancelar.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Plus, Search, X, Bot, User as UserIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SolicitacoesPendentes } from "./SolicitacoesPendentes";

interface Appointment {
  id: string;
  serviceName: string;
  scheduledAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  source: "bot" | "human" | "user";
  lead: { id: string; name: string | null; phone: string; avatarUrl: string | null };
  vehicle: { id: string; marca: string | null; modelo: string | null; ano: number | null; placa: string | null } | null;
  createdBy: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<Appointment["status"], string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  done: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const STATUS_COLOR: Record<Appointment["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  done: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-200 text-gray-600",
  no_show: "bg-red-100 text-red-800",
};

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" }).format(d);
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function AgendamentosClient() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | Appointment["status"]>("");
  const [showCreate, setShowCreate] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const monthFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const monthTo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    d.setDate(0); d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ from: monthFrom, to: monthTo });
    if (status) qs.set("status", status);
    if (q.trim()) qs.set("q", q.trim());
    fetch(`/api/appointments?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setItems(j.appointments ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [monthFrom, monthTo, q, status, refreshTick]);

  const grouped = useMemo(() => {
    const out: { day: string; iso: string; items: Appointment[] }[] = [];
    for (const a of items) {
      const day = fmtDay(a.scheduledAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(a);
      else out.push({ day, iso: a.scheduledAt, items: [a] });
    }
    return out;
  }, [items]);

  const cancel = useCallback(async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    const reason = prompt("Motivo (opcional):") ?? "";
    await fetch(`/api/appointments/${id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" });
    setRefreshTick((t) => t + 1);
  }, []);

  const setStatusOf = useCallback(async (id: string, newStatus: Appointment["status"]) => {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setRefreshTick((t) => t + 1);
  }, []);

  const tabFromUrl = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState<"agendados" | "solicitacoes">(tabFromUrl === "solicitacoes" ? "solicitacoes" : "agendados");

  // Auto-refresh da aba "agendados" a cada 15s (pausa se a aba do navegador
  // estiver oculta pra não gastar request à toa).
  useEffect(() => {
    if (tab !== "agendados") return;
    const iv = setInterval(() => {
      if (!document.hidden) setRefreshTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(iv);
  }, [tab]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#CC0000]" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Agendamentos</h1>
            <p className="text-sm text-gray-500">Manutenções marcadas pela Luma ou pelo time</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#CC0000] text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Novo agendamento
        </button>
      </div>

      <div className="flex gap-2 mb-5 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("agendados")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2",
            tab === "agendados" ? "border-[#CC0000] text-[#CC0000]" : "border-transparent text-gray-500 hover:text-gray-800"
          )}
        >
          <Calendar className="w-4 h-4" /> Agendados
        </button>
        <button
          type="button"
          onClick={() => setTab("solicitacoes")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2",
            tab === "solicitacoes" ? "border-[#CC0000] text-[#CC0000]" : "border-transparent text-gray-500 hover:text-gray-800"
          )}
        >
          <Clock className="w-4 h-4" /> Solicitações
        </button>
      </div>

      {tab === "solicitacoes" && <SolicitacoesPendentes />}

      {tab === "agendados" && (
      <div>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone ou serviço…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#CC0000]/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Appointment["status"] | "")}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todos status</option>
          <option value="confirmed">Confirmados</option>
          <option value="pending">Pendentes</option>
          <option value="done">Concluídos</option>
          <option value="cancelled">Cancelados</option>
          <option value="no_show">Não compareceu</option>
        </select>
      </div>

      {loading && items.length === 0 && <p className="text-center text-gray-500 py-12">Carregando…</p>}
      {!loading && grouped.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sem agendamentos no período.</p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map((g) => (
          <div key={g.iso}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 capitalize">{g.day}</h2>
            <ul className="space-y-2">
              {g.items.map((a) => (
                <li key={a.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="w-16 text-center">
                    <p className="text-2xl font-bold text-[#CC0000] leading-none">{fmtTime(a.scheduledAt)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link href={`/leads/${a.lead.id}`} className="font-semibold text-gray-800 hover:text-[#CC0000] truncate">
                        {a.lead.name || a.lead.phone}
                      </Link>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[a.status])}>
                        {STATUS_LABEL[a.status]}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        {a.source === "bot" ? <Bot className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        {a.source === "bot" ? "Luma" : a.createdBy?.name ?? "Manual"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{a.serviceName}</p>
                    {a.vehicle && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[a.vehicle.marca, a.vehicle.modelo, a.vehicle.ano].filter(Boolean).join(" ")}
                        {a.vehicle.placa ? ` · ${a.vehicle.placa}` : ""}
                      </p>
                    )}
                    {a.notes && <p className="text-xs text-gray-500 mt-1 italic">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status !== "done" && a.status !== "cancelled" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setStatusOf(a.id, "done")}
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Concluir
                        </button>
                        <button
                          type="button"
                          onClick={() => cancel(a.id)}
                          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-50 hover:text-red-600"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshTick((t) => t + 1); }} />}
    </div>
  );
}

interface CreateLead { id: string; name: string | null; phone: string }
interface CatalogService { id: string; nome: string; categoria: string; precoBase: string | null; duracaoMin: number | null }

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [leads, setLeads] = useState<CreateLead[]>([]);
  const [leadQ, setLeadQ] = useState("");
  const [leadId, setLeadId] = useState("");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [serviceItemId, setServiceItemId] = useState("");
  const [customServiceName, setCustomServiceName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = leadQ.trim();
      if (!q) { setLeads([]); return; }
      fetch(`/api/leads?q=${encodeURIComponent(q)}&limit=10`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setLeads(j.leads ?? []))
        .catch(() => setLeads([]));
    }, 250);
    return () => clearTimeout(t);
  }, [leadQ]);

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setServices(j.services ?? []))
      .catch(() => setServices([]));
  }, []);

  const groupedServices = useMemo(() => {
    const map = new Map<string, CatalogService[]>();
    for (const s of services) {
      const arr = map.get(s.categoria) ?? [];
      arr.push(s);
      map.set(s.categoria, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services]);

  const selectedService = services.find((s) => s.id === serviceItemId);
  const finalServiceName = serviceItemId === "__custom__" ? customServiceName.trim() : selectedService?.nome ?? "";

  const save = async () => {
    if (!leadId || !finalServiceName || !scheduledAt) return;
    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          serviceName: finalServiceName,
          serviceItemId: serviceItemId && serviceItemId !== "__custom__" ? serviceItemId : undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          notes: notes || undefined,
        }),
      });
      if (res.ok) onCreated();
      else alert("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Novo agendamento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Cliente</label>
            <input
              type="text"
              placeholder="Buscar por nome ou telefone…"
              value={leadQ}
              onChange={(e) => { setLeadQ(e.target.value); setLeadId(""); }}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            {leads.length > 0 && !leadId && (
              <ul className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
                {leads.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => { setLeadId(l.id); setLeadQ(l.name || l.phone); setLeads([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium">{l.name || "(sem nome)"}</span> <span className="text-gray-500">{l.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Serviço</label>
            <select
              value={serviceItemId}
              onChange={(e) => setServiceItemId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Selecione o serviço…</option>
              {groupedServices.map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                      {s.precoBase ? ` — R$ ${s.precoBase}` : ""}
                      {s.duracaoMin ? ` (${s.duracaoMin}min)` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="__custom__">— Outro (digitar nome) —</option>
            </select>
            {serviceItemId === "__custom__" && (
              <input
                type="text"
                placeholder="Nome do serviço"
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Data e hora</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!leadId || !finalServiceName || !scheduledAt || saving}
            className="w-full bg-[#CC0000] text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-red-700"
          >
            {saving ? "Salvando…" : "Criar agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
