import { describe, expect, it } from 'vitest';
import { novaNota } from './notas.js';
import { htmlAlerta, htmlAnexos, htmlCartao, htmlEditor, htmlEtiquetasFiltro, htmlFiltros, htmlLinks, htmlLista } from './render.js';

const AGORA = new Date(2026, 8, 30, 10, 5);
const XSS = '<img src=x onerror=alert(1)>';
const nota = (extra = {}) => ({ ...novaNota('n1', AGORA.getTime()), ...extra });

describe('cartão da anotação na lista', () => {
  it('pinta pelo estado do lembrete: amarelo pendente, vermelho vencida, verde resolvida', () => {
    expect(htmlCartao(nota({ lembrete: { data: '2026-10-02', hora: null } }), AGORA, false)).toContain('an-cartao an-pendente');
    expect(htmlCartao(nota({ lembrete: { data: '2026-09-29', hora: null } }), AGORA, false)).toContain('an-cartao an-vencida');
    expect(htmlCartao(nota({ concluida: true }), AGORA, false)).toContain('an-cartao an-resolvida');
    expect(htmlCartao(nota({ lembrete: { data: '2026-10-02', hora: null } }), AGORA, false)).toContain('Lembrar sex 02/10');
  });

  it('mostra título, trecho, etiquetas e quantos anexos', () => {
    const html = htmlCartao(nota({ titulo: 'Estorno', texto: 'conta 1234567', etiquetas: ['estorno'], anexos: [{ id: 'a' }, { id: 'b' }] }), AGORA, true);
    expect(html).toContain('Estorno');
    expect(html).toContain('conta 1234567');
    expect(html).toContain('estorno');
    expect(html).toContain('aria-current="true"');
    expect(html).toMatch(/2 anexos/);
    expect(html).toContain('href="#anotacoes/nota/n1"');
  });

  it('escapa título, texto e etiqueta', () => {
    const html = htmlCartao(nota({ titulo: XSS, texto: XSS, etiquetas: [XSS] }), AGORA, false);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('um id estranho não quebra o link', () => {
    expect(htmlCartao(nota({ id: 'a"b' }), AGORA, false)).toContain('href="#anotacoes/nota/a%22b"');
  });
});

describe('lista, filtros e etiquetas', () => {
  it('lista vazia explica o que fazer', () => {
    expect(htmlLista({ notas: [], agora: AGORA, selecionada: null, filtro: 'todas', termo: '' })).toContain('Nenhuma anotação ainda');
    expect(htmlLista({ notas: [], agora: AGORA, selecionada: null, filtro: 'vencidas', termo: '' })).toContain('Nada vencido');
    expect(htmlLista({ notas: [], agora: AGORA, selecionada: null, filtro: 'todas', termo: XSS })).toContain('&lt;img');
  });

  it('filtros com contagem e o ativo marcado', () => {
    const html = htmlFiltros({ contagens: { todas: 5, lembretes: 2, vencidas: 1, resolvidas: 3 }, filtro: 'vencidas' });
    expect(html).toMatch(/data-filtro="vencidas"[^>]*aria-pressed="true"/);
    expect(html).toContain('>1<');
  });

  it('etiquetas escapadas, com cor e contagem', () => {
    const html = htmlEtiquetasFiltro({ etiquetas: [{ nome: XSS, total: 2 }], atual: '' });
    expect(html).not.toContain('<img');
    expect(html).toMatch(/an-cor-\d/);
  });
});

describe('editor', () => {
  it('traz os campos com o texto escapado', () => {
    const html = htmlEditor({ nota: nota({ titulo: XSS, texto: `</textarea>${XSS}` }), agora: AGORA, sugestoes: [XSS] });
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/<\/textarea><img/);
    expect(html).toContain('data-campo="titulo"');
    expect(html).toContain('data-campo="texto"');
  });

  it('com lembrete, mostra o estado e a data; os atalhos viram "Adiar" quando venceu', () => {
    const pendente = htmlEditor({ nota: nota({ lembrete: { data: '2026-10-02', hora: '09:00' } }), agora: AGORA, sugestoes: [] });
    expect(pendente).toContain('value="2026-10-02"');
    expect(pendente).toContain('value="09:00"');
    expect(pendente).toContain('Lembrar sex 02/10 às 09:00');
    const vencida = htmlEditor({ nota: nota({ lembrete: { data: '2026-09-29', hora: null } }), agora: AGORA, sugestoes: [] });
    expect(vencida).toContain('Adiar');
    expect(vencida).toContain('data-atalho="amanha-9h"');
  });

  it('resolvida oferece reabrir', () => {
    expect(htmlEditor({ nota: nota({ concluida: true }), agora: AGORA, sugestoes: [] })).toContain('Reabrir');
  });
});

describe('links e anexos', () => {
  it('só http(s) vira link, com o endereço escapado e abrindo em outra aba sem acesso a esta', () => {
    const html = htmlLinks('ver https://hub.xpi.com.br/a?b=1&c=2 e javascript:alert(1)');
    expect(html).toContain('href="https://hub.xpi.com.br/a?b=1&amp;c=2"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('javascript:');
    expect(htmlLinks('sem link nenhum')).toBe('');
  });

  it('imagem vira miniatura; outro arquivo vira ficha com o nome escapado', () => {
    const html = htmlAnexos([
      { id: 'a1', nome: 'print.png', tipo: 'image/png', tamanho: 2048, criadoEm: AGORA.getTime() },
      { id: 'a2', nome: `${XSS}.pdf`, tipo: 'application/pdf', tamanho: 1_500_000, criadoEm: AGORA.getTime() }
    ]);
    expect(html).toContain('data-anexo="a1"');
    expect(html).toContain('data-miniatura="a1"');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('1,4 MB');
  });
});

describe('alerta de lembrete', () => {
  it('diz o que venceu e oferece abrir, adiar e resolver', () => {
    const html = htmlAlerta(nota({ titulo: XSS, lembrete: { data: '2026-09-30', hora: '09:00' } }), AGORA);
    expect(html).not.toContain('<img');
    expect(html).toContain('Venceu hoje às 09:00');
    for (const acao of ['abrir', 'adiar-1h', 'adiar-amanha', 'resolver', 'dispensar']) expect(html).toContain(`data-alerta="${acao}"`);
  });
});
