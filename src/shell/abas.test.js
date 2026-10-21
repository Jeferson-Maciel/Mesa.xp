import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABAS, ABA_PADRAO, abaDoAtalho, abaDoHash } from './abas.js';

describe('abaDoHash', () => {
  it('reconhece as rotas de todas as abas', () => {
    expect(abaDoHash('#ordens')).toBe('ordens');
    expect(abaDoHash('#fila')).toBe('fila');
    expect(abaDoHash('#fundos')).toBe('fundos');
    expect(abaDoHash('#rendafixa')).toBe('rendafixa');
    expect(abaDoHash('#calendario')).toBe('calendario');
    expect(abaDoHash('#operacional')).toBe('operacional');
    expect(abaDoHash('#anotacoes')).toBe('anotacoes');
    expect(abaDoHash('#anotacoes/nota/abc')).toBe('anotacoes');
  });

  // O link de um post da base leva à aba Operacional, não cai no Ordens.
  it('reconhece a aba pelo primeiro trecho, com a rota interna depois', () => {
    expect(abaDoHash('#operacional/post/confirmacao-de-ordem-venda')).toBe('operacional');
    expect(abaDoHash('#operacional/topico/disparos')).toBe('operacional');
    expect(abaDoHash('#/operacional/post/x')).toBe('operacional');
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

  it('Alt+1 em diante levam às abas na ordem da barra', () => {
    expect(ABAS).toEqual(['ordens', 'fila', 'fundos', 'rendafixa', 'calendario', 'operacional', 'anotacoes']);
    ABAS.forEach((aba, i) => expect(abaDoAtalho(tecla(`Digit${i + 1}`))).toBe(aba));
    expect(abaDoAtalho(tecla(`Digit${ABAS.length + 1}`))).toBeNull();
  });

  it('aceita o teclado numérico', () => {
    expect(abaDoAtalho(tecla('Numpad2'))).toBe('fila');
  });

  // O atalho escrito no title de cada aba é o que a tecla faz: uma aba nova no meio da barra não
  // deixa um "Alt + 3" errado para trás.
  it('a barra do index.html segue ABAS, com o Alt certo no title de cada aba, e cada aba tem a sua seção', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const abas = [...html.matchAll(/<a class="aba" href="#(\w+)" data-aba="(\w+)" title="([^"]+)"/g)];
    expect(abas.map(([, href]) => href)).toEqual(ABAS);
    abas.forEach(([, href, dataAba, title], i) => {
      expect(dataAba).toBe(href);
      expect(title).toContain(`(Alt + ${i + 1})`);
      expect(html).toContain(`<section id="modulo-${href}"`);
    });
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
    expect(abaDoAtalho(tecla('Digit9'))).toBeNull();
    expect(abaDoAtalho(tecla('KeyH'))).toBeNull();
    expect(abaDoAtalho(tecla(undefined))).toBeNull();
  });
});
