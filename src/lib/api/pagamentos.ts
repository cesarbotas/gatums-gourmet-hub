/**
 * Camada de pagamentos — contratos alinhados à API REST.
 * Em desenvolvimento usa mock local (localStorage) com o mesmo formato de resposta.
 * Ver docs/integracao-pagamentos.REFERENCE.md para operadoras reais.
 */
import QRCode from "qrcode";
import { z } from "zod";
import { readStore, writeStore, uid } from "./storage";
import { apiRequest, ApiError } from "./client";

const TRANSACOES_KEY = "gg.pagamentos.transacoes";
const MOCK_MODE =
  (import.meta.env.VITE_PAYMENTS_MOCK as string | undefined) === "true";

const METODO_FROM_INT: Record<number, MetodoPagamento> = {
  0: "cartao_debito",
  1: "cartao_credito",
  2: "pix",
};

const STATUS_FROM_INT: Record<number, StatusTransacao> = {
  0: "criada",
  1: "aguardando_pagamento",
  2: "processando",
  3: "aprovada",
  4: "recusada",
  5: "expirada",
  6: "cancelada",
};

/**
 * A API representa `metodo` de 3 formas (ver Postman — "Inconsistência de formato"):
 * inteiro (enum), "cartao_credito" (opcoes) e "cartaocredito" (TransacaoResponse).
 */
function normalizeMetodo(v: unknown): MetodoPagamento {
  if (typeof v === "number") return METODO_FROM_INT[v] ?? "pix";
  const s = String(v ?? "").toLowerCase().replace(/[_\s-]/g, "");
  if (s === "cartaodebito") return "cartao_debito";
  if (s === "cartaocredito") return "cartao_credito";
  return "pix";
}

function normalizeStatus(v: unknown): StatusTransacao {
  if (typeof v === "number") return STATUS_FROM_INT[v] ?? "criada";
  const s = String(v ?? "").toLowerCase().replace(/[_\s-]/g, "");
  const map: Record<string, StatusTransacao> = {
    criada: "criada",
    aguardandopagamento: "aguardando_pagamento",
    processando: "processando",
    aprovada: "aprovada",
    recusada: "recusada",
    expirada: "expirada",
    cancelada: "cancelada",
  };
  return map[s] ?? "criada";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransacao(raw: any): TransacaoPagamento {
  const t: TransacaoPagamento = {
    id: raw.id,
    pedidoId: raw.pedidoId,
    metodo: normalizeMetodo(raw.metodo),
    valor: raw.valor ?? 0,
    status: normalizeStatus(raw.status),
    criadoEm: raw.criadoEm ?? new Date().toISOString(),
    atualizadoEm: raw.atualizadoEm ?? raw.criadoEm ?? new Date().toISOString(),
    operadora: raw.operadora ?? "",
    operadoraRef: raw.operadoraRef,
    pixCopiaCola: raw.pixCopiaCola,
    pixQrCodeDataUrl: raw.pixQrCodeDataUrl,
    pixExpiraEm: raw.pixExpiraEm,
    cartaoUltimos4: raw.cartaoUltimos4,
    cartaoBandeira: raw.cartaoBandeira,
    mensagemErro: raw.mensagemErro,
  };
  if (t.metodo === "pix" && t.pixCopiaCola && !t.pixQrCodeDataUrl) {
    // QR gerado client-side se a API não devolver
    gerarQrPix(t.pixCopiaCola).then((url) => {
      t.pixQrCodeDataUrl = url;
      upsertTransacao(t);
    });
  }
  if (t.id) upsertTransacao(t);
  return t;
}

export type MetodoPagamento = "cartao_debito" | "cartao_credito" | "pix";

export type StatusTransacao =
  | "criada"
  | "aguardando_pagamento"
  | "processando"
  | "aprovada"
  | "recusada"
  | "expirada"
  | "cancelada";

export interface OpcaoPagamento {
  id: MetodoPagamento;
  label: string;
  descricao: string;
}

export const OPCOES_PAGAMENTO: OpcaoPagamento[] = [
  {
    id: "cartao_debito",
    label: "Cartão de débito",
    descricao: "Débito online — aprovação imediata na operadora",
  },
  {
    id: "cartao_credito",
    label: "Cartão de crédito",
    descricao: "Parcelamento conforme regras da operadora",
  },
  {
    id: "pix",
    label: "Pix",
    descricao: "QR Code com validação automática após confirmação",
  },
];

export interface TransacaoPagamento {
  id: string;
  pedidoId: string;
  metodo: MetodoPagamento;
  valor: number;
  status: StatusTransacao;
  criadoEm: string;
  atualizadoEm: string;
  operadora: string;
  operadoraRef?: string;
  pixCopiaCola?: string;
  pixQrCodeDataUrl?: string;
  pixExpiraEm?: string;
  cartaoUltimos4?: string;
  cartaoBandeira?: string;
  mensagemErro?: string;
}

const cartaoSchema = z.object({
  numero: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().min(13).max(19)),
  nome: z.string().min(3, "Nome no cartão inválido"),
  validade: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Validade MM/AA"),
  cvv: z.string().regex(/^\d{3,4}$/, "CVV inválido"),
});

