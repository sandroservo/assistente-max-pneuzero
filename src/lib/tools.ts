/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Tools (function-calling OpenAI) do Max.
 * Define schemas e executores para registrar veículo, buscar pneu/serviço,
 * cotar, agendar visita, transferir para humano.
 */

import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { upsertVehicle } from "./vehicle";

export interface ToolContext {
  leadId: string;
  organizationId: string;
  conversationId?: string;
  vehicleId?: string;
}

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "registrar_veiculo",
      description:
        "Registra ou atualiza o veículo do lead quando ele informar placa, marca, modelo, ano, km ou medida do pneu. Chame SEMPRE que aparecer um dado novo do carro.",
      parameters: {
        type: "object",
        properties: {
          placa: { type: "string", description: "Placa do veículo (ex: ABC1D23)" },
          marca: { type: "string", description: "Ex: Fiat, VW, Toyota" },
          modelo: { type: "string", description: "Ex: Strada, Gol, Corolla" },
          ano: { type: "integer", description: "Ano de fabricação" },
          cor: { type: "string" },
          medidaPneu: { type: "string", description: "Ex: 175/70R13" },
          kmAtual: { type: "integer", description: "Quilometragem atual" },
          observacoes: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_pneu",
      description:
        "Busca pneus disponíveis no catálogo Pneuzero por medida (obrigatória) e marca (opcional). Use SEMPRE antes de citar preço de pneu.",
      parameters: {
        type: "object",
        properties: {
          medida: { type: "string", description: "Ex: 175/70R13" },
          marca: { type: "string" },
        },
        required: ["medida"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_servico",
      description:
        "Busca serviços do catálogo Pneuzero por categoria ou termo. Use antes de citar preço ou detalhar um serviço.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description: "Categoria do serviço",
          },
          termo: { type: "string", description: "Palavra-chave de busca" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_humano",
      description:
        "Cria handoff para um vendedor humano. Use quando: lead pede atendente, lead pede agendamento concreto, cotação está pronta para fechamento, ou há dúvida técnica complexa.",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            description: "Motivo curto (ex: lead pediu atendente, cotação pronta para fechar)",
          },
          resumo: {
            type: "string",
            description: "Resumo do contexto para o vendedor humano (1-2 frases)",
          },
        },
        required: ["motivo"],
        additionalProperties: false,
      },
    },
  },
];

interface BuscarPneuArgs {
  medida: string;
  marca?: string;
}

interface BuscarServicoArgs {
  categoria?: string;
  termo?: string;
}

interface TransferirHumanoArgs {
  motivo: string;
  resumo?: string;
}

interface RegistrarVeiculoArgs {
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  cor?: string;
  medidaPneu?: string;
  kmAtual?: number;
  observacoes?: string;
}

export async function executeTool(
  name: string,
  args: unknown,
  ctx: ToolContext
): Promise<string> {
  try {
    switch (name) {
      case "registrar_veiculo":
        return await execRegistrarVeiculo(args as RegistrarVeiculoArgs, ctx);
      case "buscar_pneu":
        return await execBuscarPneu(args as BuscarPneuArgs);
      case "buscar_servico":
        return await execBuscarServico(args as BuscarServicoArgs);
      case "transferir_humano":
        return await execTransferirHumano(args as TransferirHumanoArgs, ctx);
      default:
        return JSON.stringify({ error: `Tool desconhecida: ${name}` });
    }
  } catch (err) {
    console.error(`Tool ${name} falhou:`, err);
    return JSON.stringify({ error: "Falha interna ao executar tool" });
  }
}

async function execRegistrarVeiculo(
  args: RegistrarVeiculoArgs,
  ctx: ToolContext
): Promise<string> {
  const vehicle = await upsertVehicle(ctx.leadId, args);
  if (!vehicle) {
    return JSON.stringify({ ok: false, message: "Sem dados suficientes para registrar" });
  }
  return JSON.stringify({
    ok: true,
    vehicleId: vehicle.id,
    placa: vehicle.placa,
    modelo: vehicle.modelo,
    ano: vehicle.ano,
    medidaPneu: vehicle.medidaPneu,
    kmAtual: vehicle.kmAtual,
  });
}

async function execBuscarPneu(args: BuscarPneuArgs): Promise<string> {
  const tires = await prisma.tireProduct.findMany({
    where: {
      ativo: true,
      medida: args.medida,
      ...(args.marca ? { marca: { contains: args.marca, mode: "insensitive" } } : {}),
    },
    take: 10,
    orderBy: { preco: "asc" },
  });
  return JSON.stringify({
    medida: args.medida,
    total: tires.length,
    pneus: tires.map((t) => ({
      id: t.id,
      marca: t.marca,
      modelo: t.modelo,
      medida: t.medida,
      preco: t.preco?.toString() ?? null,
      estoque: t.estoque,
    })),
    aviso:
      tires.length === 0
        ? "Sem pneus cadastrados para essa medida. Ofereça transferir para humano confirmar disponibilidade."
        : undefined,
  });
}

async function execBuscarServico(args: BuscarServicoArgs): Promise<string> {
  const where: Prisma.ServiceItemWhereInput = { ativo: true };
  if (args.categoria) {
    where.category = { nome: { equals: args.categoria, mode: "insensitive" } };
  }
  if (args.termo) {
    where.OR = [
      { nome: { contains: args.termo, mode: "insensitive" } },
      { descricao: { contains: args.termo, mode: "insensitive" } },
    ];
  }
  const services = await prisma.serviceItem.findMany({
    where,
    take: 10,
    include: { category: { select: { nome: true } } },
  });
  return JSON.stringify({
    total: services.length,
    servicos: services.map((s) => ({
      id: s.id,
      nome: s.nome,
      categoria: s.category.nome,
      descricao: s.descricao,
      precoBase: s.precoBase?.toString() ?? null,
      garantiaDias: s.garantiaDias,
      duracaoMin: s.duracaoMin,
    })),
  });
}

async function execTransferirHumano(
  args: TransferirHumanoArgs,
  ctx: ToolContext
): Promise<string> {
  if (!ctx.conversationId) {
    return JSON.stringify({ ok: false, message: "Sem conversa ativa para criar handoff" });
  }

  const open = await prisma.handoff.findFirst({
    where: { conversationId: ctx.conversationId, status: "open" },
  });
  if (open) {
    return JSON.stringify({ ok: true, handoffId: open.id, message: "Handoff já aberto" });
  }

  const handoff = await prisma.handoff.create({
    data: {
      leadId: ctx.leadId,
      conversationId: ctx.conversationId,
      requestedBy: "bot",
      reason: args.motivo,
      summary: args.resumo ?? null,
      status: "open",
    },
  });

  await prisma.lead.update({
    where: { id: ctx.leadId },
    data: { status: "HUMANO_SOLICITADO" },
  });

  return JSON.stringify({
    ok: true,
    handoffId: handoff.id,
    message: "Handoff criado. Avise o cliente que vai transferir.",
  });
}
