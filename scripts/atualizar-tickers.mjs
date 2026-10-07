/**
 * Regenera `src/modulos/ordens/core/validate/tickersB3.js` a partir do Cadastro de Instrumentos da
 * própria B3 (o arquivo `InstrumentsConsolidated`, público, publicado a cada pregão em
 * arquivos.b3.com.br).
 *
 * Até 07/10/2026 a fonte era a HG Brasil Finance, com 1.624 tickers: faltavam centenas de BDRs
 * (só um BDR de ETF, os de final 39), fundos e ETFs novos. `BURA39` aparecia como desconhecido, e
 * `RARA11` — um ETF — era bloqueado como erro de digitação de `RURA11`. O cadastro da B3 tem todos
 * os papéis à vista, com a categoria de cada um.
 *
 * Rodar de tempos em tempos: a B3 lista e deslista papéis, e um ticker novo ausente da lista vira
 * aviso de "fora da lista" (ou bloqueio de suspeita, se parecer com outro).
 *
 * Uso: npm run tickers:update
 */

import { writeFile } from 'node:fs/promises';

const API = 'https://arquivos.b3.com.br/api/download';

/** O arquivo do dia, em texto, ou null se aquele dia não tem (fim de semana, feriado). */
const baixarDoDia = async (dia) => {
  const pedido = await fetch(`${API}/requestname?fileName=InstrumentsConsolidated&date=${dia}`);
  if (!pedido.ok) return null;
  const token = (await pedido.json().catch(() => ({}))).redirectUrl?.split('token=')[1];
  if (!token) return null;
  const arquivo = await fetch(`${API}/?token=${token}`);
  if (!arquivo.ok) return null;
  const texto = new TextDecoder('latin1').decode(await arquivo.arrayBuffer());
  return texto.includes('TckrSymb') ? texto : null;
};

// O último pregão com arquivo: hoje ou até uma semana para trás.
let texto = null;
let dia = null;
for (let atras = 0; atras < 8 && !texto; atras++) {
  dia = new Date(Date.now() - atras * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  texto = await baixarDoDia(dia);
}
if (!texto) throw new Error('O Cadastro de Instrumentos da B3 não veio para nenhum dos últimos 8 dias.');

const linhas = texto.split(/\r?\n/);
const iCabecalho = linhas.findIndex((l) => l.startsWith('RptDt;'));
const cabecalho = linhas[iCabecalho].split(';');
const coluna = (nome) => cabecalho.indexOf(nome);
const [TICKER, SEGMENTO, MERCADO, CATEGORIA, NOME] = ['TckrSymb', 'SgmtNm', 'MktNm', 'SctyCtgyNm', 'CrpnNm'].map(coluna);

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

/**
 * A B3 põe FII, Fiagro, FI-Infra e FIP na mesma categoria (FUNDS): a classe sai do nome do fundo.
 * Conferido contra a lista antiga em 07/10/2026: concorda em quase todos, e onde discorda o nome
 * costuma dar razão à regra (BTAL11 e BTRA11 se chamam "FIAGRO" e estavam como FII).
 */
const classeDoFundo = (nome) => {
  const n = semAcento(nome);
  if (/FIAGRO|FIAG\b|FI AGRO|CADEIAS? (PROD|DO AGRO|AGRO)|CAD PROD AGRO|AGRONEG/.test(n)) return 'fiagro';
  if (/\bFII\b|IMOB/.test(n)) return 'fii';
  if (/INFRA|INC\.? INV|INCENTIVAD|\bFIP\b|\bIE\b|PARTICIP|INV(EST)?\.? (EM )?PART|FDO\.? INV\.? PART|FINANCEIRO|\bINC\.?$|DEBENT|\bFIDC\b|ROYALTIES/.test(n)) {
    return 'fundo';
  }
  if (/AGRO/.test(n)) return 'fiagro';
  return 'fii';
};

// Só o mercado à vista, e só os finais de papel negociado: ação 3 a 8 e unit 11; BDR 31 a 35 e 39;
// ETF e fundo 11. Fora ficam opções, direitos, recibos e as outras séries de fundo (12, 15…): esses
// o `ticker.js` já reconhece como espécie irmã do papel de final 11.
const classeDe = (categoria, ticker, nome) => {
  if ((categoria === 'SHARES' || categoria === 'UNIT') && /^[A-Z0-9]{4}([3-8]|11)$/.test(ticker)) return 'acao';
  if (categoria === 'BDR' && /^[A-Z0-9]{4}3[1-59]$/.test(ticker)) return 'bdr';
  if (categoria.startsWith('ETF') && /^[A-Z0-9]{4}11$/.test(ticker)) return 'etf';
  if (categoria === 'FUNDS' && /^[A-Z0-9]{4}11$/.test(ticker)) return classeDoFundo(nome);
  return null;
};

const porClasse = { acao: [], fii: [], bdr: [], etf: [], fundo: [], fiagro: [], outros: [] };
const vistos = new Set();
for (const linha of linhas.slice(iCabecalho + 1)) {
  const c = linha.split(';');
  if (c[SEGMENTO] !== 'CASH' || c[MERCADO] !== 'EQUITY-CASH') continue;
  const ticker = c[TICKER]?.trim();
  const classe = ticker && !vistos.has(ticker) ? classeDe(c[CATEGORIA], ticker, c[NOME] ?? '') : null;
  if (!classe) continue;
  vistos.add(ticker);
  porClasse[classe].push(ticker);
}
for (const tickers of Object.values(porClasse)) tickers.sort();
for (const [classe, tickers] of Object.entries(porClasse)) console.log(`${classe}: ${tickers.length}`);

const total = vistos.size;
if (total < 2000) throw new Error(`Só ${total} tickers — arquivo suspeito, lista não reescrita.`);

const linhasDoArquivo = Object.entries(porClasse)
  .map(([classe, tickers]) => `  ${classe}: ${tickers.length ? `${JSON.stringify(tickers.join(' '))}.split(' ')` : '[]'},`)
  .join('\n');

const conteudo = `// GERADO AUTOMATICAMENTE — não edite à mão para atualizar em massa.
// Fonte: B3, Cadastro de Instrumentos (InstrumentsConsolidated), mercado à vista, pregão de ${dia}.
// ${total} tickers, agrupados por classe. Para atualizar: npm run tickers:update
//
// Esta lista serve para DETECTAR SUSPEITA de erro de digitação e nunca para corrigir
// automaticamente (invariante 5). Um ticker fora dela não é inválido — é desconhecido,
// e a decisão continua sendo do operador.

export const TICKERS_POR_CLASSE = {
${linhasDoArquivo}
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
console.log(`\n${total} tickers escritos em src/modulos/ordens/core/validate/tickersB3.js (pregão de ${dia})`);
console.log('Rode `npm test` em seguida: os testes checam tickers reais contra a lista.');
