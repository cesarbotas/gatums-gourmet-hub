export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://gatumsgourmet.com.br/api/v1";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

// --- Paginação (adaptação de borda) ---------------------------------------
// A API usa o contrato: request `?pagina=&tamanho=`; response
// `{ itens, totalRegistros, paginaAtual, tamanhoPagina, totalPaginas, ... }`.
// O front mantém internamente `PaginatedResponse<T>` (items/total/page/pageSize).
// Estes helpers traduzem nos dois sentidos, em um único lugar, para as telas
// não precisarem conhecer o contrato da API.

/**
 * Preenche um URLSearchParams com os parâmetros de paginação no formato da API
 * (`pagina`/`tamanho`) a partir de page/pageSize (defaults 1/10).
 */
export function appendPageParams(
  qs: URLSearchParams,
  params: { page?: number; pageSize?: number } = {},
): { page: number; pageSize: number } {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  qs.set("pagina", String(page));
  qs.set("tamanho", String(pageSize));
  return { page, pageSize };
}

/**
 * Traduz a resposta paginada da API para o `PaginatedResponse<T>` interno,
 * aplicando `mapItem` a cada item. Tolera o formato antigo (`items`/`total`/...)
 * como fallback, para não quebrar se algum endpoint ainda não migrou.
 */
export function mapPaginated<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res: any,
  mapItem: (raw: unknown) => T,
  fallback: { page: number; pageSize: number },
): PaginatedResponse<T> {
  const rawItems: unknown[] = res?.itens ?? res?.items ?? (Array.isArray(res) ? res : []);
  const items = rawItems.map(mapItem);
  return {
    items,
    total: res?.totalRegistros ?? res?.total ?? items.length,
    page: res?.paginaAtual ?? res?.page ?? fallback.page,
    pageSize: res?.tamanhoPagina ?? res?.pageSize ?? fallback.pageSize,
  };
}
