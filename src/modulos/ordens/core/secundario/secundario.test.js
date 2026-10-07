import { describe, expect, it } from 'vitest';
import { procurarFundo } from '../validate/fundo.js';
import { secundarioDaOrdem } from './secundario.js';

const RIZA_TERRAX = 'Riza Terrax Vintage FIAgro RL';

// Uma linha da planilha exportada: sem o deságio mínimo, que só a captura do Hub traz.
const LINHA = { nome: RIZA_TERRAX, ticker: null, pu: 98.93, casasDoPu: 2, desagio: 2.25, estoque: 86116.6, aplicacaoMinima: 1000 };

const estoque = {
  arquivo: 'mercado-secundario-05-10-2026.xlsx',
  exportadaEm: new Date(2026, 9, 5, 14, 32).toISOString(),
  fundos: [LINHA]
};

// A mesma linha capturada pelo favorito do Hub: com o deságio mínimo do cliente e a corretagem.
const doHub = (extra = {}) => ({
  arquivo: 'mercado-secundario-05-10-2026-14h32.json',
  exportadaEm: new Date(2026, 9, 5, 14, 32).toISOString(),
  origem: 'hub',
  fundos: [{ ...LINHA, desagioMinimo: 1.75, corretagem: 1.5, ...extra }]
});

const hoje = new Date(2026, 9, 5, 16, 0);
const tetos = { 'riza terrax vintage fiagro rl': { teto: 0.5, desagio: 2.25, em: '2026-10-05' } };

const compra = (extra = {}) => ({
  ativo: RIZA_TERRAX,
  ticker: null,
  fundo: procurarFundo(RIZA_TERRAX),
  operacao: 'C',
  quantidade: null,
  financeiro: 16000,
  ...extra
});

describe('secundarioDaOrdem', () => {
  it('não se aplica a ticker nem a venda', () => {
    expect(secundarioDaOrdem({ ativo: 'PETR4', ticker: {}, fundo: null, operacao: 'C' }, { estoque, tetos, hoje })).toBeNull();
    expect(secundarioDaOrdem(compra({ operacao: 'V' }), { estoque, tetos, hoje })).toBeNull();
  });

  it('sem planilha, diz que falta a planilha', () => {
    expect(secundarioDaOrdem(compra(), { estoque: null, tetos, hoje }).situacao).toBe('sem-planilha');
  });

  it('fundo que não está na planilha', () => {
    const outro = compra({ ativo: 'Riza Malls Feeder FII RL', fundo: procurarFundo('Riza Malls Feeder FII RL') });
    expect(secundarioDaOrdem(outro, { estoque, tetos, hoje }).situacao).toBe('fora-da-planilha');
  });

  it('sem teto anotado, não converte com o ROA máximo', () => {
    const sec = secundarioDaOrdem(compra(), { estoque, tetos: {}, hoje });
    expect(sec.situacao).toBe('sem-teto');
    expect(sec.cotas).toBeUndefined();
  });

  it('com o teto, usa o ROA máximo e converte R$ em cotas', () => {
    const sec = secundarioDaOrdem(compra(), { estoque, tetos, hoje });
    expect(sec).toMatchObject({ situacao: 'pronto', roa: 0.5, porValor: true, semRoa: false });
    // 98,935 × (1 − 1,75%) × 1,015 = R$ 98,66 por cota no pior caso → 162 cotas
    expect(sec.cotas).toBe(162);
    expect(sec.conta.desconto).toBeCloseTo(1.75);
    expect(sec.conta.total).toBeLessThanOrEqual(16000);
    expect(sec.planilha.deHoje).toBe(true);
  });

  it('com o ROA zerado, o deságio inteiro vai para o cliente, e não precisa de teto', () => {
    const sec = secundarioDaOrdem(compra(), { estoque, tetos: {}, hoje, semRoa: true });
    expect(sec).toMatchObject({ situacao: 'pronto', roa: 0, semRoa: true });
    expect(sec.conta.desconto).toBe(2.25);
  });

  it('calcula os dois cenários, e a ordem fica com o escolhido', () => {
    const contexto = { estoque, tetos, hoje };
    const maximo = secundarioDaOrdem(compra({ financeiro: 50000 }), contexto);
    const zerado = secundarioDaOrdem(compra({ financeiro: 50000 }), { ...contexto, semRoa: true });

    // 98,935 × 98,25% × 1,015 = 98,66 → 506 cotas; com 97,75%, 98,16 → 509.
    expect(maximo.cenarios).toMatchObject({ maximo: { roa: 0.5, cotas: 506 }, zerado: { roa: 0, cotas: 509 } });
    expect(zerado.cenarios).toEqual(maximo.cenarios);
    expect(maximo.cotas).toBe(506);
    expect(zerado.cotas).toBe(509);
  });

  it('sem teto, o cenário do ROA máximo fica vazio e o zerado continua', () => {
    const sec = secundarioDaOrdem(compra(), { estoque, tetos: {}, hoje });
    expect(sec.cenarios.maximo).toBeNull();
    expect(sec.cenarios.zerado.cotas).toBeGreaterThan(0);
  });

  it('ordem por quantidade fica com a quantidade pedida', () => {
    const sec = secundarioDaOrdem(compra({ quantidade: 100, financeiro: null }), { estoque, tetos, hoje });
    expect(sec).toMatchObject({ situacao: 'pronto', porValor: false, cotas: 100 });
  });

  it('conta a idade da cotação em minutos', () => {
    // exportada às 14:32; agora são 16:00
    expect(secundarioDaOrdem(compra(), { estoque, tetos, hoje }).planilha.minutos).toBe(88);
  });

  it('marca a planilha que não é do dia', () => {
    const amanha = new Date(2026, 9, 6, 9, 0);
    expect(secundarioDaOrdem(compra(), { estoque, tetos, hoje: amanha }).planilha.deHoje).toBe(false);
  });
});

