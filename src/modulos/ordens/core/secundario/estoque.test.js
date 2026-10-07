import { describe, expect, it } from 'vitest';
import { ErroDoEstoque, lerCapturaDoHub, lerEstoque, lerNumero, procurarNoEstoque } from './estoque.js';

// O cabeçalho é o da exportação "Todos os fundos" de 05/10/2026, com as duas colunas a mais que
// ela às vezes traz. Os números vêm como texto, do jeito que a XP exporta.
const CABECALHO = [
  'fundName',
  'minimalInitialInvestment',
  'unityPrice',
  'stockOfTreasuryQuotas',
  'secondaryPurchaseDiscount',
  'peerToPeerBuyDiscount',
  'profitability12Gross',
  'roaAdditional',
  'riskGenius'
];

const PLANILHA = [
  CABECALHO,
  ['XP CDI 99 FOF Private Jun/27 FII RL', '2.500.000,00', '100,15', '1.200,00', '0,00', '0,00', '15.73', null, 3],
  ['XPHF11 - XP Hedge Fund', '10,00', '9,69', '479.807,78', '5,75', '5,90', '15.8', null, 19],
  ['TGRI – TG Renda Imobiliária Feeder FII RL', '10,00', '10,18', '1.385,01', '0,00', '0,10', '17.87', null, 33],
  ['Root Capital Figueira FIDC de Responsab Limit', '100,00', '136,18', '15,43', '-0,50', '-0,40', '17.96', null, 25],
  ['XP Private Equity II - Classe A - FIP Multiestratégia', '25.000,00', '1.072,28', '1.892,60', '15,00', '0,00', 'N/D', null, 50],
  [null, null, null, null, null, null, null, null, null]
];

describe('lerNumero', () => {
  it('lê o padrão brasileiro, com milhar e sinal', () => {
    expect(lerNumero('1.072,28')).toBe(1072.28);
    expect(lerNumero('2.500.000,00')).toBe(2500000);
    expect(lerNumero('-0,50')).toBe(-0.5);
  });

  it('deixa passar o que já é número e recusa o resto', () => {
    expect(lerNumero(9.32)).toBe(9.32);
    expect(lerNumero('N/D')).toBeNull();
    expect(lerNumero('')).toBeNull();
    expect(lerNumero(null)).toBeNull();
  });
});

describe('lerEstoque', () => {
  const fundos = lerEstoque(PLANILHA);

  it('lê uma linha por fundo e pula a vazia', () => {
    expect(fundos).toHaveLength(5);
  });

  it('separa o ticker da frente do nome, com hífen ou travessão', () => {
    expect(fundos[1]).toMatchObject({ nome: 'XP Hedge Fund', ticker: 'XPHF11' });
    expect(fundos[2]).toMatchObject({ nome: 'TG Renda Imobiliária Feeder FII RL', ticker: 'TGRI' });
    expect(fundos[4]).toMatchObject({ nome: 'XP Private Equity II - Classe A - FIP Multiestratégia', ticker: null });
  });

  it('lê PU, deságio, estoque e aplicação mínima, e guarda as casas do PU', () => {
    expect(fundos[1]).toMatchObject({ pu: 9.69, casasDoPu: 2, desagio: 5.75, estoque: 479807.78, aplicacaoMinima: 10 });
    expect(fundos[3].desagio).toBe(-0.5);
  });

  it('recusa planilha sem as colunas da exportação de fundos', () => {
    expect(() => lerEstoque([['Ticker', 'Taxa'], ['ABC', '1']])).toThrow(ErroDoEstoque);
    expect(() => lerEstoque([['Ticker', 'Taxa'], ['ABC', '1']])).toThrow(/fundName/);
  });

  it('a exportação não traz o deságio mínimo nem a corretagem', () => {
    expect(fundos[1]).toMatchObject({ desagioMinimo: null, corretagem: null });
  });
});

