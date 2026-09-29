/**
 * Regenera `src/modulos/ordens/core/validate/tickersB3.js` a partir da HG Brasil Finance.
 *
 * Rodar de tempos em tempos: a B3 lista e deslista papéis, e um ticker novo ausente da lista vira
 * aviso de "fora da lista" para o operador. O aviso não bloqueia nada, então uma lista velha
 * incomoda sem causar erro — mas incomoda.
 *
 * Uso: npm run tickers:update
 */

import { writeFile } from 'node:fs/promises';

const CLASSES = {
  acao: 'stock',
  fii: 'fii',
  bdr: 'bdr',
  etf: 'etf',
  fundo: 'fund',
  fiagro: 'fiagro'
};

const baixar = async (only) => {
  const url = 'https://api.hgbrasil.com/finance/ticker_list' + (only ? `?only=${only}` : '');
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);

  const { results } = await resposta.json();
  if (!Array.isArray(results)) throw new Error(`${url} não devolveu uma lista`);
  return results;
};

const porClasse = {};
for (const [nome, only] of Object.entries(CLASSES)) {
  porClasse[nome] = (await baixar(only)).sort();
  console.log(`${nome}: ${porClasse[nome].length}`);
}

const classificados = new Set(Object.values(porClasse).flat());
porClasse.outros = (await baixar()).filter((t) => !classificados.has(t)).sort();

const total = Object.values(porClasse).flat().length;
if (total < 1000) throw new Error(`Só ${total} tickers — resposta suspeita, lista não reescrita.`);

const linhas = Object.entries(porClasse)
  .map(([classe, tickers]) => `  ${classe}: ${JSON.stringify(tickers.join(' '))}.split(' '),`)
  .join('\n');

const conteudo = `// GERADO AUTOMATICAMENTE — não edite à mão para atualizar em massa.
// Fonte: HG Brasil Finance (api.hgbrasil.com/finance/ticker_list), baixado em ${new Date().toISOString().slice(0, 10)}.
// ${total} tickers da B3, agrupados por classe. Para atualizar: npm run tickers:update
//
// Esta lista serve para DETECTAR SUSPEITA de erro de digitação e nunca para corrigir
// automaticamente (invariante 5). Um ticker fora dela não é inválido — é desconhecido,
// e a decisão continua sendo do operador.

export const TICKERS_POR_CLASSE = {
${linhas}
};

export const NOMES_DE_CLASSE = {
  acao: 'Ação',
  fii: 'FII',
  bdr: 'BDR',
  etf: 'ETF',
  fundo: 'Fundo',
  fiagro: 'Fiagro',
  outros: 'Outro'
};

const indice = new Map();
for (const [classe, tickers] of Object.entries(TICKERS_POR_CLASSE)) {
  for (const ticker of tickers) indice.set(ticker, classe);
}

/** @returns {string|null} a classe do ticker, ou null se não estiver na lista da B3. */
export const classeDoTicker = (ticker) => indice.get(ticker) ?? null;

export const ehTickerConhecido = (ticker) => indice.has(ticker);

export const TODOS_OS_TICKERS = [...indice.keys()];
`;

await writeFile(new URL('../src/modulos/ordens/core/validate/tickersB3.js', import.meta.url), conteudo);
console.log(`\n${total} tickers escritos em src/modulos/ordens/core/validate/tickersB3.js`);
console.log('Rode `npm test` em seguida: os testes checam tickers reais contra a lista.');
