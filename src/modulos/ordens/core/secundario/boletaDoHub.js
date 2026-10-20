/**
 * O que a boleta do secundário do Hub mostra, lido do `pre-check` que o robô entrega.
 *
 * Visto no Hub de verdade em 20/10/2026, na compra do IMOV11 e na venda de um FIP: a boleta de compra
 * (`#/secundario/comprar/<fundo>/<conta>`) e a de venda (`#/secundario/vender/<fundo>/<conta>`)
 * chamam o mesmo `order-secondary/pre-check`, e ele traz, em `fund.stock`, as duas modalidades:
 *
 *   treasury (modalityId 1)   o **Estoque XP**: a operação é contra a posição da própria XP
 *   peerToPeer (modalityId 2) o **Estoque clientes**: uma intenção de ordem que a Mesa de Fundos
 *                             casa por ordem de chegada; o que não casar até as 14:00 é cancelado.
 *                             O preço pode variar até `maxAmountVariationPercentage` (2%)
 *
 * cada uma com `buy` e `sell` (deságio, corretagem, PU e, na compra, a quantidade disponível), e as
 * travas `canOperateBuyTreasury`, `canOperateBuyPeerToPeer`, `canOperateSellTreasury` e
 * `canOperateSellPeerToPeer` — que mudam por fundo e por dia (no IMOV11 de 20/10, a XP não comprava,
 * e o Estoque clientes não tinha cotas para vender).
 *
 * Na venda, `customer.balancePosition` traz a posição do cliente: a quantidade, a **disponível** (a
 * que a boleta deixa vender, com até 8 casas) e a que já está à venda. É o único dado de cliente que
 * o robô entrega, e só para a conta do pedido; a Mesa o guarda só na memória da página.
 *
 * Fica aqui, e não no robô, a leitura dos campos: o robô é um script colado no Tampermonkey de cada
 * um e não se atualiza sozinho, e o Ordens muda com o build.
 */

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * @typedef {object} Modalidade
 * @property {boolean} aberta
 * @property {number|null} desagio     em %
 * @property {number|null} corretagem  em %
 * @property {number|null} pu          o PU com que a boleta faz a conta, já com o deságio
 * @property {number|null} disponivel  cotas no estoque (só na compra)
 * @property {number|null} variacao    quanto o preço pode variar, em % (só no Estoque clientes)
 *
 * @typedef {object} BoletaDoHub
 * @property {string} fundoId
 * @property {'comprar'|'vender'} lado
 * @property {number|null} valorDaCota  o PU exato do dia (`quotaValue`)
 * @property {string|null} dataDaCota   'AAAA-MM-DD'
 * @property {{xp: Modalidade, clientes: Modalidade}} modalidades
 * @property {{quantidade: number|null, disponivel: number|null, aVenda: number|null}|null} posicao
 * @property {number} em  quando foi lida (ms)
 */

const modalidade = (bruta, lado, aberta) => {
  const deLado = bruta?.[lado === 'comprar' ? 'buy' : 'sell'] ?? {};
  return {
    aberta: aberta === true,
    desagio: numero(deLado.secondaryDiscount),
    corretagem: numero(deLado.percentageComission),
    pu: numero(deLado.unitaryQuotaValue),
    disponivel: lado === 'comprar' ? numero(deLado.quotaQuantityAvailable) : null,
    variacao: numero(deLado.maxAmountVariationPercentage)
  };
};

/**
 * @param {object} bruta  o que o robô entregou: `{fundoId, lado, quotaValue, quotaDate, stock, posicao, em}`
 * @returns {BoletaDoHub|null} null quando não é a resposta de uma boleta do secundário
 */
export const lerBoletaDoHub = (bruta) => {
  if (!bruta || typeof bruta !== 'object' || typeof bruta.fundoId !== 'string') return null;
  const lado = bruta.lado === 'vender' ? 'vender' : 'comprar';
  const stock = bruta.stock && typeof bruta.stock === 'object' ? bruta.stock : null;
  const compra = lado === 'comprar';

  const posicao =
    lado === 'vender' && bruta.posicao && typeof bruta.posicao === 'object'
      ? {
          quantidade: numero(bruta.posicao.quotaQuantity),
          disponivel: numero(bruta.posicao.quotaQuantityAvailable),
          aVenda: numero(bruta.posicao.quotaQuantityOnSale)
        }
      : null;

  return {
    fundoId: bruta.fundoId,
    lado,
    valorDaCota: numero(bruta.quotaValue),
    dataDaCota: String(bruta.quotaDate ?? '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    modalidades: stock
      ? {
          xp: modalidade(stock.treasury, lado, compra ? stock.canOperateBuyTreasury : stock.canOperateSellTreasury),
          clientes: modalidade(stock.peerToPeer, lado, compra ? stock.canOperateBuyPeerToPeer : stock.canOperateSellPeerToPeer)
        }
      : null,
    posicao,
    em: typeof bruta.em === 'number' ? bruta.em : Date.now()
  };
};

/** A chave de uma boleta lida: a de venda é por cliente, porque traz a posição dele. */
export const chaveDaBoleta = (fundoId, lado, conta) => (lado === 'vender' ? `${fundoId}|vender|${conta}` : `${fundoId}|comprar`);
