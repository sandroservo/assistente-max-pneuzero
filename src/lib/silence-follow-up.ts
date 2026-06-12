/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Follow-up automático de silêncio com cadência humanizada B2C.
 * 4 tentativas com thresholds crescentes desde a última msg do cliente:
 *   #1 — 15min  → "chacoalhão" (resgate quem se distraiu)
 *   #2 — 45min  → oferece agendamento de horário
 *   #3 — 4h     → alerta de estoque/pátio em movimento
 *   #4 — 24h   → encerramento prático, libera vaga
 *
 * Após #4 marca `silenceAbandonedAt` + posta no /equipe + status PERDIDO.
 * Cliente que volta a responder reseta tudo (resetSilenceCounter).
 *
 * Cron varre a cada 1min via /api/cron/silence-follow-up.
 */

import { prisma } from "./prisma";
import { evolutionSendText } from "./evolution";
import { postBotToGeneral } from "./team-bot";
import { publishNotif } from "./notifications-bus";

// Threshold em minutos desde a última msg DO CLIENTE (direction=in)
// Index = silenceFollowupCount atual (0 = ainda nenhuma tentativa)
const SILENCE_THRESHOLDS_MIN = [15, 45, 240, 1440] as const;
const MAX_ATTEMPTS = SILENCE_THRESHOLDS_MIN.length;

const TEMPLATES: Record<number, string> = {
  1: `Conseguiu dar uma olhadinha na mensagem anterior? 😊

Como o nosso estoque aqui na loja gira rápido, quero garantir que a medida certinha para o seu carro fique reservada. Me avisa se deu certo! 👍`,

  2: `Sei que o seu dia deve estar corrido! 🚗💨

Só para te facilitar: nós trabalhamos com agendamento de horário aqui na Pneu Zero. Você escolhe o melhor momento, traz o carro e nosso time prioriza o seu atendimento para você resolver tudo sem esperar!

Quer que eu veja os horários livres para hoje ou amanhã? 😉`,

  3: `Oi! Passando para te avisar que os meninos da oficina estão finalizando os atendimentos agora e temos uma vaga excelente para receber seu carro nas próximas horas. ⚙️🚗

Conseguimos fechar aquele orçamento que começamos para deixar tudo pronto para você?`,

  4: `Como não tive mais o seu retorno, imaginei que você já deve ter resolvido ou adiou a manutenção do carro por enquanto, sem problemas! Retive os pneus no sistema para liberar o estoque, combinado? 🛞📋

Se ainda precisar de pneus, troca de óleo ou serviços de suspensão, as portas aqui em Imperatriz estão abertas. Quando quiser, é só mandar um "Oi" que a IA te joga direto para mim! Tenha um ótimo dia! ✨`,
};

interface EligibleConversation {
  id: string;
  leadId: string;
  silenceFollowupCount: number;
  leadName: string | null;
  phone: string;
  organizationId: string;
}

/**
 * Busca conversas elegíveis pra próxima tentativa.
 *
 * Threshold é checado contra a ÚLTIMA msg direction='in' do cliente
 * (a partir dela conta o "vácuo"). Conversas onde o cliente respondeu
 * tem o contador resetado e o vácuo recomeça do zero.
 *
 * CASE WHEN no WHERE escolhe o threshold conforme silenceFollowupCount.
 */
