import { describe, expect, it } from 'vitest';
import { ABAS, ABA_PADRAO, abaDoAtalho, abaDoHash } from './abas.js';

describe('abaDoHash', () => {
  it('reconhece as três rotas', () => {
    expect(abaDoHash('#ordens')).toBe('ordens');
    expect(abaDoHash('#rendafixa')).toBe('rendafixa');
    expect(abaDoHash('#calendario')).toBe('calendario');
  });

  it('abre no Ordens sem hash: é a ferramenta de todo pedido', () => {
    expect(ABA_PADRAO).toBe('ordens');
    expect(abaDoHash('')).toBe('ordens');
    expect(abaDoHash('#')).toBe('ordens');
    expect(abaDoHash(undefined)).toBe('ordens');
  });

  it('cai no Ordens diante de um hash desconhecido, em vez de mostrar tela vazia', () => {
    expect(abaDoHash('#xyz')).toBe('ordens');
    expect(abaDoHash('#access_token=abc')).toBe('ordens');
  });

  it('tolera maiúsculas e a barra do estilo #/rota', () => {
    expect(abaDoHash('#RendaFixa')).toBe('rendafixa');
    expect(abaDoHash('#/calendario')).toBe('calendario');
  });
});

describe('abaDoAtalho', () => {
  const tecla = (code, extra = {}) => ({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code, ...extra });

  it('Alt+1, Alt+2 e Alt+3 levam às abas na ordem da barra', () => {
    expect(abaDoAtalho(tecla('Digit1'))).toBe(ABAS[0]);
    expect(abaDoAtalho(tecla('Digit2'))).toBe(ABAS[1]);
    expect(abaDoAtalho(tecla('Digit3'))).toBe(ABAS[2]);
    expect(ABAS).toEqual(['ordens', 'rendafixa', 'calendario']);
  });

  it('aceita o teclado numérico', () => {
    expect(abaDoAtalho(tecla('Numpad2'))).toBe('rendafixa');
  });

  it('ignora o número sem Alt: o operador está digitando', () => {
    expect(abaDoAtalho(tecla('Digit1', { altKey: false }))).toBeNull();
  });

  // No Windows o AltGr chega como Ctrl+Alt e, em alguns teclados, digita símbolo com número.
  it('ignora AltGr (Ctrl+Alt) e as outras combinações', () => {
    expect(abaDoAtalho(tecla('Digit2', { ctrlKey: true }))).toBeNull();
    expect(abaDoAtalho(tecla('Digit2', { metaKey: true }))).toBeNull();
    expect(abaDoAtalho(tecla('Digit2', { shiftKey: true }))).toBeNull();
  });

  it('ignora números sem aba e outras teclas', () => {
    expect(abaDoAtalho(tecla('Digit4'))).toBeNull();
    expect(abaDoAtalho(tecla('KeyH'))).toBeNull();
    expect(abaDoAtalho(tecla(undefined))).toBeNull();
  });
});
