import { describe, expect, it } from 'vitest';
import { chaveDaBoleta, lerBoletaDoHub } from './boletaDoHub.js';
import { contaDaVenda, formatarCotas, vendaDaOrdem } from './venda.js';

// O formato do pre-check como o Hub o mandou em 20/10/2026 (só os campos que o robô entrega).
// Números de fundo da boleta real; a posição e a conta são inventadas.
const FUNDO_ID = '7f062a9b-0000-4000-8000-000000000001';
const CONTA = '1234567';

const preCheckDeVenda = (sobrescrever = {}) => ({
  fundoId: FUNDO_ID,
  lado: 'vender',
  quotaValue: 1502.84837186,
  quotaDate: '2026-10-19T00:00:00',
  stock: {
    canOperateBuyTreasury: false,
    canOperateBuyPeerToPeer: true,
    canOperateSellPeerToPeer: true,
    canOperateSellTreasury: false,
    treasury: { modalityId: 1, buy: {}, sell: { unitaryQuotaValue: 0, secondaryDiscount: 0, percentageComission: 0 } },
    peerToPeer: { modalityId: 2, buy: {}, sell: { unitaryQuotaValue: 1239.85, maxAmountVariationPercentage: 2, secondaryDiscount: 17.5, percentageComission: 0 } }
  },
  posicao: { quotaQuantity: 54.36585, quotaQuantityAvailable: 54.36585, quotaQuantityOnSale: 0 },
  em: new Date(2026, 9, 20, 11, 50).getTime(),
  ...sobrescrever
});

const estoque = { exportadaEm: '2026-10-20T11:00:00', fundos: [{ id: FUNDO_ID, nome: 'XP Private Equity I FIP Multi - Classe A', ticker: null }] };
const fundo = { situacao: 'exato', fundo: { nome: 'XP Private Equity I FIP Multi - Classe A', ticker: null } };
const ordem = (extra = {}) => ({ operacao: 'V', fundo, quantidade: null, financeiro: null, total: true, estoque: null, ...extra });
const boletas = (bruta = preCheckDeVenda()) => {
  const lida = lerBoletaDoHub(bruta);
  return { [chaveDaBoleta(lida.fundoId, 'vender', CONTA)]: lida };
};
const hoje = new Date(2026, 9, 20, 12, 0);

describe('lerBoletaDoHub', () => {
  it('lê a posição e as duas modalidades da venda', () => {
    const lida = lerBoletaDoHub(preCheckDeVenda());
    expect(lida.posicao).toEqual({ quantidade: 54.36585, disponivel: 54.36585, aVenda: 0 });
    expect(lida.modalidades.xp.aberta).toBe(false);
    expect(lida.modalidades.clientes).toMatchObject({ aberta: true, desagio: 17.5, corretagem: 0, pu: 1239.85, variacao: 2 });
    expect(lida.dataDaCota).toBe('2026-10-19');
  });

  it('na compra lê a quantidade disponível de cada estoque e não traz posição', () => {
    const lida = lerBoletaDoHub({
      fundoId: FUNDO_ID,
      lado: 'comprar',
      quotaValue: 9.326913,
      stock: {
        canOperateBuyTreasury: true,
        canOperateBuyPeerToPeer: false,
        treasury: { buy: { unitaryQuotaValue: 8.54, secondaryDiscount: 9.75, percentageComission: 1.5, quotaQuantityAvailable: 1916317.97566915 } },
        peerToPeer: { buy: { quotaQuantityAvailable: 0, maxAmountVariationPercentage: 2, secondaryDiscount: 9.9, percentageComission: 1.5 } }
      },
      posicao: { quotaQuantity: 1 }
    });
    expect(lida.posicao).toBeNull();
    expect(lida.modalidades.xp).toMatchObject({ aberta: true, desagio: 9.75, disponivel: 1916317.97566915 });
    expect(lida.modalidades.clientes).toMatchObject({ aberta: false, desagio: 9.9, disponivel: 0 });
  });

  it('recusa o que não é boleta', () => {
    expect(lerBoletaDoHub(null)).toBeNull();
    expect(lerBoletaDoHub({ lado: 'vender' })).toBeNull();
  });
});

