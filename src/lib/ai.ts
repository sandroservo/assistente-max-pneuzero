/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Serviço de IA para Luma - Consultor Pneuzero
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma";
import { getSystemSettings } from "./settings";
import { getAllKnowledge, searchKnowledge, formatKnowledgeForAI } from "./knowledge";
import { searchRelevantMemories, formatMemoriesForAI, extractAndSaveMemories } from "./memory";
import { getConversationSummary } from "./conversation-summary";
import { extractVehicleData } from "./extractors";
import { upsertVehicle, getVehiclesByLead, formatVehiclesForAI } from "./vehicle";
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from "./tools";

async function getOpenAIClient() {
  const settings = await getSystemSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return null;
  }
  
  return new OpenAI({ apiKey });
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HistoryMessage {
  direction: "in" | "out";
  body: string | null;
  type?: string;
  transcription?: string | null;
  sentByUserName?: string | null; // null = bot Luma; string = nome do atendente humano
}

/**
 * Formata mensagem do histórico para o prompt da IA.
 * Cobre 3 casos:
 *  - msg só com mídia (áudio/imagem) → usa transcription
 *  - msg out enviada por humano → prefixa "[Atendente Nome]:"
 *  - msg de texto normal → body
 * Retorna null quando não há nada útil a enviar.
 */
function formatHistoryContent(msg: HistoryMessage): string | null {
  let body = msg.body?.trim() ?? "";

  if (!body && msg.transcription) {
    if (msg.type === "audio") body = `[Áudio transcrito] ${msg.transcription}`;
    else if (msg.type === "image") body = `[Imagem descrita] ${msg.transcription}`;
    else body = msg.transcription;
  }

  if (!body && msg.type) {
    body = `[${msg.type}]`;
  }

  if (!body) return null;

  if (msg.direction === "out" && msg.sentByUserName) {
    return `[Atendente ${msg.sentByUserName}]: ${body}`;
  }

  return body;
}

interface ConversationContext {
  leadId: string;
  organizationId?: string | null;
  conversationId?: string | null;
  leadName?: string | null;
  leadEmail?: string | null;
  leadCity?: string | null;
  leadPhone?: string;
  leadStatus?: string;
  leadSummary?: string | null;
  gapHours?: number;          // tempo desde a última mensagem antes da atual
  lastOutFromHuman?: boolean; // última msg out foi enviada por atendente humano
  lastHumanAgent?: string | null;
  messageHistory: HistoryMessage[];
}

/**
 * Retorna o período do dia no fuso do Brasil (America/Sao_Paulo) para o Luma usar saudação adequada
 */
function getPeriodoDoDia(): { periodo: string; saudacao: string; horaFormatada: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const horaFormatada = formatter.format(now);
  const hour = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();

  if (hour >= 0 && hour < 6) {
    return { periodo: "madrugada", saudacao: "Boa madrugada", horaFormatada };
  }
  if (hour >= 6 && hour < 12) {
    return { periodo: "manhã", saudacao: "Bom dia", horaFormatada };
  }
  if (hour >= 12 && hour < 18) {
    return { periodo: "tarde", saudacao: "Boa tarde", horaFormatada };
  }
  return { periodo: "noite", saudacao: "Boa noite", horaFormatada };
}

