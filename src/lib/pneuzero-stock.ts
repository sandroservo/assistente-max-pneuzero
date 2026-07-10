/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cliente da API externa Pneuzero — endpoint otimizado /api/products.
 * Usa GET /api/products com search multi-palavra, medida, codigo,
 * pagination, cache de 2min da API + compressão GZIP.
 * Campos: id, codigo, descricao, estoque.
 */

const API_URL = process.env.PNEUZERO_API_URL;
const API_KEY = process.env.PNEUZERO_API_KEY;

export interface ProdutoEstoque {
  id: number;
  codigo: string | null;
  proDescricao: string; // mantém nome legado pra callers existentes
  zzz_proEstoqueAtual: number; // mantém nome legado
}

interface ProductRow {
  id?: number;
  codigo?: string | null;
  descricao?: string;
  estoque?: number;
}

interface ProductsResponse {
  products?: ProductRow[];
  data?: ProductRow[];
  pagination?: {
    total?: number;
    total_pages?: number;
    page?: number;
    per_page?: number;
    has_next?: boolean;
    has_prev?: boolean;
  };
  total?: number;
  error?: string;
}

export interface SearchOptions {
  limit?: number;
  apenasDisponivel?: boolean;
  orderBy?: "id" | "codigo" | "descricao" | "estoque";
  orderDir?: "ASC" | "DESC";
  medida?: string;
  codigo?: string;
  apenasPneu?: boolean;
}

function mapProductRow(p: ProductRow): ProdutoEstoque {
  return {
    id: Number(p.id ?? 0),
    codigo: p.codigo ?? null,
    proDescricao: p.descricao ?? "",
    zzz_proEstoqueAtual: Number(p.estoque ?? 0),
  };
}

function buildApiUrl(params: URLSearchParams): string {
  return `${API_URL!.replace(/\/$/, "")}/api/products?${params.toString()}`;
}

async function fetchProducts(
  params: URLSearchParams,
  timeoutMs = 15_000
): Promise<{ ok: true; produtos: ProdutoEstoque[]; total: number } | { ok: false; error: string }> {
  if (!API_URL || !API_KEY) {
    return { ok: false, error: "Pneuzero API não configurada (PNEUZERO_API_URL/PNEUZERO_API_KEY)" };
  }

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(buildApiUrl(params), {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
        "Accept-Encoding": "gzip",
        Accept: "application/json",
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
    const items = json.products ?? json.data ?? [];
    const total = json.pagination?.total ?? json.total ?? items.length;
    return { ok: true, produtos: items.map(mapProductRow), total };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha ao consultar Pneuzero API: ${msg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildSearchParams(termo: string, opts: SearchOptions): URLSearchParams {
  const perPage = Math.min(Math.max(opts.limit ?? 30, 1), 500);
  const params = new URLSearchParams({
    per_page: String(perPage),
    fields: "id,codigo,descricao,estoque",
    order_by: opts.orderBy ?? "descricao",
    order_dir: opts.orderDir ?? "ASC",
  });

  const cleaned = termo.trim().slice(0, 120);
  if (cleaned) params.set("search", cleaned);
  if (opts.medida) params.set("medida", opts.medida.trim().slice(0, 40));
  if (opts.codigo) params.set("codigo", opts.codigo.trim().slice(0, 50));
  if (opts.apenasDisponivel) params.set("in_stock", "true");
  if (opts.apenasPneu) params.set("apenas_pneu", "true");

  return params;
}

export async function buscarProdutosPorDescricao(
  termo: string,
  limitOrOpts: number | SearchOptions = 30
): Promise<{ ok: true; produtos: ProdutoEstoque[]; total: number } | { ok: false; error: string }> {
  const opts: SearchOptions =
    typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts;
  const cleaned = termo.trim().slice(0, 120);
  if (!cleaned && !opts.medida && !opts.codigo) {
    return { ok: false, error: "Termo vazio" };
  }

  const result = await fetchProducts(buildSearchParams(cleaned, opts));
  return result;
}

/**
 * Busca pneus no ERP por medida (e marca opcional na descrição).
 */
export async function buscarPneusPorMedida(
  medida: string,
  opts: { marca?: string; limit?: number; apenasDisponivel?: boolean } = {}
): Promise<{ ok: true; produtos: ProdutoEstoque[]; total: number } | { ok: false; error: string }> {
  const cleanedMedida = medida.trim().slice(0, 40);
  if (!cleanedMedida) {
    return { ok: false, error: "Medida vazia" };
  }

  const searchOpts: SearchOptions = {
    medida: cleanedMedida,
    apenasPneu: true,
    apenasDisponivel: opts.apenasDisponivel ?? true,
    limit: opts.limit ?? 15,
    orderBy: "descricao",
    orderDir: "ASC",
  };

  // Marca vira palavra extra na busca (ex: GOODYEAR, PIRELLI)
  const termo = opts.marca?.trim() ?? "";
  const result = await fetchProducts(buildSearchParams(termo, searchOpts));
  if (!result.ok) return result;

  // Fallback: se medida+marca não achou nada, tenta só medida
  if (result.produtos.length === 0 && termo) {
    return fetchProducts(buildSearchParams("", { ...searchOpts, limit: opts.limit ?? 15 }));
  }

  return result;
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
        Accept: "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const raw = (await res.json()) as ProductRow & { data?: ProductRow; error?: string };
    if (raw.error) return { ok: false, error: raw.error };
    const p: ProductRow = raw.data ?? raw;
    if (p.id == null && p.descricao == null) return { ok: false, error: "produto não encontrado" };
    return { ok: true, produto: mapProductRow(p) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha: ${msg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}
