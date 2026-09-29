/**
 * A referência dos golden files do Renda Fixa: data fixa e os dois mercados.
 *
 * O prazo de cada título é contado a partir de "hoje", então a mesma planilha processada em outro
 * dia dá outros vértices. Os goldens fixam o dia — o mesmo do exemplo do README original — e o fuso
 * de Brasília, em que a XP entrega o vencimento (meia-noite local).
 */
export const DATA_GOLDEN = '2026-09-23T12:00:00-03:00';

export const FUSO_GOLDEN = 'America/Sao_Paulo';

export const MODOS = [
  { nome: 'primario', secundario: false },
  { nome: 'secundario', secundario: true }
];
