/**
 * Serviço de venda presencial — contratos alinhados a docs/GUIA-API-VENDA-RAPIDA.md
 *
 * Mock ativo quando VITE_PAYMENTS_MOCK=true (mesma flag do módulo de pagamentos).
 * Quando a API publicar os endpoints, apenas remover os blocos `if (MOCK_MODE)`.
 */
import { apiRequest } from "./client";
import { readStore, writeStore, uid } from "./storage";
import {
  pagamentosService,
  normalizeStatus,
  type TransacaoPagamento,
  type MetodoPagamento,
} from "./pagamentos";

const MOCK_MODE =
  (import.meta.env.VITE_PAYMENTS_MOCK as string | undefined) === "true";

const VENDAS_KEY = "gg.vendas-presenciais";

// ── Tipos públicos ─────────────────────────────────────────────────────────

export interface ItemVendaPresencial {
  produtoId: string;
  quantidade: number;
}

export interface ItemVendaPresencialResposta {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface VendaPresencial {
  pedidoId: string;
  total: number;
  itens: ItemVendaPresencialResposta[];
  canal: "presencial";
  operadorId: string;
  clienteNome: string;
  criadoEm: string;
}

export interface IniciarPagamentoPresencialInput {
  pedidoId: string;
  metodo: MetodoPagamento | "dinheiro";
  valor: number;
  /** Obrigatório quando metodo === "dinheiro". Deve ser >= valor. */
  valorRecebido?: number;
}

export interface PagamentoPresencialResposta extends TransacaoPagamento {
  /** Calculado pelo servidor. Presente quando metodo === "dinheiro" e valorRecebido > valor. */
  troco?: number;
  valorRecebido?: number;
  /** ISO-8601: momento em que o pagamento foi aprovado (dinheiro/cartão confirmado/Pix). */
  aprovadoEm?: string;
  /**
   * QR Code Pix como string base64 pura (sem prefixo data:), conforme retornado pela API.
   * O serviço monta pixQrCodeDataUrl a partir deste campo para uso direto em <img src>.
   */
  pixQrCodeBase64?: string;
}

export interface ConfirmarCartaoInput {
  aprovado: boolean;
  observacao?: string;
}

// ── Helpers mock ───────────────────────────────────────────────────────────

function loadVendas(): VendaPresencial[] {
  return readStore<VendaPresencial[]>(VENDAS_KEY, []);
}

function saveVenda(v: VendaPresencial) {
  const list = loadVendas().filter((x) => x.pedidoId !== v.pedidoId);
  writeStore(VENDAS_KEY, [v, ...list]);
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Mapeamento da resposta da API ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVendaPresencial(raw: any): VendaPresencial {
  return {
    pedidoId: raw.pedidoId ?? raw.id,
    total: Number(raw.total ?? 0),
    canal: "presencial",
    operadorId: raw.operadorId ?? "",
    clienteNome: raw.clienteNome ?? "",
    criadoEm: raw.criadoEm ?? new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itens: (raw.itens ?? []).map((i: any) => ({
      produtoId: i.produtoId,
      produtoNome: i.produtoNome ?? i.nome ?? "",
      quantidade: Number(i.quantidade ?? 0),
      precoUnitario: Number(i.precoUnitario ?? i.preco ?? 0),
      subtotal: Number(i.subtotal ?? 0),
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPagamentoPresencial(raw: any): PagamentoPresencialResposta {
  // A API retorna pixQrCodeBase64 (string base64 pura, sem prefixo data:).
  // Montamos o data: URI aqui para que a tela use direto num <img src>.
  const pixQrCodeBase64: string | undefined = raw.pixQrCodeBase64 ?? undefined;
  const pixQrCodeDataUrl: string | undefined =
    pixQrCodeBase64
      ? `data:image/png;base64,${pixQrCodeBase64}`
      : (raw.pixQrCodeDataUrl ?? undefined);

  return {
    id: raw.id,
    pedidoId: raw.pedidoId,
    metodo: raw.metodo === "dinheiro" ? ("dinheiro" as MetodoPagamento) : raw.metodo,
    valor: Number(raw.valor ?? 0),
    valorRecebido: raw.valorRecebido != null ? Number(raw.valorRecebido) : undefined,
    troco: raw.troco != null ? Number(raw.troco) : undefined,
    status: normalizeStatus(raw.status),
    criadoEm: raw.criadoEm ?? new Date().toISOString(),
    atualizadoEm: raw.atualizadoEm ?? raw.criadoEm ?? new Date().toISOString(),
    operadora: raw.operadora ?? "presencial",
    operadoraRef: raw.operadoraRef,
    pixCopiaCola: raw.pixCopiaCola,
    pixQrCodeBase64,
    pixQrCodeDataUrl,
    pixExpiraEm: raw.pixExpiraEm,
    cartaoUltimos4: raw.cartaoUltimos4,
    cartaoBandeira: raw.cartaoBandeira,
    mensagemErro: raw.mensagemErro,
    aprovadoEm: raw.aprovadoEm,
  };
}

// ── Mock: criar venda ──────────────────────────────────────────────────────

interface MockCriarInput {
  clienteNome: string;
  operadorId: string;
  itens: ItemVendaPresencial[];
  // produtos já resolvidos para o mock calcular subtotais
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  produtosResolve: (ids: string[]) => Promise<{ id: string; nome: string; preco: number }[]>;
}

async function mockCriarVenda(input: MockCriarInput): Promise<VendaPresencial> {
  await delay(350);
  const produtos = await input.produtosResolve(input.itens.map((i) => i.produtoId));

  const itens: ItemVendaPresencialResposta[] = input.itens.map((i) => {
    const p = produtos.find((x) => x.id === i.produtoId);
    const precoUnitario = p?.preco ?? 0;
    return {
      produtoId: i.produtoId,
      produtoNome: p?.nome ?? i.produtoId,
      quantidade: i.quantidade,
      precoUnitario,
      subtotal: Math.round(precoUnitario * 100 * i.quantidade) / 100,
    };
  });

  const total = itens.reduce((s, i) => s + i.subtotal, 0);
  const venda: VendaPresencial = {
    pedidoId: `presencial-${uid()}`,
    total,
    itens,
    canal: "presencial",
    operadorId: input.operadorId,
    clienteNome: input.clienteNome || "Balcão",
    criadoEm: new Date().toISOString(),
  };

  saveVenda(venda);
  return venda;
}

// ── Mock: pagamento presencial ─────────────────────────────────────────────

async function mockIniciarPagamentoPresencial(
  input: IniciarPagamentoPresencialInput,
): Promise<PagamentoPresencialResposta> {
  await delay(300);
  const agora = new Date().toISOString();
  const id = `pgpres-${uid()}`;

  if (input.metodo === "dinheiro") {
    const valorRecebido = input.valorRecebido ?? input.valor;
    if (valorRecebido < input.valor) {
      throw new Error("Valor recebido insuficiente para cobrir o total.");
    }
    return {
      id,
      pedidoId: input.pedidoId,
      metodo: "dinheiro" as MetodoPagamento,
      valor: input.valor,
      valorRecebido,
      troco: Math.round((valorRecebido - input.valor) * 100) / 100,
      status: "aprovada",
      criadoEm: agora,
      atualizadoEm: agora,
      operadora: "presencial",
      aprovadoEm: agora,
    };
  }

  if (input.metodo === "cartao_debito" || input.metodo === "cartao_credito") {
    return {
      id,
      pedidoId: input.pedidoId,
      metodo: input.metodo,
      valor: input.valor,
      status: "aguardando_pagamento", // frontend trata como "aguardando_confirmacao_operador"
      criadoEm: agora,
      atualizadoEm: agora,
      operadora: "presencial",
    };
  }

  // Pix — delega ao serviço de pagamentos existente para reutilizar QR mock
  const tx = await pagamentosService.iniciar(input.pedidoId, "pix", input.valor);
  // O mock de pagamentos devolve pixQrCodeDataUrl com prefixo data:image/png;base64,
  // Extraímos a parte base64 pura para manter o mesmo contrato da API real.
  const dataUrl = tx.pixQrCodeDataUrl ?? "";
  const pixQrCodeBase64 = dataUrl.startsWith("data:image/png;base64,")
    ? dataUrl.slice("data:image/png;base64,".length)
    : undefined;
  return {
    ...tx,
    pixQrCodeBase64,
    // Mantém pixQrCodeDataUrl para compatibilidade com o restante do serviço
    pixQrCodeDataUrl: dataUrl || undefined,
  };
}

async function mockConfirmarCartaoPresencial(
  transacaoId: string,
  input: ConfirmarCartaoInput,
): Promise<PagamentoPresencialResposta> {
  await delay(400);
  if (!input.aprovado) {
    throw new Error("Pagamento recusado pelo operador.");
  }
  const agora = new Date().toISOString();
  return {
    id: transacaoId,
    pedidoId: "",
    metodo: "cartao_debito" as MetodoPagamento,
    valor: 0,
    status: "aprovada",
    criadoEm: agora,
    atualizadoEm: agora,
    operadora: "presencial",
    operadoraRef: input.observacao ?? "Aprovado na maquininha",
    aprovadoEm: agora,
  };
}

// ── Serviço público ────────────────────────────────────────────────────────

export const vendaPresencialService = {
  /**
   * Cria o pedido presencial. Aceita a lista de produtos já resolvidos (nome e
   * preço) para o mock calcular subtotais sem bater na API de produtos de novo.
   * Na integração real, o servidor recalcula tudo — os campos de produto são
   * ignorados pelo backend.
   */
  async criar(
    input: {
      clienteNome: string;
      operadorId: string;
      itens: ItemVendaPresencial[];
    },
    // Usado apenas pelo mock para calcular subtotais localmente
    resolverProdutos: (ids: string[]) => Promise<{ id: string; nome: string; preco: number }[]>,
  ): Promise<VendaPresencial> {
    if (MOCK_MODE) {
      return mockCriarVenda({ ...input, produtosResolve: resolverProdutos });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/admin/vendas-presenciais", {
      method: "POST",
      json: {
        clienteNome: input.clienteNome || null,
        operadorId: input.operadorId,
        itens: input.itens,
      },
      headers: {
        "Idempotency-Key": `vp-${input.operadorId}-${Date.now()}`,
      },
    });

    return mapVendaPresencial(raw);
  },

  /**
   * Inicia o pagamento de um pedido presencial.
   * Para cartão físico a resposta tem status "aguardando_confirmacao_operador";
   * para dinheiro é "aprovada" imediatamente; para Pix retorna QR Code.
   */
  async iniciarPagamento(
    input: IniciarPagamentoPresencialInput,
  ): Promise<PagamentoPresencialResposta> {
    if (MOCK_MODE) {
      return mockIniciarPagamentoPresencial(input);
    }

    const METODO_TO_INT: Record<string, number> = {
      cartao_debito: 0,
      cartao_credito: 1,
      dinheiro: 2,
      pix: 3,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/admin/vendas-presenciais/pagamento", {
      method: "POST",
      json: {
        pedidoId: input.pedidoId,
        metodo: METODO_TO_INT[input.metodo] ?? input.metodo,
        valor: input.valor,
        valorRecebido: input.valorRecebido ?? null,
        canal: "presencial",
      },
      headers: {
        "Idempotency-Key": `pg-${input.pedidoId}-${input.metodo}-${Date.now()}`,
      },
    });

    return mapPagamentoPresencial(raw);
  },

  /**
   * Confirma pagamento de cartão físico após a maquininha aprovar.
   * Avança o pedido para pagamento_aprovado no servidor.
   */
  async confirmarCartao(
    transacaoId: string,
    input: ConfirmarCartaoInput,
  ): Promise<PagamentoPresencialResposta> {
    if (MOCK_MODE) {
      return mockConfirmarCartaoPresencial(transacaoId, input);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(
      `/pagamentos/${transacaoId}/confirmar-presencial`,
      { method: "POST", json: input },
    );

    return mapPagamentoPresencial(raw);
  },

  /**
   * Consulta status do Pix (polling). Reutiliza o endpoint existente.
   * Retorna a transação atualizada — o frontend para o polling ao receber "aprovada".
   */
  async consultarStatusPix(transacaoId: string): Promise<PagamentoPresencialResposta> {
    const tx = await pagamentosService.consultarStatus(transacaoId);
    return tx as PagamentoPresencialResposta;
  },
};
