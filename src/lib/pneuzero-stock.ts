/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cliente da API externa Pneuzero (Flasgger SQL gateway).
 * Consulta tabela `produto` do ERP por descrição e retorna estoque atual.
 */

const API_URL = process.env.PNEUZERO_API_URL;
const API_KEY = process.env.PNEUZERO_API_KEY;
const DATABASE = process.env.PNEUZERO_API_DATABASE ?? "MAX";

export interface ProdutoEstoque {
  proDescricao: string;
  zzz_proEstoqueAtual: number;
}

interface QueryResponse {
  data?: ProdutoEstoque[];
  error?: string;
  row_count?: number;
}

function escapeSqlLike(termo: string): string {
  // SQL Server: escape ' (dobra), e wildcards [ % _ via colchetes para LIKE literal
  return termo
    .replace(/'/g, "''")
    .replace(/\[/g, "[[]")
    .replace(/%/g, "[%]")
    .replace(/_/g, "[_]");
}

export async function buscarProdutosPorDescricao(
  termo: string,
  limit = 20
): Promise<{ ok: true; produtos: ProdutoEstoque[] } | { ok: false; error: string }> {
  if (!API_URL || !API_KEY) {
    return { ok: false, error: "Pneuzero API não configurada (PNEUZERO_API_URL/PNEUZERO_API_KEY)" };
  }

  const cleaned = termo.trim().slice(0, 100);
  if (!cleaned) {
    return { ok: false, error: "Termo vazio" };
  }

  const safe = escapeSqlLike(cleaned);
  const top = Math.min(Math.max(limit, 1), 50);
  const sql = `SELECT TOP ${top} proDescricao, zzz_proEstoqueAtual FROM produto WHERE proDescricao LIKE '%${safe}%' ORDER BY proDescricao`;

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify({ database: DATABASE, sql, max_rows: top }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    const json = (await res.json()) as QueryResponse;
    if (json.error) return { ok: false, error: json.error };
    return { ok: true, produtos: json.data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha ao consultar Pneuzero API: ${msg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}
