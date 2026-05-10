/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Serviço de gestão de veículos do lead.
 */

import { prisma } from "./prisma";

export interface VehicleData {
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  cor?: string;
  medidaPneu?: string;
  kmAtual?: number;
  observacoes?: string;
}

export async function upsertVehicle(leadId: string, data: VehicleData) {
  // Match prioritário por placa (se houver). Fallback: pega o último veículo do lead.
  const existing = data.placa
    ? await prisma.vehicle.findFirst({ where: { leadId, placa: data.placa } })
    : await prisma.vehicle.findFirst({ where: { leadId }, orderBy: { updatedAt: "desc" } });

  if (existing) {
    return prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        placa: data.placa ?? existing.placa,
        marca: data.marca ?? existing.marca,
        modelo: data.modelo ?? existing.modelo,
        ano: data.ano ?? existing.ano,
        cor: data.cor ?? existing.cor,
        medidaPneu: data.medidaPneu ?? existing.medidaPneu,
        kmAtual: data.kmAtual ?? existing.kmAtual,
        observacoes: data.observacoes ?? existing.observacoes,
      },
    });
  }

  if (!data.placa && !data.modelo && !data.medidaPneu && !data.ano) {
    return null;
  }

  return prisma.vehicle.create({
    data: {
      leadId,
      placa: data.placa,
      marca: data.marca,
      modelo: data.modelo,
      ano: data.ano,
      cor: data.cor,
      medidaPneu: data.medidaPneu,
      kmAtual: data.kmAtual,
      observacoes: data.observacoes,
    },
  });
}

export async function getVehiclesByLead(leadId: string) {
  return prisma.vehicle.findMany({
    where: { leadId },
    orderBy: { updatedAt: "desc" },
  });
}

export function formatVehiclesForAI(
  vehicles: Awaited<ReturnType<typeof getVehiclesByLead>>
): string {
  if (vehicles.length === 0) return "";
  const lines = vehicles.map((v) => {
    const parts: string[] = [];
    if (v.marca || v.modelo) parts.push(`${v.marca ?? ""} ${v.modelo ?? ""}`.trim());
    if (v.ano) parts.push(`${v.ano}`);
    if (v.placa) parts.push(`placa ${v.placa}`);
    if (v.medidaPneu) parts.push(`pneu ${v.medidaPneu}`);
    if (v.kmAtual) parts.push(`${v.kmAtual.toLocaleString("pt-BR")} km`);
    return `- ${parts.join(" · ") || "(sem dados)"}`;
  });
  return `<VeículoLead>\n${lines.join("\n")}\n</VeículoLead>`;
}
