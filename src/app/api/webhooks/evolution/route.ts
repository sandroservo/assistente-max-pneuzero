/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Webhook para receber mensagens do WhatsApp via Evolution API (single-tenant).
 */

import { NextResponse } from "next/server";
import { prisma, LeadStatus } from "@/lib/prisma";
import { evolutionSendText, evolutionSendTextHumanized, evolutionGetProfilePicture, evolutionGetMediaBase64, EvolutionInvalidNumberError, wasRecentBotSend } from "@/lib/evolution";
import { bumpMessageCount, maybeUpdateSummary } from "@/lib/conversation-summary";
import { transcribeAudio, describeImage } from "@/lib/media";
import { saveMedia } from "@/lib/media-storage";
import { generateAIResponse, shouldTransferToHuman, detectLeadStatus, generateConversationSummary } from "@/lib/ai";
import { updateLeadScore, getStatusFromScore } from "@/lib/lead-score";
import { detectOptOut } from "@/lib/followup-engine";
import { extractNPSScore, findPendingNPS, recordNPSResponse, npsReplyMessage } from "@/lib/nps";

function phoneFromJid(remoteJid: string) {
  return remoteJid.split("@")[0];
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => null);
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "invalid json" },
        { status: 400 }
      );
    }

    // Processa eventos de atualização de status (read receipts)
    const event = payload?.event;
    if (event === "messages.update" || event === "messages.ack") {
      const updates = Array.isArray(payload?.data) ? payload.data : [payload?.data];
      for (const upd of updates) {
        const msgId = upd?.key?.id || upd?.id;
        const ack = upd?.update?.ack ?? upd?.ack ?? upd?.update?.status;
        if (msgId && ack != null) {
          const statusMap: Record<number, string> = {
            1: "sent",
            2: "delivered",
            3: "read",
            4: "read",
          };
          const newStatus = typeof ack === "number" ? statusMap[ack] : String(ack).toLowerCase();
          if (newStatus) {
            try {
              await prisma.message.updateMany({
                where: { providerId: msgId },
                data: { status: newStatus },
              });
            } catch { /* ignore */ }
          }
        }
      }
      return NextResponse.json({ ok: true, event: "status_update" });
    }

    const remoteJid: string | undefined = payload?.data?.key?.remoteJid;
    const providerId: string | undefined = payload?.data?.key?.id;
    const fromMe: boolean = payload?.data?.key?.fromMe === true;
    const pushName: string | undefined = payload?.data?.pushName;
    const instanceName: string | undefined = payload?.instance;
    const avatarUrl: string | undefined = payload?.data?.profilePictureUrl;

    // Self-echo guard: Evolution reemite mensagens enviadas pelo bot como fromMe=true.
    // Sem isso, webhook abaixo trata como "atendente assumiu" e cria handoff calando o bot.
    // wasRecentBotSend compara providerId com cache populado em evolution.ts no envio.
    if (fromMe && wasRecentBotSend(providerId)) {
      return NextResponse.json({ ok: true, action: "self_echo" });
    }

    const msg = payload?.data?.message ?? {};
    let text: string | undefined =
      msg?.conversation ?? msg?.extendedTextMessage?.text;

    const messageType: "text" | "audio" | "image" = text != null ? "text" : msg?.audioMessage ? "audio" : msg?.imageMessage ? "image" : "text";

    // Só transcreve/descreve mídia em mensagens recebidas (não as enviadas por nós)
    let savedMediaUrl: string | null = null;
    let transcriptionText: string | null = null;

    if (!fromMe) {
      if (messageType === "audio" && instanceName && providerId) {
        const media = await evolutionGetMediaBase64(instanceName, providerId);
        if (media) {
          if (media.base64 && media.mimeType) {
            try { savedMediaUrl = await saveMedia(media.base64, media.mimeType); } catch (e) { console.error("Erro ao salvar áudio:", e); }
          }
          const transcribed = await transcribeAudio(media.base64, media.mimeType);
          if (transcribed) {
            transcriptionText = transcribed;
            text = transcribed;
          }
        }
        if (!text) text = "[Áudio não transcrito]";
      } else if (messageType === "image" && instanceName && providerId) {
        const media = await evolutionGetMediaBase64(instanceName, providerId);
        const caption = msg?.imageMessage?.caption ?? "";
        if (media) {
          if (media.base64 && media.mimeType) {
            try { savedMediaUrl = await saveMedia(media.base64, media.mimeType); } catch (e) { console.error("Erro ao salvar imagem:", e); }
          }
          const described = await describeImage(media.base64, media.mimeType, caption || undefined);
          if (described) {
            transcriptionText = described;
            text = caption ? `${described}\n\nLegenda do usuário: ${caption}` : described;
          }
        }
        if (!text) text = caption || "[Imagem sem descrição]";
      }
    }

    if (!remoteJid) {
      return NextResponse.json(
        { ok: false, error: "remoteJid missing" },
        { status: 422 }
      );
    }

    const phone = phoneFromJid(remoteJid);

    // Single-tenant: usa sempre a primeira organização
    let org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Pneu Zero", slug: "pneuzero" },
      });
    }
    const organizationId = org.id;

    // Instância (opcional): para vincular conversa ao canal
    const instance = instanceName
      ? await prisma.instance.findFirst({
          where: { instanceName, organizationId },
          include: { organization: true },
        })
      : null;

    // Busca foto de perfil se não tiver ainda
    let profilePicture: string | undefined = avatarUrl;
    if (!profilePicture) {
      profilePicture = (await evolutionGetProfilePicture(phone)) ?? undefined;
    }

    // pushName só é confiável em mensagens recebidas (!fromMe)
    // Mensagens enviadas (fromMe) carregam o nome da conta business, não do cliente
    const clientPushName = !fromMe ? pushName : undefined;

    // Upsert atômico evita race condition (Evolution dispara eventos em paralelo
    // pro mesmo número — findFirst+create concorrentes quebravam com P2002).
    let lead = await prisma.lead.upsert({
      where: { organizationId_phone: { organizationId, phone } },
      update: {
        lastMessageAt: new Date(),
        ...(clientPushName && { pushName: clientPushName }),
      },
      create: {
        organizationId,
        phone,
        name: clientPushName || null,
        pushName: clientPushName || null,
        avatarUrl: profilePicture || null,
        status: "NOVO",
        ownerType: "bot",
        lastMessageAt: new Date(),
      },
    });

    // Backfill name/avatarUrl quando ainda vazios (sem race — update por id)
    const needsName = clientPushName && !lead.name;
    const needsAvatar = profilePicture && !lead.avatarUrl;
    if (needsName || needsAvatar) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          ...(needsName && { name: clientPushName }),
          ...(needsAvatar && { avatarUrl: profilePicture }),
        },
      });
    }

    // Garante contato salvo (idempotente: ignora se já existe)
    const existingContact = await prisma.savedContact.findFirst({
      where: { organizationId, phone },
      select: { id: true },
    });
    if (!existingContact) {
      await prisma.savedContact.create({
        data: {
          organizationId,
          name: clientPushName || phone,
          phone,
          category: "lead",
        },
      }).catch(() => { /* ignora corridas */ });
    }

    // Single-tenant: uma conversa por lead (busca por leadId apenas)
    let conversation = await prisma.conversation.findFirst({
      where: { leadId: lead.id },
    });

    if (conversation) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
        },
      });
    } else {
      conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          instanceId: instance?.id ?? null,
          remoteJid,
          channel: "whatsapp",
          lastMessageAt: new Date(),
          unreadCount: fromMe ? 0 : 1,
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: fromMe ? "out" : "in",
        type: messageType,
        body: text ?? null,
        mediaUrl: savedMediaUrl,
        transcription: transcriptionText,
        providerId: providerId ?? null,
        sentAt: new Date(),
      },
    });

    // Memória rolante: incrementa contador + dispara sumário se passou do limite.
    // Fire-and-forget pra não bloquear resposta.
    await bumpMessageCount(conversation.id);
    void maybeUpdateSummary(conversation.id);

    // Mensagem enviada pelo atendente (fromMe): humano assumiu a conversa — bot não responde até "Devolver ao Bot"
    if (fromMe) {
      const wasBot = lead.ownerType === "bot";
      await prisma.lead.update({
        where: { id: lead.id },
        data: { ownerType: "human", status: "HUMANO_EM_ATENDIMENTO" },
      });
      if (wasBot) {
        await prisma.handoff.create({
          data: {
            leadId: lead.id,
            conversationId: conversation.id,
            requestedBy: "human",
            reason: "Atendente enviou mensagem pelo WhatsApp",
          },
        });
      }
      return NextResponse.json({ ok: true, action: "human_sent" });
    }

    if (!text?.trim()) {
      return NextResponse.json({ ok: true, action: "no_text" });
    }

    // Detecta opt-out de follow-up
    if (detectOptOut(text)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { followUpOptOut: true },
      });
    }

    // Parser NPS: se há follow-up nps_d1 recente sem resposta, tenta extrair nota
    const pendingNps = await findPendingNPS(lead.id);
    if (pendingNps?.saleId) {
      const nota = extractNPSScore(text);
      if (nota !== null) {
        const resp = await recordNPSResponse({
          leadId: lead.id,
          saleId: pendingNps.saleId,
          conversationId: conversation.id,
          nota,
        });
        const reply = npsReplyMessage(resp.categoria as "detrator" | "neutro" | "promotor");
        await evolutionSendText({ number: phone, text: reply });
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "out",
            type: "text",
            body: reply,
            sentAt: new Date(),
          },
        });
        return NextResponse.json({ ok: true, action: "nps_recorded", nota });
      }
    }

    // Se lead já está com humano, não responde automaticamente
    if (lead.ownerType === "human") {
      return NextResponse.json({ ok: true, action: "human_owner" });
    }

    // Lista de exceção: números da empresa etc. — Luma não responde
    const phoneNormalized = phone.replace(/\D/g, "").slice(-11);
    if (phoneNormalized) {
      const excluded = await prisma.excludedContact.findUnique({
        where: {
          organizationId_phone: {
            organizationId: lead.organizationId,
            phone: phoneNormalized,
          },
        },
      });
      if (excluded) {
        return NextResponse.json({ ok: true, action: "excluded_contact" });
      }
    }

    // Verifica se pediu transferência para humano
    if (text && shouldTransferToHuman(text)) {
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: { status: "HUMANO_SOLICITADO", ownerType: "human" },
        }),
        prisma.handoff.create({
          data: {
            leadId: lead.id,
            conversationId: conversation.id,
            requestedBy: "lead",
            reason: "Lead solicitou atendente humano",
            summary: text,
          },
        }),
      ]);

      const handoffMessage = `Entendido! 👤 Vou te transferir para um de nossos atendentes. Aguarde um momento que logo alguém vai te atender!`;
      
      await evolutionSendText({ number: phone, text: handoffMessage });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "out",
          type: "text",
          body: handoffMessage,
          sentAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true, action: "handoff" });
    }

    // Busca as ÚLTIMAS 50 mensagens (não as primeiras) e devolve em ordem
    // cronológica para a IA. Antes a query pegava take:20 ASC, perdendo
    // todo o contexto recente em conversas longas.
    const recentDesc = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        direction: true,
        body: true,
        type: true,
        transcription: true,
        sentByUserId: true,
        createdAt: true,
        sentByUser: { select: { name: true } },
      },
    });
    const messageHistoryFull = recentDesc.reverse();
    const messageHistory = messageHistoryFull.map((m) => ({
      direction: m.direction,
      body: m.body,
      type: m.type,
      transcription: m.transcription,
      sentByUserName: m.sentByUser?.name ?? null,
    }));

    // Detecta gap (cliente retomando conversa após pausa).
    // Última mensagem antes da atual: se foi há > 12h, sinaliza retomada.
    const lastIn = [...messageHistoryFull].reverse().find((m) => m.direction === "in");
    const previousMessages = messageHistoryFull.filter((m) => m !== lastIn);
    const lastBefore = previousMessages[previousMessages.length - 1];
    const gapHours = lastBefore
      ? (Date.now() - lastBefore.createdAt.getTime()) / 36e5
      : 0;

    // Quem fez a última mensagem out (Luma ou atendente humano)?
    const lastOut = [...previousMessages].reverse().find((m) => m.direction === "out");
    const lastHumanAgent = lastOut?.sentByUser?.name ?? null;
    const lastOutFromHuman = !!lastOut?.sentByUserId;

    // Gera resposta humanizada com IA (Luma - Pneuzero)
    const { response: botResponse, extractedData, cotacaoEnviada } = await generateAIResponse(text ?? "", {
      leadId: lead.id,
      organizationId: lead.organizationId,
      conversationId: conversation.id,
      leadName: lead.name,
      leadEmail: lead.email,
      leadCity: lead.city,
      leadPhone: lead.phone,
      leadStatus: lead.status,
      leadSummary: lead.summary,
      gapHours,
      lastOutFromHuman,
      lastHumanAgent,
      messageHistory,
    });
    
    // Salva resposta do bot SEMPRE — independente do envio Evolution dar certo.
    let sendStatus: string | null = null;
    let sendError: string | null = null;
    try {
      await evolutionSendTextHumanized({ number: phone, text: botResponse });
      sendStatus = "sent";
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
      sendStatus = "failed";

      // Número não tem WhatsApp — marca lead como PERDIDO e não retenta.
      if (err instanceof EvolutionInvalidNumberError) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: "PERDIDO",
            notes: `${lead.notes ?? ""}\n[${new Date().toISOString()}] Número sem WhatsApp ativo (Evolution exists:false).`.trim(),
            followUpOptOut: true,
          },
        });
        console.warn(`[webhook] Lead ${lead.id} (${lead.phone}) marcado PERDIDO — número sem WhatsApp`);
      } else {
        console.error("Erro ao enviar resposta do bot via Evolution:", err);
      }
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "out",
        type: "text",
        body: botResponse,
        status: sendStatus,
        sentAt: sendStatus === "sent" ? new Date() : null,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), unreadCount: 0 },
    });

    try {
      // Calcula e persiste o Lead Score (0–1.000)
      const scoreBreakdown = await updateLeadScore(lead.id, messageHistory, text ?? "");
      console.log(`Lead ${lead.id} score: ${scoreBreakdown.total}/1000 (P:${scoreBreakdown.perfil} N:${scoreBreakdown.necessidade} C:${scoreBreakdown.consciencia} B:${scoreBreakdown.comportamento} D:${scoreBreakdown.decisao})`);

      // Detecta status por keywords + sinais de tools (cotação enviada)
      const detectedStatus = detectLeadStatus(
        messageHistory,
        text ?? "",
        lead.status,
        { cotacaoEnviada: cotacaoEnviada ?? false }
      );

      // Se keywords detectaram mudança, usa keyword; senão usa score para sugerir
      let newStatus: string | null = detectedStatus;
      if (!newStatus) {
        const scoreStatus = getStatusFromScore(scoreBreakdown.total);
        // Só avança pelo score (não regride), e não sobrescreve status manuais/especiais
        const protectedStatuses = ["FECHADO", "PERDIDO", "HUMANO_SOLICITADO", "HUMANO_EM_ATENDIMENTO", "AGUARDANDO_RESPOSTA", "LEAD_FRIO"];
        if (!protectedStatuses.includes(lead.status) && scoreStatus !== lead.status) {
          // Score só avança: NOVO → EM_ATENDIMENTO → CONSCIENTIZADO → QUALIFICADO → EM_NEGOCIACAO
          const statusOrder = ["NOVO", "EM_ATENDIMENTO", "CONSCIENTIZADO", "QUALIFICADO", "EM_NEGOCIACAO", "HUMANO_SOLICITADO"];
          const currentIdx = statusOrder.indexOf(lead.status);
          const newIdx = statusOrder.indexOf(scoreStatus);
          if (newIdx > currentIdx) {
            newStatus = scoreStatus;
          }
        }
      }
      
      if (newStatus && newStatus !== lead.status) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: newStatus as LeadStatus },
        });
        console.log(`Lead ${lead.id} status atualizado: ${lead.status} → ${newStatus} (score: ${scoreBreakdown.total})`);
      }

      // Gera resumo da conversa a cada 5 mensagens do lead (não bloqueia resposta)
      const leadMsgCount = messageHistory.filter((m) => m.direction === "in").length;
      if (leadMsgCount > 0 && leadMsgCount % 5 === 0) {
        generateConversationSummary(messageHistory, lead.name)
          .then(async (summary) => {
            if (summary) {
              await prisma.lead.update({
                where: { id: lead.id },
                data: { summary },
              });
              console.log(`Lead ${lead.id} resumo atualizado`);
            }
          })
          .catch((err) => console.error("Erro ao gerar resumo:", err));
      }
    } catch (postProcessErr) {
      console.error("Erro no pós-processamento (score/status/summary):", postProcessErr);
    }

    return NextResponse.json({
      ok: true,
      action: "bot_replied",
      sendStatus,
      sendError,
      extractedData,
    });
  } catch (error) {
    console.error("Webhook Evolution error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
