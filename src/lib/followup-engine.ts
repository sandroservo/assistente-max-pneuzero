/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Engine de follow-up: gera (a partir de eventos/regras), renderiza
 * templates e envia via Evolution API.
 */

import { prisma } from "./prisma";
import { evolutionSendText } from "./evolution";

interface TemplateVars {
  primeiro_nome?: string;
  nome?: string;
  veiculo_modelo?: string;
  veiculo_placa?: string;
  ultimo_servico?: string;
  dias_atras?: string;
  km_estimado?: string;
  cupom?: string;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: keyof TemplateVars) => vars[k] ?? "");
}

function firstName(full?: string | null): string {
  if (!full) return "amigo";
  return full.trim().split(/\s+/)[0];
}

/**
 * Cria FollowUp pendente para uma regra+lead, se ainda não existir similar no período.
 */
async function scheduleFollowUp(opts: {
  leadId: string;
  conversationId: string;
  ruleId: string;
  type: string;
  scheduledAt: Date;
  template: string;
  vehicleId?: string | null;
  saleId?: string | null;
  serviceLogId?: string | null;
}) {
  // Evita duplicar: mesma combinação leadId+type ainda pending em janela próxima
  const exists = await prisma.followUp.findFirst({
    where: {
      leadId: opts.leadId,
      type: opts.type,
      status: "pending",
    },
  });
  if (exists) return exists;

  return prisma.followUp.create({
    data: {
      leadId: opts.leadId,
      conversationId: opts.conversationId,
      stage: 1,
      scheduledAt: opts.scheduledAt,
      status: "pending",
      type: opts.type,
      vehicleId: opts.vehicleId ?? null,
      saleId: opts.saleId ?? null,
      serviceLogId: opts.serviceLogId ?? null,
      ruleId: opts.ruleId,
      template: opts.template,
    },
  });
}

interface GatilhoConfig {
  evento: string;
  delayDias?: number;
  horarioEnvio?: string;
  kmIntervalo?: number;
}

function applyHorario(date: Date, horarioEnvio?: string): Date {
  if (!horarioEnvio) return date;
  const [hh, mm] = horarioEnvio.split(":").map((s) => parseInt(s, 10));
  const d = new Date(date);
  d.setHours(hh, mm ?? 0, 0, 0);
  return d;
}

/**
 * Após uma Sale virar CONCLUIDA: agenda NPS D+1.
 */
export async function onSaleConcluida(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { lead: true, vehicle: true, serviceLogs: true },
  });
  if (!sale || sale.lead.followUpOptOut) return;

  const rule = await prisma.followUpRule.findFirst({
    where: { organizationId: sale.organizationId, tipo: "nps_d1", ativo: true },
  });
  if (!rule) return;

  const conv = await prisma.conversation.findFirst({
    where: { leadId: sale.leadId },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!conv) return;

  const gatilho = JSON.parse(rule.gatilho) as GatilhoConfig;
  const scheduledAt = applyHorario(
    new Date(Date.now() + (gatilho.delayDias ?? 1) * 86400000),
    gatilho.horarioEnvio
  );

  await scheduleFollowUp({
    leadId: sale.leadId,
    conversationId: conv.id,
    ruleId: rule.id,
    type: rule.tipo,
    scheduledAt,
    template: rule.template,
    vehicleId: sale.vehicleId,
    saleId: sale.id,
  });
}

/**
 * Após criar ServiceLog: agenda follow-up por tipo (alinhamento_3m, rodizio_6m, troca_oleo_km).
 */
export async function onServiceLogCreated(serviceLogId: string) {
  const log = await prisma.serviceLog.findUnique({
    where: { id: serviceLogId },
    include: { vehicle: { include: { lead: true } } },
  });
  if (!log) return;
  const lead = log.vehicle.lead;
  if (lead.followUpOptOut) return;

  const tipoToRule: Record<string, string> = {
    alinhamento: "alinhamento_3m",
    troca_pneu: "rodizio_6m",
    troca_oleo: "troca_oleo_km",
  };
  const ruleType = tipoToRule[log.tipo];
  if (!ruleType) return;

  const rule = await prisma.followUpRule.findFirst({
    where: { organizationId: lead.organizationId, tipo: ruleType, ativo: true },
  });
  if (!rule) return;

  const conv = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!conv) return;

  const gatilho = JSON.parse(rule.gatilho) as GatilhoConfig;
  const scheduledAt = applyHorario(
    new Date(log.executadoEm.getTime() + (gatilho.delayDias ?? 90) * 86400000),
    gatilho.horarioEnvio
  );

  await scheduleFollowUp({
    leadId: lead.id,
    conversationId: conv.id,
    ruleId: rule.id,
    type: rule.tipo,
    scheduledAt,
    template: rule.template,
    vehicleId: log.vehicleId,
    serviceLogId: log.id,
  });
}

