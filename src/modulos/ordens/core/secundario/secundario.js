import { CORRETAGEM, contaDaBoleta, cotasPara, margemDoPu } from './boleta.js';
import { chaveDoFundo, procurarNoEstoque } from './estoque.js';

/**
 * O que os fundos do secundário dizem de uma ordem: a ligação entre a boleta e o Ordens.
 *
 * Vale só para **compra de fundo cetipado reconhecido pelo nome** — é a única ordem que passa pela
 * boleta do secundário. Ticker vai para a bolsa, e venda não usa estoque.
 *
 * Um pedido em R$ vira cotas: é a exceção à invariante 2 que o operador pediu em 05/10/2026,
 * porque o e-mail de fundo leva a quantidade. A conversão não adivinha nada — sai do estoque do
 * dia e do ROA máximo do fundo — e fica à vista no cartão antes de qualquer saída.
 *
 * **A barra da boleta divide o deságio.** O deságio da prateleira é o máximo: com o ROA zerado,
 * vai todo para o cliente; com a barra no fim, o cliente fica com o deságio mínimo, e a diferença
 * é o ROA adicional do escritório. Conferido em quatro boletas: Riza (2,50 / mínimo 1,50 / ROA
 * 1%), XPHF11 (5,50 / 5,00 / 0,5%), CPHF11 (6,75 / 6,25 / 0,5%) e IMOV11 (8,75 / 8,25 / 0,5%).
 *
 * O ROA máximo sai da captura do favorito do Hub (deságio − deságio mínimo). A planilha exportada
 * não traz o mínimo: com ela, vale o teto **anotado** por fundo no cartão, pelo fim da barra na
 * boleta, e lembrado com o deságio do dia em que foi visto. O do Hub vale mais que o anotado, por
 * ser o daquela hora.
 *
 * O e-mail sai num de dois cenários, escolhido para a solicitação inteira nos botões de copiar:
 * **ROA máximo** (o padrão) ou **ROA zerado**. Os dois são calculados, para o cartão mostrar lado a
 * lado; o escolhido fica em `roa`, `cotas` e `conta`, que é o que o validador e o e-mail leem. O
 * ROA zerado não precisa do teto: o deságio inteiro vai para o cliente.
 *
 * @typedef {object} Estoque
 * @property {string} arquivo
 * @property {string} exportadaEm  ISO; a hora da captura, ou a data do arquivo baixado
 * @property {'hub'|'planilha'} [origem]  `hub` é a captura do favorito
 * @property {import('./estoque.js').FundoDoEstoque[]} fundos
 *
 * @typedef {Record<string, {teto: number, desagio: number|null, em: string}>} Tetos
 *
 * O preço exato da cota, por código de fundo, como a boleta do Hub o mostra (`quotaValue` do
 * pre-check). A prateleira manda o PU arredondado em duas casas (8,34 para 8,337589), e a conta
 * conservadora perde umas cotas por isso. Vale só para o dia de cota em que foi visto.
 * @typedef {Record<string, {valor: number, dataDaCota: string}>} Cotas
 *
 * @typedef {'sem-planilha'|'fora-da-planilha'|'sem-teto'|'pronto'} SituacaoNoSecundario
 *
 * @typedef {{roa: number, cotas: number|null, conta: ReturnType<typeof contaDaBoleta>|null}} Cenario
 */

/**
 * Até quantos minutos uma cotação vale para o e-mail de um pedido em R$ sem perguntar. O deságio
 * muda ao longo do dia, e as cotas de uma cotação velha podem passar do valor pedido.
 */
export const LIMITE_DA_COTACAO_MIN = 10;

const mesmoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * O ROA máximo do fundo: o da captura do Hub, se veio; senão, o anotado.
 *
 * A conta (deságio − mínimo) foi conferida em boletas de fundos **com corretagem**. Nos sem
 * corretagem — FIPs e fundos fechados, XP CDI Private —, o modelo da boleta não foi visto, e ela
 * daria ROA de até 15% (mínimo 0,00 com deságio de 15%): o teto fica por anotar. A exceção é não
 * haver deságio a dividir, quando o teto é zero de qualquer jeito.
 */