const DEFAULT_SYSTEM_PROMPT = `Você é o Luma, consultor da Pneu Zero. Você fala por WhatsApp com leads sobre serviços automotivos EXCLUSIVAMENTE da Pneu Zero.

CONVERSA NATURAL (PRIORIDADE MÁXIMA):
- Reaja ao que a pessoa disse antes de fazer a próxima pergunta. Nunca ignore a mensagem dela e pule direto para uma pergunta de script.
- Exemplo: se ela disser "preciso trocar os 4 pneus", não responda só "Qual a medida?". Reaja antes: "Beleza, vamos trocar os 4 então! Me passa a medida do pneu ou o ano/modelo do carro que eu vejo pra você."
- Se ela contar algo (ex.: "tô sentindo o carro puxando pro lado"), reconheça com uma frase curta antes de responder: "Entendi, isso pode ser alinhamento...", e aí traga a informação ou a próxima pergunta.
- Deixe a conversa fluir: às vezes a pessoa responde algo que já responde a outra pergunta; use isso e não repita perguntas. Às vezes ela pergunta algo no meio; responda com naturalidade e depois retome se precisar.
- Sua mensagem deve parecer uma resposta à mensagem dela, não um bloco genérico + pergunta. Evite começar direto com uma pergunta sem nenhum "gancho" no que ela falou.
- Se ela fizer uma pergunta, responda primeiro (com base na Tool Information) e, se fizer sentido, acrescente uma pergunta ou convite natural no final — não o contrário (pergunta primeiro, resposta depois).

TOM E ESTILO:
- Escreva como no WhatsApp para um conhecido: calorosa, direta. Use "Olha...", "Então...", "Ah, ótimo!", coloquial ("né", "tá", "pra") quando cair bem.
- Frases corridas, não listas. Emoji de vez em quando. NUNCA soe como FAQ ou script.

REGRAS DE CONTEÚDO:
- Use EXCLUSIVAMENTE o que está em <Tool Information>. NUNCA invente dados (valores, regras, prazos).
- Você SEMPRE recebe a base de conhecimento; use o que for mais próximo da dúvida (serviços, pneus, preços). Se a informação exata não estiver lá, resuma o que tiver de relevante e ofereça transferir para um atendente para detalhes: "Quer que eu te passe para alguém da equipe te dar essa informação direitinho?"
- NUNCA diga "Não tenho essa informação no momento" nem que não tem a informação. Prefira usar algo da base + oferecer atendente humano.
- Antes de citar preço: confira se está na Tool Information. Se não souber o preço de um pneu específico, NÃO invente — diga que vai verificar.
- Respostas curtas (3–4 frases). Uma pergunta por vez quando for perguntar.
- Se pedir atendente humano, confirme que vai transferir. Se não souber o nome, pergunte de forma natural.

FOCO APENAS EM SERVIÇOS DA PNEU ZERO:
- Discuta SOMENTE pneus, alinhamento, balanceamento, suspensão, freios, óleo, elétrica, baterias e checklists automotivos.
- NÃO responda piadas. NÃO dê conselhos sobre família, relacionamentos ou qualquer assunto pessoal.
- Se o lead perguntar sobre algo fora do escopo (piadas, vida pessoal, etc.), redirecione educadamente: "Sou especialista em serviços automotivos da Pneu Zero. Posso te ajudar com pneus, alinhamento, freios ou outro serviço para seu carro?"
- Mantenha o foco total em ajudar com as necessidades do veículo do cliente.

ROTEIRO DE ATENDIMENTO (fluxo natural, NÃO como script rígido):
Siga a base de conhecimento (Tool Information) para conduzir o atendimento. A ordem geral é:
1. COMPOSIÇÃO — Pergunte quantos pneus vai trocar e se quer alinhar/balancear
2. ANO DO VEÍCULO — Pergunte o ano para enviar o checklist correto
3. CHECKLIST — Envie o checklist por idade do veículo + pergunte quilometragem
4. PREÇO — Passe o preço já com montagem, bicos, alinhamento e balanceamento inclusos
5. PAGAMENTO — Pergunte se prefere à vista ou parcelado (pode melhorar o valor)
6. FECHAMENTO — Convide para trazer o carro sem compromisso para avaliação gratuita

IMPORTANTE: O roteiro é um GUIA, não um script. Se o lead já respondeu algo, não repita. Se ele pergunta algo, responda e retome depois.

REGRA DE OURO:
- NUNCA empurre venda — ajude o cliente a entender o que o carro precisa
- Pergunta boa vale mais que resposta rápida
- Seja consultivo e amigável, como um consultor de confiança
- Aqui na Pneu Zero o cliente resolve tudo em um só lugar: pneus, alinhamento, suspensão, freios, óleo, elétrica e baterias
- FOCO TOTAL EM SERVIÇOS AUTOMOTIVOS — nada de assuntos pessoais ou entretenimento

AGENDAMENTO COM EQUIPE:
- Se o cliente pedir para agendar e já houver serviço + data + hora claros, chame a tool agendar_servico com confirmadoPeloCliente=true.
- A tool agendar_servico NÃO confirma direto: ela pede a disponibilidade para a equipe no chat interno. Depois diga ao cliente que vai confirmar com os consultores e já volta com a resposta.
- Se faltar serviço, data ou hora, pergunte apenas o dado que falta antes de chamar a tool.

HANDOFF — Transfira para humano quando:
- Lead pede valores exatos que você não tem na base
- Lead pede especificamente um atendente humano
- Pergunta técnica complexa sobre mecânica específica
- Frase de transição: "Posso te explicar melhor ou, se preferir, te coloco agora com um atendente pra tirar todas as dúvidas finais 🙂"`;

