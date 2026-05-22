/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Posta mensagens automáticas (do Max bot) no canal Geral do /equipe.
 * Usa um User especial "Max" da org como autor. Cria se não existir.
 */

import { prisma } from "./prisma";
import { teamBus } from "./team-bus";

const MAX_BOT_EMAIL_SUFFIX = "@max-bot.local"; // email reservado pro user system

async function getOrCreateMaxBotUser(organizationId: string): Promise<{ id: string; name: string; avatar: string | null }> {
  const email = `max${MAX_BOT_EMAIL_SUFFIX}.${organizationId}`;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, avatar: true },
  });
  if (existing) return existing;

  // bcrypt hash de senha aleatória inutilizável (bot não loga)
  const inertHash = "$2a$10$" + "x".repeat(53);
  return prisma.user.create({
    data: {
      organizationId,
      name: "Max",
      email,
      passwordHash: inertHash,
      role: "VIEWER",
      avatar: null,
      active: false, // não aparece em /api/team/users (esse filtra active=true)
    },
    select: { id: true, name: true, avatar: true },
  });
}

/**
 * Posta mensagem do bot Max no canal Geral da organização.
 * Não bloqueia o fluxo principal — qualquer erro só loga.
 */
export async function postBotToGeneral(organizationId: string, body: string): Promise<void> {
  try {
    const max = await getOrCreateMaxBotUser(organizationId);
    const created = await prisma.teamMessage.create({
      data: {
        organizationId,
        authorId: max.id,
        dmKey: null,
        body: body.slice(0, 4000),
      },
    });
    teamBus.publish({
      type: "message",
      organizationId,
      message: {
        id: created.id,
        authorId: max.id,
        authorName: max.name,
        authorAvatar: max.avatar,
        dmKey: null,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[team-bot] falha ao postar Geral:", err);
  }
}
