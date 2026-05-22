/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Helpers de agendamento. Parser de data/hora em PT-BR (sábado 14h, amanhã 10:00,
 * 18/05 14h, 2026-05-18T14:00, etc.) e CRUD básico.
 */

import { prisma } from "./prisma";

const TZ = "America/Sao_Paulo";
const TZ_OFFSET = "-03:00";

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, "segunda-feira": 1, seg: 1,
  terca: 2, terça: 2, "terca-feira": 2, "terça-feira": 2, ter: 2,
  quarta: 3, "quarta-feira": 3, qua: 3,
  quinta: 4, "quinta-feira": 4, qui: 4,
  sexta: 5, "sexta-feira": 5, sex: 5,
  sabado: 6, sábado: 6, sab: 6, sáb: 6,
};

function nowInTz(): Date {
  // "now" em BRT (servidor já roda com TZ=America/Sao_Paulo, mas garante)
  return new Date();
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function isoFromParts(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Constrói ISO em BRT explícito → Date interno UTC correto
  const iso = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00${TZ_OFFSET}`;
  return new Date(iso);
}

function partsInTz(d: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  // Extrai partes no fuso configurado
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: wdMap[get("weekday") as keyof typeof wdMap] ?? 0,
  };
}

interface ParsedDateTime {
  date: Date;
  reason: string; // descrição do match pra debug
}

function parseTime(s: string): { hour: number; minute: number } | null {
  // 14h, 14:00, 14h30, 14:30, 8h, 08:00
  const m = s.match(/(\d{1,2})\s*(?:h|:)(?:\s*(\d{2}))?/i);
  if (m) {
    const hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) return { hour, minute };
  }
  // hora isolada: "às 14"
  const m2 = s.match(/\b(?:às|as)\s+(\d{1,2})\b/i);
  if (m2) {
    const hour = Number(m2[1]);
    if (hour >= 0 && hour < 24) return { hour, minute: 0 };
  }
  return null;
}

/**
 * Parse flexível de data/hora em PT-BR.
 * Retorna null se não conseguir interpretar.
 */
export function parseDateTimePtBr(input: string, refNow: Date = nowInTz()): ParsedDateTime | null {
  if (!input) return null;
  const lower = input.toLowerCase().trim();
  const ref = partsInTz(refNow);

  // 1) ISO direto (2026-05-18T14:00 ou 2026-05-18 14:00)
  const iso = lower.match(/(\d{4})-(\d{2})-(\d{2})[ tT](\d{2}):(\d{2})/);
  if (iso) {
    return {
      date: isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4]), Number(iso[5])),
      reason: "iso",
    };
  }

  // 2) DD/MM[/YYYY] HH:MM ou DD/MM HH:MMh
  const br = lower.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(.+))?/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = br[3] ? Number(br[3]) : ref.year;
    if (year < 100) year += 2000;
    const timePart = br[4] ?? "";
    const t = parseTime(timePart) ?? parseTime(lower);
    if (t && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: isoFromParts(year, month, day, t.hour, t.minute), reason: "dd/mm" };
    }
  }

  const t = parseTime(lower);
  if (!t) return null;

  // 3) "hoje" / "amanhã" / "depois de amanhã"
  if (/\bhoje\b/.test(lower)) {
    return { date: isoFromParts(ref.year, ref.month, ref.day, t.hour, t.minute), reason: "hoje" };
  }
  if (/\bamanh[ãa]\b/.test(lower)) {
    const d = new Date(refNow.getTime() + 86400_000);
    const p = partsInTz(d);
    return { date: isoFromParts(p.year, p.month, p.day, t.hour, t.minute), reason: "amanha" };
  }
  if (/\bdepois\s+de\s+amanh[ãa]\b/.test(lower)) {
    const d = new Date(refNow.getTime() + 2 * 86400_000);
    const p = partsInTz(d);
    return { date: isoFromParts(p.year, p.month, p.day, t.hour, t.minute), reason: "depois-amanha" };
  }

  // 4) Dia da semana ("sábado", "próxima quinta")
  for (const [key, wd] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(lower)) {
      let daysToAdd = (wd - ref.weekday + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7; // mesmo dia da semana → próximo (não hoje)
      const d = new Date(refNow.getTime() + daysToAdd * 86400_000);
      const p = partsInTz(d);
      return { date: isoFromParts(p.year, p.month, p.day, t.hour, t.minute), reason: `weekday:${key}` };
    }
  }

  return null;
}

export interface CreateAppointmentInput {
  organizationId: string;
  leadId: string;
  serviceName: string;
  scheduledAt: Date;
  vehicleId?: string;
  serviceItemId?: string;
  notes?: string;
  source: "bot" | "human" | "user";
  createdById?: string;
}

export async function createAppointment(input: CreateAppointmentInput) {
  return prisma.appointment.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      vehicleId: input.vehicleId ?? null,
      serviceItemId: input.serviceItemId ?? null,
      serviceName: input.serviceName.trim().slice(0, 200),
      scheduledAt: input.scheduledAt,
      status: "confirmed",
      notes: input.notes?.slice(0, 1000) ?? null,
      source: input.source,
      createdById: input.createdById ?? null,
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, marca: true, modelo: true, ano: true, placa: true } },
    },
  });
}

export async function cancelAppointment(id: string, reason?: string) {
  return prisma.appointment.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: reason?.slice(0, 500) ?? null,
    },
  });
}

export async function listUpcomingForLead(leadId: string, limit = 10) {
  return prisma.appointment.findMany({
    where: {
      leadId,
      status: { in: ["pending", "confirmed"] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}

export function formatBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatBRShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
