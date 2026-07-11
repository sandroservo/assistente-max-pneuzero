/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Helpers de solicitação de agendamento (Luma → equipe → aprovação → Appointment).
 */

import { prisma } from "./prisma";
import { createAppointment, formatBR } from "./appointments";
import { evolutionSendText } from "./evolution";
import { postBotToGeneral } from "./team-bot";
import { pushToActiveAgents } from "./web-push";
import { publishNotif } from "./notifications-bus";

export interface CreateRequestInput {
  organizationId: string;
  leadId: string;
  conversationId?: string;
  vehicleId?: string;
  serviceItemId?: string;
  serviceName: string;
  requestedAt: Date;
  notes?: string;
}

export async function createAppointmentRequest(input: CreateRequestInput) {
  const req = await prisma.appointmentRequest.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      conversationId: input.conversationId ?? null,
      vehicleId: input.vehicleId ?? null,
      serviceItemId: input.serviceItemId ?? null,
      serviceName: input.serviceName.trim().slice(0, 200),
      requestedAt: input.requestedAt,
      notes: input.notes?.slice(0, 1000) ?? null,
      status: "pending",
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
    },
  });

  // Alerta canal Geral + Web Push (fire-and-forget)
  const clienteNome = req.lead.name || req.lead.phone;
  const dataFmt = formatBR(input.requestedAt);
  const shortId = req.id.slice(0, 8);
  const body =
    `🟡 *Solicitação de agendamento*\n` +
    `ID: #${shortId}\n` +
    `👤 ${clienteNome}\n` +
    `📞 ${req.lead.phone}\n` +
    `🔧 ${req.serviceName}\n` +
    `📅 ${dataFmt}${input.notes ? `\n📝 ${input.notes}` : ""}\n\n` +
    `Responda aqui no Geral:\n` +
    `• aprovar ${shortId}\n` +
    `• recusar ${shortId} motivo\n` +
    `• oferecer ${shortId} novo horário\n\n` +
    `Ou vá em /agendamentos → Solicitações.`;

  void postBotToGeneral(input.organizationId, body);
  void pushToActiveAgents(input.organizationId, {
    title: `🟡 Solicitação de agendamento — ${clienteNome}`,
    body: `${req.serviceName} — ${dataFmt}. Toque pra aprovar.`,
    url: "/agendamentos?tab=solicitacoes",
    tag: `appt-request-${req.id}`,
    requireInteraction: true,
  });
  publishNotif({
    organizationId: input.organizationId,
    kind: "appointment_request",
    title: `Pedido de agendamento — ${clienteNome}`,
    body: `${req.serviceName} • ${dataFmt}`,
    url: "/agendamentos?tab=solicitacoes",
  });

  return req;
}

interface ApproveOptions {
  resolvedById: string;
  note?: string;
}

/**
 * Aprovar: cria Appointment real + envia WhatsApp pro cliente + marca request approved.
 */
export async function approveAppointmentRequest(id: string, opts: ApproveOptions) {
  const req = await prisma.appointmentRequest.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!req) throw new Error("Solicitação não encontrada");
  if (req.status !== "pending" && req.status !== "proposed") {
    throw new Error(`Solicitação já está como ${req.status}`);
  }

  // Se houver horário proposto ao cliente, aprova nesse; senão no pedido original.
  const scheduledAt = req.proposedAt ?? req.requestedAt;

  const appt = await createAppointment({
    organizationId: req.organizationId,
    leadId: req.leadId,
    vehicleId: req.vehicleId ?? undefined,
    serviceItemId: req.serviceItemId ?? undefined,
    serviceName: req.serviceName,
    scheduledAt,
    notes: req.notes ?? undefined,
    source: "bot",
    createdById: opts.resolvedById,
  });

  const updated = await prisma.appointmentRequest.update({
    where: { id },
    data: {
      status: "approved",
      resolvedAt: new Date(),
      resolvedById: opts.resolvedById,
      resolvedNote: opts.note?.slice(0, 1000) ?? null,
      resultingAppointmentId: appt.id,
    },
  });

  // Notifica cliente
  const firstName = (req.lead.name?.split(" ")[0] ?? "tudo bem").trim();
  const dataFmt = formatBR(scheduledAt);
  await evolutionSendText({
    number: req.lead.phone,
    text: `Oi ${firstName}! 🙂\nSeu agendamento de *${req.serviceName}* foi confirmado pra *${dataFmt}*.\nTe esperamos! 🚗🔧`,
  }).catch((err) => console.error("[appt-request] falha ao notificar cliente:", err));

  void postBotToGeneral(
    req.organizationId,
    `✅ *Agendamento aprovado*\n👤 ${req.lead.name || req.lead.phone}\n🔧 ${req.serviceName}\n📅 ${dataFmt}`
  );

  return { request: updated, appointment: appt };
}

interface ProposeOptions {
  resolvedById: string;
  proposedAt: Date;
  note?: string;
}

/**
 * Propor melhor data/hora: vendedor sugere um horário concreto e a Luma manda
 * pro cliente pedindo confirmação. NÃO cria o Appointment ainda — isso só
 * acontece quando o cliente confirma (confirmAppointmentProposalForLead).
 */