const tetoDo = (fundo, tetos) => {
  const { desagio, desagioMinimo, corretagem } = fundo;
  const temMinimo = desagioMinimo !== null && desagioMinimo !== undefined && desagioMinimo <= desagio;
  if (temMinimo && (corretagem !== 0 || desagioMinimo === desagio)) {
    // 23,25 − 22,55 daria 0,6999999999999993: os dois vêm com duas casas.
    return { teto: Number((desagio - desagioMinimo).toFixed(6)), desagio, doHub: true };
  }
  return tetos[chaveDoFundo(fundo.nome)] ?? null;
};

/**
 * @param {object} ordem
 * @param {{estoque: Estoque|null, tetos?: Tetos, cotas?: Cotas, hoje?: Date, semRoa?: boolean}} contexto
 *   `semRoa` é a escolha da solicitação: o ROA zerado no lugar do máximo
 * @returns {null | {situacao: SituacaoNoSecundario,
 *   planilha?: {exportadaEm: string, deHoje: boolean, doHub: boolean, minutos: number},
 *   fundo?: object, teto?: object|null, semRoa?: boolean, porValor?: boolean,
 *   cenarios?: {maximo: Cenario|null, zerado: Cenario}, roa?: number, cotas?: number|null,
 *   conta?: ReturnType<typeof contaDaBoleta>|null, precoExatoMuda?: boolean}}
 */
export const secundarioDaOrdem = (ordem, { estoque, tetos = {}, cotas = {}, hoje = new Date(), semRoa = false }) => {
  if (ordem.fundo?.situacao !== 'exato' || ordem.operacao !== 'C') return null;
  if (!estoque) return { situacao: 'sem-planilha' };

  const tiradaEm = new Date(estoque.exportadaEm);
  const planilha = {
    exportadaEm: estoque.exportadaEm,
    deHoje: mesmoDia(tiradaEm, hoje),
    doHub: estoque.origem === 'hub',
    minutos: Math.floor((hoje - tiradaEm) / 60000)
  };
  const fundo = procurarNoEstoque(estoque.fundos, ordem.fundo.fundo);
  if (!fundo || fundo.pu === null || fundo.desagio === null) return { situacao: 'fora-da-planilha', planilha };

  const porValor = ordem.financeiro !== null && ordem.financeiro !== undefined;
  const teto = tetoDo(fundo, tetos);

  // Com o preço exato do dia, a conta é a da boleta, sem a margem do arredondamento.
  const exato = fundo.id ? cotas[fundo.id] : null;
  const puExato = exato && fundo.dataDaCota && exato.dataDaCota === fundo.dataDaCota ? exato.valor : null;
  const pu = puExato ?? fundo.pu;
  const casasDoPu = puExato === null ? fundo.casasDoPu : 6;

  const cenario = (roa) => {
    const boleta = { pu, casasDoPu, desagio: fundo.desagio, roa, corretagem: fundo.corretagem ?? CORRETAGEM };
    const cotas = porValor ? cotasPara(ordem.financeiro, boleta) : (ordem.quantidade ?? null);
    return { roa, cotas, conta: cotas ? contaDaBoleta({ ...boleta, cotas }) : null };
  };
  const cenarios = { maximo: teto ? cenario(teto.teto) : null, zerado: cenario(0) };

  // Se o preço exato pode mudar as cotas, em algum dos dois cenários: o de verdade está a menos de
  // meia casa do arredondado, e a conta acima já usa a ponta de cima. Se a de baixo dá as mesmas
  // cotas, abrir a boleta não muda nada no e-mail.
  const puMaisBaixo = { pu: fundo.pu - margemDoPu(fundo.casasDoPu), casasDoPu: 6, desagio: fundo.desagio, corretagem: fundo.corretagem ?? CORRETAGEM };
  const precoExatoMuda =
    porValor &&
    puExato === null &&
    [cenarios.maximo, cenarios.zerado].some((c) => c && cotasPara(ordem.financeiro, { ...puMaisBaixo, roa: c.roa }) !== c.cotas);

  const base = { planilha, fundo, teto, semRoa, porValor, cenarios, pu, puExato: puExato !== null, precoExatoMuda };

  const escolhido = semRoa ? cenarios.zerado : cenarios.maximo;
  if (!escolhido) return { situacao: 'sem-teto', ...base };

  return { situacao: 'pronto', ...base, ...escolhido };
};
