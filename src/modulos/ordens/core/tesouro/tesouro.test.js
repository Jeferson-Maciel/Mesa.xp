import { describe, expect, it } from 'vitest';
import { acharTitulo, especieDoNome, lerPosicoesDoHub, lerTitulosDoHub, noHorarioDoTesouro, pedidoDeTesouro, resgateDaOrdem, semOTitulo, tesouroDaOrdem } from './tesouro.js';
import { ehDiaUtil } from '../util/diasUteis.js';

// A lista como o Hub a mandou em 20/10/2026 (dados de título, públicos), um de cada espécie.
const DO_HUB = [
  { codeBonds: 212, descTypeBond: 'LFT', expirateDate: '2031-03-01T00:00:00-03:00', buyValue: 20043.37, minimumInvestmentValue: 200.43, nickname: 'Tesouro Selic 2031', descIndex: 'SELIC', profitability: 'SELIC + 0,0992 %' },
  { codeBonds: 174, descTypeBond: 'LTN', expirateDate: '2029-01-01T00:00:00-03:00', buyValue: 772.09, minimumInvestmentValue: 7.72, nickname: 'Tesouro Prefixado 2029', descIndex: 'prefixado', profitability: '12,63 %' },
  { codeBonds: 214, descTypeBond: 'LTN', expirateDate: '2032-01-01T00:00:00-03:00', buyValue: 536.71, minimumInvestmentValue: 5.36, nickname: 'Tesouro Prefixado 2032', profitability: '12,81 %' },
  { codeBonds: 222, descTypeBond: 'NTN-B', expirateDate: '2037-05-15T00:00:00-03:00', buyValue: 4626.99, minimumInvestmentValue: 46.26, nickname: 'Tesouro IPCA+ com Juros Semestrais 2037', profitability: 'IPCA+ 6,84 %' },
  { codeBonds: 223, descTypeBond: 'NTN-B', expirateDate: '2045-05-15T00:00:00-03:00', buyValue: 4549.4, minimumInvestmentValue: 45.49, nickname: 'Tesouro IPCA+ com Juros Semestrais 2045', profitability: 'IPCA+ 6,74 %' },
  { codeBonds: 300, descTypeBond: 'NTN-B1', expirateDate: '2034-12-15T00:00:00-03:00', buyValue: 3309.21, minimumInvestmentValue: 33.09, nickname: 'Tesouro Educa+ 2030', profitability: 'IPCA+ 6,76 %' },
  { codeBonds: 400, descTypeBond: 'NTN-B1', expirateDate: '2084-12-15T00:00:00-03:00', buyValue: 900, minimumInvestmentValue: 9, nickname: 'Tesouro Renda+ Aposentadoria Extra 2065', profitability: 'IPCA+ 6,6 %' }
];
const TITULOS = lerTitulosDoHub(DO_HUB);
const achar = (linha) => acharTitulo(pedidoDeTesouro(linha), TITULOS);

describe('lerTitulosDoHub', () => {
  it('lê nome, espécie, ano, vencimento, taxa como o Hub mostra, PU e mínimo', () => {
    expect(TITULOS[0]).toEqual({ codigo: 212, tipo: 'LFT', nome: 'Tesouro Selic 2031', especie: 'selic', ano: 2031, vencimento: '01/03/2031', taxa: 'SELIC + 0,0992 %', pu: 20043.37, minimo: 200.43 });
    expect(TITULOS.map((t) => t.especie)).toEqual(['selic', 'prefixado', 'prefixado', 'ipca-juros', 'ipca-juros', 'educa', 'renda']);
    expect(TITULOS[5]).toMatchObject({ ano: 2030, vencimento: '15/12/2034' });
  });

  it('pula o que não tem nome', () => {
    expect(lerTitulosDoHub([{ codeBonds: 1 }, null])).toEqual([]);
  });
});

