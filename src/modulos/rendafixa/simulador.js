import { aliquotaDoIR } from './analise.js';

/**
 * O simulador de pré-fixado: quanto um valor aplicado hoje vira no vencimento, antes e depois do IR.
 * Para o assessor responder "e quanto dá isso?" sem abrir outra ferramenta. Puro, testado em
 * `simulador.test.js`.
 *
 * A conta é a do mercado para título pré: a taxa é ao ano, em base de 252 dias úteis — o bruto é
 * valor × (1 + taxa)^(dias úteis / 252) —, e o IR é a tabela regressiva pelos dias corridos, sobre o
 * rendimento (isento: zero). É uma estimativa: não entra IOF (só até 30 dias), custódia, nem o PU do
 * dia do secundário.
 */

/**
 * Os dias úteis entre hoje (exclusive) e o vencimento (inclusive).
 *
 * @param {Date} hoje
 * @param {Date} vencimento
 * @param {(d: Date) => boolean} ehUtil
 */
export const diasUteisAte = (hoje, vencimento, ehUtil) => {
  let n = 0;
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fim = new Date(vencimento.getFullYear(), vencimento.getMonth(), vencimento.getDate());
  while (d < fim) {
    d.setDate(d.getDate() + 1);
    if (ehUtil(d)) n++;
  }
  return n;
};

export const CDI_PADRAO = 10.65;

/**
 * @param {{valor: number, taxa: number, diasUteis: number, diasCorridos: number, isento?: boolean, cdi?: number}} p
 *   `taxa` em % ao ano (14,2 → 14.2), `cdi` em % ao ano de referência (ex.: 10.65)
 * @returns {{bruto: number, rendimento: number, aliquota: number, ir: number, liquido: number, taxaLiquida: number, cdi: number, percCdiLiquido: number}|null}
 */
export const simularPre = ({ valor, taxa, diasUteis, diasCorridos, isento = false, cdi = CDI_PADRAO }) => {
  if (!(valor > 0) || !(diasUteis > 0) || !(diasCorridos > 0) || !Number.isFinite(taxa)) return null;
  const bruto = valor * (1 + taxa / 100) ** (diasUteis / 252);
  const rendimento = bruto - valor;
  const aliquota = isento ? 0 : aliquotaDoIR(diasCorridos);
  const ir = (rendimento * aliquota) / 100;
  const liquido = bruto - ir;
  // A taxa líquida ao ano, na mesma base de 252 dias úteis: para comparar com a bruta de outro título.
  const taxaLiquida = ((liquido / valor) ** (252 / diasUteis) - 1) * 100;
  const taxaCdi = Number.isFinite(cdi) && cdi > 0 ? cdi : CDI_PADRAO;
  const percCdiLiquido = (taxaLiquida / taxaCdi) * 100;
  return { bruto, rendimento, aliquota, ir, liquido, taxaLiquida, cdi: taxaCdi, percCdiLiquido };
};