export async function proposeAppointmentTime(id: string, opts: ProposeOptions) {
  const req = await prisma.appointmentRequest.findUnique({
    where: { id },
    include: { lead: { select: { id: true, name: true, phone: true } } },
  });
  if (!req) throw new Error("Solicitação não encontrada");
  if (req.status !== "pending" && req.status !== "proposed") {
    throw new Error(`Solicitação já está como ${req.status}`);
  }

  const updated = await prisma.appointmentRequest.update({
    where: { id },
    data: {
      status: "proposed",
      proposedAt: opts.proposedAt,
      resolvedById: opts.resolvedById, // proposer — vira createdById do Appointment ao confirmar
      resolvedNote: opts.note?.slice(0, 1000) ?? null,
    },
  });

  const firstName = (req.lead.name?.split(" ")[0] ?? "").trim();
  const dataFmt = formatBR(opts.proposedAt);
  const saud = firstName ? `Oi ${firstName}! ` : "Oi! ";
  await evolutionSendText({
    number: req.lead.phone,
    text:
      `${saud}Consegui encaixar seu *${req.serviceName}* em *${dataFmt}*.\n` +
      `Posso confirmar esse horário pra você? 🙂` +
      (opts.note?.trim() ? `\n\n${opts.note.trim()}` : ""),
  }).catch((err) => console.error("[appt-request] falha ao propor horário:", err));

  void postBotToGeneral(
    req.organizationId,
    `📅 *Horário proposto ao cliente*\n👤 ${req.lead.name || req.lead.phone}\n🔧 ${req.serviceName}\n🕐 ${dataFmt}\n\nAguardando o cliente confirmar no WhatsApp.`
  );

  return updated;
}

/**
 * Confirmar a proposta pendente do lead. Chamado quando o CLIENTE confirma
 * (via tool confirmar_proposta da Luma). Cria o Appointment no proposedAt e
 * marca approved. Retorna null se não houver proposta pendente.
 */
export async function confirmAppointmentProposalForLead(leadId: string) {
  const req = await prisma.appointmentRequest.findFirst({
    where: { leadId, status: "proposed", proposedAt: { not: null } },
    orderBy: { updatedAt: "desc" },
    include: { lead: { select: { id: true, name: true, phone: true } } },
  });
  if (!req || !req.proposedAt) return null;

  const appt = await createAppointment({
    organizationId: req.organizationId,
    leadId: req.leadId,
    vehicleId: req.vehicleId ?? undefined,
    serviceItemId: req.serviceItemId ?? undefined,
    serviceName: req.serviceName,
    scheduledAt: req.proposedAt,
    notes: req.notes ?? undefined,
    source: "bot",
    createdById: req.resolvedById ?? undefined,
  });

  await prisma.appointmentRequest.update({
    where: { id: req.id },
    data: {
      status: "approved",
      resolvedAt: new Date(),
      resultingAppointmentId: appt.id,
    },
  });

  const dataFmt = formatBR(req.proposedAt);
  void postBotToGeneral(
    req.organizationId,
    `✅ *Cliente confirmou o horário proposto*\n👤 ${req.lead.name || req.lead.phone}\n🔧 ${req.serviceName}\n📅 ${dataFmt}`
  );

  // A própria Luma dá o feedback final ao cliente (via resposta da conversa).
  return { request: req, appointment: appt, serviceName: req.serviceName, dataFmt };
}

interface RejectOptions {
  resolvedById: string;
  note: string; // motivo obrigatório
  alternativaTexto?: string; // se vendedor quiser sugerir outro horário
}

export async function rejectAppointmentRequest(id: string, opts: RejectOptions) {
  const req = await prisma.appointmentRequest.findUnique({
    where: { id },
    include: { lead: { select: { id: true, name: true, phone: true } } },
  });
  if (!req) throw new Error("Solicitação não encontrada");
  if (req.status !== "pending") throw new Error(`Solicitação já está como ${req.status}`);

  const updated = await prisma.appointmentRequest.update({
    where: { id },
    data: {
      status: "rejected",
      resolvedAt: new Date(),
      resolvedById: opts.resolvedById,
      resolvedNote: opts.note.slice(0, 1000),
    },
  });

  const firstName = (req.lead.name?.split(" ")[0] ?? "tudo bem").trim();
  const dataFmt = formatBR(req.requestedAt);
  const fallback = opts.alternativaTexto?.trim()
    ? opts.alternativaTexto.trim()
    : `Não consegui esse horário (${dataFmt}). ${opts.note}\nMe sugere outra data/hora que eu vejo certinho 🙂`;
  await evolutionSendText({
    number: req.lead.phone,
    text: `Oi ${firstName}! ${fallback}`,
  }).catch((err) => console.error("[appt-request] falha ao notificar cliente:", err));

  void postBotToGeneral(
    req.organizationId,
    `❌ *Solicitação recusada*\n👤 ${req.lead.name || req.lead.phone}\n🔧 ${req.serviceName}\n📅 ${dataFmt}\n📝 ${opts.note}`
  );

  return updated;
}