export { DEFAULT_SYSTEM_PROMPT };

// Fonte única do prompt padrão: agent/systemprompt.md (mesmo arquivo exibido
// em /settings). Constante acima é só fallback se o arquivo não existir no deploy.
let filePromptCache: string | null | undefined;
function getDefaultSystemPrompt(): string {
  if (filePromptCache === undefined) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), "agent", "systemprompt.md"), "utf-8").trim();
      filePromptCache = raw.length > 0 ? raw : null;
    } catch {
      filePromptCache = null;
    }
  }
  return filePromptCache ?? DEFAULT_SYSTEM_PROMPT;
}

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext
): Promise<{
  response: string;
  extractedData?: { name?: string; email?: string };
  cotacaoEnviada?: boolean;
  handoffSolicitado?: boolean;
  statusAtualizadoPorIA?: boolean;
}> {
  try {
    const settings = await getSystemSettings();
    const openai = await getOpenAIClient();
    
    if (!openai) {
      console.warn("OpenAI API Key não configurada, usando resposta padrão");
      return { response: generateFallbackResponse(userMessage, context.leadName) };
    }

    // Usa prompt do banco (/settings) ou o padrão (agent/systemprompt.md)
    const systemPrompt = settings.systemPrompt || getDefaultSystemPrompt();

    // Base de conhecimento única (single-tenant): busca toda a base, sem filtro de organização.
    // A mensagem do lead já foi salva no banco antes de chegar aqui,
    // então primeira mensagem = só 1 msg "in" e nenhuma "out" no histórico.
    const outMessages = context.messageHistory.filter(m => m.direction === "out");
    const isFirstMessage = outMessages.length === 0;

    let knowledge: Awaited<ReturnType<typeof getAllKnowledge>>;
    if (isFirstMessage) {
      knowledge = await getAllKnowledge(undefined, 100, undefined);
    } else {
      const [searchResults, baseKnowledge] = await Promise.all([
        searchKnowledge(userMessage, undefined, 25, undefined),
        getAllKnowledge(undefined, 60, undefined),
      ]);
      const byId = new Map(searchResults.map((k) => [k.id, k]));
      baseKnowledge.forEach((k) => byId.set(k.id, k));
      knowledge = Array.from(byId.values());
    }
    const toolInformation = formatKnowledgeForAI(knowledge);

    // Busca memórias do lead — FTS rankeia por relevância à mensagem atual,
    // fallback pra recentes se query muito curta. Cap 12 itens.
    const leadMemories = await searchRelevantMemories(context.leadId, userMessage, 12);
    const memoryContext = formatMemoriesForAI(leadMemories);

    // Sumário rolante da conversa (atualizado a cada 20 msgs por job background)
    const conversationSummary = context.conversationId
      ? await getConversationSummary(context.conversationId)
      : null;

    // Verifica se a última mensagem do bot perguntou o nome
    const lastBotMessage = context.messageHistory
      .filter(m => m.direction === "out" && m.body)
      .pop()?.body?.toLowerCase() || "";
    const botAskedName = lastBotMessage.includes("chamar") || 
                         lastBotMessage.includes("nome") ||
                         lastBotMessage.includes("quem fala");

    // Extrai e salva memórias da mensagem atual
    const { extractedName } = await extractAndSaveMemories(
      context.leadId, 
      userMessage, 
      true,
      botAskedName
    );
    
    // Só atualiza o nome do lead se ele ainda não tiver nome (não sobrescreve durante a conversa)
    if (extractedName && !context.leadName?.trim()) {
      await prisma.lead.update({
        where: { id: context.leadId },
        data: { name: extractedName },
      });
      context.leadName = extractedName;
    }

    // Contexto temporal — LLM tem cutoff de treino antigo e aluci
    // datas (ex: 2023 em 2026). Sem isso, agendar_servico recebe ano errado.
    const nowBrt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    const isoNow = new Date().toISOString();

    // Contexto dinâmico consolidado em UM bloco system (em vez de ~12 blocos
    // soltos): menos tokens, instruções não competem entre si.
    const contextParts: string[] = [];

    contextParts.push(
      `DATA E HORA ATUAL (use SEMPRE como referência — NÃO use 2023, 2024, 2025): ${nowBrt} (ISO ${isoNow}, fuso America/Sao_Paulo).\n` +
      `Quando o cliente disser "amanhã", "sábado", "semana que vem", calcule a partir DESTA data. Ao chamar agendar_servico, passe data no formato ISO completo com o ano correto (atual ou próximo se a data já passou no ano atual).`
    );

    // Tool Information (base de conhecimento) — Luma DEVE consultar para serviços, pneus, preços, garantias, endereços.
    if (toolInformation) {
      contextParts.push(`${toolInformation}\n\nIMPORTANTE: Use o bloco <Tool Information> acima para responder sobre pneus, serviços, preços, garantias, endereços e regras da Pneuzero. Consulte sempre essa base antes de responder.`);
    }

    // Sumário rolante: dá contexto longo em texto compacto. Custa pouco token,
    // permite Luma "lembrar" de conversa anterior sem dumpar todo histórico.
    if (conversationSummary) {
      contextParts.push(`<ConversationSummary>\n${conversationSummary}\n</ConversationSummary>\n\nUse este sumário pra retomar contexto. Não repita o que já foi tratado.`);
    }

    // Memórias do lead (top-12 rankeadas por FTS)
    if (memoryContext) {
      contextParts.push(memoryContext);
    }

    // Contexto de horário (Brasil): Luma sabe se é dia, tarde, noite ou madrugada
    const { periodo, saudacao, horaFormatada } = getPeriodoDoDia();
    contextParts.push(`Agora são ${horaFormatada} (horário de Brasília). Período: ${periodo}. Use a saudação adequada quando for começar ou cumprimentar: ${saudacao}. Seja natural com o horário (ex.: de madrugada pode ser mais breve; de manhã/tarde/noite use o cumprimento correto).`);

    // Contexto do lead (usa isFirstMessage já definida acima)
    if (isFirstMessage && context.leadName) {
      contextParts.push(`Esta é a PRIMEIRA mensagem do cliente. O nome dele é ${context.leadName} (do perfil WhatsApp). Apresente-se de forma breve e calorosa usando o nome dele (ex.: "${saudacao}, ${context.leadName}! Sou o Luma, da Pneu Zero 🔴 Em que posso te ajudar?"). NÃO pergunte o nome, pois já sabe. Seja natural como no WhatsApp.`);
    } else if (isFirstMessage) {
      contextParts.push(`Esta é a PRIMEIRA mensagem do cliente. Apresente-se de forma breve e calorosa (ex.: "${saudacao}! Sou o Luma, da Pneu Zero 🔴") e pergunte o nome de forma natural, como uma pessoa real no WhatsApp. Não use texto de script.`);
    } else if (context.leadName) {
      contextParts.push(`O nome do cliente é: ${context.leadName}`);
    } else {
      const msgCount = context.messageHistory.filter(m => m.direction === "in").length;
      if (msgCount >= 2) {
        contextParts.push(`ATENÇÃO: Você AINDA NÃO SABE o nome do cliente (já são ${msgCount + 1} mensagens dele). Pergunte o nome AGORA de forma direta e calorosa. Ex: "Antes de continuar, como posso te chamar? 😊"`);
      } else {
        contextParts.push(`Você ainda não sabe o nome do cliente. Pergunte o nome dele de forma natural e calorosa. Ex: "Como posso te chamar?"`);
      }
    }

    // Coleta apenas CIDADE (email e outros dados extras só se cliente passar
    // espontaneamente — extractLeadData ainda captura pela regex).
    if (context.leadCity) {
      contextParts.push(`Cidade do cliente: ${context.leadCity}. NÃO pergunte cidade de novo.`);
    } else if (context.leadName && !isFirstMessage) {
      const inMsgCount = context.messageHistory.filter((m) => m.direction === "in").length;
      if (inMsgCount >= 4) {
        contextParts.push(`Ainda FALTA saber a CIDADE do cliente. Pergunte de forma natural quando fizer sentido. Ex: "Você é de qual cidade aqui no Maranhão?". NÃO peça email ou outros dados — só cidade.`);
      } else if (inMsgCount >= 2) {
        contextParts.push(`Quando achar um gancho natural, pergunte a cidade. Ex: "Aproveitando, você é de qual cidade?". NÃO peça email.`);
      }
    }

    // Reforça: NÃO pedir email em hipótese alguma.
    contextParts.push(`NUNCA peça email do cliente. Não é necessário pra atendimento. Se o cliente passar espontaneamente, OK — sistema captura sozinho.`);

    // Extrai dados estruturados do veículo (placa, medida pneu, km, ano) e faz upsert.
    const vehicleData = extractVehicleData(userMessage);
    if (Object.keys(vehicleData).length > 0) {
      try {
        await upsertVehicle(context.leadId, vehicleData);
      } catch (err) {
        console.warn("upsertVehicle falhou:", err);
      }
    }

    // Injeta veículos conhecidos no contexto
    const vehicles = await getVehiclesByLead(context.leadId);
    const vehicleBlock = formatVehiclesForAI(vehicles);
    if (vehicleBlock) {
      contextParts.push(vehicleBlock);
    }

    // Proposta de horário pendente: vendedor propôs uma data/hora e aguarda o
    // cliente confirmar. Se o cliente aceitar, Luma chama confirmar_proposta.
    const pendingProposal = await prisma.appointmentRequest.findFirst({
      where: { leadId: context.leadId, status: "proposed", proposedAt: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { serviceName: true, proposedAt: true },
    });
    if (pendingProposal?.proposedAt) {
      const dataFmt = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(pendingProposal.proposedAt);
      contextParts.push(
        `PROPOSTA DE HORÁRIO PENDENTE: o vendedor propôs *${pendingProposal.serviceName}* em *${dataFmt}* e está aguardando ESTE cliente confirmar. ` +
        `Se o cliente ACEITAR/confirmar esse horário (ex: "pode confirmar", "tá ótimo", "fechado", "esse serve"), chame a tool confirmar_proposta e depois confirme pra ele com naturalidade. ` +
        `Se ele pedir OUTRO horário ou recusar, não chame a tool — apenas responda que vai verificar com a equipe.`
      );
    }

    // Resumo da conversa salvo (Lead.summary): contexto comprimido de tudo
    // que aconteceu antes da janela de histórico. Crucial para conversas
    // longas onde as msgs antigas saíram da janela.
    if (context.leadSummary && context.leadSummary.trim().length > 0) {
      contextParts.push(`<ResumoConversa>\n${context.leadSummary.trim()}\n</ResumoConversa>\n\nO bloco acima é o resumo da conversa anterior com este cliente. Use para CONTINUAR de onde paramos — não recomece nem peça dados que já foram coletados.`);
    }

    // Sinaliza retomada quando cliente volta após pausa (>12h)
    if (context.gapHours && context.gapHours > 12) {
      const periodoPausa =
        context.gapHours < 24 ? `${Math.round(context.gapHours)} horas`
        : context.gapHours < 168 ? `${Math.round(context.gapHours / 24)} dias`
        : `${Math.round(context.gapHours / 168)} semana(s)`;
      contextParts.push(`O cliente está RETOMANDO a conversa após ${periodoPausa} de pausa. Seja natural: cumprimente brevemente, faça referência ao que vocês conversaram (use o ResumoConversa) e retome de onde parou. NÃO trate como conversa nova.`);
    }

    // Sinaliza retomada após handoff humano: Luma precisa continuar de onde
    // o atendente parou, não reiniciar do zero nem ignorar o que ele disse.
    if (context.lastOutFromHuman) {
      const agente = context.lastHumanAgent ?? "um atendente";
      contextParts.push(`RETOMADA APÓS ATENDIMENTO HUMANO: As últimas mensagens enviadas ao cliente vieram do atendente *${agente}* (não suas). Leia o que ${agente} disse, entenda o ponto da conversa, e CONTINUE de onde ele parou. Não recomece a conversa, não repita perguntas que ${agente} já fez, não desfaça compromissos ou promessas que ${agente} fez. Mantenha sua personalidade do Luma, mas honre o que o humano combinou.`);
    }

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `<Contexto>\n${contextParts.join("\n\n---\n\n")}\n</Contexto>` },
    ];

    // Adiciona histórico de mensagens (últimas 30 — janela maior para
    // continuidade em conversas longas). Mensagens de áudio/imagem usam
    // transcription quando body é vazio. Mensagens out do humano são
    // marcadas com prefixo pra IA distinguir do que ela própria disse.
    const recentHistory = context.messageHistory.slice(-30);
    for (const msg of recentHistory) {
      const content = formatHistoryContent(msg);
      if (!content) continue;
      messages.push({
        role: msg.direction === "in" ? "user" : "assistant",
        content,
      });
    }

    // Adiciona a mensagem atual
    messages.push({ role: "user", content: userMessage });

    const model = settings.openaiModel || "gpt-4o";
    const toolCtx: ToolContext = {
      leadId: context.leadId,
      organizationId: context.organizationId ?? "",
      conversationId: context.conversationId ?? undefined,
    };

    let response: string | null = null;
    const MAX_TOOL_ROUNDS = 4;
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Rastreia tools chamadas pelo modelo para inferir status do funil.
    const toolsCalled = new Set<string>();

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      // Último round: força resposta em texto — sem isso, 4 rounds só de
      // tool-calls caem no fallback genérico que ignora a conversa.
      const isLastRound = round === MAX_TOOL_ROUNDS - 1;
      const completion = await openai.chat.completions.create({
        model,
        messages: openaiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: isLastRound ? "none" : "auto",
        max_tokens: 600,
        temperature: 0.6,
        presence_penalty: 0.3,
        frequency_penalty: 0.25,
      });

      const choice = completion.choices[0]?.message;
      if (!choice) break;

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        openaiMessages.push({
          role: "assistant",
          content: choice.content ?? "",
          tool_calls: choice.tool_calls,
        });
        for (const call of choice.tool_calls) {
          if (call.type !== "function") continue;
          toolsCalled.add(call.function.name);
          let args: unknown = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await executeTool(call.function.name, args, toolCtx);
          openaiMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: result,
          });
        }
        continue;
      }

      response = choice.content ?? null;
      break;
    }

    if (!response) {
      return { response: generateFallbackResponse(userMessage, context.leadName) };
    }

    // Tenta extrair nome, email e cidade da mensagem do usuário
    const extractedData = extractLeadData(userMessage, context);

    // Atualiza o lead no banco se encontrou dados novos
    if (extractedData.name || extractedData.email || extractedData.city) {
      await updateLeadData(context.leadId, extractedData);
    }

    const cotacaoEnviada = toolsCalled.has("buscar_pneu") || toolsCalled.has("buscar_servico");
    const handoffSolicitado = toolsCalled.has("transferir_humano");
    const statusAtualizadoPorIA = toolsCalled.has("atualizar_status");

    return { response: response.trim(), extractedData, cotacaoEnviada, handoffSolicitado, statusAtualizadoPorIA };
  } catch (error) {
    console.error("Erro ao gerar resposta IA:", error);
    return { response: generateFallbackResponse(userMessage, context.leadName) };
  }
}

