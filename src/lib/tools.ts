/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Tools (function-calling OpenAI) do Luma.
 * Define schemas e executores para registrar veículo, buscar pneu/serviço,
 * cotar, agendar visita, transferir para humano.
 */

import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { upsertVehicle } from "./vehicle";
import { buscarProdutosPorDescricao } from "./pneuzero-stock";
import {
  parseDateTimePtBr,
  cancelAppointment,
  formatBR,
} from "./appointments";
import { createAppointmentRequest } from "./appointment-requests";
import { postBotToGeneral } from "./team-bot";
import { pushToActiveAgents } from "./web-push";

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
        "Busca serviços do catálogo Pneuzero por categoria OU termo. PREFIRA 'termo' (palavra-chave do nome/descrição do serviço — ex: 'troca de óleo', 'alinhamento', 'pastilha'). Use 'categoria' SÓ se souber o nome exato da categoria do catálogo (ex: 'Óleo', 'Suspensão', 'Freios', 'Alinhamento'). Quando em dúvida, passe só 'termo'.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description:
              "Nome EXATO da categoria do catálogo (ex: 'Óleo', 'Freios'). Se passar nome de serviço aqui, vai falhar — use 'termo' em vez disso.",
          },
          termo: { type: "string", description: "Palavra-chave que aparece no nome/descrição do serviço (ex: 'troca de óleo', 'alinhamento 3D'). Mais robusto que categoria." },
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
            description: "Máximo de produtos retornados (1-500, padrão 20).",
          },
          apenasDisponivel: {
            type: "boolean",
            description: "true para filtrar somente itens com estoque > 0 (recomendado quando o cliente quer comprar agora). false (padrão) traz tudo incluindo zerados.",
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
      name: "agendar_servico",
      description:
        "ATENÇÃO: esta tool NÃO confirma agendamento direto. Ela registra uma SOLICITAÇÃO PENDENTE pra equipe analisar disponibilidade. Você só chama APÓS o cliente confirmar verbalmente serviço+data+hora (`confirmadoPeloCliente=true`). Depois, AVISA o cliente: \"Vou encaminhar pra equipe confirmar disponibilidade e já te aviso\". NÃO diga \"agendamento confirmado\" — espere a equipe aprovar. Aceita data natural: 'amanhã 14h', 'sábado 10:00', '18/05 14h', ISO completo. Posta alerta no canal Geral + push pra equipe automaticamente.",
      parameters: {
        type: "object",
        properties: {
          servico: {
            type: "string",
            description:
              "Nome do serviço (ex: 'Alinhamento e balanceamento', 'Troca dos 4 pneus', 'Troca de óleo'). Use exatamente o que o cliente disse ou o item do catálogo.",
          },
          dataHora: {
            type: "string",
            description:
              "Data e hora em texto natural PT-BR ('sábado 14h', 'amanhã 10:00', '18/05 14h') OU ISO completo com ANO ATUAL ou próximo (NUNCA 2023/2024 — consulte a 'DATA E HORA ATUAL' injetada pelo sistema). Hora exata obrigatória. Em texto natural, ano não precisa — sistema infere do contexto temporal.",
          },
          confirmadoPeloCliente: {
            type: "boolean",
            description: "true se o cliente confirmou data+hora+serviço claramente. NUNCA passe true sem confirmação.",
          },
          notas: { type: "string", description: "Observações adicionais (opcional)" },
        },
        required: ["servico", "dataHora", "confirmadoPeloCliente"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_agendamento",
      description:
        "Cancela um agendamento existente do lead quando ele pedir para desmarcar/cancelar. Cancela o mais próximo no futuro a menos que ele especifique outro. Posta no canal Geral.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Motivo curto (ex: 'cliente desmarcou via WhatsApp', 'conflito de horário')" },
        },
        required: ["motivo"],
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

interface AgendarServicoArgs {
  servico: string;
  dataHora: string;
  confirmadoPeloCliente: boolean;
  notas?: string;
}

interface CancelarAgendamentoArgs {
  motivo: string;
}

interface BuscarEstoqueArgs {
  termo: string;
  limite?: number;
  apenasDisponivel?: boolean;
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
      case "agendar_servico":
        result = await execAgendarServico(args as AgendarServicoArgs, ctx);
        break;
      case "cancelar_agendamento":
        result = await execCancelarAgendamento(args as CancelarAgendamentoArgs, ctx);
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
  // Estratégia: busca primeira tentativa categoria+termo. Se vazio e categoria
  // foi passada, faz fallback tratando categoria como termo (modelo confunde
  // "Troca de Óleo" como categoria quando na verdade é nome do serviço).
  const fetchWith = async (cat?: string, term?: string) => {
    const where: Prisma.ServiceItemWhereInput = { ativo: true };
    if (cat) where.category = { nome: { contains: cat, mode: "insensitive" } };
    if (term) {
      where.OR = [
        { nome: { contains: term, mode: "insensitive" } },
        { descricao: { contains: term, mode: "insensitive" } },
        { category: { nome: { contains: term, mode: "insensitive" } } },
      ];
    }
    return prisma.serviceItem.findMany({
      where,
      take: 10,
      include: { category: { select: { nome: true } } },
    });
  };

  let services = await fetchWith(args.categoria, args.termo);

  // Fallback 1: categoria não bateu e nada veio → tenta categoria como termo
  if (services.length === 0 && args.categoria && !args.termo) {
    services = await fetchWith(undefined, args.categoria);
  }
  // Fallback 2: ambos vazios → ignora categoria, busca só por termo
  if (services.length === 0 && args.categoria && args.termo) {
    services = await fetchWith(undefined, args.termo);
  }

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
    aviso:
      services.length === 0
        ? "Nenhum serviço encontrado com esse filtro. Tente com 'termo' (ex: 'óleo', 'alinhamento') em vez de 'categoria'."
        : undefined,
  });
}

