import { describe, it, expect } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl } from "./helpers";

// Testes INTEGRADOS de contrato do endpoint de busca de CEP contra a API local
// real. Validam o SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ
// via `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip) com mensagem
//    clara em vez de falhar por erro de conexão.
//
// PARTICULARIDADE: este endpoint é PÚBLICO (como o catálogo) — NÃO exige Bearer.
// Os testes propositalmente NÃO enviam Authorization, para provar que funciona
// anônimo.
//
// Shape documentado de GET /enderecos/cep/{cep} (API encapsula o ViaCEP):
//   { cep, logradouro, complemento: string|null, bairro, cidade, estado }
//   (não há `numero` — o usuário preenche no formulário)
//
// Erros de negócio → HTTP 400 ProblemDetails { detail, status }:
//   "CEP inválido." | "CEP não encontrado." | "Serviço de CEP indisponível."

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de CEP PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: busca de CEP (público)", () => {
  it("GET /enderecos/cep/{cep} válido (sem token) → 200 com shape de endereço", async () => {
    // Sem Authorization de propósito: o endpoint é público.
    const resp = await fetch(`${baseUrl()}/enderecos/cep/01001000`);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body).not.toBeNull();
    expect(typeof body).toBe("object");

    // Campos do EnderecoResponse (sem numero/id/clienteId).
    expect(typeof body.cep).toBe("string");
    expect(typeof body.logradouro).toBe("string");
    expect(typeof body.bairro).toBe("string");
    expect(typeof body.cidade).toBe("string");
    expect(typeof body.estado).toBe("string");
    // complemento pode vir null.
    expect(body).toHaveProperty("complemento");
    // numero NÃO é retornado pelo endpoint.
    expect("numero" in body).toBe(false);
  });

  it("GET /enderecos/cep/{cep} aceita CEP com máscara (normaliza para 8 dígitos) → 200", async () => {
    const resp = await fetch(`${baseUrl()}/enderecos/cep/01001-000`);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(typeof body.cidade).toBe("string");
  });

  it("GET /enderecos/cep/{cep} inexistente → 400 ProblemDetails", async () => {
    const resp = await fetch(`${baseUrl()}/enderecos/cep/00000000`);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    // ProblemDetails: mensagem de negócio em `detail`.
    expect(typeof body.detail).toBe("string");
  });

  it("GET /enderecos/cep/{cep} malformado → 400 (CEP inválido)", async () => {
    const resp = await fetch(`${baseUrl()}/enderecos/cep/123`);
    expect(resp.status).toBe(400);
  });
});
