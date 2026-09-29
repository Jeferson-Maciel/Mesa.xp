import { describe, expect, it } from 'vitest';
import { analisarTicker, temFormatoDeTicker } from './ticker.js';

describe('temFormatoDeTicker', () => {
  it.each(['PETR4', 'VALE3', 'KNCR11', 'HGLG11', 'IVVB11', 'M2ST34', 'A1AP34', 'RECR12'])(
    'reconhece %s como formato de ticker',
    (t) => expect(temFormatoDeTicker(t)).toBe(true)
  );

  it.each(['COMPRA', 'VENDA', '700003', 'R$', 'qntds', 'via', 'email', 'Total', 'C', 'V', ''])(
    'rejeita %j',
    (t) => expect(temFormatoDeTicker(t)).toBe(false)
  );

  it('aceita minúsculas', () => {
    expect(temFormatoDeTicker('petr4')).toBe(true);
  });
});

describe('analisarTicker — reconhecidos', () => {
  it('reconhece ação, FII, BDR e ETF com a classe certa', () => {
    expect(analisarTicker('PETR4')).toMatchObject({ situacao: 'conhecido', classe: 'acao' });
    expect(analisarTicker('KNCR11')).toMatchObject({ situacao: 'conhecido', classe: 'fii' });
    expect(analisarTicker('M2ST34')).toMatchObject({ situacao: 'conhecido', classe: 'bdr' });
    expect(analisarTicker('IVVB11')).toMatchObject({ situacao: 'conhecido', classe: 'etf' });
  });

  it('normaliza para maiúsculas', () => {
    expect(analisarTicker('petr4').ticker).toBe('PETR4');
  });

  it('reconhece os tickers dos pedidos reais do grupo', () => {
    for (const t of ['HGCR11', 'HGLG11', 'HGRE11', 'HGRU11', 'PCIP11', 'RZTR11', 'VGIP11', 'VRTA11']) {
      expect(analisarTicker(t).situacao).toBe('conhecido');
    }
  });
});

describe('analisarTicker — recibos de subscrição', () => {
  it('aceita RECR12 porque RECR11 existe', () => {
    expect(analisarTicker('RECR12')).toMatchObject({ situacao: 'variante', classe: 'fii' });
  });

  it('aceita o recibo 13 do mesmo jeito', () => {
    expect(analisarTicker('HGLG13').situacao).toBe('variante');
  });

  it('aceita PETR3 e PETR4 como variantes da mesma raiz', () => {
    expect(['conhecido', 'variante']).toContain(analisarTicker('PETR3').situacao);
  });

  it('não aceita variante de raiz inexistente', () => {
    expect(analisarTicker('ZZZZ12').situacao).not.toBe('variante');
  });
});

describe('analisarTicker — suspeita de digitação', () => {
  it('sinaliza KCNR11 como parecido com KNCR11, sem corrigir', () => {
    const r = analisarTicker('KCNR11');
    expect(r.situacao).toBe('parecido');
    expect(r.sugestoes).toContain('KNCR11');
    expect(r.ticker).toBe('KCNR11');
  });

  it('sinaliza uma letra trocada', () => {
    const r = analisarTicker('PETQ4');
    expect(r.situacao).toBe('parecido');
    expect(r.sugestoes).toContain('PETR4');
  });

  it('só sugere tickers do mesmo tamanho', () => {
    for (const s of analisarTicker('KCNR11').sugestoes) {
      expect(s).toHaveLength('KCNR11'.length);
    }
  });

  it('marca como desconhecido o que não parece com nada', () => {
    const r = analisarTicker('ZZZZ99');
    expect(r.situacao).toBe('desconhecido');
    expect(r.sugestoes).toEqual([]);
  });

  it('jamais substitui o ticker digitado pela sugestão', () => {
    expect(analisarTicker('KCNR11').ticker).not.toBe('KNCR11');
  });
});

describe('tickers da prateleira da XP', () => {
  it('reconhece os fundos listados que a lista da B3 não tem', () => {
    for (const t of ['JGPT11', 'VICA11', 'VGIE11', 'IMOV11', 'XPHF11', 'PIER11', 'PAAG11']) {
      expect(analisarTicker(t).situacao, t).toBe('conhecido');
    }
  });

  it('não sugere correção para eles — o alarme falso era pior que o silêncio', () => {
    for (const t of ['JGPT11', 'VGIE11', 'XPHF11', 'PAAG11']) {
      expect(analisarTicker(t).sugestoes, t).toEqual([]);
    }
  });

  it('carrega o nome do fundo junto, para o operador conferir o que está comprando', () => {
    expect(analisarTicker('PIER11').nome).toBe('Pátria Infra Energia Core Renda FIP INFRA');
    expect(analisarTicker('XPHF11').nome).toBe('XP Hedge Fund');
  });

  it('a lista da B3 continua mandando no que ela conhece', () => {
    expect(analisarTicker('PETR4')).toMatchObject({ situacao: 'conhecido', classe: 'acao' });
    expect(analisarTicker('KNCR11')).toMatchObject({ situacao: 'conhecido', classe: 'fii' });
  });

  it('e a suspeita de digitação continua funcionando', () => {
    expect(analisarTicker('KCNR11').situacao).toBe('parecido');
    expect(analisarTicker('KCNR11').sugestoes).toContain('KNCR11');
  });

  it('ticker inventado continua desconhecido', () => {
    expect(analisarTicker('ZZZZ99').situacao).toBe('desconhecido');
  });
});