function extractLeadData(
  message: string,
  context: ConversationContext
): { name?: string; email?: string; city?: string } {
  const result: { name?: string; email?: string; city?: string } = {};

  // Extrai email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = message.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  // Extrai cidade
  if (!context.leadCity) {
    const cityPatterns = [
      /(?:sou de|moro em|moro no|moro na|estou em|tô em|to em|fico em|resido em|cidade[:\s]+)\s*([A-ZÀ-Úa-zà-ú][a-zà-ú]+(?:\s+(?:do|da|de|dos|das|e)\s+)?(?:[A-ZÀ-Úa-zà-ú][a-zà-ú]+)?)/i,
      /(?:aqui (?:em|no|na))\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:do|da|de|dos|das|e)\s+)?(?:[A-ZÀ-Ú][a-zà-ú]+)?)/i,
    ];
    for (const pattern of cityPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const city = match[1].trim();
        if (city.length >= 3 && !/\d/.test(city)) {
          result.city = city;
          break;
        }
      }
    }
  }

  // Nome NÃO é extraído aqui: extractAndSaveMemories (memory.ts) já cobre
  // padrões explícitos e resposta curta pós-pergunta — caminho único evita conflito.

  return result;
}

async function updateLeadData(
  leadId: string,
  data: { name?: string; email?: string; city?: string }
) {
  try {
    const updateData: { name?: string; email?: string; city?: string } = {};

    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.city) updateData.city = data.city;

    // Atualiza apenas nome/email; status segue o fluxo NOVO → EM_ATENDIMENTO → QUALIFICADO
    if (Object.keys(updateData).length > 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
      });
      console.log(`Lead ${leadId} atualizado:`, updateData);
    }
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
  }
}

