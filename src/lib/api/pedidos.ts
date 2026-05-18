import { readStore, writeStore, uid } from "./storage";
import type { CartItem } from "./carrinho";
import {
  type PedidoEtapa,
  type PedidoEvento,
  type PedidoActor,
  type EntregaTipo,
  etapaAtual,
  proximaEtapa,
  podeAvancar,
} from "@/lib/pedido-flow";
import {
  pagamentosService,
  resumoPagamento,
  type TransacaoPagamento,
} from "./pagamentos";

const PEDIDOS_KEY = "gg.pedidos";

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

type LegacyPedido = Pedido & { status?: string };

function migrateLegacy(raw: LegacyPedido): Pedido {
  if (raw.timeline?.length) return raw;

  const legacy = raw.status ?? "recebido";
  const map: Record<string, PedidoEtapa> = {
    recebido: "criado",
    preparando: "envio_pendente",
    entregue: "entregue",
  };
  const alvo = map[legacy] ?? "criado";
  const timeline: PedidoEvento[] = [
    { etapa: "criado", em: raw.data, por: "cliente" },
  ];
  if (alvo !== "criado") {
    const steps: PedidoEtapa[] = [
      "aprovado",
      "pagamento",
      "pagamento_aprovado",
      "envio_pendente",
      "entregue",
      "finalizado",
    ];
    const endIdx = steps.indexOf(alvo);
    if (endIdx >= 0) {
      for (let i = 0; i <= endIdx; i++) {
        timeline.push({
          etapa: steps[i],
          em: raw.data,
          por: steps[i] === "pagamento" ? "cliente" : "admin",
          ...(steps[i] === "entregue" ? { entregaTipo: "transporte" as EntregaTipo } : {}),
        });
      }
    }
  }

  const { status: _s, ...rest } = raw;
  return { ...rest, timeline };
}

function load(): Pedido[] {
  return readStore<LegacyPedido[]>(PEDIDOS_KEY, []).map(migrateLegacy);
}

function save(list: Pedido[]) {
  writeStore(PEDIDOS_KEY, list);
}

function updatePedido(id: string, fn: (p: Pedido) => Pedido): Pedido {
  const list = load();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Pedido não encontrado");
  list[idx] = fn(list[idx]);
  save(list);
  return list[idx];
}

export const pedidosService = {
  create(input: Omit<Pedido, "id" | "timeline"> & { timeline?: PedidoEvento[] }): Pedido {
    const pedido: Pedido = {
      ...input,
      id: uid(),
      timeline: input.timeline ?? [
        { etapa: "criado", em: new Date().toISOString(), por: "cliente" },
      ],
    };
    save([pedido, ...load()]);
    return pedido;
  },

  listAll(): Pedido[] {
    return load().sort((a, b) => b.data.localeCompare(a.data));
  },

  listByUser(userId: string): Pedido[] {
    return load()
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.data.localeCompare(a.data));
  },

  getById(id: string): Pedido | null {
    return load().find((p) => p.id === id) ?? null;
  },

  etapaAtual(pedido: Pedido): PedidoEtapa {
    return etapaAtual(pedido.timeline);
  },

  podeAvancar(pedido: Pedido, actor: PedidoActor): boolean {
    return podeAvancar(pedido.timeline, actor);
  },

  /** Registra pagamento aprovado pela API e avança para etapa "pagamento". */
  concluirPagamentoCliente(pedidoId: string, transacao: TransacaoPagamento): Pedido {
    const pedido = this.getById(pedidoId);
    if (!pedido) throw new Error("Pedido não encontrado");
    if (transacao.status !== "aprovada") {
      throw new Error("Pagamento não foi aprovado pela operadora.");
    }
    if (!podeAvancar(pedido.timeline, "cliente")) {
      throw new Error("Este pedido não está aguardando pagamento.");
    }
    const prox = proximaEtapa(etapaAtual(pedido.timeline));
    if (prox !== "pagamento") {
      throw new Error("Etapa de pagamento indisponível.");
    }

    const resumo = resumoPagamento(transacao);
    return updatePedido(pedidoId, (p) => ({
      ...p,
      pagamento: {
        transacaoId: transacao.id,
        resumo,
        aprovadoEm: transacao.atualizadoEm,
      },
      timeline: [
        ...p.timeline,
        {
          etapa: "pagamento",
          em: new Date().toISOString(),
          por: "cliente",
          observacao: resumo,
        },
      ],
    }));
  },

  async avancar(
    id: string,
    actor: PedidoActor,
    opts?: { observacao?: string; entregaTipo?: EntregaTipo },
  ): Promise<Pedido> {
    const pedido = this.getById(id);
    if (!pedido) throw new Error("Pedido não encontrado");
    if (!podeAvancar(pedido.timeline, actor)) {
      throw new Error("Esta etapa não pode ser concluída agora.");
    }
    const prox = proximaEtapa(etapaAtual(pedido.timeline));
    if (!prox) throw new Error("Pedido já está finalizado.");

    if (prox === "pagamento_aprovado") {
      if (!pedido.pagamento?.transacaoId) {
        throw new Error("Pedido sem transação de pagamento.");
      }
      await pagamentosService.validarParaAprovacao(pedido.pagamento.transacaoId);
    }

    if (prox === "entregue" && !opts?.entregaTipo) {
      throw new Error("Informe o tipo de entrega (transporte ou retirada).");
    }

    return updatePedido(id, (p) => ({
      ...p,
      timeline: [
        ...p.timeline,
        {
          etapa: prox,
          em: new Date().toISOString(),
          por: actor,
          observacao: opts?.observacao,
          entregaTipo: opts?.entregaTipo,
        },
      ],
    }));
  },
};