describe('pedidoDeTesouro — como o assessor escreve', () => {
  it('reconhece o nome, o código e o tipo com o ano', () => {
    for (const linha of ['Tesouro Selic 2031', 'Selic 2031 - 2k', 'LFT 2k', 'LFT - R$ 81.708,17', 'Compra Tesouro Selic 2031 R$ 2.000,00']) {
      expect(pedidoDeTesouro(linha)?.especies, linha).toEqual(['selic']);
    }
    expect(pedidoDeTesouro('Pré 2029 R$ 5.000')).toMatchObject({ especies: ['prefixado', 'prefixado-juros'], ano: 2029 });
    expect(pedidoDeTesouro('LTN 2032 3.000,00')).toMatchObject({ especies: ['prefixado'], ano: 2032 });
    expect(pedidoDeTesouro('NTN-B 2045 R$ 20.000,00')).toMatchObject({ especies: ['ipca-juros'], ano: 2045 });
    expect(pedidoDeTesouro('C - IPCA+ 2045 juros semestrais 5k')).toMatchObject({ especies: ['ipca-juros'], ano: 2045 });
    expect(pedidoDeTesouro('Tesouro IPCA com juros 2037 - R$ 50.000')).toMatchObject({ especies: ['ipca-juros'], ano: 2037 });
    expect(pedidoDeTesouro('Renda+ 2065 R$ 1.000')).toMatchObject({ especies: ['renda'], ano: 2065 });
    expect(pedidoDeTesouro('Educa+ 2030 500 reais')).toMatchObject({ especies: ['educa'], ano: 2030 });
  });

  it('"Tesouro Direto" sem tipo é qualquer título; sem ano, o ano fica em aberto', () => {
    expect(pedidoDeTesouro('Tesouro Direto Selic R$ 81.708,17')).toMatchObject({ especies: ['selic'], ano: null });
  });

  it('não é Tesouro: fundos com "Prefixado" e "Renda+" no nome, e o resto', () => {
    expect(pedidoDeTesouro('LCP Prefixado Feeder FII')).toBeNull();
    expect(pedidoDeTesouro('Valora CRI CDI Renda+ FII RL R$ 10.000,00')).toBeNull();
    expect(pedidoDeTesouro('PETR4 100')).toBeNull();
    expect(pedidoDeTesouro('Riza Malls Feeder FII RL')).toBeNull();
  });

  it('o que sobra para ler o valor não tem o ano nem o nome', () => {
    expect(semOTitulo('Aplicar 10 mil no Tesouro Prefixado 2029').replace(/\s+/g, ' ').trim()).toBe('Aplicar 10 mil no');
    expect(semOTitulo('C - IPCA+ 2045 juros semestrais 5k').replace(/\s+/g, ' ').trim()).toBe('C - 5k');
  });
});

describe('acharTitulo', () => {
  it('com o tipo e o ano, acha o título exato', () => {
    expect(achar('Tesouro Selic 2031')).toMatchObject({ situacao: 'exato', titulo: { codigo: 212 } });
    expect(achar('NTN-B 2045')).toMatchObject({ situacao: 'exato', titulo: { codigo: 223 } });
    expect(achar('Pré 2029')).toMatchObject({ situacao: 'exato', titulo: { codigo: 174 } });
  });

  it('sem o ano, vale o único do tipo (decisão do operador), com a marca para o aviso', () => {
    expect(achar('LFT')).toMatchObject({ situacao: 'unico-do-tipo', titulo: { nome: 'Tesouro Selic 2031' } });
  });

  it('com mais de um do tipo, o operador escolhe', () => {
    const r = achar('Tesouro Prefixado');
    expect(r.situacao).toBe('ambiguo');
    expect(r.candidatos.map((t) => t.nome)).toEqual(['Tesouro Prefixado 2029', 'Tesouro Prefixado 2032']);
  });

  it('o que não está na lista não é chutado', () => {
    expect(achar('Tesouro Selic 2029').situacao).toBe('nenhum');
  });
});

describe('tesouroDaOrdem', () => {
  const ordem = (linha) => ({ tesouro: pedidoDeTesouro(linha), operacao: 'C', financeiro: 2000 });
  const hoje = new Date(2026, 9, 20, 14, 0);
  const lista = { titulos: TITULOS, em: hoje.getTime() - 3 * 60000 };

  it('sem a lista, diz que falta; com o erro do Hub, diz qual', () => {
    expect(tesouroDaOrdem(ordem('LFT'), { lista: null, hoje }).situacao).toBe('sem-lista');
    expect(tesouroDaOrdem(ordem('LFT'), { lista: { erro: 'A Conta 1234567 não está habilitada para operar no Tesouro Direto', em: 1 }, hoje }).situacao).toBe('nao-habilitada');
  });

  it('pronto, com a idade da lista', () => {
    expect(tesouroDaOrdem(ordem('Tesouro Selic 2031'), { lista, hoje })).toMatchObject({ situacao: 'pronto', unicoDoTipo: false, minutos: 3, titulo: { taxa: 'SELIC + 0,0992 %' } });
  });

  it('não é de Tesouro: nada a dizer', () => {
    expect(tesouroDaOrdem({ tesouro: null }, { lista, hoje })).toBeNull();
  });
});