describe('contaDaVenda — o painel da boleta', () => {
  it('bate centavo por centavo com o painel visto no Hub', () => {
    const c = contaDaVenda({ cotas: 54.36585, valorDaCota: 1502.84837186, desagio: 17.5, corretagem: 0 });
    expect(c.posicao.toFixed(2)).toBe('81703.63');
    expect(c.desagio.toFixed(2)).toBe('14298.14');
    expect(c.total.toFixed(2)).toBe('67405.49');
  });
});

describe('vendaDaOrdem', () => {
  it('não é venda de fundo: nada a dizer', () => {
    expect(vendaDaOrdem({ ...ordem(), operacao: 'C' }, { estoque, conta: CONTA })).toBeNull();
    expect(vendaDaOrdem({ ...ordem(), fundo: null }, { estoque, conta: CONTA })).toBeNull();
  });

  it('o total é a quantidade disponível da posição', () => {
    const v = vendaDaOrdem(ordem({ estoque: 'clientes' }), { estoque, boletas: boletas(), conta: CONTA, hoje });
    expect(v).toMatchObject({ situacao: 'pronto', quantidade: 54.36585, modalidade: 'clientes', outraAberta: false });
    expect(v.conta.total.toFixed(2)).toBe('67405.49');
  });

  it('sem nada escrito, vende no Estoque XP — fechado neste fundo', () => {
    const v = vendaDaOrdem(ordem(), { estoque, boletas: boletas(), conta: CONTA, hoje });
    expect(v.modalidade).toBe('xp');
    expect(v.condicoes.aberta).toBe(false);
    expect(v.outraAberta).toBe(true);
  });

  it('a quantidade escrita fica a escrita, e a posição vem junto para conferir', () => {
    const v = vendaDaOrdem(ordem({ total: false, quantidade: 100 }), { estoque, boletas: boletas(), conta: CONTA, hoje });
    expect(v.quantidade).toBe(100);
    expect(v.posicao.disponivel).toBe(54.36585);
  });

  it('sem os fundos, sem o fundo neles, ou sem a boleta lida, diz o que falta', () => {
    expect(vendaDaOrdem(ordem(), { estoque: null, conta: CONTA }).situacao).toBe('sem-planilha');
    expect(vendaDaOrdem(ordem(), { estoque: { fundos: [] }, conta: CONTA }).situacao).toBe('fora-da-planilha');
    expect(vendaDaOrdem(ordem(), { estoque, boletas: {}, conta: CONTA, hoje })).toMatchObject({ situacao: 'sem-boleta', fundoId: FUNDO_ID });
  });

  it('a boleta de outra conta não serve', () => {
    expect(vendaDaOrdem(ordem(), { estoque, boletas: boletas(), conta: '7654321', hoje }).situacao).toBe('sem-boleta');
  });

  it('a cotação vale um dia útil: de terça 11:50 até quarta 11:50', () => {
    const b = boletas();
    expect(vendaDaOrdem(ordem(), { estoque, boletas: b, conta: CONTA, hoje: new Date(2026, 9, 21, 11, 49) }).situacao).toBe('pronto');
    expect(vendaDaOrdem(ordem(), { estoque, boletas: b, conta: CONTA, hoje: new Date(2026, 9, 21, 11, 51) }).situacao).toBe('sem-boleta');
  });
});

describe('formatarCotas', () => {
  it('inteira sem separador; fracionada com as 8 casas da boleta', () => {
    expect(formatarCotas(5125)).toBe('5125');
    expect(formatarCotas(598)).toBe('598');
    expect(formatarCotas(123.4567891)).toBe('123,45678910');
    expect(formatarCotas(54.36585)).toBe('54,36585000');
  });
});