// O arquivo que o favorito baixa: a resposta da API da prateleira, inteira, com a hora da captura
// na frente. O IMOV11 é o da captura de 06/10/2026 às 12:09; a boleta das 11:11 mostrava deságio
// máximo 8,75% e 8,25% para o cliente com o ROA no fim da barra.
const CAPTURA = {
  capturadaEm: '2026-10-06T14:11:00.000Z',
  origem: 'hub.xpi.com.br/investment-funds-secondary',
  isMarketOpen: true,
  highSecondaryOperationTime: '16:30:00',
  data: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      fundName: 'IMOV11 - Navi Hedge Fund',
      quotaDate: '2026-10-01T00:00:00',
      unityPrice: '9,00',
      secondaryPurchaseDiscount: '8,75',
      treasuryMinimumPurchaseDiscount: '8,25',
      minimumPurchaseDiscount: '8,25',
      treasuryMinimumBuyCost: '0,50',
      percentageComission: '1,50',
      stockOfTreasuryQuotas: '1.755.331,22',
      stockOfPeerToPeerQuotas: '0,00',
      minimalInitialInvestment: '10,00',
      profitability12Gross: '10.32',
      canApply: true
    },
    {
      fundName: 'XP Private Equity II - Classe A - FIP Multiestratégia',
      unityPrice: '1.072,28',
      secondaryPurchaseDiscount: '15,00',
      treasuryMinimumPurchaseDiscount: 'N/D',
      stockOfTreasuryQuotas: '1.892,60',
      minimalInitialInvestment: '25.000,00'
    }
  ]
};

describe('lerCapturaDoHub', () => {
  const { capturadaEm, fundos } = lerCapturaDoHub(JSON.stringify(CAPTURA));

  it('lê os mesmos campos da exportação, e a hora da captura', () => {
    expect(capturadaEm).toBe('2026-10-06T14:11:00.000Z');
    expect(fundos).toHaveLength(2);
    expect(fundos[0]).toMatchObject({
      nome: 'Navi Hedge Fund',
      ticker: 'IMOV11',
      pu: 9,
      casasDoPu: 2,
      desagio: 8.75,
      estoque: 1755331.22,
      aplicacaoMinima: 10
    });
  });

  it('traz o código do fundo e o dia da cota, para achar o preço exato dele', () => {
    expect(fundos[0]).toMatchObject({ id: '00000000-0000-0000-0000-000000000001', dataDaCota: '2026-10-01' });
    expect(fundos[1]).toMatchObject({ id: null, dataDaCota: null });
  });

  it('traz o deságio mínimo do cliente e a corretagem de cada fundo', () => {
    expect(fundos[0]).toMatchObject({ desagioMinimo: 8.25, corretagem: 1.5 });
  });

  // `treasuryMinimumBuyCost` parecia o ROA (0,50 no IMOV11), mas no Riza vem 0,00 com a barra
  // indo até 1% na boleta. Não é lido.
  it('não lê o treasuryMinimumBuyCost', () => {
    expect(fundos[0]).not.toHaveProperty('roaAdicional');
  });

  it('campo ausente ou N/D fica sem valor, nunca zero', () => {
    expect(fundos[1]).toMatchObject({ desagioMinimo: null, corretagem: null });
  });

  it('aceita a resposta já como objeto, como o robô do Hub a entrega', () => {
    const { fundos: lidos } = lerCapturaDoHub(CAPTURA);
    expect(lidos[0]).toMatchObject({ ticker: 'IMOV11', desagio: 8.75 });
  });

  it('a resposta salva à mão, sem a hora da captura, também serve', () => {
    const { capturadaEm: sem, fundos: lidos } = lerCapturaDoHub(JSON.stringify({ data: CAPTURA.data }));
    expect(sem).toBeNull();
    expect(lidos).toHaveLength(2);
  });

  it('recusa o que não é a resposta da prateleira', () => {
    expect(() => lerCapturaDoHub('não é json')).toThrow(ErroDoEstoque);
    expect(() => lerCapturaDoHub(JSON.stringify({ itens: [] }))).toThrow(ErroDoEstoque);
    expect(() => lerCapturaDoHub(JSON.stringify({ data: [] }))).toThrow(/nenhum fundo/);
    expect(() => lerCapturaDoHub(JSON.stringify({ data: [{ nome: 'x' }] }))).toThrow(/fundName/);
  });
});

describe('procurarNoEstoque', () => {
  const fundos = lerEstoque(PLANILHA);

  it('acha pelo nome, sem ligar para acento e caixa', () => {
    expect(procurarNoEstoque(fundos, { nome: 'tg renda imobiliaria feeder fii rl', ticker: null })?.ticker).toBe('TGRI');
  });

  it('acha pelo ticker quando o nome não bate', () => {
    expect(procurarNoEstoque(fundos, { nome: 'Hedge Fund da XP', ticker: 'XPHF11' })?.nome).toBe('XP Hedge Fund');
  });

  it('não acha o que não está na planilha', () => {
    expect(procurarNoEstoque(fundos, { nome: 'Riza Malls Feeder FII RL', ticker: null })).toBeNull();
  });
});