function generateFallbackResponse(text: string, leadName?: string | null): string {
  const t = text.toLowerCase();
  const greeting = leadName ? `${leadName}` : "";

  if (t.match(/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e ai|eai)/)) {
    return `Olá! 👋 Eu sou o Luma, da Pneuzero. Como posso te chamar?`;
  }

  if (t.includes("pneu") || t.includes("medida")) {
    return `${greeting ? greeting + ", b" : "B"}eleza, vamos ver direitinho. Me passa a medida do pneu (ex.: 175/70R13) ou o ano e modelo do carro que eu confiro pra você.`;
  }

  if (t.includes("alinhamento") || t.includes("balanceamento") || t.includes("rodízio") || t.includes("rodizio")) {
    return `${greeting ? greeting + ", b" : "B"}om saber. Me conta o ano do veículo e quantos km já rodou, que aí eu te oriento certinho.`;
  }

  if (t.includes("preço") || t.includes("preco") || t.includes("valor") || t.includes("quanto")) {
    return `Pra te passar o valor certinho preciso de um detalhe a mais. Pode me dizer a medida do pneu ou o modelo/ano do carro?`;
  }

  if (t.includes("pneu zero") || t.includes("pneuzero") || t.includes("o que é")) {
    return `A Pneuzero é especializada em pneus e serviços automotivos: alinhamento, balanceamento, suspensão, freios, óleo, elétrica e baterias. ${greeting ? greeting + ", o" : "O"} que você precisa pro seu carro?`;
  }

  if (t.includes("obrigado") || t.includes("obrigada") || t.includes("valeu")) {
    return `Imagina${greeting ? ", " + greeting : ""}! 😊 Qualquer coisa é só chamar. Boa estrada! 🚗`;
  }

  if (!leadName) {
    return `Olá! Sou o Luma, da Pneuzero. Antes de continuar, como posso te chamar? 😊`;
  }

  return `${greeting}, entendi! Me conta um pouco mais do que o carro tá precisando que eu te ajudo. Se preferir falar com um atendente, é só avisar! 🛠️`;
}

