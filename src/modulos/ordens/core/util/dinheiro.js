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

/**
 * Percentual como o Hub mostra: `6,75%`, sempre com duas casas.
 *
 * @param {number|null|undefined} valor  em pontos percentuais (6.75)
 */
export const formatarPercentual = (valor) => {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '';
  return valor.toFixed(2).replace('.', ',') + '%';
};

/**
 * Lê um percentual digitado: `0,50`, `0.5`, `0,5%`. Só aceita número não negativo — é para o teto
 * do ROA, que vai de zero para cima.
 *
 * @returns {number|null}
 */
export const lerPercentual = (texto) => {
  const limpo = String(texto ?? '').replace('%', '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  return Number(limpo);
};

/* ── Escrita por extenso (anti-fat-finger) ────────────────────────────────────────────── */

const UNIDADES_EXT = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE_EXT = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS_EXT = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS_EXT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

const centenaPorExtenso = (n) => {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const partes = [];
  if (c > 0) partes.push(CENTENAS_EXT[c]);
  if (d === 1) {
    partes.push(DEZ_A_DEZENOVE_EXT[u]);
  } else {
    if (d > 1) partes.push(DEZENAS_EXT[d]);
    if (u > 0) partes.push(UNIDADES_EXT[u]);
  }
  return partes.join(' e ');
};

/**
 * Converte valor em reais para texto por extenso (ex.: 50000 -> "Cinquenta mil reais").
 * Auxilia a verificação humana instantânea contra erros de digitação de zeros a mais.
 *
 * @param {number|null|undefined} valor
 * @returns {string}
 */
export const porExtenso = (valor) => {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return '';
  // Pelos centavos arredondados: 0,999 é um real, não "cem centavos".
  const totalCentavos = Math.round(valor * 100);
  const inteiro = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  // As casas de três dígitos, da maior para a menor, já com o nome de cada uma.
  const grupos = [
    [Math.floor(inteiro / 1_000_000_000) % 1000, (n) => `${centenaPorExtenso(n)} ${n === 1 ? 'bilhão' : 'bilhões'}`],
    [Math.floor(inteiro / 1_000_000) % 1000, (n) => `${centenaPorExtenso(n)} ${n === 1 ? 'milhão' : 'milhões'}`],
    [Math.floor(inteiro / 1_000) % 1000, (n) => (n === 1 ? 'mil' : `${centenaPorExtenso(n)} mil`)],
    [inteiro % 1000, (n) => centenaPorExtenso(n)]
  ].filter(([n]) => n > 0);

  // O "e" entre as casas, como se lê: antes de um grupo menor que 100 ou de uma centena redonda
  // ("mil e cem", "um milhão e duzentos mil"); senão, só o espaço ("dois mil trezentos e quarenta").
  let textoReais = '';
  grupos.forEach(([n, escrever], i) => {
    if (i > 0) textoReais += n < 100 || n % 100 === 0 ? ' e ' : ' ';
    textoReais += escrever(n);
  });
  if (textoReais) {
    const soMilhoes = inteiro >= 1_000_000 && inteiro % 1_000_000 === 0;
    textoReais += `${soMilhoes ? ' de' : ''} ${inteiro === 1 ? 'real' : 'reais'}`;
  }

  const textoCentavos = centavos > 0 ? `${centenaPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}` : '';
  const resultado = textoReais && textoCentavos ? `${textoReais} e ${textoCentavos}` : textoReais || textoCentavos;
  return resultado ? resultado.charAt(0).toUpperCase() + resultado.slice(1) : '';
};
