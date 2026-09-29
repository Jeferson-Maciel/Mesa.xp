import { describe, expect, it } from 'vitest';
import { limparEntrada } from './limparEntrada.js';

const linhasUteis = (texto) => limparEntrada(texto).linhas;
const ignoradas = (texto) => limparEntrada(texto).ignoradas.map((i) => i.linha);

describe('limparEntrada — prefixo do WhatsApp', () => {
  it('remove o carimbo [hora, data] Remetente:', () => {
    expect(linhasUteis('[13:46, 21/09/2026] Paulo Mendes: 700003')).toEqual(['700003']);
  });

  it('remove o carimbo quando o remetente é um telefone', () => {
    expect(linhasUteis('[14:03, 21/09/2026] +55 11 5555-0101: 80000009')).toEqual(['80000009']);
  });

  it('remove o carimbo mesmo quando não sobra conteúdo na linha', () => {
    expect(linhasUteis('[14:03, 21/09/2026] Mônica Araújo:')).toEqual([]);
  });

  it('NUNCA deixa o horário do carimbo virar conteúdo da ordem', () => {
    const { linhas } = limparEntrada('[13:46, 21/09/2026] Paulo Mendes: C - PETR4 - 100');
    expect(linhas.join(' ')).not.toContain('13:46');
    expect(linhas.join(' ')).not.toContain('21/09/2026');
  });
});

describe('limparEntrada — ruído da mesa', () => {
  it.each([
    'Enviado mesa.',
    'Enviado mesa',
    'Email enviado.',
    'E-mail enviado',
    'Push enviado',
    'Enviado',
    '@Paulo Mendes @~Rafael Berwaldt'
  ])('descarta a linha de confirmação %j', (linha) => {
    expect(linhasUteis(linha)).toEqual([]);
  });

  it('registra o que descartou, para nada sumir calado', () => {
    expect(ignoradas('700003\nEnviado mesa.')).toEqual(['Enviado mesa.']);
  });

  it('diz o motivo de cada descarte', () => {
    const { ignoradas } = limparEntrada('Enviado mesa.');
    expect(ignoradas[0].motivo).toBeTruthy();
  });

  it('não descarta uma linha de ordem que contém a palavra enviado', () => {
    expect(linhasUteis('C - PETR4 - 100 enviado hoje')).toEqual(['C - PETR4 - 100 enviado hoje']);
  });
});

describe('limparEntrada — higiene geral', () => {
  it('remove linhas vazias e espaços nas pontas', () => {
    expect(linhasUteis('  700003  \n\n\n  COMPRA  ')).toEqual(['700003', 'COMPRA']);
  });

  it('preserva a ordem original das linhas', () => {
    expect(linhasUteis('700003\nC\nPETR4\nVALE3')).toEqual(['700003', 'C', 'PETR4', 'VALE3']);
  });

  it('aceita quebra de linha do Windows', () => {
    expect(linhasUteis('700003\r\nCOMPRA')).toEqual(['700003', 'COMPRA']);
  });

  it('devolve vazio para entrada vazia', () => {
    expect(limparEntrada('')).toEqual({ linhas: [], ignoradas: [] });
    expect(limparEntrada(null)).toEqual({ linhas: [], ignoradas: [] });
  });
});

describe('limparEntrada — bloco real colado do grupo', () => {
  const bloco = `[13:46, 21/09/2026] Paulo Mendes: 700003

V - HGCR11 (Total)
V - HGLG11 (Total)
Enviado mesa.
[14:14, 21/09/2026] +55 11 5555-0202: 7000001

COMPRA

IVVB11 - 7 qntds

via email`;

  it('deixa só as linhas que interessam', () => {
    expect(linhasUteis(bloco)).toEqual([
      '700003',
      'V - HGCR11 (Total)',
      'V - HGLG11 (Total)',
      '7000001',
      'COMPRA',
      'IVVB11 - 7 qntds',
      'via email'
    ]);
  });
});

// Lista numerada fazia o `1` de `1. BTLG11 - 100` virar a quantidade, e o negrito do WhatsApp
// escondia o ticker (`*BTLG11*` não tem formato de ticker) e a linha ia para os descartes.
describe('limparEntrada — formatação da mensagem', () => {
  it.each([
    ['1. BTLG11 - 100', 'BTLG11 - 100'],
    ['2) XPML11 200', 'XPML11 200'],
    ['10) KNCR11 - 5.000,00', 'KNCR11 - 5.000,00'],
    ['• BTLG11 - 100', 'BTLG11 - 100'],
    ['- XPML11 - 200', 'XPML11 - 200'],
    ['– XPML11 - 200', 'XPML11 - 200']
  ])('tira a numeração e o marcador de lista de %j', (linha, esperado) => {
    expect(linhasUteis(linha)).toEqual([esperado]);
  });

  it.each(['1.000 PETR4', '100 PETR4', '10 - PETR4', '7000001'])(
    'não confunde %j, que começa com número de verdade, com numeração',
    (linha) => expect(linhasUteis(linha)).toEqual([linha])
  );

  it.each([
    ['*BTLG11* - 100', 'BTLG11 - 100'],
    ['*compra*', 'compra'],
    ['_via email_', 'via email']
  ])('tira o negrito e o itálico do WhatsApp de %j', (linha, esperado) => {
    expect(linhasUteis(linha)).toEqual([esperado]);
  });

  // Riscar no WhatsApp costuma ser cancelar. Tirar o `~` transformaria um cancelamento numa
  // ordem; mantido, o `~VALE3` não tem formato de ticker e a linha vai para os descartes, à vista.
  it('NÃO tira o tachado: linha riscada não vira ordem por acidente', () => {
    expect(linhasUteis('~VALE3 100~')).toEqual(['~VALE3 100~']);
  });

  it('continua reconhecendo a menção depois de tirar a formatação', () => {
    expect(ignoradas('@~Rafael Berwaldt')).toHaveLength(1);
  });
});
