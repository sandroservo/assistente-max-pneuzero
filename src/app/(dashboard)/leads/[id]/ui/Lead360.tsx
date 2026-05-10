"use client";

/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Ficha 360° do lead — Timeline + Veículos + Vendas + NPS + Follow-ups.
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  DollarSign,
  Star,
  Bell,
  Activity,
  MessageSquare,
  FileText,
  Wrench,
  Mail,
  Phone,
  MapPin,
  Cake,
  AlertTriangle,
} from "lucide-react";

interface Vehicle {
  id: string;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  cor: string | null;
  medidaPneu: string | null;
  kmAtual: number | null;
  ultimoAlinhamentoData: string | null;
  ultimaTrocaPneusData: string | null;
  ultimaTrocaOleoData: string | null;
  ultimaTrocaOleoKm: number | null;
  observacoes: string | null;
}

interface MessageItem {
  id: string;
  direction: "in" | "out";
  body: string | null;
  type: string;
  createdAt: string;
  sentByUserId: string | null;
}

interface QuoteItem {
  id: string;
  descricao: string;
  quantidade: number;
  precoUnit: string;
  subtotal: string;
}

interface Quote {
  id: string;
  status: string;
  total: string;
  formaPagamento: string | null;
  parcelas: number | null;
  observacoes: string | null;
  enviadaEm: string | null;
  createdAt: string;
  validadeAte: string | null;
  vendedor: string | null;
  vehicle: string | null;
  items: QuoteItem[];
}

interface ServiceLogItem {
  id: string;
  tipo: string;
  descricao: string | null;
  executadoEm: string;
  garantiaAte: string | null;
}

interface Sale {
  id: string;
  status: string;
  total: string;
  formaPagamento: string;
  parcelas: number | null;
  dataFechamento: string;
  dataServico: string | null;
  vendedor: string | null;
  vehicle: string | null;
  npsNota: number | null;
  serviceLogs: ServiceLogItem[];
}

interface NPSItem {
  id: string;
  nota: number;
  categoria: string;
  comentario: string | null;
  respondidoEm: string;
  saleId: string;
}

interface FollowUpItem {
  id: string;
  status: string;
  type: string | null;
  ruleNome: string | null;
  ruleTipo: string | null;
  scheduledAt: string;
  sentAt: string | null;
  template: string | null;
  lastError: string | null;
}