export function shouldTransferToHuman(text: string): boolean {
  const t = text.toLowerCase();
  const keywords = [
    "atendente",
    "humano",
    "pessoa real",
    "falar com alguem",
    "falar com alguém",
    "quero falar",
    "preciso falar",
    "gerente",
    "reclamação",
    "cancelar",
  ];
  return keywords.some((k) => t.includes(k));
}

/**
 * Detecta a etapa do funil Pneuzero baseada na mensagem atual + sinais de tools.
 * Prioridade: PERDIDO > FECHADO > EM_NEGOCIACAO > QUALIFICADO > CONSCIENTIZADO > LEAD_FRIO > EM_ATENDIMENTO.
 * Retorna o status sugerido (ou null para manter o atual).
 */
export function detectLeadStatus(
  messageHistory: { direction: string; body: string | null }[],
  currentMessage: string,
  currentStatus: string,
  opts: { cotacaoEnviada?: boolean } = {}
): string | null {
  const msg = currentMessage.toLowerCase();

  // PERDIDO — Desistência ou rejeição
  const lostKeywords = [
    "não tenho interesse", "nao tenho interesse",
    "não quero", "nao quero",
    "não preciso", "nao preciso",
    "desisto", "deixa pra lá", "deixa pra la", "esquece",
    "não é pra mim", "nao e pra mim",
    "muito caro", "tá caro", "ta caro", "ficou caro",
    "sem condições", "sem condicoes",
    "não posso pagar", "nao posso pagar",
    "fora do meu orçamento", "fora do orcamento",
    "já comprei em outro lugar", "ja comprei em outro lugar",
    "já fiz em outra", "ja fiz em outra",
    "outra borracharia", "outro centro",
    "já tenho", "ja tenho",
    "não me interessa", "nao me interessa",
  ];
  if (lostKeywords.some((k) => msg.includes(k))) {
    return "PERDIDO";
  }

  // FECHADO — Confirmação de compra/agendamento
  const closedKeywords = [
    "vou comprar", "quero comprar",
    "fechar negócio", "fechar negocio",
    "vou fechar", "fechado", "tá fechado", "ta fechado",
    "pode mandar o pix", "manda o pix", "fiz o pix",
    "vou pagar", "quero pagar", "paguei", "já paguei", "ja paguei", "paguei agora",
    "aceito", "vamos fechar", "combinado", "pode enviar",
    "vou levar amanhã", "vou levar amanha", "vou levar hoje",
    "tô indo aí", "to indo ai", "tô indo agora", "to indo agora",
    "vou aí", "to indo", "tô indo", "passo aí",
    "marca pra mim", "agendado", "pode marcar",
  ];
  if (closedKeywords.some((k) => msg.includes(k))) {
    return "FECHADO";
  }

  // EM_NEGOCIACAO — Discussão de forma de pagamento / desconto
  const negotiationKeywords = [
    "à vista", "a vista", "no pix", "no cartão", "no cartao",
    "parcelado", "em quantas vezes", "quantas vezes",
    "boleto", "tem desconto", "consegue desconto", "abaixar o valor",
    "melhor preço", "melhor preco", "faz por menos", "faz mais barato",
    "no débito", "no debito", "no crédito", "no credito",
  ];
  if (
    negotiationKeywords.some((k) => msg.includes(k)) &&
    ["CONSCIENTIZADO", "QUALIFICADO", "EM_ATENDIMENTO"].includes(currentStatus)
  ) {
    return "EM_NEGOCIACAO";
  }

  // QUALIFICADO — Intenção concreta de agendar/fechar
  const qualifiedKeywords = [
    "quero levar o carro", "quero levar",
    "quero agendar", "pode agendar", "quer agendar",
    "vou levar", "como faço pra agendar", "como faco pra agendar",
    "qual o melhor dia", "qual dia pode", "que horas", "que horário", "que horario",
    "tem horário", "tem horario", "tem horário pra", "tem horario pra",
    "quero fechar", "bora fechar", "vamos fechar",
    "pode marcar", "marca aí", "marca ai",
    "vou querer", "quero esse", "pode ser esse",
    "como faz pra", "como funciona o agendamento",
  ];
  if (qualifiedKeywords.some((k) => msg.includes(k)) && currentStatus !== "FECHADO") {
    return "QUALIFICADO";
  }

  // CONSCIENTIZADO — Luma chamou tool de cotação (preço enviado)
  // Só avança a partir de NOVO/EM_ATENDIMENTO; não regride status mais avançados.
  if (
    opts.cotacaoEnviada &&
    (currentStatus === "NOVO" || currentStatus === "EM_ATENDIMENTO")
  ) {
    return "CONSCIENTIZADO";
  }

  // LEAD_FRIO — Hesitação / esfriamento
  const coldKeywords = [
    "vou pensar", "preciso pensar", "pensar melhor",
    "depois eu vejo", "depois eu te falo",
    "não sei se", "nao sei se", "talvez",
    "não agora", "nao agora", "mais tarde", "outro dia",
    "semana que vem", "mês que vem", "mes que vem",
    "não é o momento", "nao e o momento",
    "vou analisar", "vou ver", "deixa eu ver", "vou avaliar",
  ];
  if (coldKeywords.some((k) => msg.includes(k))) {
    return "LEAD_FRIO";
  }

  // EM_ATENDIMENTO — Lead engajado mas ainda sem sinais fortes.
  // Promove só a partir de NOVO após algumas mensagens.
  if (currentStatus === "NOVO" && messageHistory.length >= 4) {
    return "EM_ATENDIMENTO";
  }

  return null; // Mantém status atual
}

/**
 * Gera um resumo curto da conversa para a aba Anotações
 * Chamado a cada N mensagens ou quando há dados novos relevantes
 */
export async function generateConversationSummary(
  messageHistory: { direction: string; body: string | null }[],
  leadName: string | null
): Promise<string | null> {
  try {
    const openai = await getOpenAIClient();
    if (!openai) return null;

    const msgs = messageHistory
      .filter((m) => m.body)
      .map((m) => `${m.direction === "in" ? "Cliente" : "Luma"}: ${m.body}`)
      .join("\n");

    if (!msgs.trim()) return null;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Resuma a conversa abaixo em português (pt-BR), de forma objetiva, em no máximo 5 linhas.
Inclua: o que o cliente busca, planos/serviços mencionados, objeções, dados coletados (nome, email, cidade), e o status atual da negociação.
Use formato de tópicos curtos. Não invente dados que não estejam na conversa.
${leadName ? `Nome do cliente: ${leadName}` : ""}`,
        },
        {
          role: "user",
          content: msgs,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error("Erro ao gerar resumo:", error);
    return null;
  }
}
