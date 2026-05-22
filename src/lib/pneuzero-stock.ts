/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cliente da API externa Pneuzero — endpoint otimizado /api/products.
 * Substitui a query SQL manual: usa GET /api/products com search + fields +
 * pagination, aproveita cache de 2min da API + compressão GZIP + connection
 * pooling no lado servidor. Campos amigáveis: id, codigo, descricao, estoque.
 */

const API_URL = process.env.PNEUZERO_API_URL;
const API_KEY = process.env.PNEUZERO_API_KEY;

export interface ProdutoEstoque {
  id: number;
  codigo: string | null;
  proDescricao: string; // mantém nome legado pra callers existentes
  zzz_proEstoqueAtual: number; // mantém nome legado
}

interface ProductsResponse {
  data?: Array<{
    id?: number;
    codigo?: string | null;
    descricao?: string;
    estoque?: number;
  }>;
  error?: string;
  total?: number;
  total_pages?: number;
  page?: number;
  per_page?: number;
}

interface SearchOptions {
  limit?: number;
  apenasDisponivel?: boolean; // filtra estoque > 0 (usa in_stock=true)
  orderBy?: "id" | "codigo" | "descricao" | "estoque";
  orderDir?: "ASC" | "DESC";
}

export async function buscarProdutosPorDescricao(
  termo: string,
  limitOrOpts: number | SearchOptions = 30
): Promise<{ ok: true; produtos: ProdutoEstoque[]; total: number } | { ok: false; error: string }> {
  if (!API_URL || !API_KEY) {
    return { ok: false, error: "Pneuzero API não configurada (PNEUZERO_API_URL/PNEUZERO_API_KEY)" };
  }

  const opts: SearchOptions =
    typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts;
  const cleaned = termo.trim().slice(0, 120);
  if (!cleaned) {
    return { ok: false, error: "Termo vazio" };
  }

  const perPage = Math.min(Math.max(opts.limit ?? 30, 1), 500);
  const params = new URLSearchParams({
    search: cleaned,
    per_page: String(perPage),
    fields: "id,codigo,descricao,estoque",
    order_by: opts.orderBy ?? "descricao",
    order_dir: opts.orderDir ?? "ASC",
  });
  if (opts.apenasDisponivel) params.set("in_stock", "true");

  const url = `${API_URL.replace(/\/$/, "")}/api/products?${params.toString()}`;
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
        "Accept-Encoding": "gzip",
        "Accept": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    const json = (await res.json()) as ProductsResponse;
    if (json.error) return { ok: false, error: json.error };
    const items = json.data ?? [];
    const produtos: ProdutoEstoque[] = items.map((p) => ({
      id: Number(p.id ?? 0),
      codigo: p.codigo ?? null,
      proDescricao: p.descricao ?? "",
      zzz_proEstoqueAtual: Number(p.estoque ?? 0),
    }));
    return { ok: true, produtos, total: json.total ?? produtos.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha ao consultar Pneuzero API: ${msg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Busca rápida por ID — útil pra confirmar produto específico antes de cotar.
 */
export async function buscarProdutoPorId(
  id: number
): Promise<{ ok: true; produto: ProdutoEstoque } | { ok: false; error: string }> {
  if (!API_URL || !API_KEY) {
    return { ok: false, error: "Pneuzero API não configurada" };
  }
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/products/${id}`, {
      headers: {
        "X-API-Key": API_KEY,
        "Accept-Encoding": "gzip",
        "Accept": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const json = (await res.json()) as { data?: { id?: number; codigo?: string | null; descricao?: string; estoque?: number }; error?: string };
    if (json.error || !json.data) return { ok: false, error: json.error ?? "produto não encontrado" };
    const p = json.data;
    return {
      ok: true,
      produto: {
        id: Number(p.id ?? id),
        codigo: p.codigo ?? null,
        proDescricao: p.descricao ?? "",
        zzz_proEstoqueAtual: Number(p.estoque ?? 0),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha: ${msg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}
