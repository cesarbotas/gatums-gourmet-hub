import { apiRequest } from "./client";
import type { CartItem } from "./carrinho";
import {
  type PedidoEtapa,
  type PedidoEvento,
  type PedidoActor,
  type EntregaTipo,
  ETAPAS_ORDEM,
  etapaAtual,
  proximaEtapa,
  podeAvancar,
} from "@/lib/pedido-flow";
import { pagamentosService, resumoPagamento, type TransacaoPagamento } from "./pagamentos";

export interface PedidoPagamento {
  transacaoId: string;
  resumo: string;
  aprovadoEm: string;
}

export interface Pedido {
  id: string;
  userId: string;
  clienteNome: string;
  itens: CartItem[];
  total: number;
  data: string;
  timeline: PedidoEvento[];
  pagamento?: PedidoPagamento;
}

const ETAPA_TO_INT: Record<PedidoEtapa, number> = {
  criado: 0,
  aprovado: 1,
  pagamento: 2,
  pagamento_aprovado: 3,
  envio_pendente: 4,
  entregue: 5,
  finalizado: 6,
};

const ENTREGA_TO_INT: Record<EntregaTipo, number> = { transporte: 0, retirada: 1 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPedido(raw: any): Pedido {
  return {
    id: raw.id,
    userId: raw.userId ?? raw.clienteId ?? "",
    clienteNome: raw.clienteNome ?? raw.cliente?.nome ?? "",
    itens: raw.itens ?? [],
    total: raw.total ?? 0,
    data: raw.data ?? raw.criadoEm ?? new Date().toISOString(),
    timeline: raw.timeline ?? [{ etapa: ETAPAS_ORDEM[raw.etapa ?? 0], em: raw.criadoEm ?? new Date().toISOString(), por: "cliente" as PedidoActor }],
    pagamento: raw.pagamento,
  };
}

export const pedidosService = {
  async listAll(): Promise<Pedido[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/pedidos?page=1&pageSize=100");
    return (res.items ?? res).map(mapPedido);
  },

  async listByUser(_userId: string): Promise<Pedido[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/pedidos?page=1&pageSize=100");
    return (res.items ?? res).map(mapPedido);
  },

  async getById(id: string): Promise<Pedido | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await apiRequest<any>(`/pedidos/${id}`);
      return mapPedido(raw);
    } catch {
      return null;
    }
  },

  etapaAtual(pedido: Pedido): PedidoEtapa {
    return etapaAtual(pedido.timeline);
  },

  podeAvancar(pedido: Pedido, actor: PedidoActor): boolean {
    return podeAvancar(pedido.timeline, actor);
  },

  concluirPagamentoCliente(pedidoId: string, transacao: TransacaoPagamento): Promise<Pedido> {
    if (transacao.status !== "aprovada") throw new Error("Pagamento não foi aprovado pela operadora.");
    return apiRequest<Pedido>(`/pedidos/${pedidoId}/pagamento/concluir`, {
      method: "POST",
      json: { transacaoId: transacao.id },
    }).then(mapPedido);
  },

  async avancar(
    id: string,
    actor: PedidoActor,
    opts?: { observacao?: string; entregaTipo?: EntregaTipo },
  ): Promise<Pedido> {
    const pedido = await this.getById(id);
    if (!pedido) throw new Error("Pedido não encontrado");
    if (!podeAvancar(pedido.timeline, actor)) throw new Error("Esta etapa não pode ser concluída agora.");
    const prox = proximaEtapa(etapaAtual(pedido.timeline));
    if (!prox) throw new Error("Pedido já está finalizado.");

    if (prox === "pagamento_aprovado") {
      if (!pedido.pagamento?.transacaoId) throw new Error("Pedido sem transação de pagamento.");
      await pagamentosService.validarParaAprovacao(pedido.pagamento.transacaoId);
    }

    if (prox === "entregue" && !opts?.entregaTipo) throw new Error("Informe o tipo de entrega.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/pedidos/${id}/etapas/avancar`, {
      method: "POST",
      json: {
        proximaEtapa: ETAPA_TO_INT[prox],
        observacao: opts?.observacao ?? null,
        entregaTipo: opts?.entregaTipo ? ENTREGA_TO_INT[opts.entregaTipo] : 0,
      },
    });
    return mapPedido(raw);
  },

  // kept for carrinho.ts compatibility
  create(input: Omit<Pedido, "id" | "timeline"> & { timeline?: PedidoEvento[] }): Pedido {
    throw new Error("Use cartService.checkout() to create orders via the API.");
    return input as unknown as Pedido;
  },
};
