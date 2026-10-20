/**
 * A conta de outro pedido colada no fim da linha de um pedido: num pedido real de 20/10/2026, a
 * quebra de linha se perdeu na colagem, e "LFT - R$ 81.708,17   <conta>" juntou a ordem de um
 * cliente com a conta do pedido seguinte. Lido assim, tudo o que vinha abaixo ficava na conta do
 * primeiro cliente. Quando o operador diz que o número é outra conta, a quebra de linha volta antes
 * dela, e o texto é lido de novo.
 *
 * @param {string} texto  o texto colado
 * @param {string} conta  o número que o operador disse ser a conta de outro pedido
 * @returns {string|null} o texto com a quebra de linha antes da conta, ou null se ela não está
 *   inteira no fim de uma linha que tem mais coisa antes
 */
export const separarConta = (texto, conta) => {
  if (!/^\d{5,8}$/.test(String(conta))) return null;
  const colada = new RegExp(String.raw`(\S)[ \t]+` + conta + String.raw`[ \t]*(?=\r?\n|$)`);
  return colada.test(texto) ? texto.replace(colada, (_tudo, antes) => `${antes}\n${conta}`) : null;
};
