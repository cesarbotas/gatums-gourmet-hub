export type PedidoEtapa =
  | "criado"
  | "aprovado"
  | "pagamento"
  | "pagamento_aprovado"
  | "envio_pendente"
  | "entregue"
  | "finalizado";

export type PedidoActor = "cliente" | "admin";

export type EntregaTipo = "transporte" | "retirada";

export interface PedidoEvento {
  etapa: PedidoEtapa;
  em: string;
  por: PedidoActor;
  observacao?: string;
  entregaTipo?: EntregaTipo;
}

export const ETAPAS_ORDEM: PedidoEtapa[] = [
  "criado",
  "aprovado",
  "pagamento",
  "pagamento_aprovado",
  "envio_pendente",
  "entregue",
  "finalizado",
];

export const ETAPA_META: Record<
  PedidoEtapa,
  { label: string; descricao: string; responsavel: PedidoActor }
> = {
  criado: {
    label: "Pedido criado",
    descricao: "Cliente finalizou o pedido",
    responsavel: "cliente",
  },
  aprovado: {
    label: "Pedido aprovado",
    descricao: "Admin confirmou o pedido",
    responsavel: "admin",
  },
  pagamento: {
    label: "Pagamento",
    descricao: "Cliente realizou o pagamento",
    responsavel: "cliente",
  },
  pagamento_aprovado: {
    label: "Aprovação do pagamento",
    descricao: "Admin confirmou o recebimento",
    responsavel: "admin",
  },
  envio_pendente: {
    label: "Envio pendente",
    descricao: "Pedido pronto para envio ou retirada",
    responsavel: "admin",
  },
  entregue: {
    label: "Pedido entregue",
    descricao: "Validação com transportadora ou retirada no local",
    responsavel: "admin",
  },
  finalizado: {
    label: "Pedido finalizado",
    descricao: "Fluxo concluído pelo admin",
    responsavel: "admin",
  },
};

export function etapaAtual(timeline: PedidoEvento[]): PedidoEtapa {
  if (timeline.length === 0) return "criado";
  return timeline[timeline.length - 1].etapa;
}

export function proximaEtapa(atual: PedidoEtapa): PedidoEtapa | null {
  const i = ETAPAS_ORDEM.indexOf(atual);
  return i >= 0 && i < ETAPAS_ORDEM.length - 1 ? ETAPAS_ORDEM[i + 1] : null;
}

export function etapaConcluida(timeline: PedidoEvento[], etapa: PedidoEtapa): boolean {
  return timeline.some((e) => e.etapa === etapa);
}

export function podeAvancar(timeline: PedidoEvento[], actor: PedidoActor): boolean {
  const atual = etapaAtual(timeline);
  const prox = proximaEtapa(atual);
  if (!prox) return false;
  return ETAPA_META[prox].responsavel === actor;
}

export function proximaAcaoLabel(timeline: PedidoEvento[], actor: PedidoActor): string | null {
  const atual = etapaAtual(timeline);
  const prox = proximaEtapa(atual);
  if (!prox || ETAPA_META[prox].responsavel !== actor) return null;
  const labels: Record<PedidoEtapa, string> = {
    criado: "",
    aprovado: "Aprovar pedido",
    pagamento: "Pagar pedido",
    pagamento_aprovado: "Aprovar pagamento",
    envio_pendente: "Marcar envio pendente",
    entregue: "Confirmar entrega",
    finalizado: "Finalizar pedido",
  };
  return labels[prox];
}

export function statusPedidoLabel(etapa: PedidoEtapa): string {
  return ETAPA_META[etapa].label;
}