describe('o horário do Tesouro Direto', () => {
  it('dia útil, das 9h30 às 18h', () => {
    expect(noHorarioDoTesouro(new Date(2026, 9, 20, 9, 29), ehDiaUtil)).toBe(false);
    expect(noHorarioDoTesouro(new Date(2026, 9, 20, 9, 30), ehDiaUtil)).toBe(true);
    expect(noHorarioDoTesouro(new Date(2026, 9, 20, 18, 0), ehDiaUtil)).toBe(false);
    expect(noHorarioDoTesouro(new Date(2026, 9, 24, 11, 0), ehDiaUtil)).toBe(false); // sábado
  });
});

describe('especieDoNome', () => {
  it('separa o com juros do sem juros', () => {
    expect(especieDoNome('Tesouro IPCA+ 2035')).toBe('ipca');
    expect(especieDoNome('Tesouro Prefixado com Juros Semestrais 2035')).toBe('prefixado-juros');
  });
});

describe('o resgate', () => {
  // A posição no formato do Hub (os PUs de venda são os de 20/10/2026; as quantidades, inventadas).
  const POSICOES = lerPosicoesDoHub([
    { bondName: 'Tesouro Selic 2029', codeBonds: 178, expirateDate: '2029-03-01T00:00:00-03:00', quantityBuy: 0.5, quantityBalance: 0.5, blockedQuantity: 0, sellPrice: 20090.26, grossValue: 10045.13 },
    { bondName: 'Tesouro Selic 2031', codeBonds: 212, expirateDate: '2031-03-01T00:00:00-03:00', quantityBuy: 4.2, quantityBalance: 4.2, blockedQuantity: 0, sellPrice: 20024.39, grossValue: 84102.44 }
  ]);
  const hoje = new Date(2026, 9, 20, 14, 0);
  const lista = { posicoes: POSICOES, em: hoje.getTime() - 60000 };
  const resgate = (linha, extra = {}) => ({ tesouro: pedidoDeTesouro(linha), operacao: 'V', financeiro: null, quantidade: null, total: false, ...extra });

  it('lê a posição: disponível e o valor disponível, que é o da boleta de resgate', () => {
    expect(POSICOES[1]).toMatchObject({ nome: 'Tesouro Selic 2031', vencimento: '01/03/2031', disponivel: 4.2, valorDisponivel: 84102.44 });
  });

  it('com quantidade bloqueada, o disponível e o valor dele são a parte livre', () => {
    const [p] = lerPosicoesDoHub([{ bondName: 'Tesouro Selic 2031', quantityBalance: 10, blockedQuantity: 2, grossValue: 200000 }]);
    expect(p).toMatchObject({ disponivel: 8, valorDisponivel: 160000 });
  });

  it('o total resgata o valor disponível', () => {
    expect(resgateDaOrdem(resgate('Tesouro Selic 2031', { total: true }), { lista, hoje })).toMatchObject({ situacao: 'pronto', valor: 84102.44, total: true });
  });

  it('o valor pedido vai como pedido, com a posição para conferir', () => {
    const r = resgateDaOrdem(resgate('Selic 2031', { financeiro: 10000 }), { lista, hoje });
    expect(r).toMatchObject({ situacao: 'pronto', valor: 10000, posicao: { valorDisponivel: 84102.44 } });
  });

  it('o título que o cliente não tem não é chutado; dois do mesmo tipo, o operador escolhe', () => {
    expect(resgateDaOrdem(resgate('Tesouro Prefixado 2029', { financeiro: 1 }), { lista, hoje }).situacao).toBe('nao-tem');
    expect(resgateDaOrdem(resgate('LFT', { total: true }), { lista, hoje }).situacao).toBe('ambiguo');
  });

  it('sem a posição lida, diz que falta; não é resgate, nada a dizer', () => {
    expect(resgateDaOrdem(resgate('LFT', { total: true }), { lista: null, hoje }).situacao).toBe('sem-posicoes');
    expect(resgateDaOrdem({ ...resgate('LFT'), operacao: 'C' }, { lista, hoje })).toBeNull();
  });
});
