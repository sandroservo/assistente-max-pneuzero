/**
 * Cliente para APIs externas (cobrança, etc.)
 * Usado pelo Max para consultar dados em tempo real.
 *
 * Env: AMOVIDAS_API_URL, AMOVIDAS_AGENT_TOKEN
 */

const BASE = process.env.AMOVIDAS_API_URL || "https://amovidas.com.br";
const TOKEN = process.env.AMOVIDAS_AGENT_TOKEN;

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

export function hasCobrancaToken(): boolean {
  return !!TOKEN;
}

export interface ClienteVencido {
  customerName: string;
  value: number;
  daysOverdue: number;
  dueDate: string;
  phone: string | null;
  userId: number | null;
}

export async function listarClientesVencidos(): Promise<{
  ok: boolean;
  clients?: ClienteVencido[];
  total?: number;
  error?: string;
}> {
  if (!TOKEN) {
    return { ok: false, error: "AMOVIDAS_AGENT_TOKEN não configurado" };
  }
  try {
    const res = await fetch(`${BASE}/api/agent/cobranca/overdue`, {
      method: "GET",
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      clients: (data as { clients?: ClienteVencido[] }).clients || [],
      total: (data as { total?: number }).total ?? 0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
