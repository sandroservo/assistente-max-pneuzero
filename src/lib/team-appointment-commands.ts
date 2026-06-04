/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Comandos do chat interno para resolver solicitações de agendamento.
 */

import { approveAppointmentRequest, rejectAppointmentRequest } from "./appointment-requests";
import { formatBR } from "./appointments";
import { prisma } from "./prisma";

type AppointmentCommand =
  | { action: "approve"; requestToken: string; note?: string }
  | { action: "reject"; requestToken: string; note: string; alternativaTexto?: string };

export interface TeamAppointmentCommandResult {
  handled: boolean;
  ok?: boolean;
  message?: string;
  requestId?: string;
}

const TOKEN_RE = /#?([a-z0-9]{6,32})/i;
const TOKEN_PATTERN = TOKEN_RE.source;

export function parseTeamAppointmentCommand(text: string): AppointmentCommand | null {
  const normalized = text.trim().replace(/\s+/g, " ");

  const approve = normalized.match(
    new RegExp(`^(?:aprovar|aprova|confirmar|confirma|liberar|libera)\\s+${TOKEN_PATTERN}(?:\\s+(.+))?$`, "i")
  );
  if (approve) {
    return {
      action: "approve",
      requestToken: approve[1],
      note: approve[2]?.trim(),
    };
  }

  const reject = normalized.match(
    new RegExp(`^(?:recusar|recusa|negar|nega|indisponivel|indisponível)\\s+${TOKEN_PATTERN}(?:\\s+(.+))?$`, "i")
  );
  if (reject) {
    const note = reject[2]?.trim() || "Horário indisponível";
    return {
      action: "reject",
      requestToken: reject[1],
      note,
    };
  }

  const offer = normalized.match(
    new RegExp(`^(?:oferecer|oferece|sugerir|sugere|alternativa)\\s+${TOKEN_PATTERN}\\s+(.+)$`, "i")
  );
  if (offer) {
    const alternative = offer[2].trim();
    return {
      action: "reject",
      requestToken: offer[1],
      note: "Horário solicitado indisponível",
      alternativaTexto: `Não consegui aquele horário, mas temos esta alternativa: ${alternative}. Pode ser?`,
    };
  }

  return null;
}

async function resolveRequestId(organizationId: string, token: string): Promise<string | null> {
  const matches = await prisma.appointmentRequest.findMany({
    where: {
      organizationId,
      status: "pending",
      id: { startsWith: token },
    },
    select: { id: true },
    take: 2,
  });

  if (matches.length !== 1) return null;
  return matches[0].id;
}

export async function handleTeamAppointmentCommand(input: {
  organizationId: string;
  userId: string;
  text: string;
}): Promise<TeamAppointmentCommandResult> {
  const command = parseTeamAppointmentCommand(input.text);
  if (!command) return { handled: false };

  const requestId = await resolveRequestId(input.organizationId, command.requestToken);
  if (!requestId) {
    return {
      handled: true,
      ok: false,
      message:
        "Não encontrei uma solicitação pendente com esse ID. Confira o código curto que a Luma mandou no pedido.",
    };
  }

  if (command.action === "approve") {
    const result = await approveAppointmentRequest(requestId, {
      resolvedById: input.userId,
      note: command.note,
    });
    return {
      handled: true,
      ok: true,
      requestId,
      message: `Solicitação aprovada. Avisei o cliente sobre ${result.appointment.serviceName} em ${formatBR(result.appointment.scheduledAt)}.`,
    };
  }

  const result = await rejectAppointmentRequest(requestId, {
    resolvedById: input.userId,
    note: command.note,
    alternativaTexto: command.alternativaTexto,
  });
  return {
    handled: true,
    ok: true,
    requestId,
    message: `Solicitação resolvida como indisponível. Avisei o cliente sobre ${result.serviceName} em ${formatBR(result.requestedAt)}.`,
  };
}
