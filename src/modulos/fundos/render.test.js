import { describe, expect, it } from 'vitest';
import { htmlMudancas, htmlTabela } from './render.js';

const linha = (extra = {}) => ({ chave: 'a', id: 'a', nome: 'Fundo Exemplo', ticker: 'EXMP11', desagio: 6, roaMaximo: 0.5, pu: 8, estoque: 1000, aplicacaoMinima: 10, corretagem: 1.5, clientes: null, ...extra });

describe('a tabela da prateleira', () => {
  it('escapa o nome que vem do Hub e marca a coluna da ordem', () => {
    const html = htmlTabela([linha({ nome: '<img src=x onerror=1>' })], { campo: 'desagio', sentido: 'desc', total: 1 });
    expect(html).not.toContain('<img');
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('6,00%');
  });

  it('o fundo sem estoque e o Estoque clientes fechado aparecem como tais', () => {
    const html = htmlTabela([linha({ estoque: 0 })], { campo: 'nome', sentido: 'asc', total: 1 });
    expect(html).toContain('sem estoque');
    expect(html).toContain('fechado');
    expect(htmlTabela([], { campo: 'nome', sentido: 'asc', total: 3 })).toContain('Nenhum fundo com esse filtro');
    expect(htmlTabela([], { campo: 'nome', sentido: 'asc', total: 0 })).toBe('');
  });
});

describe('o que mudou', () => {
  it('sem dia anterior, sem mudança, e as mudanças com o sentido', () => {
    expect(htmlMudancas(null, null, true)).toBe('<p class="fu-nota">Primeira foto da prateleira.</p>');
    expect(htmlMudancas({}, '2026-10-20', true)).toBe('<p class="fu-nota">Nada mudou desde 20/10.</p>');
    const html = htmlMudancas({ entraram: ['<b>Novo</b>'], sairam: [], desagio: [{ fundo: 'X', de: 6, para: 6.5 }], roa: [], estoque: [{ fundo: 'Y', zerou: true }] }, '2026-10-20', false);
    expect(html).toContain('&lt;b&gt;Novo');
    expect(html).toContain('class="fu-subiu">6,50%');
    expect(html).toContain('class="fu-caiu">zerou');
  });
});