/**
 * Processa FollowUps pendentes com scheduledAt <= now. Renderiza e envia.
 */
export async function processPendingFollowUps(limit = 50) {
  const now = new Date();
  const pending = await prisma.followUp.findMany({
    where: { status: "pending", scheduledAt: { lte: now } },
    take: limit,
    orderBy: { scheduledAt: "asc" },
    include: {
      lead: { include: { vehicles: true } },
      conversation: true,
      vehicle: true,
      serviceLog: true,
      rule: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const fu of pending) {
    if (fu.lead.followUpOptOut) {
      await prisma.followUp.update({
        where: { id: fu.id },
        data: { status: "skipped", lastError: "lead opt-out" },
      });
      skipped++;
      continue;
    }

    // Anti-spam: pula se cliente respondeu nas últimas 24h
    const recentIn = await prisma.message.findFirst({
      where: {
        conversationId: fu.conversationId,
        direction: "in",
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    if (recentIn) {
      // adia 1 dia
      await prisma.followUp.update({
        where: { id: fu.id },
        data: { scheduledAt: new Date(Date.now() + 86400000) },
      });
      skipped++;
      continue;
    }

    const vehicle = fu.vehicle ?? fu.lead.vehicles[0];
    const vars: TemplateVars = {
      primeiro_nome: firstName(fu.lead.name),
      nome: fu.lead.name ?? "",
      veiculo_modelo: vehicle?.modelo ?? "carro",
      veiculo_placa: vehicle?.placa ?? "",
      ultimo_servico: fu.serviceLog?.tipo ?? "serviço",
      cupom: cupomFromLead(fu.lead.name, fu.type ?? ""),
    };

    const template = fu.template ?? fu.rule?.template ?? "";
    const text = renderTemplate(template, vars);

    try {
      await evolutionSendText({ number: fu.lead.phone, text });
      await prisma.followUp.update({
        where: { id: fu.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await prisma.message.create({
        data: {
          conversationId: fu.conversationId,
          direction: "out",
          body: text,
          type: "text",
        },
      });
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.followUp.update({
        where: { id: fu.id },
        data: { status: "failed", lastError: msg.slice(0, 500) },
      });
      failed++;
    }
  }

  return { processed: pending.length, sent, skipped, failed };
}

function cupomFromLead(name: string | null | undefined, type: string): string {
  if (type !== "aniversario") return "";
  const first = firstName(name).toUpperCase();
  const mes = String(new Date().getMonth() + 1).padStart(2, "0");
  return `ANIV-${first}-${mes}`;
}

/**
 * Procura aniversariantes do dia que ainda não receberam follow-up este ano.
 */
export async function scheduleBirthdayFollowUps() {
  const today = new Date();
  const mes = today.getMonth() + 1;
  const dia = today.getDate();

  const leads = await prisma.lead.findMany({
    where: { birthDate: { not: null }, followUpOptOut: false },
    include: { conversations: { orderBy: { lastMessageAt: "desc" }, take: 1 } },
  });

  const aniversariantes = leads.filter((l) => {
    if (!l.birthDate) return false;
    const b = l.birthDate;
    return b.getUTCMonth() + 1 === mes && b.getUTCDate() === dia;
  });

  let created = 0;
  for (const lead of aniversariantes) {
    const rule = await prisma.followUpRule.findFirst({
      where: { organizationId: lead.organizationId, tipo: "aniversario", ativo: true },
    });
    if (!rule) continue;
    const conv = lead.conversations[0];
    if (!conv) continue;

    const gatilho = JSON.parse(rule.gatilho) as GatilhoConfig;
    const sched = applyHorario(today, gatilho.horarioEnvio ?? "09:00");
    const sameYearStart = new Date(today.getFullYear(), 0, 1);

    const already = await prisma.followUp.findFirst({
      where: {
        leadId: lead.id,
        type: "aniversario",
        createdAt: { gte: sameYearStart },
      },
    });
    if (already) continue;

    await scheduleFollowUp({
      leadId: lead.id,
      conversationId: conv.id,
      ruleId: rule.id,
      type: rule.tipo,
      scheduledAt: sched,
      template: rule.template,
    });
    created++;
  }
  return created;
}

/**
 * Detecta opt-out na mensagem do lead.
 */
export function detectOptOut(text: string): boolean {
  const t = text.toLowerCase();
  const phrases = [
    "para de me mandar",
    "pare de me mandar",
    "remove meu número",
    "remova meu número",
    "não quero mais receber",
    "nao quero mais receber",
    "descadastrar",
    "sai dessa lista",
    "tira meu numero",
    "tira meu número",
  ];
  return phrases.some((p) => t.includes(p));
}