async function execBuscarEstoque(args: BuscarEstoqueArgs): Promise<string> {
  const result = await buscarProdutosPorDescricao(args.termo, {
    limit: args.limite ?? 20,
    apenasDisponivel: args.apenasDisponivel === true,
  });
  if (!result.ok) {
    return JSON.stringify({
      ok: false,
      error: result.error,
      aviso: "Não consegui consultar o estoque agora. Ofereça transferir para humano confirmar.",
    });
  }
  const produtos = result.produtos.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.proDescricao,
    estoque: p.zzz_proEstoqueAtual,
    disponivel: p.zzz_proEstoqueAtual > 0,
  }));
  return JSON.stringify({
    ok: true,
    termo: args.termo,
    total: result.total,
    retornados: produtos.length,
    produtos,
    aviso:
      produtos.length === 0
        ? "Nenhum produto encontrado com esse termo."
        : produtos.every((p) => !p.disponivel)
          ? "Nenhum item com estoque positivo. Ofereça alternativa ou transferir para humano."
          : undefined,
  });
}

async function execAgendarServico(args: AgendarServicoArgs, ctx: ToolContext): Promise<string> {
  if (!args.confirmadoPeloCliente) {
    return JSON.stringify({
      ok: false,
      error: "confirmacao_pendente",
      message: "Não confirmou com o cliente. Repita os dados (serviço, data, hora) e pergunte se pode marcar. Só chame de novo após o 'sim'.",
    });
  }

  const parsed = parseDateTimePtBr(args.dataHora);
  if (!parsed) {
    return JSON.stringify({
      ok: false,
      error: "data_invalida",
      message: "Não entendi a data/hora. Peça pro cliente confirmar: dia + hora (ex: 'sábado às 14h' ou '18/05 14:00').",
    });
  }
  if (parsed.date.getTime() < Date.now() - 60_000) {
    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const recebida = parsed.date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return JSON.stringify({
      ok: false,
      error: "data_passada",
      message: `Data ${recebida} já passou (agora é ${agora}). REVISE O ANO — provavelmente está usando ano antigo. Use o ano atual ou próximo. Peça pro cliente confirmar dia e hora e tente de novo com ISO YYYY-MM-DD usando o ano correto.`,
    });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: ctx.leadId },
    select: { id: true, name: true, phone: true, vehicles: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) {
    return JSON.stringify({ ok: false, error: "lead_nao_encontrado" });
  }

  const vehicle = lead.vehicles[0] ?? null;

  // Cria SOLICITAÇÃO pendente — equipe valida antes de virar Appointment real
  const req = await createAppointmentRequest({
    organizationId: ctx.organizationId,
    leadId: ctx.leadId,
    conversationId: ctx.conversationId,
    serviceName: args.servico,
    requestedAt: parsed.date,
    vehicleId: vehicle?.id ?? ctx.vehicleId,
    notes: args.notas,
  });

  return JSON.stringify({
    ok: true,
    requestId: req.id,
    quando: formatBR(parsed.date),
    servico: args.servico,
    status: "pending_team_approval",
    message:
      "Solicitação registrada. AVISE o cliente: 'Vou encaminhar pros consultores confirmarem o horário e já te aviso por aqui certinho 🙂'. NÃO diga que está agendado — a equipe aprova antes.",
  });
}

