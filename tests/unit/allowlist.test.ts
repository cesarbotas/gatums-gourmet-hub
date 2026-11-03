// Teste PURO (sem rede) da allowlist de ambiente dos testes de contrato.
//
// Este é o PINO DE SEGURANÇA: garante que `hostPermitido` só libera os
// ambientes local e HML, e recusa PROD, hosts desconhecidos e subdomínios
// arbitrários. Roda no `npm test` padrão (happy-dom), sem tocar a rede.
//
// `hostPermitido` é importada de `tests/integration/helpers` — é apenas um
// import de módulo (função pura), não a execução dos testes de integração, que
// o vitest unitário exclui via `exclude`.
import { describe, it, expect } from "vitest";
import { hostPermitido } from "../integration/helpers";

describe("hostPermitido (allowlist de ambiente)", () => {
  it("libera localhost", () => {
    expect(hostPermitido("localhost")).toBe(true);
  });

  it("libera 127.0.0.1", () => {
    expect(hostPermitido("127.0.0.1")).toBe(true);
  });

  it("libera o host de homologacao (onrender)", () => {
    expect(hostPermitido("gatums-gourmet-api.onrender.com")).toBe(true);
  });

  it("BLOQUEIA producao (gatumsgourmet.com.br)", () => {
    expect(hostPermitido("gatumsgourmet.com.br")).toBe(false);
  });

  it("BLOQUEIA host desconhecido", () => {
    expect(hostPermitido("evil.com")).toBe(false);
  });

  it("BLOQUEIA subdominio arbitrario de host permitido (match exato)", () => {
    expect(hostPermitido("sub.gatums-gourmet-api.onrender.com")).toBe(false);
  });
});