describe('com os fundos do favorito do Hub', () => {
  it('o teto é o deságio menos o deságio mínimo do cliente: não precisa anotar', () => {
    const sec = secundarioDaOrdem(compra(), { estoque: doHub(), tetos: {}, hoje });
    expect(sec).toMatchObject({ situacao: 'pronto', roa: 0.5, cotas: 162 });
    expect(sec.teto).toMatchObject({ teto: 0.5, doHub: true });
    expect(sec.planilha.doHub).toBe(true);
  });

  it('o teto do Hub vale mais que o anotado: é o daquela hora', () => {
    const anotado = { 'riza terrax vintage fiagro rl': { teto: 1, desagio: 2.25, em: '2026-10-01' } };
    expect(secundarioDaOrdem(compra(), { estoque: doHub(), tetos: anotado, hoje }).roa).toBe(0.5);
  });

  it('a conta não deixa resto de vírgula flutuante no teto', () => {
    // 23,25 − 22,55 dá 0,6999999999999993 em ponto flutuante.
    const kijani = doHub({ desagio: 23.25, desagioMinimo: 22.55 });
    expect(secundarioDaOrdem(compra(), { estoque: kijani, tetos: {}, hoje }).teto.teto).toBe(0.7);
  });

  it('fundo sem ROA adicional: deságio mínimo igual ao deságio', () => {
    const sec = secundarioDaOrdem(compra(), { estoque: doHub({ desagioMinimo: 2.25 }), tetos: {}, hoje });
    expect(sec).toMatchObject({ situacao: 'pronto', roa: 0 });
    expect(sec.cenarios.maximo.cotas).toBe(sec.cenarios.zerado.cotas);
  });

  it('a corretagem é a do fundo', () => {
    const sec = secundarioDaOrdem(compra({ quantidade: 100, financeiro: null }), { estoque: doHub({ corretagem: 1 }), tetos: {}, hoje });
    expect(sec.conta.percentualDaRemuneracao).toBe(1.5);
  });

  it('sem o deságio mínimo, volta ao teto anotado', () => {
    const sec = secundarioDaOrdem(compra(), { estoque: doHub({ desagioMinimo: null }), tetos, hoje });
    expect(sec.teto).not.toHaveProperty('doHub');
    expect(sec.roa).toBe(0.5);
  });

  // Na captura de 06/10, 15 FIPs e fundos fechados vêm com deságio de 5% a 15%, mínimo 0,00 e
  // corretagem 0,00: a conta daria ROA de 15%. As boletas conferidas eram todas de fundos com
  // corretagem; o modelo desses não foi visto, e o teto fica por anotar.
  it('fundo sem corretagem: a captura não dá o teto', () => {
    const fip = doHub({ desagio: 15, desagioMinimo: 0, corretagem: 0 });
    expect(secundarioDaOrdem(compra(), { estoque: fip, tetos: {}, hoje }).situacao).toBe('sem-teto');
    expect(secundarioDaOrdem(compra(), { estoque: fip, tetos: {}, hoje, semRoa: true }).situacao).toBe('pronto');
  });

  it('fundo sem corretagem e sem deságio a dividir: o teto é zero', () => {
    const cdiPrivate = doHub({ desagio: 0, desagioMinimo: 0, corretagem: 0 });
    expect(secundarioDaOrdem(compra(), { estoque: cdiPrivate, tetos: {}, hoje })).toMatchObject({ situacao: 'pronto', roa: 0 });
  });

  it('deságio mínimo zero num fundo com corretagem é teto como outro qualquer', () => {
    const rzds = doHub({ desagio: 0.25, desagioMinimo: 0, corretagem: 1.5 });
    expect(secundarioDaOrdem(compra(), { estoque: rzds, tetos: {}, hoje }).roa).toBe(0.25);
  });

  it('deságio mínimo acima do deságio não vira teto negativo', () => {
    const sec = secundarioDaOrdem(compra(), { estoque: doHub({ desagioMinimo: 3 }), tetos: {}, hoje });
    expect(sec.situacao).toBe('sem-teto');
  });

  // A boleta de 05/10/2026: deságio máximo 2,50%, a barra até 1% de ROA, 1,50% para o cliente,
  // remuneração de 2,50%. Na captura de 06/10 o Riza vem com deságio 2,50 e mínimo 1,50 — e com
  // `treasuryMinimumBuyCost` 0,00, que por isso não é o ROA.
  it('Riza Renda Imobiliária: os números da boleta saem do deságio e do mínimo', () => {
    const nome = 'Riza Renda Imobiliária Feeder FII RL - Subclasse I';
    const riza = {
      ...doHub(),
      fundos: [{ nome, ticker: null, pu: 101.510457, casasDoPu: 6, desagio: 2.5, desagioMinimo: 1.5, corretagem: 1.5, estoque: 494875.19, aplicacaoMinima: 500 }]
    };
    const ordem = compra({ ativo: nome, fundo: procurarFundo(nome), quantidade: 100, financeiro: null });

    const sec = secundarioDaOrdem(ordem, { estoque: riza, tetos: {}, hoje });
    expect(sec.roa).toBe(1);
    expect(sec.conta.desconto).toBeCloseTo(1.5);
    expect(Math.round(sec.conta.posicao * 100) / 100).toBe(9998.78);
    expect(Math.round(sec.conta.remuneracao * 100) / 100).toBe(249.97);
    expect(sec.cenarios.zerado.conta.percentualDaRemuneracao).toBe(1.5);
  });

  // A boleta do VGPR11 de 06/10/2026, aberta pelo operador: 5.080 cotas a R$ 8,337589 (o
  // `quotaValue` do pre-check), posição de R$ 39.368,93, corretagem de R$ 590,53, total de
  // R$ 39.959,46. A prateleira manda o PU como "8,34".
  describe('com o preço exato da cota, trazido pelo robô da boleta', () => {
    const vgpr = (extra = {}) => ({
      ...doHub(),
      fundos: [{ id: 'ce52be97-05e7-40d9-887a-215d7711bfc7', dataDaCota: '2026-10-01', nome: 'Valora Imobiliário Multiestratégia Premium', ticker: 'VGPR11', pu: 8.34, casasDoPu: 2, desagio: 7.75, desagioMinimo: 7.05, corretagem: 1.5, estoque: 2233152.58, aplicacaoMinima: 10, ...extra }]
    });
    const cotas = { 'ce52be97-05e7-40d9-887a-215d7711bfc7': { valor: 8.337589, dataDaCota: '2026-10-01', em: hoje.getTime() - 60 * 1000 } };
    const ordem = (extra) => compra({ ativo: 'VGPR11', fundo: procurarFundo('VGPR11'), ...extra });
    const centavos = (n) => Math.round(n * 100) / 100;

    it('os números da boleta saem iguais, centavo por centavo', () => {
      const sec = secundarioDaOrdem(ordem({ quantidade: 5080, financeiro: null }), { estoque: vgpr(), tetos: {}, hoje, cotas });
      expect(sec).toMatchObject({ puExato: true, pu: 8.337589, roa: 0.7 });
      expect(centavos(sec.conta.posicao)).toBe(39368.93);
      expect(centavos(sec.conta.corretagem)).toBe(590.53);
      expect(centavos(sec.conta.total)).toBe(39959.46);
    });

    it('com o preço exato, R$ 40.000 compram 5.085 cotas, não as 5.080 da conta conservadora', () => {
      expect(secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr(), tetos: {}, hoje }).cotas).toBe(5080);
      const sec = secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr(), tetos: {}, hoje, cotas });
      expect(sec.cotas).toBe(5085);
      expect(sec.conta.total).toBeLessThanOrEqual(40000);
    });

    it('preço exato de outro dia de cota não vale', () => {
      const sec = secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr({ dataDaCota: '2026-10-02' }), tetos: {}, hoje, cotas });
      expect(sec).toMatchObject({ puExato: false, pu: 8.34, cotas: 5080 });
    });

    // A cota é calculada uma vez por dia, mas isso não foi visto no Hub: se ela mudar no meio do dia,
    // o PU arredondado da Prateleira muda junto, e o preço guardado deixa de arredondar para ele.
    it('no mesmo dia de cota, preço exato que não arredonda mais para o PU da Prateleira não vale', () => {
      const sec = secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr({ pu: 8.36 }), tetos: {}, hoje, cotas });
      expect(sec).toMatchObject({ puExato: false, pu: 8.36, precoExatoMuda: true });
    });

    it('enquanto arredonda para o PU da Prateleira, o preço guardado serve, sem boleta', () => {
      const sec = secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr({ pu: 8.34 }), tetos: {}, hoje, cotas });
      expect(sec).toMatchObject({ puExato: true, precoExatoMuda: false });
    });

    // O PU muda ao longo do dia (o operador, em 07/10): o preço exato vale 10 minutos, como a cotação.
    it('com mais de 10 minutos, o preço exato não vale mais, e a boleta é pedida de novo', () => {
      const velho = (minutos) => ({ 'ce52be97-05e7-40d9-887a-215d7711bfc7': { ...Object.values(cotas)[0], em: hoje.getTime() - minutos * 60 * 1000 } });
      expect(secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr(), tetos: {}, hoje, cotas: velho(10) }).puExato).toBe(true);
      const sec = secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr(), tetos: {}, hoje, cotas: velho(11) });
      expect(sec).toMatchObject({ puExato: false, pu: 8.34, cotas: 5080, precoExatoMuda: true });
    });

    it('preço guardado sem a hora da leitura (de antes de 07/10) não vale', () => {
      const semHora = { 'ce52be97-05e7-40d9-887a-215d7711bfc7': { valor: 8.337589, dataDaCota: '2026-10-01' } };
      expect(secundarioDaOrdem(ordem({ financeiro: 40000 }), { estoque: vgpr(), tetos: {}, hoje, cotas: semHora }).puExato).toBe(false);
    });
  });

  // Abrir a boleta custa segundos ao robô: só vale quando o preço exato pode mudar as cotas. O PU
  // de verdade está a menos de meia casa do arredondado; se as cotas são as mesmas nas duas pontas,
  // e nos dois cenários do e-mail, a boleta não muda nada.
  describe('se vale buscar o preço exato', () => {
    const terrax = (financeiro) => secundarioDaOrdem(compra({ financeiro }), { estoque: doHub(), tetos: {}, hoje });

    it('vale quando as cotas mudam com o preço: VGPR11, R$ 40.000, 5.080 ou 5.085', () => {
      const vgpr = {
        ...doHub(),
        fundos: [{ id: 'ce52be97-05e7-40d9-887a-215d7711bfc7', dataDaCota: '2026-10-01', nome: 'Valora Imobiliário Multiestratégia Premium', ticker: 'VGPR11', pu: 8.34, casasDoPu: 2, desagio: 7.75, desagioMinimo: 7.05, corretagem: 1.5, estoque: 2233152.58, aplicacaoMinima: 10 }]
      };
      const ordem = compra({ ativo: 'VGPR11', fundo: procurarFundo('VGPR11'), financeiro: 40000 });
      expect(secundarioDaOrdem(ordem, { estoque: vgpr, tetos: {}, hoje }).precoExatoMuda).toBe(true);

      const cotas = { 'ce52be97-05e7-40d9-887a-215d7711bfc7': { valor: 8.337589, dataDaCota: '2026-10-01', em: hoje.getTime() - 60 * 1000 } };
      expect(secundarioDaOrdem(ordem, { estoque: vgpr, tetos: {}, hoje, cotas }).precoExatoMuda).toBe(false);
    });

    it('não vale quando dá o mesmo número de cotas com qualquer preço possível', () => {
      expect(terrax(10000).precoExatoMuda).toBe(false);
    });

    it('conta também o cenário que não está escolhido: o ROA pode ser trocado na hora de copiar', () => {
      // R$ 16.000 no Riza Terrax: 162 cotas com o ROA máximo de qualquer jeito; com o zerado, 162 ou 163.
      const sec = terrax(16000);
      expect(sec.cotas).toBe(162);
      expect(sec.precoExatoMuda).toBe(true);
    });

    it('pedido por cotas não precisa do preço', () => {
      expect(secundarioDaOrdem(compra({ quantidade: 100, financeiro: null }), { estoque: doHub(), tetos: {}, hoje }).precoExatoMuda).toBe(false);
    });
  });

  // A boleta de 06/10/2026 às 11:11: deságio máximo 8,75%, 8,25% para o cliente, 0,5% de ROA,
  // ROA total 2,00%. A captura das 12:09: deságio 8,75, mínimo 8,25, corretagem 1,50.
  it('IMOV11: os números da boleta saem da captura', () => {
    const imov = {
      ...doHub(),
      fundos: [{ nome: 'Navi Hedge Fund', ticker: 'IMOV11', pu: 9, casasDoPu: 2, desagio: 8.75, desagioMinimo: 8.25, corretagem: 1.5, estoque: 1755331.22, aplicacaoMinima: 10 }]
    };
    const ordem = compra({ ativo: 'Navi Hedge Fund', fundo: procurarFundo('Navi Hedge Fund'), quantidade: 100, financeiro: null });

    const sec = secundarioDaOrdem(ordem, { estoque: imov, tetos: {}, hoje });
    expect(sec.roa).toBe(0.5);
    expect(sec.conta.desconto).toBeCloseTo(8.25);
    expect(sec.conta.percentualDaRemuneracao).toBe(2);
  });
});
