import { afterEach, describe, expect, it } from 'vitest';
import { TOTAL_DE_FUNDOS, fundoPeloTicker, juntarPrateleira, procurarFundo } from './fundo.js';

describe('nomes reais do grupo', () => {
  it('reconhece o BGR exatamente como foi escrito no WhatsApp', () => {
    const r = procurarFundo('BGR Galpões Logísticos I Feeder FII');
    expect(r.situacao).toBe('exato');
    expect(r.fundo.nome).toBe('BGR Galpões Logísticos I Feeder FII');
  });

  it('reconhece o XP Habitat II, com o "II" fazendo diferença', () => {
    const r = procurarFundo('XP Habitat Renda Imobiliária II Feeder FII RL');
    expect(r.situacao).toBe('exato');
    expect(r.fundo.nome).toBe('XP Habitat Renda Imobiliária II Feeder FII RL');
  });

  it('NÃO confunde o Habitat II com o Habitat sem numeral', () => {
    const comNumeral = procurarFundo('XP Habitat Renda Imobiliária II Feeder FII RL');
    const semNumeral = procurarFundo('XP Habitat Renda Imobiliária Feeder FII');
    expect(comNumeral.fundo.nome).not.toBe(semNumeral.fundo.nome);
  });
});

describe('tolerância à digitação do operador', () => {
  it('ignora acento, caixa e espaço sobrando', () => {
    expect(procurarFundo('  bgr galpoes logisticos i feeder fii  ').situacao).toBe('exato');
  });

  it('aceita o nome parcial quando ele só cabe num fundo', () => {
    const r = procurarFundo('Riza Malls');
    expect(r.situacao).toBe('exato');
    expect(r.fundo.nome).toBe('Riza Malls Feeder FII RL');
  });

  it('encontra pelo ticker quando o fundo tem um', () => {
    const r = procurarFundo('RZDS11');
    expect(r.situacao).toBe('exato');
    expect(r.fundo.ticker).toBe('RZDS11');
  });
});

describe('ambiguidade — o ponto da funcionalidade', () => {
  it('devolve os candidatos em vez de escolher um', () => {
    const r = procurarFundo('Habitat');
    expect(r.situacao).toBe('ambiguo');
    expect(r.candidatos.length).toBeGreaterThan(1);
    expect(r.fundo).toBeNull();
  });

  it('lista os dois Malls sem eleger nenhum', () => {
    const r = procurarFundo('Malls');
    expect(r.situacao).toBe('ambiguo');
    expect(r.candidatos.map((c) => c.nome).sort()).toEqual([
      'JHSF Capital Malls Feeder FII RL',
      'Riza Malls Feeder FII RL'
    ]);
  });

  it('"Riza" sozinho é ambíguo entre os cinco da casa', () => {
    expect(procurarFundo('Riza').candidatos.length).toBe(5);
  });
});

describe('quando o texto não bate com a prateleira', () => {
  it('"Riza terrax - prefixado" não vira Vintage sozinho', () => {
    const r = procurarFundo('Riza terrax - prefixado');
    expect(r.situacao).toBe('parcial');
    expect(r.fundo).toBeNull();
    expect(r.candidatos.map((c) => c.nome)).toContain('Riza Terrax Vintage FIAgro RL');
  });

  it('devolve nada quando não há parecença alguma', () => {
    const r = procurarFundo('Fundo Que Não Existe Em Lugar Nenhum');
    expect(r.situacao).toBe('nenhum');
    expect(r.candidatos).toEqual([]);
  });

  it('não confunde um ticker de bolsa com nome de fundo', () => {
    expect(procurarFundo('PETR4').situacao).toBe('nenhum');
  });

  it('lida com entrada vazia', () => {
    expect(procurarFundo('').situacao).toBe('nenhum');
    expect(procurarFundo(null).situacao).toBe('nenhum');
  });
});

describe('aplicação mínima', () => {
  it('vem junto do fundo encontrado, como número de reais', () => {
    expect(procurarFundo('BGR Galpões Logísticos I Feeder FII').fundo.aplicacaoMinima).toBe(1000);
  });

  it('lê o separador de milhar corretamente', () => {
    expect(procurarFundo('XP CDI 99 FOF Private Jun/27 FII RL').fundo.aplicacaoMinima).toBe(2500000);
  });
});

// Os 32 tickers da prateleira de 06/10/2026 (a lista colada do Hub). Nenhum está na lista da B3 do
// sistema; a mesa decidiu que, escritos sozinhos, são o fundo — compra pela boleta do secundário.
const TICKERS_DA_PRATELEIRA = 'AZQA11 TGRI VGIE11 XPHF11 TGRE11 AVBI11 KJNT11 BTLP11 MARE11 CYHF11 MCCE11 AUGM11 NFIP11 VGPR11 CPAC11 IDZA11 XPAG11 XPHB11 PIER11 AZPR11 RBRJ11 VICA11 JGFA11 AZQI11 CPHF11 JGPT11 IMOV11 RZDS11 JGPI11 MRFA11 PAAG11 TGRI11';

