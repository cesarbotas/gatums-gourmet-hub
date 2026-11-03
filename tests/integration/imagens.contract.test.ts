import { describe, it, expect } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do endpoint de upload de imagens contra a API
// local real. Validam o SHAPE da resposta e a autorização (não a regra de
// negócio). Rodam SÓ via `npm run test:integration`.
//
// Contrato (ver docs/Site/Guia-Integracao-Front.md):
//   POST /imagens  — multipart/form-data, campo "arquivo"
//     Bearer com permissão `produtos:escrever`
//     201 → { url: string }
//     401 anônimo, 403 sem permissão
//     Tipos aceitos: JPEG/PNG/WebP; máx 5 MB
//
// Guardas de segurança (ver helpers.ts): allowlist local+HML + skip se offline.

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API. Testes de contrato de imagens PULADOS.`,
  );
}

/** PNG 1x1 transparente mínimo (bytes reais → passa na validação por conteúdo). */
function pngUmPorUm(): Uint8Array {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function fotoFormData(): FormData {
  const fd = new FormData();
  const blob = new Blob([pngUmPorUm()], { type: "image/png" });
  fd.append("arquivo", new File([blob], "pixel.png", { type: "image/png" }));
  return fd;
}

describe.skipIf(!online)("contrato: upload de imagens", () => {
  it(
    "POST /imagens com Bearer admin + arquivo PNG → 201 com { url }",
    async () => {
      const token = await loginAdmin();
      const resp = await fetch(`${baseUrl()}/imagens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fotoFormData(),
      });

      expect(resp.status).toBe(201);

      const body = await resp.json();
      expect(body).not.toBeNull();
      expect(typeof body).toBe("object");
      expect(typeof body.url).toBe("string");
      expect(body.url.length).toBeGreaterThan(0);
    },
    20000,
  );

  it("POST /imagens SEM Authorization → 401", async () => {
    const resp = await fetch(`${baseUrl()}/imagens`, {
      method: "POST",
      body: fotoFormData(),
    });
    expect(resp.status).toBe(401);
  });
});
