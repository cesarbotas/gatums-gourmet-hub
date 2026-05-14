// Mock vendas — usadas apenas no painel de relatórios.
import { readStore, writeStore, uid } from "./storage";
import { produtosService, type Produto } from "./produtos";

const KEY = "gg.vendas";

export interface Venda {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  total: number;
  data: string; // ISO
}

async function ensureSeed() {
  const stored = readStore<Venda[]>(KEY, []);
  if (stored.length > 0) return stored;
  const { items } = await produtosService.list({ pageSize: 100 });
  const vendas: Venda[] = [];
  const today = new Date();
  for (let d = 29; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const sales = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < sales; i++) {
      const p = items[Math.floor(Math.random() * items.length)] as Produto | undefined;
      if (!p) continue;
      const qtd = Math.floor(Math.random() * 3) + 1;
      vendas.push({
        id: uid(),
        produtoId: p.id,
        produtoNome: p.nome,
        quantidade: qtd,
        total: qtd * p.preco,
        data: date.toISOString(),
      });
    }
  }
  writeStore(KEY, vendas);
  return vendas;
}

export const vendasService = {
  async list() {
    return ensureSeed();
  },
  async resumo() {
    const vendas = await ensureSeed();
    const totalFaturamento = vendas.reduce((s, v) => s + v.total, 0);
    const totalPedidos = vendas.length;
    const ticket = totalPedidos ? totalFaturamento / totalPedidos : 0;

    const porProduto = new Map<string, { nome: string; quantidade: number; total: number }>();
    for (const v of vendas) {
      const cur = porProduto.get(v.produtoId) ?? { nome: v.produtoNome, quantidade: 0, total: 0 };
      cur.quantidade += v.quantidade;
      cur.total += v.total;
      porProduto.set(v.produtoId, cur);
    }
    const topProdutos = [...porProduto.values()]
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    const porDia = new Map<string, number>();
    for (const v of vendas) {
      const day = v.data.slice(0, 10);
      porDia.set(day, (porDia.get(day) ?? 0) + v.total);
    }
    const serieDiaria = [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, total]) => ({ dia, total }));

    return { totalFaturamento, totalPedidos, ticket, topProdutos, serieDiaria };
  },
};