function loadTransacoes(): TransacaoPagamento[] {
  return readStore<TransacaoPagamento[]>(TRANSACOES_KEY, []);
}

function saveTransacoes(list: TransacaoPagamento[]) {
  writeStore(TRANSACOES_KEY, list);
}

function getTransacao(id: string): TransacaoPagamento | null {
  return loadTransacoes().find((t) => t.id === id) ?? null;
}

function upsertTransacao(t: TransacaoPagamento) {
  const list = loadTransacoes().filter((x) => x.id !== t.id);
  saveTransacoes([t, ...list]);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number.parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function bandeiraCartao(num: string): string {
  if (num.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "Mastercard";
  if (num.startsWith("3")) return "Amex";
  if (num.startsWith("6")) return "Elo";
  return "Cartão";
}

/** Payload Pix simplificado (mock). Produção: BR Code + CRC16 conforme BACEN. */
function buildPixCopiaCola(pedidoId: string, valor: number): string {
  const valorFmt = valor.toFixed(2);
  const txid = pedidoId.replace(/-/g, "").slice(0, 25).toUpperCase().padEnd(25, "0");
  return [
    "00020126",
    "0014BR.GOV.BCB.PIX",
    `25${String(txid.length).padStart(2, "0")}${txid}`,
    "52040000",
    "5303986",
    `54${String(valorFmt.length).padStart(2, "0")}${valorFmt}`,
    "5802BR",
    "5913GATUMS GOURMET",
    "6009SAO PAULO",
    "62070503***",
    "6304DEMO",
  ].join("");
}

async function gerarQrPix(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { width: 220, margin: 2 });
}

function operadoraPorMetodo(metodo: MetodoPagamento): string {
  if (metodo === "pix") return "bacen_pix";
  if (metodo === "cartao_credito") return "gateway_credito";
  return "gateway_debito";
}

// ——— Mock handlers (mesmo contrato que a API REST) ———

async function mockIniciar(body: {
  pedidoId: string;
  metodo: MetodoPagamento;
  valor: number;
}): Promise<TransacaoPagamento> {
  await delay(400);
  const id = uid();
  const agora = new Date().toISOString();
  const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  let transacao: TransacaoPagamento = {
    id,
    pedidoId: body.pedidoId,
    metodo: body.metodo,
    valor: body.valor,
    status: body.metodo === "pix" ? "aguardando_pagamento" : "criada",
    criadoEm: agora,
    atualizadoEm: agora,
    operadora: operadoraPorMetodo(body.metodo),
    operadoraRef: `MOCK-${id.toUpperCase()}`,
  };

  if (body.metodo === "pix") {
    const copiaCola = buildPixCopiaCola(body.pedidoId, body.valor);
    transacao = {
      ...transacao,
      pixCopiaCola: copiaCola,
      pixQrCodeDataUrl: await gerarQrPix(copiaCola),
      pixExpiraEm: expira,
    };
  }

  upsertTransacao(transacao);
  return transacao;
}

async function mockProcessarCartao(
  transacaoId: string,
  dados: z.infer<typeof cartaoSchema>,
): Promise<TransacaoPagamento> {
  await delay(1200);
  const t = getTransacao(transacaoId);
  if (!t) throw new ApiError("Transação não encontrada", 404, "TRANSACAO_NAO_ENCONTRADA");
  if (t.metodo !== "cartao_debito" && t.metodo !== "cartao_credito") {
    throw new ApiError("Método inválido para cartão", 400, "METODO_INVALIDO");
  }

  const parsed = cartaoSchema.safeParse(dados);
  if (!parsed.success) {
    throw new ApiError(parsed.error.errors[0]?.message ?? "Dados inválidos", 422, "VALIDACAO");
  }

  const numero = parsed.data.numero;
  if (!luhnCheck(numero)) {
    const recusada: TransacaoPagamento = {
      ...t,
      status: "recusada",
      atualizadoEm: new Date().toISOString(),
      mensagemErro: "Número do cartão inválido (operadora recusou)",
    };
    upsertTransacao(recusada);
    throw new ApiError(recusada.mensagemErro!, 402, "CARTAO_RECUSADO");
  }

  // Demo: cartões terminados em 0000 são recusados
  if (numero.endsWith("0000")) {
    const recusada: TransacaoPagamento = {
      ...t,
      status: "recusada",
      atualizadoEm: new Date().toISOString(),
      mensagemErro: "Transação não autorizada pela operadora",
      cartaoUltimos4: numero.slice(-4),
      cartaoBandeira: bandeiraCartao(numero),
    };
    upsertTransacao(recusada);
    throw new ApiError(recusada.mensagemErro!, 402, "CARTAO_RECUSADO");
  }

  const aprovada: TransacaoPagamento = {
    ...t,
    status: "aprovada",
    atualizadoEm: new Date().toISOString(),
    cartaoUltimos4: numero.slice(-4),
    cartaoBandeira: bandeiraCartao(numero),
    operadoraRef: `AUTH-${uid().toUpperCase()}`,
  };
  upsertTransacao(aprovada);
  return aprovada;
}

async function mockConsultarStatus(transacaoId: string): Promise<TransacaoPagamento> {
  await delay(200);
  const t = getTransacao(transacaoId);
  if (!t) throw new ApiError("Transação não encontrada", 404, "TRANSACAO_NAO_ENCONTRADA");

  if (t.metodo === "pix" && t.status === "aguardando_pagamento") {
    const criado = new Date(t.criadoEm).getTime();
    // Simula confirmação Pix após ~8s (polling do cliente)
    if (Date.now() - criado > 8000) {
      const paga: TransacaoPagamento = {
        ...t,
        status: "aprovada",
        atualizadoEm: new Date().toISOString(),
        operadoraRef: `PIX-${uid().toUpperCase()}`,
      };
      upsertTransacao(paga);
      return paga;
    }
  }

  return t;
}

async function mockValidarAdmin(transacaoId: string): Promise<TransacaoPagamento> {
  await delay(300);
  const t = getTransacao(transacaoId);
  if (!t) throw new ApiError("Transação não encontrada", 404, "TRANSACAO_NAO_ENCONTRADA");
  if (t.status !== "aprovada") {
    throw new ApiError(
      "Pagamento ainda não confirmado pela operadora",
      409,
      "PAGAMENTO_PENDENTE",
    );
  }
  return t;
}

async function mockConfirmarPixCliente(transacaoId: string): Promise<TransacaoPagamento> {
  await delay(600);
  const t = getTransacao(transacaoId);
  if (!t) throw new ApiError("Transação não encontrada", 404, "TRANSACAO_NAO_ENCONTRADA");
  if (t.metodo !== "pix") throw new ApiError("Transação não é Pix", 400, "METODO_INVALIDO");

  const processando: TransacaoPagamento = {
    ...t,
    status: "processando",
    atualizadoEm: new Date().toISOString(),
  };
  upsertTransacao(processando);
  await delay(800);

  const aprovada: TransacaoPagamento = {
    ...processando,
    status: "aprovada",
    atualizadoEm: new Date().toISOString(),
    operadoraRef: `PIX-${uid().toUpperCase()}`,
  };
  upsertTransacao(aprovada);
  return aprovada;
}

// ——— Serviço público ———

const METODO_TO_INT: Record<MetodoPagamento, number> = {
  cartao_debito: 0,
  cartao_credito: 1,
  pix: 2,
};

export const pagamentosService = {
  listarOpcoes(): OpcaoPagamento[] {
    return OPCOES_PAGAMENTO;
  },

  async listarOpcoesRemoto(): Promise<OpcaoPagamento[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiRequest<any>("/pagamentos/opcoes");
      const items = Array.isArray(res) ? res : res.items ?? [];
      if (!items.length) return OPCOES_PAGAMENTO;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return items.map((o: any) => ({
        id: typeof o.id === "number" ? METODO_FROM_INT[o.id] : o.id,
        label: o.label ?? o.nome ?? "",
        descricao: o.descricao ?? "",
      }));
    } catch {
      return OPCOES_PAGAMENTO;
    }
  },

  async iniciar(pedidoId: string, metodo: MetodoPagamento, valor: number): Promise<TransacaoPagamento> {
    const body = { pedidoId, metodo: METODO_TO_INT[metodo], valor };
    if (MOCK_MODE) return mockIniciar({ pedidoId, metodo, valor });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/pagamentos/iniciar", {
      method: "POST",
      json: body,
      headers: { "Idempotency-Key": `${pedidoId}-${metodo}-${Date.now()}` },
    });
    return mapTransacao(raw);
  },

  async processarCartao(
    transacaoId: string,
    dados: { numero: string; nome: string; validade: string; cvv: string },
  ): Promise<TransacaoPagamento> {
    if (MOCK_MODE) return mockProcessarCartao(transacaoId, dados);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/pagamentos/${transacaoId}/cartao`, { method: "POST", json: dados });
    return mapTransacao(raw);
  },

  async consultarStatus(transacaoId: string): Promise<TransacaoPagamento> {
    if (MOCK_MODE) return mockConsultarStatus(transacaoId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/pagamentos/${transacaoId}/status`);
    return mapTransacao(raw);
  },

  async confirmarPix(transacaoId: string): Promise<TransacaoPagamento> {
    if (MOCK_MODE) return mockConfirmarPixCliente(transacaoId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/pagamentos/${transacaoId}/pix/confirmar`, { method: "POST" });
    return mapTransacao(raw);
  },

  async validarParaAprovacao(transacaoId: string): Promise<TransacaoPagamento> {
    if (MOCK_MODE) return mockValidarAdmin(transacaoId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/pagamentos/${transacaoId}/validar`, { method: "POST" });
    return mapTransacao(raw);
  },

  getLocal(transacaoId: string): TransacaoPagamento | null {
    return getTransacao(transacaoId);
  },

  getByPedido(pedidoId: string): TransacaoPagamento | null {
    return loadTransacoes().find((t) => t.pedidoId === pedidoId && t.status === "aprovada") ?? null;
  },
};

export function labelMetodo(metodo: MetodoPagamento): string {
  return OPCOES_PAGAMENTO.find((o) => o.id === metodo)?.label ?? metodo;
}

export function resumoPagamento(t: TransacaoPagamento): string {
  if (t.metodo === "pix") return `Pix · ref. ${t.operadoraRef ?? t.id}`;
  return `${labelMetodo(t.metodo)} ${t.cartaoBandeira ?? ""} ·••• ${t.cartaoUltimos4 ?? "****"}`;
}
