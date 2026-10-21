/**
 * "A Fila mudou" — na mesma página e nas outras abas do navegador.
 *
 * O Ordens grava um cartão quando um e-mail sai; o robô anota a resposta do cliente; a aba Fila
 * mostra; o contador da aba e a faixa de atenção também. Quem grava avisa, com a origem; quem mostra
 * relê. Entre abas do navegador, por BroadcastChannel, criado só no primeiro uso (como nas Anotações),
 * para não prender o processo dos testes.
 */

const alvo = new EventTarget();
let canal = null;

const ligarCanal = () => {
  if (canal || typeof BroadcastChannel !== 'function') return;
  canal = new BroadcastChannel('mesa-xp-fila');
  canal.onmessage = () => alvo.dispatchEvent(new CustomEvent('mudou', { detail: 'outra-aba' }));
};

/** @param {string} origem quem gravou: 'ordens', 'fila', 'robo'… */
export const avisarMudancaNaFila = (origem) => {
  ligarCanal();
  alvo.dispatchEvent(new CustomEvent('mudou', { detail: origem }));
  canal?.postMessage('mudou');
};

/**
 * @param {(origem: string) => void} fn
 * @returns {() => void} a função que para de escutar
 */
export const aoMudarAFila = (fn) => {
  ligarCanal();
  const ouvinte = (e) => fn(e.detail);
  alvo.addEventListener('mudou', ouvinte);
  return () => alvo.removeEventListener('mudou', ouvinte);
};