describe('fundoPeloTicker', () => {
  it('acha o fundo pelo ticker, e só pelo ticker', () => {
    expect(fundoPeloTicker('VGPR11')).toMatchObject({
      situacao: 'exato',
      fundo: { nome: 'Valora Imobiliário Multiestratégia Premium', ticker: 'VGPR11' }
    });
    expect(fundoPeloTicker(' vgpr11 ').fundo.ticker).toBe('VGPR11');
    expect(fundoPeloTicker('PETR4')).toBeNull();
    expect(fundoPeloTicker('Valora')).toBeNull();
  });

  it('conhece os 32 tickers da prateleira de 06/10', () => {
    for (const t of TICKERS_DA_PRATELEIRA.split(' ')) expect(fundoPeloTicker(t), t).not.toBeNull();
  });
});

describe('a prateleira de 06/10/2026', () => {
  it('tem os 150 fundos, com os quatro XP CDI CRA Set/27 que faltavam', () => {
    expect(TOTAL_DE_FUNDOS).toBe(150);
    for (const nome of ['XP CDI 97 CRA Private Set/27 FIAGRO RL', 'XP CDI 96 CRA Unique Set/27 FIAGRO RL', 'XP CDI 95 CRA Set/27 FIAGRO RL', 'XP CDI 94 CRA Set/27 FIAGRO RL']) {
      expect(procurarFundo(nome).situacao, nome).toBe('exato');
    }
  });

  it('a aplicação mínima é a da lista colada', () => {
    expect(procurarFundo('XP SS 1 FIC FIDC RL-NP').fundo.aplicacaoMinima).toBe(100380);
    expect(procurarFundo('XP Special Opportunities FIP Multi - Classe A').fundo.aplicacaoMinima).toBe(25859);
    expect(fundoPeloTicker('IDZA11').fundo.aplicacaoMinima).toBe(10000);
  });
});

// A prateleira do dia (captura do robô ou do favorito, ou a planilha) entra no catálogo junto com a
// lista gerada: fundo novo é reconhecido pelo nome sem esperar `npm run fundos:update`.
describe('a prateleira do dia no catálogo', () => {
  afterEach(() => juntarPrateleira([]));
  const novo = { nome: 'Fundo Lançado Ontem Feeder FII RL', ticker: null, aplicacaoMinima: 5000 };

  it('reconhece pelo nome o fundo que só a prateleira do dia tem', () => {
    expect(procurarFundo('Fundo Lançado Ontem Feeder FII RL').situacao).not.toBe('exato');
    juntarPrateleira([novo]);
    expect(procurarFundo('Fundo Lançado Ontem Feeder FII RL')).toMatchObject({ situacao: 'exato', fundo: { nome: novo.nome, aplicacaoMinima: 5000 } });
  });

  it('e pelo ticker, o fundo novo com ticker', () => {
    juntarPrateleira([{ nome: 'Fundo Novo Com Ticker FII', ticker: 'NOVO11', aplicacaoMinima: null }]);
    expect(fundoPeloTicker('NOVO11')?.fundo.nome).toBe('Fundo Novo Com Ticker FII');
  });

  it('o fundo que saiu da prateleira continua lá: o nome que cabe nos dois não escolhe sozinho', () => {
    // Só o II na prateleira do dia: o "XP Habitat … Feeder" sem numeral continua ambíguo, como antes.
    juntarPrateleira([{ nome: 'XP Habitat Renda Imobiliária II Feeder FII RL', ticker: null, aplicacaoMinima: null }]);
    expect(procurarFundo('XP Habitat Renda Imobiliária Feeder FII').fundo?.nome).not.toBe('XP Habitat Renda Imobiliária II Feeder FII RL');
  });

  it('o mesmo nome da lista não vira dois fundos, e sem prateleira vale a lista sozinha', () => {
    juntarPrateleira([{ nome: 'BGR Galpões Logísticos I Feeder FII', ticker: null, aplicacaoMinima: 1 }]);
    expect(procurarFundo('BGR Galpões Logísticos I Feeder FII').situacao).toBe('exato');
    juntarPrateleira([]);
    expect(procurarFundo('Fundo Lançado Ontem Feeder FII RL').situacao).not.toBe('exato');
    expect(TOTAL_DE_FUNDOS).toBe(150);
  });

  it('ignora o que não é fundo', () => {
    juntarPrateleira([null, { nome: '' }, { nome: 42 }, novo]);
    expect(procurarFundo(novo.nome).situacao).toBe('exato');
  });
});
