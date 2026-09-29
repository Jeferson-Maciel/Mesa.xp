import { FUNDOS_XP } from './fundosXP.js';

/**
 * Busca de fundo pelo nome comercial, contra a prateleira da XP.
 *
 * Os fundos cetipados não têm ticker: chegam escritos por extenso, do jeito que o assessor
 * digitou ("BGR Galpões Logísticos I Feeder FII", "Riza terrax - prefixado"). Um nome erra de um
 * jeito que um ticker não erra — por uma palavra. `XP Habitat Renda Imobiliária Feeder` e
 * `XP Habitat Renda Imobiliária II Feeder` são fundos diferentes separados por um numeral, e
 * Feeder e Master são fundos diferentes separados por uma palavra.
 *
 * Por isso esta função **nunca elege um fundo quando há mais de um candidato**. Ela é a
 * contraparte de `analisarTicker` para nomes: diagnostica e devolve os candidatos, e a escolha
 * continua sendo do operador.
 */

/** Tira acento, caixa e pontuação, preservando os números e as palavras que distinguem. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();

const lerQtdMinima = (texto) => {
  const n = parseInt(String(texto ?? '').replace(/\./g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const CATALOGO = FUNDOS_XP.map((f) => ({
  nome: f.nome,
  ticker: f.ticker,
  qtdMinima: lerQtdMinima(f.qtdMinima),
  chave: normalizar(f.nome),
  chaveTicker: f.ticker ? normalizar(f.ticker) : null
}));

const semCatalogo = (consulta) => ({ consulta, situacao: 'nenhum', fundo: null, candidatos: [] });

const publico = ({ chave, chaveTicker, ...resto }) => resto;

/**
 * @typedef {'exato'|'ambiguo'|'parcial'|'nenhum'} SituacaoDoFundo
 *
 * - `exato`    — um único fundo cabe no que foi digitado; vem em `fundo`.
 * - `ambiguo`  — o texto cabe em vários; todos vêm em `candidatos` e `fundo` fica nulo.
 * - `parcial`  — nenhum fundo contém tudo o que foi digitado, mas há parecidos o bastante para
 *                valer confirmação. Nunca é promovido a `exato` sozinho.
 * - `nenhum`   — não há a que se agarrar.
 *
 * @param {string} texto
 * @returns {{consulta: string, situacao: SituacaoDoFundo,
 *            fundo: {nome: string, ticker: string|null, qtdMinima: number|null}|null,
 *            candidatos: Array<{nome: string, ticker: string|null, qtdMinima: number|null}>}}
 */
export const procurarFundo = (texto) => {
  const consulta = normalizar(texto);
  if (!consulta) return semCatalogo(consulta);

  const porTicker = CATALOGO.filter((f) => f.chaveTicker === consulta);
  if (porTicker.length === 1) {
    return { consulta, situacao: 'exato', fundo: publico(porTicker[0]), candidatos: [] };
  }

  const termos = consulta.split(' ');

  // Contêm TODOS os termos digitados: o operador escreveu algo que cabe inteiro nestes nomes.
  const contemTudo = CATALOGO.filter((f) => termos.every((t) => f.chave.includes(t)));

  if (contemTudo.length === 1) {
    return { consulta, situacao: 'exato', fundo: publico(contemTudo[0]), candidatos: [] };
  }

  if (contemTudo.length > 1) {
    // Um nome idêntico ao digitado desempata: quem escreveu o nome inteiro não está em dúvida.
    const identico = contemTudo.filter((f) => f.chave === consulta);
    if (identico.length === 1) {
      return { consulta, situacao: 'exato', fundo: publico(identico[0]), candidatos: [] };
    }
    return { consulta, situacao: 'ambiguo', fundo: null, candidatos: contemTudo.map(publico) };
  }

  // Ninguém contém tudo. Procuramos parecença suficiente para valer uma confirmação — e só
  // confirmação: um nome que não bate por inteiro nunca vira escolha automática.
  const pontuados = CATALOGO.map((f) => ({
    fundo: f,
    acertos: termos.filter((t) => f.chave.includes(t)).length
  })).filter(({ acertos }) => acertos >= 2 && acertos / termos.length >= 0.5);

  if (pontuados.length === 0) return semCatalogo(consulta);

  const melhor = Math.max(...pontuados.map((p) => p.acertos));
  const candidatos = pontuados.filter((p) => p.acertos === melhor).map((p) => publico(p.fundo));

  return { consulta, situacao: 'parcial', fundo: null, candidatos };
};

export const TOTAL_DE_FUNDOS = CATALOGO.length;
