export * from "./config";
export * from "./auth";
export * from "./produtos";
export * from "./categorias";
// produtos.ts tambem exporta um tipo `Categoria` (uniao de nomes de categoria),
// colidindo no barrel com a entidade `Categoria` de ./categorias. O export explicito
// abaixo resolve a ambiguidade a favor da entidade; o tipo de produtos segue
// acessivel via import direto de "./produtos".
export type { Categoria } from "./categorias";
export * from "./roles";
export * from "./permissions";
export * from "./usuarios";
export * from "./imagens";
export * from "./clientes";
export * from "./vendas";
export * from "./pedidos";
export * from "./pagamentos";
export * from "./carrinho";
export * from "./enderecos";
