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
import { buscarProdutosPorDescricao } from "./pneuzero-stock";

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
      name: "buscar_estoque",
      description:
        "Consulta estoque ao vivo no ERP da Pneuzero (tabela produto). USE SEMPRE quando o lead perguntar se TEM, se ESTÁ DISPONÍVEL, ou pedir QUALQUER item específico — pneus, filtros (ar, óleo, combustível, cabine), óleos, lonas, pastilhas, baterias, lâmpadas, protetores, câmaras, válvulas, kits, peças. NÃO se limite a pneus. Faz LIKE em proDescricao do ERP, retorna descrição exata e quantidade. Estoque > 0 = disponível; <= 0 = indisponível (oferecer transferir_humano para confirmar reposição).",
      parameters: {
        type: "object",
        properties: {
          termo: {
            type: "string",
            description:
              "Trecho da descrição EXATAMENTE como o lead falou ou o mais próximo (ex: 'FILTRO DE AR', 'PROTETOR ARO 25', 'PNEU 175/70 R13', 'GOODYEAR 205', 'ALINHAMENTO'). Use as palavras do lead. Mínimo 2 caracteres.",
          },
          limite: {
            type: "integer",
            description: "Máximo de produtos retornados (1-50, padrão 20).",
          },
        },
        required: ["termo"],
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

interface BuscarEstoqueArgs {
  termo: string;
  limite?: number;
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
  console.log(`[tool] call name=${name} leadId=${ctx.leadId} args=${JSON.stringify(args)}`);
  try {
    let result: string;
    switch (name) {
      case "registrar_veiculo":
        result = await execRegistrarVeiculo(args as RegistrarVeiculoArgs, ctx);
        break;
      case "buscar_pneu":
        result = await execBuscarPneu(args as BuscarPneuArgs);
        break;
      case "buscar_servico":
        result = await execBuscarServico(args as BuscarServicoArgs);
        break;
      case "buscar_estoque":
        result = await execBuscarEstoque(args as BuscarEstoqueArgs);
        break;
      case "transferir_humano":
        result = await execTransferirHumano(args as TransferirHumanoArgs, ctx);
        break;
      default:
        result = JSON.stringify({ error: `Tool desconhecida: ${name}` });
    }
    console.log(`[tool] result name=${name} bytes=${result.length} preview=${result.slice(0, 200)}`);
    return result;
  } catch (err) {
    console.error(`[tool] error name=${name}:`, err);
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

async function execBuscarEstoque(args: BuscarEstoqueArgs): Promise<string> {
  const result = await buscarProdutosPorDescricao(args.termo, args.limite ?? 20);
  if (!result.ok) {
    return JSON.stringify({
      ok: false,
      error: result.error,
      aviso: "Não consegui consultar o estoque agora. Ofereça transferir para humano confirmar.",
    });
  }
  const produtos = result.produtos.map((p) => ({
    descricao: p.proDescricao,
    estoque: p.zzz_proEstoqueAtual,
    disponivel: p.zzz_proEstoqueAtual > 0,
  }));
  return JSON.stringify({
    ok: true,
    termo: args.termo,
    total: produtos.length,
    produtos,
    aviso:
      produtos.length === 0
        ? "Nenhum produto encontrado com esse termo."
        : produtos.every((p) => !p.disponivel)
          ? "Nenhum item com estoque positivo. Ofereça alternativa ou transferir para humano."
          : undefined,
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
