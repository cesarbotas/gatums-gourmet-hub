export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "https://gatumsgourmet.com.br/api/v1";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
