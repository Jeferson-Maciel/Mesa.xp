/**
 * As contas da boleta de compra de fundo no secundário da XP, a mesma que o Hub mostra.
 *
 * O deságio do fundo é dividido entre o cliente e o escritório: o que não vai de desconto para
 * o cliente vira ROA adicional da mesa. A corretagem é cobrada por cima, sobre a posição.
 *
 *   desconto do cliente  = deságio − ROA adicional
 *   posição              = cotas × PU × (1 − desconto)
 *   corretagem           = % da posição (1,5% na maioria dos fundos)
 *   total da operação    = posição + corretagem               (o que o cliente paga)
 *   remuneração          = posição × (% da corretagem + ROA)  (o que o escritório recebe)
 *
 * Conferido contra três boletas reais de 05/10/2026 — Riza Renda Imobiliária, XPHF11 e CPHF11 —,
 * que estão nos testes. Tudo em pontos percentuais (6,75 é 6,75%), e nada é arredondado aqui:
 * o arredondamento ao centavo é só da exibição, como no Hub.
 *
 * O `desagio` daqui é o **deságio máximo** da boleta, o que a barra divide — o mesmo número da
 * prateleira (`secondaryPurchaseDiscount`).
 */

/** A corretagem máxima quando o fundo não diz a dele (a planilha exportada não diz). */
export const CORRETAGEM = 1.5;

/**
 * @param {{pu: number, desagio: number, roa: number, cotas: number, corretagem?: number}} boleta
 */
export const contaDaBoleta = ({ pu, desagio, roa, cotas, corretagem = CORRETAGEM }) => {
  const desconto = desagio - roa;
  const posicao = cotas * pu * (1 - desconto / 100);
  const valorDaCorretagem = (posicao * corretagem) / 100;

  return {
    desconto,
    posicao,
    corretagem: valorDaCorretagem,
    total: posicao + valorDaCorretagem,
    remuneracao: (posicao * (corretagem + roa)) / 100,
    percentualDaRemuneracao: corretagem + roa
  };
};

/**
 * Meia unidade da última casa que a planilha trouxe: o PU real do Hub está a menos disso do PU
 * exportado. Com duas casas, R$ 0,005.
 */
export const margemDoPu = (casas) => 0.5 / 10 ** casas;

/**
 * Quantas cotas cabem em `valor`, com tudo dentro: corretagem e ROA.
 *
 * A planilha traz o PU arredondado (9,32), e o Hub usa o de verdade (9,32065). Contar as cotas
 * pelo PU da planilha pode passar do valor pedido: no CPHF11, R$ 16.000 dariam 1.804 cotas, que
 * no Hub custam R$ 16.000,00 — no limite. Por isso a conta usa o PU mais alto que o arredondamento
 * permite. Às vezes isso custa uma cota; nunca passa do pedido.
 *
 * @param {number} valor  o financeiro pedido
 * @param {{pu: number, casasDoPu: number, desagio: number, roa: number, corretagem?: number}} boleta
 * @returns {number} a quantidade inteira, possivelmente 0
 */
export const cotasPara = (valor, { pu, casasDoPu, desagio, roa, corretagem }) => {
  const puMaisAlto = pu + margemDoPu(casasDoPu);
  const totalDe = (cotas) => contaDaBoleta({ pu: puMaisAlto, desagio, roa, cotas, corretagem }).total;

  const porCota = totalDe(1);
  if (!(porCota > 0) || !(valor > 0)) return 0;

  let cotas = Math.floor(valor / porCota);
  while (cotas > 0 && totalDe(cotas) > valor) cotas--; // a divisão em ponto flutuante pode passar de 1
  return cotas;
};