interface LeadData {
  id: string;
  name: string | null;
  pushName: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  cpf: string | null;
  status: string;
  category: string;
  priority: string;
  source: string;
  summary: string | null;
  notes: string | null;
  leadScore: number;
  birthDate: string | null;
  followUpOptOut: boolean;
  avatarUrl: string | null;
  tags: { id: string; name: string; color: string }[];
  vehicles: Vehicle[];
  messages: MessageItem[];
  quotes: Quote[];
  sales: Sale[];
  nps: NPSItem[];
  followUps: FollowUpItem[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(s: string) {
  const n = parseFloat(s);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface TimelineEvent {
  id: string;
  ts: string;
  icon: React.ReactNode;
  title: string;
  body?: string;
  color: string;
}

function buildTimeline(data: LeadData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const m of data.messages) {
    events.push({
      id: `msg-${m.id}`,
      ts: m.createdAt,
      icon: <MessageSquare className="w-3 h-3" />,
      title: m.direction === "in" ? `Cliente disse` : (m.sentByUserId ? "Atendente respondeu" : "Max respondeu"),
      body: m.body ? m.body.slice(0, 220) : `[${m.type}]`,
      color: m.direction === "in" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700",
    });
  }

  for (const q of data.quotes) {
    const itens = q.items.map((i) => `${i.quantidade}× ${i.descricao}`).join(" + ");
    events.push({
      id: `quote-${q.id}`,
      ts: q.createdAt,
      icon: <FileText className="w-3 h-3" />,
      title: `Cotação ${q.status} — ${fmtMoney(q.total)}`,
      body: `${itens}${q.vendedor ? ` · ${q.vendedor}` : ""}`,
      color: "bg-amber-100 text-amber-700",
    });
  }

  for (const s of data.sales) {
    events.push({
      id: `sale-${s.id}`,
      ts: s.dataFechamento,
      icon: <DollarSign className="w-3 h-3" />,
      title: `Venda ${s.status} — ${fmtMoney(s.total)}`,
      body: `${s.formaPagamento}${s.parcelas ? `/${s.parcelas}x` : ""} · ${s.vendedor ?? "—"}${s.vehicle ? ` · ${s.vehicle}` : ""}`,
      color: "bg-green-100 text-green-700",
    });
    for (const sl of s.serviceLogs) {
      events.push({
        id: `log-${sl.id}`,
        ts: sl.executadoEm,
        icon: <Wrench className="w-3 h-3" />,
        title: `Serviço executado: ${sl.tipo}`,
        body: sl.descricao ?? undefined,
        color: "bg-purple-100 text-purple-700",
      });
    }
  }

  for (const n of data.nps) {
    const color = n.categoria === "promotor" ? "bg-emerald-100 text-emerald-700"
      : n.categoria === "neutro" ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
    events.push({
      id: `nps-${n.id}`,
      ts: n.respondidoEm,
      icon: <Star className="w-3 h-3" />,
      title: `NPS ${n.nota}/10 (${n.categoria})`,
      body: n.comentario ?? undefined,
      color,
    });
  }

  for (const f of data.followUps) {
    if (f.status === "pending") continue;
    events.push({
      id: `fu-${f.id}`,
      ts: f.sentAt ?? f.scheduledAt,
      icon: <Bell className="w-3 h-3" />,
      title: `Follow-up ${f.status} — ${f.ruleNome ?? f.type ?? "—"}`,
      body: f.template ? f.template.slice(0, 220) : undefined,
      color: f.status === "sent" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700",
    });
  }

  return events.sort((a, b) => b.ts.localeCompare(a.ts));
}

export function Lead360({ data }: { data: LeadData }) {
  const timeline = buildTimeline(data);
  const displayName = data.name || data.pushName || data.phone;
  const initial = displayName.trim()[0]?.toUpperCase() ?? "?";

  const totalVendas = data.sales.reduce((acc, s) => acc + parseFloat(s.total), 0);
  const npsMedio =
    data.nps.length === 0
      ? null
      : data.nps.reduce((a, n) => a + n.nota, 0) / data.nps.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-5 flex flex-wrap items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#CC0000] to-[#990000] text-white text-2xl font-bold flex items-center justify-center shrink-0">
            {data.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatarUrl} alt={displayName} className="w-full h-full rounded-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{displayName}</h2>
              <Badge variant="secondary">{data.status}</Badge>
              <Badge variant="outline">{data.category}</Badge>
              {data.followUpOptOut && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> Opt-out follow-up
                </Badge>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {data.phone}</span>
              {data.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {data.email}</span>}
              {data.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {data.city}</span>}
              {data.birthDate && (
                <span className="inline-flex items-center gap-1"><Cake className="w-3 h-3" /> {new Date(data.birthDate).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
            {data.tags.length > 0 && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {data.tags.map((t) => (
                  <span key={t.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <KpiBox label="Score" value={data.leadScore} />
            <KpiBox label="Vendas" value={fmtMoney(totalVendas.toFixed(2))} />
            <KpiBox label="NPS médio" value={npsMedio === null ? "—" : npsMedio.toFixed(1)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline"><Activity className="w-4 h-4 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="veiculos"><Car className="w-4 h-4 mr-1" /> Veículos ({data.vehicles.length})</TabsTrigger>
          <TabsTrigger value="vendas"><DollarSign className="w-4 h-4 mr-1" /> Vendas ({data.sales.length})</TabsTrigger>
          <TabsTrigger value="nps"><Star className="w-4 h-4 mr-1" /> NPS ({data.nps.length})</TabsTrigger>
          <TabsTrigger value="followups"><Bell className="w-4 h-4 mr-1" /> Follow-ups ({data.followUps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {timeline.length === 0 && <p className="text-gray-500 text-sm">Nenhum evento.</p>}
              {timeline.map((e) => (
                <div key={e.id} className="flex gap-3 items-start">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${e.color}`}>
                    {e.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{e.title}</div>
                    {e.body && <div className="text-xs text-gray-600 mt-0.5 break-words">{e.body}</div>}
                    <div className="text-[10px] text-gray-400 mt-0.5">{fmtDate(e.ts)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="veiculos">
          <div className="grid gap-3 md:grid-cols-2">
            {data.vehicles.length === 0 && (
              <Card><CardContent className="p-5 text-sm text-gray-500">Nenhum veículo registrado.</CardContent></Card>
            )}
            {data.vehicles.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-5 h-5 text-[#CC0000]" />
                    <h3 className="font-semibold">{[v.marca, v.modelo, v.ano].filter(Boolean).join(" ") || "Veículo"}</h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-1 text-sm">
                    {v.placa && <Row label="Placa" value={v.placa} />}
                    {v.cor && <Row label="Cor" value={v.cor} />}
                    {v.medidaPneu && <Row label="Pneu" value={v.medidaPneu} />}
                    {v.kmAtual !== null && <Row label="Km atual" value={v.kmAtual.toLocaleString("pt-BR")} />}
                    {v.ultimaTrocaPneusData && <Row label="Última troca pneus" value={new Date(v.ultimaTrocaPneusData).toLocaleDateString("pt-BR")} />}
                    {v.ultimoAlinhamentoData && <Row label="Último alinhamento" value={new Date(v.ultimoAlinhamentoData).toLocaleDateString("pt-BR")} />}
                    {v.ultimaTrocaOleoData && <Row label="Última troca óleo" value={`${new Date(v.ultimaTrocaOleoData).toLocaleDateString("pt-BR")}${v.ultimaTrocaOleoKm ? ` @ ${v.ultimaTrocaOleoKm.toLocaleString("pt-BR")} km` : ""}`} />}
                  </dl>
                  {v.observacoes && <p className="mt-3 text-xs text-gray-600">{v.observacoes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vendas">
          <div className="space-y-3">
            {data.sales.length === 0 && (
              <Card><CardContent className="p-5 text-sm text-gray-500">Nenhuma venda registrada.</CardContent></Card>
            )}
            {data.sales.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge>{s.status}</Badge>
                      <span className="text-lg font-bold">{fmtMoney(s.total)}</span>
                    </div>
                    <span className="text-xs text-gray-500">{fmtDate(s.dataFechamento)}</span>
                  </div>
                  <div className="text-sm text-gray-700 grid grid-cols-2 gap-1">
                    <Row label="Vendedor" value={s.vendedor ?? "—"} />
                    <Row label="Pagamento" value={`${s.formaPagamento}${s.parcelas ? `/${s.parcelas}x` : ""}`} />
                    {s.vehicle && <Row label="Veículo" value={s.vehicle} />}
                    {s.dataServico && <Row label="Data serviço" value={fmtDate(s.dataServico)} />}
                    {s.npsNota !== null && <Row label="NPS" value={`${s.npsNota}/10`} />}
                  </div>
                  {s.serviceLogs.length > 0 && (
                    <div className="border-t pt-2 text-xs space-y-1">
                      <div className="font-semibold text-gray-600">Serviços executados:</div>
                      {s.serviceLogs.map((sl) => (
                        <div key={sl.id} className="flex gap-2">
                          <Wrench className="w-3 h-3 mt-0.5 text-purple-600 shrink-0" />
                          <span>{sl.tipo}{sl.descricao ? ` — ${sl.descricao}` : ""} <span className="text-gray-400">({new Date(sl.executadoEm).toLocaleDateString("pt-BR")})</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="nps">
          <div className="grid gap-3 md:grid-cols-2">
            {data.nps.length === 0 && (
              <Card><CardContent className="p-5 text-sm text-gray-500">Sem respostas NPS.</CardContent></Card>
            )}
            {data.nps.map((n) => {
              const color = n.categoria === "promotor" ? "border-emerald-300 bg-emerald-50"
                : n.categoria === "neutro" ? "border-yellow-300 bg-yellow-50"
                : "border-red-300 bg-red-50";
              return (
                <Card key={n.id} className={`border-2 ${color}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold">{n.nota}/10</div>
                      <Badge variant="outline">{n.categoria}</Badge>
                    </div>
                    {n.comentario && <p className="text-sm mt-2">{n.comentario}</p>}
                    <p className="text-xs text-gray-500 mt-2">{fmtDate(n.respondidoEm)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="followups">
          <div className="space-y-2">
            {data.followUps.length === 0 && (
              <Card><CardContent className="p-5 text-sm text-gray-500">Nenhum follow-up.</CardContent></Card>
            )}
            {data.followUps.map((f) => (
              <Card key={f.id}>
                <CardContent className="p-4 flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant={f.status === "pending" ? "default" : f.status === "sent" ? "secondary" : "destructive"}>
                    {f.status}
                  </Badge>
                  <span className="font-medium">{f.ruleNome ?? f.type ?? "—"}</span>
                  <span className="text-gray-500 text-xs">
                    {f.sentAt ? `Enviado ${fmtDate(f.sentAt)}` : `Agendado ${fmtDate(f.scheduledAt)}`}
                  </span>
                  {f.lastError && <span className="text-xs text-red-600 truncate max-w-xs">⚠ {f.lastError}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </>
  );
}

function KpiBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-2 rounded-md bg-gray-50 border">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
