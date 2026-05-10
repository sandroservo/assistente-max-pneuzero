/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Lead360 } from "./ui/Lead360";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      tags: true,
      vehicles: { orderBy: { updatedAt: "desc" } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 200,
            select: {
              id: true, direction: true, body: true, type: true,
              createdAt: true, sentByUserId: true,
            },
          },
        },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          vendedor: { select: { id: true, name: true } },
          vehicle: { select: { modelo: true, placa: true } },
        },
      },
      sales: {
        orderBy: { dataFechamento: "desc" },
        include: {
          vendedor: { select: { id: true, name: true } },
          vehicle: { select: { modelo: true, placa: true } },
          nps: true,
          serviceLogs: true,
        },
      },
      nps: { orderBy: { respondidoEm: "desc" }, include: { sale: { select: { id: true, dataFechamento: true } } } },
      followUps: {
        orderBy: { scheduledAt: "desc" },
        take: 50,
        include: { rule: { select: { nome: true, tipo: true } } },
      },
    },
  });

  if (!lead) notFound();

  // Serializa Decimals/Dates para o cliente
  const data = {
    id: lead.id,
    name: lead.name,
    pushName: lead.pushName,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    cpf: lead.cpf,
    status: lead.status,
    category: lead.category,
    priority: lead.priority,
    source: lead.source,
    summary: lead.summary,
    notes: lead.notes,
    leadScore: lead.leadScore,
    birthDate: lead.birthDate?.toISOString() ?? null,
    followUpOptOut: lead.followUpOptOut,
    avatarUrl: lead.avatarUrl,
    tags: lead.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    vehicles: lead.vehicles.map((v) => ({
      id: v.id,
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      cor: v.cor,
      medidaPneu: v.medidaPneu,
      kmAtual: v.kmAtual,
      ultimoAlinhamentoData: v.ultimoAlinhamentoData?.toISOString() ?? null,
      ultimaTrocaPneusData: v.ultimaTrocaPneusData?.toISOString() ?? null,
      ultimaTrocaOleoData: v.ultimaTrocaOleoData?.toISOString() ?? null,
      ultimaTrocaOleoKm: v.ultimaTrocaOleoKm,
      observacoes: v.observacoes,
    })),
    messages: lead.conversations.flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        type: m.type,
        createdAt: m.createdAt.toISOString(),
        sentByUserId: m.sentByUserId,
      }))
    ),
    quotes: lead.quotes.map((q) => ({
      id: q.id,
      status: q.status,
      total: q.total.toString(),
      formaPagamento: q.formaPagamento,
      parcelas: q.parcelas,
      observacoes: q.observacoes,
      enviadaEm: q.enviadaEm?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
      validadeAte: q.validadeAte?.toISOString() ?? null,
      vendedor: q.vendedor?.name ?? null,
      vehicle: q.vehicle ? `${q.vehicle.modelo ?? ""} ${q.vehicle.placa ? `(${q.vehicle.placa})` : ""}`.trim() : null,
      items: q.items.map((i) => ({
        id: i.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnit: i.precoUnit.toString(),
        subtotal: i.subtotal.toString(),
      })),
    })),
    sales: lead.sales.map((s) => ({
      id: s.id,
      status: s.status,
      total: s.total.toString(),
      formaPagamento: s.formaPagamento,
      parcelas: s.parcelas,
      dataFechamento: s.dataFechamento.toISOString(),
      dataServico: s.dataServico?.toISOString() ?? null,
      vendedor: s.vendedor?.name ?? null,
      vehicle: s.vehicle ? `${s.vehicle.modelo ?? ""} ${s.vehicle.placa ? `(${s.vehicle.placa})` : ""}`.trim() : null,
      npsNota: s.nps?.nota ?? null,
      serviceLogs: s.serviceLogs.map((sl) => ({
        id: sl.id,
        tipo: sl.tipo,
        descricao: sl.descricao,
        executadoEm: sl.executadoEm.toISOString(),
        garantiaAte: sl.garantiaAte?.toISOString() ?? null,
      })),
    })),
    nps: lead.nps.map((n) => ({
      id: n.id,
      nota: n.nota,
      categoria: n.categoria,
      comentario: n.comentario,
      respondidoEm: n.respondidoEm.toISOString(),
      saleId: n.saleId,
    })),
    followUps: lead.followUps.map((f) => ({
      id: f.id,
      status: f.status,
      type: f.type,
      ruleNome: f.rule?.nome ?? null,
      ruleTipo: f.rule?.tipo ?? null,
      scheduledAt: f.scheduledAt.toISOString(),
      sentAt: f.sentAt?.toISOString() ?? null,
      template: f.template,
      lastError: f.lastError,
    })),
  };

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <Link href="/leads" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Voltar para leads
        </Link>
      </div>
      <Lead360 data={data} />
    </div>
  );
}
