import { chaveDaBoleta } from './boletaDoHub.js';
import { procurarNoEstoque } from './estoque.js';
import { umDiaUtilDepois } from '../../../../comum/diasUteis.js';

/**
 * A venda de fundo do secundário: o que a boleta de venda do Hub diz de uma ordem.
 *
 * Decidido com o operador em 20/10/2026, com o e-mail de auditoria aprovado na mão:
 * - a quantidade de "Total" é a quantidade **disponível** da posição, com todas as casas;
 * - a quantidade escrita é conferida contra a posição: acima dela, bloqueia;
 * - sem nada escrito, a venda é no **Estoque XP**; "estoque cliente" no pedido vende no **Estoque
 *   clientes**. Com a modalidade fechada no dia, bloqueia e oferece a outra — a decisão é do
 *   operador, porque o preço muda e o Estoque clientes pode não executar;
 * - venda em R$ não é tratada: o e-mail leva cotas;
 * - a cotação vale **um dia útil** a partir da hora em que foi lida (e o print dela, na fase 2).
 *
 * A boleta lida (`core/secundario/boletaDoHub.js`) chega do robô, que a abre para a conta do pedido
 * sem digitar nada: a posição e as condições já vêm no pre-check.
 *
 * @typedef {'sem-planilha'|'fora-da-planilha'|'sem-boleta'|'pronto'} SituacaoDaVenda
 */

/** As contas da venda, como o painel "Visualizar mais detalhes da operação" da boleta as mostra. */
export const contaDaVenda = ({ cotas, valorDaCota, desagio, corretagem = 0 }) => {
  const posicao = cotas * valorDaCota;
  const valorDoDesagio = (posicao * desagio) / 100;
  const comDesagio = posicao - valorDoDesagio;
  const valorDaCorretagem = (comDesagio * corretagem) / 100;
  return { posicao, desagio: valorDoDesagio, comDesagio, corretagem: valorDaCorretagem, total: comDesagio - valorDaCorretagem };
};

/**
 * @param {object} ordem
 * @param {{estoque: object|null, boletas?: Record<string, import('./boletaDoHub.js').BoletaDoHub>,
 *   conta: string|null, hoje?: Date}} contexto
 * @returns {null | {situacao: SituacaoDaVenda, modalidade: 'xp'|'clientes', total: boolean,
 *   quantidade: number|null, fundoId?: string, posicao?: object|null, condicoes?: object|null,
 *   outraAberta?: boolean, lidaEm?: number, validaAte?: Date, conta?: ReturnType<typeof contaDaVenda>|null}}
 */
export const vendaDaOrdem = (ordem, { estoque, boletas = {}, conta, hoje = new Date() }) => {
  if (ordem.operacao !== 'V' || ordem.fundo?.situacao !== 'exato') return null;

  const modalidade = ordem.estoque === 'clientes' ? 'clientes' : 'xp';
  const total = ordem.total === true;
  const escrita = total ? null : (ordem.quantidade ?? null);
  const base = { modalidade, total, quantidade: escrita };

  if (!estoque) return { situacao: 'sem-planilha', ...base };
  const fundo = procurarNoEstoque(estoque.fundos, ordem.fundo.fundo);
  if (!fundo?.id) return { situacao: 'fora-da-planilha', ...base };

  const lida = boletas[chaveDaBoleta(fundo.id, 'vender', conta)];
  const validaAte = lida ? umDiaUtilDepois(lida.em) : null;
  if (!lida || hoje > validaAte) return { situacao: 'sem-boleta', fundoId: fundo.id, ...base };

  const condicoes = lida.modalidades?.[modalidade] ?? null;
  const outra = lida.modalidades?.[modalidade === 'xp' ? 'clientes' : 'xp'] ?? null;
  const quantidade = total ? (lida.posicao?.disponivel ?? null) : escrita;
  const valorDaCota = lida.valorDaCota;

  return {
    situacao: 'pronto',
    fundoId: fundo.id,
    ...base,
    quantidade,
    posicao: lida.posicao,
    condicoes,
    outraAberta: outra?.aberta === true,
    lidaEm: lida.em,
    validaAte,
    valorDaCota,
    conta:
      quantidade > 0 && valorDaCota && condicoes?.desagio !== null && condicoes?.desagio !== undefined
        ? contaDaVenda({ cotas: quantidade, valorDaCota, desagio: condicoes.desagio, corretagem: condicoes.corretagem ?? 0 })
        : null
  };
};

/**
 * A quantidade como o e-mail de venda a escreve: inteira, sem separador de milhar; fracionada, com
 * as 8 casas do campo de quantidade da boleta (`123,45678910`, como no e-mail aprovado).
 */
export const formatarCotas = (cotas) =>
  Number.isInteger(cotas) ? String(cotas) : Number(cotas).toFixed(8).replace('.', ',');
