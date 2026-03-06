/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

"use client";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  UserCheck,
  MessageCircle,
  Headphones
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserStat {
  id: string;
  name: string;
  email: string;
  role: string;
  totalHandoffs: number;
  completedHandoffs: number;
  pendingHandoffs: number;
  messagesSent: number;
  avgResponseTimeSec: number;
  leadsQualified: number;
  leadsClosed: number;
}

interface LeadByStatus {
  status: string;
  count: number;
}

interface Stats {
  totalLeads: number;
  leadsByStatus: LeadByStatus[];
  messagesIn: number;
  messagesOut: number;
  totalHandoffs: number;
  completedHandoffs: number;
}

interface ReportsViewProps {
  userStats: UserStat[];
  stats: Stats;
}

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em Atendimento",
  QUALIFICADO: "Qualificado",
  LEAD_FRIO: "Lead Frio",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
  HUMANO_SOLICITADO: "Aguardando Humano",
};

const STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-red-100 text-red-700",
  EM_ATENDIMENTO: "bg-orange-100 text-orange-700",
  QUALIFICADO: "bg-blue-100 text-blue-700",
  LEAD_FRIO: "bg-slate-100 text-slate-700",
  FECHADO: "bg-green-100 text-green-700",
  PERDIDO: "bg-red-100 text-red-700",
  HUMANO_SOLICITADO: "bg-yellow-100 text-yellow-700",
};

export function ReportsView({ userStats, stats }: ReportsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
        <p className="text-gray-500">Visão geral dos atendimentos (últimos 30 dias)</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CC0000] to-[#990000] flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de Leads</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalLeads}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensagens Recebidas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.messagesIn}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensagens Enviadas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.messagesOut}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Headphones className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Transferências</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.completedHandoffs}/{stats.totalHandoffs}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Leads por status */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#CC0000]" />
          Leads por Status
        </h2>
        <div className="flex flex-wrap gap-3">
          {stats.leadsByStatus.map((item) => (
            <div 
              key={item.status}
              className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2"
            >
              <Badge className={cn("text-xs", STATUS_COLORS[item.status])}>
                {STATUS_LABELS[item.status] || item.status}
              </Badge>
              <span className="text-lg font-bold text-gray-800">{item.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Desempenho por usuário */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#CC0000]" />
          Desempenho por Usuário
        </h2>

        {userStats.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {userStats.map((user) => {
              const completionRate = user.totalHandoffs > 0 
                ? Math.round((user.completedHandoffs / user.totalHandoffs) * 100)
                : 0;

              const roleLabel = user.role === "OWNER" ? "Proprietário"
                : user.role === "ADMIN" ? "Administrador"
                : user.role === "AGENT" ? "Atendente"
                : "Visualizador";

              const responseTime = user.avgResponseTimeSec > 0
                ? user.avgResponseTimeSec >= 3600
                  ? `${Math.round(user.avgResponseTimeSec / 3600)}h ${Math.round((user.avgResponseTimeSec % 3600) / 60)}min`
                  : user.avgResponseTimeSec >= 60
                    ? `${Math.round(user.avgResponseTimeSec / 60)}min`
                    : `${user.avgResponseTimeSec}s`
                : "—";

              const responseColor = user.avgResponseTimeSec === 0 ? "text-gray-400"
                : user.avgResponseTimeSec <= 300 ? "text-green-600"
                : user.avgResponseTimeSec <= 900 ? "text-yellow-600"
                : "text-red-600";

              return (
                <div
                  key={user.id}
                  className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
                >
                  {/* Header do card */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#CC0000] to-[#990000] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 truncate">{user.email}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {roleLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Métricas principais */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                      <MessageSquare className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-700">{user.messagesSent}</p>
                      <p className="text-[10px] text-blue-500 leading-tight">Msgs enviadas</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                      <Clock className={cn("w-4 h-4 mx-auto mb-1", responseColor)} />
                      <p className={cn("text-lg font-bold", responseColor)}>{responseTime}</p>
                      <p className="text-[10px] text-purple-500 leading-tight">Tempo resposta</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2.5 text-center">
                      <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-700">{user.leadsQualified}</p>
                      <p className="text-[10px] text-green-500 leading-tight">Qualificados</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-700">{user.leadsClosed}</p>
                      <p className="text-[10px] text-emerald-500 leading-tight">Fechados</p>
                    </div>
                  </div>

                  {/* Handoffs + barra de progresso */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">Atendimentos</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">{user.totalHandoffs} total</span>
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          {user.completedHandoffs}
                        </span>
                        <span className="inline-flex items-center gap-1 text-orange-500">
                          <Clock className="w-3 h-3" />
                          {user.pendingHandoffs}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            completionRate >= 70 ? "bg-green-500" :
                            completionRate >= 40 ? "bg-yellow-500" : "bg-red-400"
                          )}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-xs font-bold min-w-[36px] text-right",
                        completionRate >= 70 ? "text-green-600" :
                        completionRate >= 40 ? "text-yellow-600" : "text-red-500"
                      )}>
                        {completionRate}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