export async function findSilentConversations(limit = 30): Promise<EligibleConversation[]> {
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
      SELECT direction::text AS direction
      FROM "Message"
      WHERE "conversationId" = c.id
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) last_msg ON true
    JOIN LATERAL (
      SELECT max("createdAt") AS started
      FROM "Message"
      WHERE "conversationId" = c.id AND direction::text = 'in'
    ) silence ON true
    WHERE l."ownerType" = 'bot'
      AND l."followUpOptOut" = false
      AND l.status NOT IN ('PERDIDO', 'FECHADO')
      AND c."silenceAbandonedAt" IS NULL
      AND c."silenceFollowupCount" < ${MAX_ATTEMPTS}
      AND last_msg.direction = 'out'
      AND silence.started IS NOT NULL
      AND NOW() - silence.started > make_interval(mins := CASE
        WHEN c."silenceFollowupCount" = 0 THEN ${SILENCE_THRESHOLDS_MIN[0]}
        WHEN c."silenceFollowupCount" = 1 THEN ${SILENCE_THRESHOLDS_MIN[1]}
        WHEN c."silenceFollowupCount" = 2 THEN ${SILENCE_THRESHOLDS_MIN[2]}
        WHEN c."silenceFollowupCount" = 3 THEN ${SILENCE_THRESHOLDS_MIN[3]}
        ELSE 99999
      END)
      AND (c."silenceLastTryAt" IS NULL OR c."silenceLastTryAt" < silence.started)
    ORDER BY silence.started ASC
    LIMIT ${limit}
  `;
  return rows;
}

function pickTemplate(attempt: number): string {
  return TEMPLATES[attempt] ?? TEMPLATES[1];
}

interface RunResult {
  conversationId: string;
  ok: boolean;
  attempt: number;
  abandoned?: boolean;
  error?: string;
}

/**
 * Envia 1 tentativa de follow-up. Templates fixos (sem chamada IA).
 * Se for a #4, marca abandono + status PERDIDO + notifica time.
 */
export async function runSilenceFollowUp(c: EligibleConversation): Promise<RunResult> {
  const nextAttempt = c.silenceFollowupCount + 1;
  const text = pickTemplate(nextAttempt);

  try {
    await evolutionSendText({ number: c.phone, text });

    const now = new Date();
    const isLast = nextAttempt >= MAX_ATTEMPTS;
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
          ...(isLast ? { silenceAbandonedAt: now } : {}),
        },
      }),
    ]);

    if (isLast) {
      // Última tentativa → marca PERDIDO + notifica time
      await prisma.lead.update({
        where: { id: c.leadId },
        data: { status: "PERDIDO" },
      }).catch(() => null);

      const clienteNome = c.leadName || c.phone;
      void postBotToGeneral(
        c.organizationId,
        `🔕 *Conversa encerrada por silêncio* — *${clienteNome}* (${c.phone}) não respondeu após 24h. Status marcado como PERDIDO. Volta a contar quando ele mandar mensagem.`
      );
      publishNotif({
        organizationId: c.organizationId,
        kind: "handoff",
        title: `Silêncio 24h: ${clienteNome}`,
        body: "Conversa encerrada — cliente não respondeu",
        url: `/leads/${c.leadId}`,
      });
      return { conversationId: c.id, ok: true, attempt: nextAttempt, abandoned: true };
    }

    return { conversationId: c.id, ok: true, attempt: nextAttempt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[silence] envio falhou conv=${c.id}:`, msg);
    // Marca tentativa pra não ficar em loop infinito
    await prisma.conversation.update({
      where: { id: c.id },
      data: { silenceLastTryAt: new Date() },
    }).catch(() => null);
    return { conversationId: c.id, ok: false, attempt: nextAttempt, error: msg };
  }
}

/**
 * Cliente voltou a falar → zera contador e tira flag de abandono.
 * Se o Lead estava PERDIDO, volta pra EM_ATENDIMENTO.
 */
export async function resetSilenceCounter(conversationId: string): Promise<void> {
  try {
    const c = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        leadId: true,
        silenceFollowupCount: true,
        silenceAbandonedAt: true,
      },
    });
    if (!c) return;
    if (c.silenceFollowupCount === 0 && !c.silenceAbandonedAt) return;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        silenceFollowupCount: 0,
        silenceLastTryAt: null,
        silenceAbandonedAt: null,
      },
    });

    // Se Lead estava PERDIDO por silêncio, reativa
    await prisma.lead.updateMany({
      where: { id: c.leadId, status: "PERDIDO" },
      data: { status: "EM_ATENDIMENTO" },
    });
  } catch (err) {
    console.error("[silence] reset falhou:", err);
  }
}
