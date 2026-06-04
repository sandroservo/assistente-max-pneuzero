/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Sumário rolante da conversa. A cada N mensagens novas (default 20),
 * pega últimas 30 msgs + sumário anterior e gera novo via OpenAI.
 * ai.ts usa `Conversation.summary` no contexto em vez de dumpar histórico.
 */

import OpenAI from "openai";
import { prisma } from "./prisma";
import { getSystemSettings } from "./settings";

const TRIGGER_EVERY_N_MESSAGES = 20;
const RECENT_WINDOW = 30;

/**
 * Incrementa contador de mensagens desde último sumário. Chame após cada
 * Message create (in/out). Fire-and-forget — não bloqueia caller.
 */
export async function bumpMessageCount(conversationId: string): Promise<void> {
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { messagesSinceSummary: { increment: 1 } },
    });
  } catch (err) {
    console.error("[summary] bump falhou:", err);
  }
}

/**
 * Se contador >= TRIGGER, gera novo sumário em background. Senão, no-op.
 */
export async function maybeUpdateSummary(conversationId: string): Promise<void> {
  try {
    const c = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { messagesSinceSummary: true },
    });
    if (!c || c.messagesSinceSummary < TRIGGER_EVERY_N_MESSAGES) return;
    // Não await — fire-and-forget
    void generateRollingSummary(conversationId).catch((err) =>
      console.error("[summary] generate background falhou:", err)
    );
  } catch (err) {
    console.error("[summary] maybeUpdateSummary falhou:", err);
  }
}

async function getOpenAIClient(): Promise<OpenAI | null> {
  const settings = await getSystemSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Gera sumário da conversa via OpenAI e salva em Conversation.summary.
 */
export async function generateRollingSummary(conversationId: string): Promise<string | null> {
  const openai = await getOpenAIClient();
  if (!openai) return null;

  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      summary: true,
      lead: { select: { name: true, phone: true } },
    },
  });
  if (!convo) return null;

  const recent = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: RECENT_WINDOW,
    select: { direction: true, body: true, transcription: true, createdAt: true },
  });
  if (recent.length === 0) return null;

  const ordered = recent.reverse();
  const transcript = ordered
    .map((m) => {
      const speaker = m.direction === "in" ? "Cliente" : "Luma";
      const text = (m.body || m.transcription || "").trim();
      return text ? `${speaker}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const prompt = `Você atualiza o sumário de uma conversa de vendas no WhatsApp entre Luma (assistente Pneuzero) e ${convo.lead.name || "cliente"}.

SUMÁRIO ATUAL (pode estar vazio na primeira vez):
${convo.summary || "(ainda não há sumário)"}

ÚLTIMAS MENSAGENS (cronológico):
${transcript}

GERE UM NOVO SUMÁRIO COMPACTO (máx 600 caracteres) em texto corrido, contendo:
- Veículo/modelo/ano se cliente mencionou
- Serviço/produto de interesse principal
- Etapa da conversa (descobrindo necessidade / cotação / agendamento / fechamento / handoff)
- Decisões tomadas (forma pagto, data agendada, valor combinado)
- Objeções não resolvidas
- Próximo passo natural

Não invente. Use 3a pessoa. Sem emojis. Sem listas.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });
    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) return null;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary,
        summaryUpdatedAt: new Date(),
        messagesSinceSummary: 0,
      },
    });
    return summary;
  } catch (err) {
    console.error("[summary] OpenAI falhou:", err);
    return null;
  }
}

/**
 * Lê o sumário atual da conversa (pode ser null).
 */
export async function getConversationSummary(conversationId: string): Promise<string | null> {
  const c = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { summary: true },
  });
  return c?.summary ?? null;
}
