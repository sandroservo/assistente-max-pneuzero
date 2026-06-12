/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Follow-up automático de silêncio: cliente parou de responder, Luma toca
 * de novo a cada 2min. Até 5 tentativas, depois abandona e aguarda volta.
 *
 * Critérios de elegibilidade:
 * - Última mensagem da conversa foi direction='out' (foi Luma)
 * - Passou >= 2 min desde lastMessageAt
 * - Passou >= 2 min desde silenceLastTryAt (se houver)
 * - Lead.ownerType = 'bot' (sem handoff humano)
 * - Lead.followUpOptOut = false
 * - Lead.status NOT IN ('PERDIDO', 'FECHADO')
 * - Conversation.silenceFollowupCount < 5
 * - Conversation.silenceAbandonedAt IS NULL
 */

import OpenAI from "openai";
import { prisma } from "./prisma";
import { getSystemSettings } from "./settings";
import { evolutionSendText } from "./evolution";
import { postBotToGeneral } from "./team-bot";
import { publishNotif } from "./notifications-bus";

const SILENCE_GAP_MINUTES = 2;
const MAX_ATTEMPTS = 5;

interface EligibleConversation {
  id: string;
  leadId: string;
  silenceFollowupCount: number;
  leadName: string | null;
  phone: string;
  organizationId: string;
}

/**
 * Busca conversas elegíveis pra próxima tentativa de follow-up.
 */
export async function findSilentConversations(limit = 30): Promise<EligibleConversation[]> {
  // Query raw — usa join lateral pra pegar última msg eficientemente
  const rows = await prisma.$queryRaw<EligibleConversation[]>`
    SELECT
      c.id,
      c."leadId",
      c."silenceFollowupCount",
      l.name AS "leadName",
      l.phone,
      l."organizationId"
    FROM "Conversation" c
    JOIN "Lead" l ON l.id = c."leadId"
    JOIN LATERAL (
      SELECT direction
      FROM "Message"
      WHERE "conversationId" = c.id
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) last_msg ON true
    WHERE l."ownerType" = 'bot'
      AND l."followUpOptOut" = false
      AND l.status NOT IN ('PERDIDO', 'FECHADO')
      AND c."silenceAbandonedAt" IS NULL
      AND c."silenceFollowupCount" < ${MAX_ATTEMPTS}
      AND last_msg.direction::text = 'out'
      AND c."lastMessageAt" IS NOT NULL
      AND c."lastMessageAt" < NOW() - make_interval(mins := ${SILENCE_GAP_MINUTES})
      AND (
        c."silenceLastTryAt" IS NULL
        OR c."silenceLastTryAt" < NOW() - make_interval(mins := ${SILENCE_GAP_MINUTES})
      )
    ORDER BY c."lastMessageAt" ASC
    LIMIT ${limit}
  `;
  return rows;
}

