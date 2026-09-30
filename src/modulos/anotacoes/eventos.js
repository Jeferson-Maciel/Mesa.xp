/**
 * "As anotações mudaram" — na mesma página e nas outras abas do navegador.
 *
 * Duas partes leem as mesmas anotações: a aba Anotações e o vigia dos lembretes, que roda desde
 * que a página abre (vigia.js). E a mesma pessoa pode ter a Mesa XP aberta em duas abas do
 * navegador. Quem grava avisa, dizendo quem é (`origem`); quem mostra relê — menos o próprio autor,
 * que já está com a versão mais nova na tela e perderia o que está digitando se relesse.
 *
 * Entre abas do navegador o aviso vai por BroadcastChannel, criado só no primeiro uso, para não
 * prender o processo dos testes.
 */

const alvo = new EventTarget();
let canal = null;

const ligarCanal = () => {
  if (canal || typeof BroadcastChannel !== 'function') return;
  canal = new BroadcastChannel('mesa-xp-anotacoes');
  canal.onmessage = () => alvo.dispatchEvent(new CustomEvent('mudou', { detail: 'outra-aba' }));
};

/** @param {string} origem quem gravou: 'aba', 'vigia'… */
export const avisarMudanca = (origem) => {
  ligarCanal();
  alvo.dispatchEvent(new CustomEvent('mudou', { detail: origem }));
  canal?.postMessage('mudou');
};

/**
 * @param {(origem: string) => void} fn
 * @returns {() => void} a função que para de escutar
 */
export const aoMudar = (fn) => {
  ligarCanal();
  const ouvinte = (e) => fn(e.detail);
  alvo.addEventListener('mudou', ouvinte);
  return () => alvo.removeEventListener('mudou', ouvinte);
};
