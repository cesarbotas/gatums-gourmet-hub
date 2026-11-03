import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  imagensService,
  TIPOS_IMAGEM_ACEITOS,
  TAMANHO_MAX_IMAGEM,
} from "@/lib/api/imagens";
import { ApiError } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";

// --- Helpers ---------------------------------------------------------------

function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function seedSession(accessToken = "tok-abc") {
  window.localStorage.setItem(
    "gg.session",
    JSON.stringify({
      accessToken,
      refreshToken: "r",
      user: { id: "1", nome: "X", email: "e@e", roles: ["Admin"] },
    }),
  );
}

function makeFile(type = "image/png", size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], "foto.png", { type });
}

// --- Setup -----------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window.location, "assign").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- Constantes do contrato ------------------------------------------------

describe("constantes de imagem", () => {
  it("aceita JPEG, PNG e WebP", () => {
    expect(TIPOS_IMAGEM_ACEITOS).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("limita o tamanho a 5 MB", () => {
    expect(TAMANHO_MAX_IMAGEM).toBe(5 * 1024 * 1024);
  });
});

// --- upload ----------------------------------------------------------------

describe("imagensService.upload", () => {
  it("faz POST /imagens com FormData (campo 'arquivo') e devolve a url", async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(
      fakeResponse(201, { url: "https://cdn.exemplo/img/foto.png" }),
    );

    const url = await imagensService.upload(makeFile());

    expect(url).toBe("https://cdn.exemplo/img/foto.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${API_BASE_URL}/imagens`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect(fd.get("arquivo")).toBeInstanceOf(File);
    expect((fd.get("arquivo") as File).name).toBe("foto.png");
  });

  it("não define Content-Type application/json para FormData", async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(fakeResponse(201, { url: "https://x/y.png" }));

    await imagensService.upload(makeFile());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("injeta o Bearer token da sessão", async () => {
    seedSession("tok-xyz");
    fetchMock.mockResolvedValueOnce(fakeResponse(201, { url: "https://x/y.png" }));

    await imagensService.upload(makeFile());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok-xyz");
  });

  it("relança ApiError quando a API responde erro de validação (400)", async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(
      fakeResponse(400, { detail: "Arquivo inválido." }),
    );

    await expect(imagensService.upload(makeFile())).rejects.toThrow(ApiError);
  });
});
