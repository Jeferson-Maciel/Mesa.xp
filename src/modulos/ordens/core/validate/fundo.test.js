import { describe, expect, it } from 'vitest';
import { procurarFundo } from './fundo.js';

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

describe('quantidade mínima', () => {
  it('vem junto do fundo encontrado, como número', () => {
    expect(procurarFundo('BGR Galpões Logísticos I Feeder FII').fundo.qtdMinima).toBe(1000);
  });

  it('lê o separador de milhar corretamente', () => {
    expect(procurarFundo('XP CDI 99 FOF Private Jun/27 FII RL').fundo.qtdMinima).toBe(2500000);
  });
});