async function getOpenAIClient(): Promise<OpenAI | null> {
  const settings = await getSystemSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Gera mensagem de reativação contextual via OpenAI.
 * Recebe contexto da conversa + número da tentativa pra modular tom.
 */
async function generateSilenceMessage(
  conversationId: string,
  leadFirstName: string | null,
  attempt: number
): Promise<string | null> {
  const openai = await getOpenAIClient();
  if (!openai) return null;

  // Pega últimas 15 msgs + sumário
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { summary: true },
  });

  const msgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { direction: true, body: true, transcription: true },
  });
  const transcript = msgs
    .reverse()
    .map((m) => {
      const speaker = m.direction === "in" ? "Cliente" : "Luma";
      const text = (m.body || m.transcription || "").trim();
      return text ? `${speaker}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const tomPorTentativa: Record<number, string> = {
    1: "leve e casual — só verificar se ainda está aí",
    2: "ainda casual mas direto — perguntar se conseguiu olhar a info",
    3: "mais consultivo — oferecer ajuda específica baseada no contexto",
    4: "tom de \"vou ficar à disposição\" — sem pressão",
    5: "última tentativa amigável — \"qualquer coisa estou por aqui\", deixa porta aberta",
  };

  const prompt = `Você é a Luma, consultora da Pneuzero, falando por WhatsApp. O cliente${leadFirstName ? ` ${leadFirstName}` : ""} parou de responder. Esta é a tentativa ${attempt} de ${MAX_ATTEMPTS} de retomar a conversa.

CONTEXTO DA CONVERSA:
${convo?.summary ? `Sumário: ${convo.summary}\n\n` : ""}Últimas mensagens:
${transcript || "(sem mensagens anteriores)"}

INSTRUÇÕES:
- Tom: ${tomPorTentativa[attempt] || "casual e amigável"}
- Mensagem CURTA (1-2 frases máximo)
- NÃO repita exatamente algo que você já disse
- NÃO seja insistente ou pareça spam
- Use emoji leve só se fizer sentido
- Se for tentativa 4 ou 5, deixa claro que você fica à disposição quando ele quiser voltar
- NUNCA invente informação nova de produto/preço
- Fale como pessoa real, não como bot

Gere SÓ a mensagem (sem aspas, sem prefixo).`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 120,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;
    return text.replace(/^["']|["']$/g, "").trim();
  } catch (err) {
    console.error("[silence] OpenAI falhou:", err);
    return null;
  }
}

interface RunResult {
  conversationId: string;
  ok: boolean;
  attempt: number;
  abandoned?: boolean;
  error?: string;
}

/**
 * Executa 1 tentativa de follow-up: gera msg + envia + incrementa contador.
 * Se atingiu MAX_ATTEMPTS, marca abandonado e posta no /equipe.
 */
export async function runSilenceFollowUp(c: EligibleConversation): Promise<RunResult> {
  const nextAttempt = c.silenceFollowupCount + 1;
  const firstName = (c.leadName?.split(" ")[0] ?? "").trim() || null;

  try {
    const text = await generateSilenceMessage(c.id, firstName, nextAttempt);
    if (!text) {
      return { conversationId: c.id, ok: false, attempt: nextAttempt, error: "gen_failed" };
    }

    await evolutionSendText({ number: c.phone, text });

    // Grava como out + atualiza contadores
    const now = new Date();
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: c.id,
          direction: "out",
          type: "text",
          body: text,
          sentAt: now,
        },
      }),
      prisma.conversation.update({
        where: { id: c.id },
        data: {
          lastMessageAt: now,
          silenceFollowupCount: nextAttempt,
          silenceLastTryAt: now,
          ...(nextAttempt >= MAX_ATTEMPTS ? { silenceAbandonedAt: now } : {}),
        },
      }),
    ]);

    // Última tentativa → marca abandono + notifica time
    if (nextAttempt >= MAX_ATTEMPTS) {
      const clienteNome = c.leadName || c.phone;
      void postBotToGeneral(
        c.organizationId,
        `🔕 *Cliente em silêncio* — *${clienteNome}* (${c.phone}) não respondeu após ${MAX_ATTEMPTS} tentativas. Conversa pausada, aguarda ele voltar.`
      );
      publishNotif({
        organizationId: c.organizationId,
        kind: "handoff",
        title: `Silêncio: ${clienteNome}`,
        body: `Não respondeu após ${MAX_ATTEMPTS} tentativas`,
        url: `/leads/${c.leadId}`,
      });
      return { conversationId: c.id, ok: true, attempt: nextAttempt, abandoned: true };
    }

    return { conversationId: c.id, ok: true, attempt: nextAttempt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[silence] envio falhou conv=${c.id}:`, msg);
    // Mesmo com erro, marca tentativa pra não ficar em loop infinito
    await prisma.conversation.update({
      where: { id: c.id },
      data: { silenceLastTryAt: new Date() },
    }).catch(() => null);
    return { conversationId: c.id, ok: false, attempt: nextAttempt, error: msg };
  }
}

/**
 * Reseta contador quando cliente volta a falar. Chame no webhook quando
 * recebe msg direction=in. Idempotente — só atualiza se houver estado.
 */
export async function resetSilenceCounter(conversationId: string): Promise<void> {
  try {
    await prisma.conversation.updateMany({
      where: {
        id: conversationId,
        OR: [
          { silenceFollowupCount: { gt: 0 } },
          { silenceAbandonedAt: { not: null } },
        ],
      },
      data: {
        silenceFollowupCount: 0,
        silenceLastTryAt: null,
        silenceAbandonedAt: null,
      },
    });
  } catch (err) {
    console.error("[silence] reset falhou:", err);
  }
}
