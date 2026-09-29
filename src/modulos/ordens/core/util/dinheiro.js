/**
 * Leitura e escrita de valores financeiros no padrão brasileiro.
 *
 * A entrada do usuário é imprevisível ("R$ 11.000,00", "R$ 34.800", "11000,50"), mas a saída
 * é sempre `R$ X.XXX,XX` (invariante 10). Ler é tolerante; escrever é rígido.
 */

/**
 * Converte texto em número. Toma a primeira sequência numérica do texto, o que descarta
 * observações coladas ao valor sem precisar entendê-las.
 *
 * @param {string|null|undefined} texto
 * @returns {number|null} o valor, ou null se não houver número algum.
 */
export const lerFinanceiro = (texto) => {
  if (typeof texto !== 'string') return null;

  const encontrado = texto.match(/\d[\d.,]*/);
  if (!encontrado) return null;

  const bruto = encontrado[0].replace(/[.,]$/, '');

  // Com vírgula, ela é o decimal e os pontos são milhar. Sem vírgula, os pontos
  // também são milhar: "R$ 1.234" vale mil duzentos e trinta e quatro, não 1,234.
  const normalizado = bruto.includes(',')
    ? bruto.replace(/\./g, '').replace(',', '.')
    : bruto.replace(/\./g, '');

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
};

const formatador = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Escreve o valor como `R$ X.XXX,XX`.
 *
 * O Intl emite um espaço não separável depois do `R$`, que vira caractere estranho ao colar
 * em planilha — trocamos por espaço comum.
 *
 * @param {number|null|undefined} valor
 * @returns {string} o valor formatado, ou string vazia.
 */
export const formatarFinanceiro = (valor) => {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '';
  return formatador.format(valor).replace(/\u00a0/g, ' ');
};
