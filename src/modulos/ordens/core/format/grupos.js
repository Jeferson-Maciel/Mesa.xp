/**
 * Os grupos de e-mail de uma solicitação: cada conta gera até quatro e-mails, um por grupo
 * (decidido com o operador em 20/10/2026, com um pedido real que misturava bolsa e fundos):
 *
 *   bolsa          ações, FIIs listados, ETFs e BDRs — compra e venda juntas, no modelo de sempre
 *   fundos-compra  fundos cetipados comprados pela boleta do secundário, no modelo de sempre, com as
 *                  cotas
 *   fundos-venda   fundos cetipados vendidos no secundário, no modelo da auditoria de venda, com a
 *                  cotação de cada um
 *   tesouro        Tesouro Direto, no modelo de aplicação ("Confirmação aplicação Tesouro Direto"),
 *                  com o título, a taxa e o vencimento da lista do Hub
 *
 * O e-mail em tabela, o Lote Simples e o TWAP são de bolsa: levam as
 * ordens de bolsa e os fundos escritos pelo ticker (`VGPR11`), que cabem na coluna `Ativo` e podem ser
 * comprados em bolsa — ali eles seguem com o bloqueio confirmável de sempre.
 *
 * Um grupo é a própria solicitação com só as ordens dele: o validador e os formatadores não mudam de
 * contrato. As ordens são as mesmas (não cópias), e a ordem de digitação se mantém (invariante 9).
 */

export const GRUPOS = ['bolsa', 'fundos-compra', 'fundos-venda', 'tesouro'];

export const ROTULOS_DOS_GRUPOS = {
  bolsa: 'Bolsa',
  'fundos-compra': 'Fundos · Compra',
  'fundos-venda': 'Fundos · Venda',
  tesouro: 'Tesouro Direto'
};

/** O assunto do e-mail de cada grupo no Outlook: o Tesouro tem o dele (decisão do operador). */
export const ASSUNTOS_DOS_GRUPOS = {
  tesouro: 'Confirmação aplicação Tesouro Direto'
};

/** Fundo da prateleira escrito pelo ticker: o código cabe na coluna `Ativo` dos TSVs. */
const peloTicker = (o) => Boolean(o.fundo?.fundo?.ticker) && o.ativo === o.fundo.fundo.ticker;

/** @returns {'bolsa'|'fundos-compra'|'fundos-venda'|'tesouro'} */
export const grupoDaOrdem = (ordem) =>
  ordem.tesouro ? 'tesouro' : !ordem.fundo ? 'bolsa' : ordem.operacao === 'V' ? 'fundos-venda' : 'fundos-compra';

/** @returns {string[]} os grupos que a solicitação tem, na ordem de `GRUPOS` */
export const gruposDe = (solicitacao) => GRUPOS.filter((g) => (solicitacao.ordens ?? []).some((o) => grupoDaOrdem(o) === g));

/**
 * A solicitação com só as ordens de um grupo, para um formato.
 *
 * @param {object} solicitacao
 * @param {string} grupo
 * @param {'email'|'auditoria'|'lote'|'twap'} formato
 */
export const recorte = (solicitacao, grupo, formato = 'email') => {
  const entra =
    formato === 'email'
      ? (o) => grupoDaOrdem(o) === grupo
      : // Tabela, lote e TWAP: bolsa, mais os fundos escritos pelo ticker.
        (o) => grupoDaOrdem(o) === 'bolsa' || peloTicker(o);
  return { ...solicitacao, ordens: (solicitacao.ordens ?? []).filter(entra), grupo };
};

/** O índice da ordem na solicitação inteira, a partir do índice dela no grupo. */
export const indiceNaSolicitacao = (solicitacao, parte, indice) =>
  indice === null || indice === undefined ? null : solicitacao.ordens.indexOf(parte.ordens[indice]);
