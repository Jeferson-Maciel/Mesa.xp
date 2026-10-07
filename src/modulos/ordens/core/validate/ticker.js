import { TODOS_OS_TICKERS, classeDoTicker } from './tickersB3.js';
import { FUNDOS_XP } from './fundosXP.js';

/**
 * Fundos da prateleira da XP que também são negociados em bolsa.
 *
 * A lista da B3 envelhece: fundos listados recentemente (`JGPT11`, `VICA11`, `PIER11`…) não
 * aparecem nela, e sem esta segunda fonte um pedido perfeitamente normal sairia com quatro
 * bloqueios de "ticker suspeito" em sete linhas. Alarme falso em série é pior que alarme
 * nenhum: ele treina o operador a passar por cima do aviso, e aí o aviso verdadeiro passa junto.
 */
const NOME_NA_PRATELEIRA = new Map(
  FUNDOS_XP.filter((f) => f.ticker).map((f) => [f.ticker.toUpperCase(), f.nome])
);

/**
 * Reconhecimento de ticker e suspeita de erro de digitação.
 *
 * O ponto central, e a razão de a lista da B3 existir no projeto: `KCNR11` é um ticker
 * perfeitamente bem formado — nenhuma regra de formato pega a troca de letras que o separa de
 * `KNCR11`. Só a comparação contra a lista revela a suspeita.
 *
 * O resultado é sempre um *diagnóstico*, nunca uma correção: `ticker` devolve o que o operador
 * digitou, e `sugestoes` fica ao lado para ele decidir (invariante 5).
 */

/**
 * Quatro caracteres de raiz (letras, com dígito no meio nos BDRs como `A1AP34`, `M2ST34`)
 * seguidos de um ou dois dígitos de espécie.
 */
const FORMATO = /^[A-Z][A-Z0-9]{3}\d{1,2}$/;

export const temFormatoDeTicker = (token) =>
  typeof token === 'string' && FORMATO.test(token.trim().toUpperCase());

const raizDe = (ticker) => ticker.slice(0, 4);
const especieDe = (ticker) => ticker.slice(4);

/**
 * Espécies que compartilham raiz com um papel negociado: recibos de subscrição de FII (12, 13)
 * e as espécies ordinárias/preferenciais de uma ação. Um recibo não aparece em lista nenhuma de
 * negociação, e sem isto todo `RECR12` viraria alerta de ticker suspeito.
 */
const ESPECIES_IRMAS = {
  11: ['12', '13'],
  3: ['4', '5', '6'],
  4: ['3', '5', '6'],
  5: ['3', '4', '6'],
  6: ['3', '4', '5']
};

const temIrmaConhecida = (ticker) => {
  const raiz = raizDe(ticker);
  const especie = especieDe(ticker);

  for (const [base, derivadas] of Object.entries(ESPECIES_IRMAS)) {
    if (derivadas.includes(especie) && classeDoTicker(raiz + base)) return raiz + base;
  }
  return null;
};

/** Distância de Damerau-Levenshtein, que conta a transposição de vizinhos como um único erro. */
const distancia = (a, b) => {
  const linhas = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linhas[i][j] = Math.min(linhas[i - 1][j] + 1, linhas[i][j - 1] + 1, linhas[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        linhas[i][j] = Math.min(linhas[i][j], linhas[i - 2][j - 2] + custo);
      }
    }
  }
  return linhas[a.length][b.length];
};

// Os tickers da prateleira entram na comparação: `VGRP11` digitado errado sugere o `VGPR11`.
const CANDIDATOS = [...new Set([...TODOS_OS_TICKERS, ...NOME_NA_PRATELEIRA.keys()])];

const parecidos = (ticker) =>
  CANDIDATOS.filter((t) => t.length === ticker.length && distancia(t, ticker) === 1);

/**
 * @typedef {'conhecido'|'variante'|'parecido'|'desconhecido'} Situacao
 * @typedef {object} DiagnosticoDeTicker
 * @property {string} ticker    o que foi digitado, em maiúsculas — nunca a sugestão
 * @property {Situacao} situacao
 * @property {string|null} classe
 * @property {string|null} nome  o nome do fundo, quando o ticker está na prateleira da XP
 * @property {string[]} sugestoes
 */

/** @returns {DiagnosticoDeTicker} */
export const analisarTicker = (bruto) => {
  const ticker = String(bruto ?? '').trim().toUpperCase();
  const nome = NOME_NA_PRATELEIRA.get(ticker) ?? null;

  const classe = classeDoTicker(ticker);
  if (classe) return { ticker, situacao: 'conhecido', classe, nome, sugestoes: [] };

  // Está na prateleira da XP mesmo sem estar na lista da B3: é papel que o escritório
  // negocia, e nada aqui tem autoridade para chamá-lo de suspeito.
  if (nome) return { ticker, situacao: 'conhecido', classe: 'outros', nome, sugestoes: [] };

  const irma = temIrmaConhecida(ticker);
  if (irma) return { ticker, situacao: 'variante', classe: classeDoTicker(irma), nome, sugestoes: [] };

  const sugestoes = parecidos(ticker);
  if (sugestoes.length > 0) return { ticker, situacao: 'parecido', classe: null, nome, sugestoes };

  return { ticker, situacao: 'desconhecido', classe: null, nome, sugestoes: [] };
};