async function execCancelarAgendamento(args: CancelarAgendamentoArgs, ctx: ToolContext): Promise<string> {
  const proximo = await prisma.appointment.findFirst({
    where: {
      leadId: ctx.leadId,
      status: { in: ["pending", "confirmed"] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    include: { lead: { select: { name: true, phone: true } } },
  });
  if (!proximo) {
    return JSON.stringify({
      ok: false,
      error: "nenhum_agendamento",
      message: "Cliente não tem agendamento futuro ativo. Confirme com ele se é isso mesmo.",
    });
  }

  await cancelAppointment(proximo.id, args.motivo);

  const clienteNome = proximo.lead.name || proximo.lead.phone;
  void postBotToGeneral(
    ctx.organizationId,
    `❌ *Agendamento cancelado*\n👤 ${clienteNome}\n📞 ${proximo.lead.phone}\n🔧 ${proximo.serviceName}\n📅 ${formatBR(proximo.scheduledAt)}\n📝 ${args.motivo}`
  );

  return JSON.stringify({
    ok: true,
    appointmentId: proximo.id,
    quando: formatBR(proximo.scheduledAt),
    servico: proximo.serviceName,
    message: "Agendamento cancelado. Avise o cliente que está feito.",
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

  // Alerta vendedores no canal Geral do /equipe (fire-and-forget)
  const lead = await prisma.lead.findUnique({
    where: { id: ctx.leadId },
    select: { name: true, phone: true },
  });
  if (lead) {
    const clienteNome = lead.name || lead.phone;
    void postBotToGeneral(
      ctx.organizationId,
      `🆘 *Transferência para humano*\n👤 ${clienteNome}\n📞 ${lead.phone}\n💬 Motivo: ${args.motivo}${args.resumo ? `\n📝 ${args.resumo}` : ""}`
    );
    // Web Push pra todos vendedores ativos (mesmo com painel fechado)
    void pushToActiveAgents(ctx.organizationId, {
      title: `🆘 Novo handoff — ${clienteNome}`,
      body: args.motivo + (args.resumo ? `\n${args.resumo}` : ""),
      url: "/equipe",
      tag: `handoff-${handoff.id}`,
      requireInteraction: true,
    });
  }

  return JSON.stringify({
    ok: true,
    handoffId: handoff.id,
    message: "Handoff criado. Avise o cliente que vai transferir. Time já notificado no /equipe + push.",
  });
}
