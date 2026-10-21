/**
 * Uma anotação pedida por outra aba: a Fila do dia e o Ordens têm um botão "Anotar" que leva às
 * Anotações já com o título e o texto do pedido. O pedido fica aqui, na memória da página — nunca no
 * endereço, que iria para o histórico do navegador com a conta do cliente —, e a aba Anotações o pega
 * ao abrir uma anotação nova. Vale um minuto: um pedido esquecido não vira anotação mais tarde.
 */

let pedido = null;

/** @param {{titulo: string, texto: string, etiquetas?: string[]}} dados */
export const pedirAnotacao = (dados) => {
  pedido = { ...dados, em: Date.now() };
  location.hash = '#anotacoes/nova';
};

/** @returns {{titulo: string, texto: string, etiquetas?: string[]}|null} o pedido, uma vez só */
export const pegarAnotacaoPedida = () => {
  const p = pedido;
  pedido = null;
  return p && Date.now() - p.em < 60000 ? p : null;
};
