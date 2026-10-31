import { apiRequest } from "./client";

/** Tipos de imagem aceitos pela API (validados por conteúdo no backend). */
export const TIPOS_IMAGEM_ACEITOS: string[] = ["image/jpeg", "image/png", "image/webp"];

/** Tamanho máximo do arquivo de imagem (5 MB), alinhado ao contrato da API. */
export const TAMANHO_MAX_IMAGEM = 5 * 1024 * 1024;

export const imagensService = {
  /**
   * Sobe uma imagem de produto para `POST /imagens` (multipart/form-data, campo
   * "arquivo") e devolve a URL pública. Use essa URL como `fotoUrl` ao
   * criar/atualizar o produto.
   *
   * Requer Bearer com a permissão `produtos:escrever` (401 anônimo, 403 sem
   * permissão) — o `apiRequest` injeta o token e trata o 401 com refresh.
   * Não setamos `Content-Type`: com FormData o browser monta o multipart.
   */
  async upload(file: File): Promise<string> {
    const form = new FormData();
    form.append("arquivo", file);
    const res = await apiRequest<{ url: string }>("/imagens", {
      method: "POST",
      body: form,
    });
    return res.url;
  },
};
