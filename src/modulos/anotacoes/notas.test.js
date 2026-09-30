import { describe, expect, it } from 'vitest';
import {
  adicionarEtiqueta,
  contagens,
  corDaEtiqueta,
  estaVazia,
  etiquetasEmUso,
  extrairLinks,
  filtrarNotas,
  novaNota,
  ordenarNotas,
  tituloVisivel,
  trechoDe
} from './notas.js';

const AGORA = new Date(2026, 8, 30, 10, 5);
let seq = 0;
const nota = (extra = {}) => ({ ...novaNota(`n${++seq}`, AGORA.getTime() - seq * 60_000), ...extra });

describe('anotação nova', () => {
  it('nasce vazia, sem lembrete, sem etiqueta, com as datas de criação', () => {
    const n = novaNota('abc', 1000);
    expect(n).toEqual({
      id: 'abc',
      titulo: '',
      texto: '',
      etiquetas: [],
      lembrete: null,
      concluida: false,
      concluidaEm: null,
      fixada: false,
      anexos: [],
      criadaEm: 1000,
      atualizadaEm: 1000,
      excluidaEm: null
    });
    expect(estaVazia(n)).toBe(true);
    expect(estaVazia({ ...n, anexos: [{ id: 'a' }] })).toBe(false);
    expect(estaVazia({ ...n, texto: '  \n ' })).toBe(true);
  });
});

describe('título e trecho', () => {
  it('sem título, a primeira linha do texto faz as vezes dele', () => {
    expect(tituloVisivel(nota({ titulo: '  Estorno dia 25 ' }))).toBe('Estorno dia 25');
    expect(tituloVisivel(nota({ texto: '\n\nLigar para o assessor\nconta 1234567' }))).toBe('Ligar para o assessor');
    expect(tituloVisivel(nota())).toBe('Sem título');
  });

  it('o trecho é o texto numa linha só, sem repetir a linha que virou título', () => {
    expect(trechoDe(nota({ texto: 'Ligar para o assessor\nconta 1234567\n\nprint no anexo' }))).toBe('conta 1234567 print no anexo');
    expect(trechoDe(nota({ titulo: 'Estorno', texto: 'conta 1234567\nvalor R$ 50,00' }))).toBe('conta 1234567 valor R$ 50,00');
    expect(trechoDe(nota({ titulo: 'Estorno', texto: '[x] pedir\n- [ ] anexar o print' }))).toBe('☑ pedir - ☐ anexar o print');
  });
});

describe('etiquetas', () => {
  it('limpa espaços, não repete (sem ligar para maiúsculas) e ignora vazia', () => {
    expect(adicionarEtiqueta(['estorno'], '  Cliente   XP ')).toEqual(['estorno', 'Cliente XP']);
    expect(adicionarEtiqueta(['estorno'], 'ESTORNO')).toEqual(['estorno']);
    expect(adicionarEtiqueta(['estorno'], '   ')).toEqual(['estorno']);
  });

  it('corta etiqueta longa e para em 20 por anotação', () => {
    expect(adicionarEtiqueta([], 'x'.repeat(60))[0]).toHaveLength(40);
    const vinte = Array.from({ length: 20 }, (_, i) => `e${i}`);
    expect(adicionarEtiqueta(vinte, 'mais uma')).toEqual(vinte);
  });

  it('a cor é sempre a mesma para o mesmo nome, e dentro da paleta', () => {
    expect(corDaEtiqueta('estorno')).toBe(corDaEtiqueta('ESTORNO'));
    for (const nome of ['estorno', 'ajudar', 'cliente', 'fixing', 'ted']) expect(corDaEtiqueta(nome)).toBeGreaterThanOrEqual(0);
    expect(new Set(['estorno', 'ajudar', 'cliente', 'fixing', 'ted', 'rf', 'pix'].map(corDaEtiqueta)).size).toBeGreaterThan(1);
  });

  it('lista as etiquetas em uso com a contagem, em ordem alfabética', () => {
    const notas = [nota({ etiquetas: ['estorno', 'Ajudar'] }), nota({ etiquetas: ['estorno'] }), nota({ etiquetas: ['ajudar'], concluida: true })];
    expect(etiquetasEmUso(notas)).toEqual([
      { nome: 'Ajudar', total: 2 },
      { nome: 'estorno', total: 2 }
    ]);
  });
});

describe('links', () => {
  it('acha os links http e https do texto, sem a pontuação do fim da frase', () => {
    const texto = 'Veja https://hub.xpi.com.br/relatorios?id=12. E também (http://exemplo.com/a) e https://hub.xpi.com.br/relatorios?id=12';
    expect(extrairLinks(texto)).toEqual(['https://hub.xpi.com.br/relatorios?id=12', 'http://exemplo.com/a']);
  });

  // Qualquer coisa que não seja http(s) não vira link clicável.
  it('ignora javascript:, data: e file:', () => {
    expect(extrairLinks('javascript:alert(1) data:text/html,<b>x</b> file:///C:/x.txt')).toEqual([]);
  });
});

describe('ordem, filtros e busca', () => {
  const vencida = nota({ titulo: 'Estorno', lembrete: { data: '2026-09-29', hora: null }, etiquetas: ['estorno'] });
  const hoje = nota({ titulo: 'Ligar 14h', lembrete: { data: '2026-09-30', hora: '14:00' } });
  const pendente = nota({ titulo: 'Ajudar a Ana com o relatório', lembrete: { data: '2026-10-02', hora: null }, etiquetas: ['ajudar'] });
  const fixada = nota({ titulo: 'Senhas não! Contatos da mesa', fixada: true });
  const solta = nota({ titulo: 'Rascunho', texto: 'resgate de fundos até 15h' });
  const resolvida = nota({ titulo: 'TED devolvida', concluida: true, concluidaEm: AGORA.getTime(), etiquetas: ['estorno'] });
  const todas = [solta, resolvida, pendente, fixada, hoje, vencida];

  it('vencidas primeiro, depois fixadas, depois as de hoje e as pendentes pela data, depois o resto', () => {
    expect(ordenarNotas(todas, AGORA).map((n) => n.titulo)).toEqual([
      'Estorno',
      'Senhas não! Contatos da mesa',
      'Ligar 14h',
      'Ajudar a Ana com o relatório',
      'Rascunho',
      'TED devolvida'
    ]);
  });

  it('"Todas" não mostra as resolvidas; cada filtro mostra o seu', () => {
    const titulos = (filtro, extra = {}) => filtrarNotas(todas, { filtro, ...extra }, AGORA).map((n) => n.titulo);
    expect(titulos('todas')).not.toContain('TED devolvida');
    expect(titulos('lembretes')).toEqual(['Ligar 14h', 'Ajudar a Ana com o relatório']);
    expect(titulos('vencidas')).toEqual(['Estorno']);
    expect(titulos('resolvidas')).toEqual(['TED devolvida']);
    expect(titulos('resolvidas', { etiqueta: 'ESTORNO' })).toEqual(['TED devolvida']);
    expect(titulos('todas', { etiqueta: 'estorno' })).toEqual(['Estorno']);
  });

  it('a busca acha no título, no texto e nas etiquetas, sem ligar para acento', () => {
    const achar = (termo) => filtrarNotas(todas, { filtro: 'todas', termo }, AGORA).map((n) => n.titulo);
    expect(achar('relatorio')).toEqual(['Ajudar a Ana com o relatório']);
    expect(achar('RESGATE')).toEqual(['Rascunho']);
    expect(achar('ajudar')).toEqual(['Ajudar a Ana com o relatório']);
  });

  it('conta cada filtro', () => {
    expect(contagens(todas, AGORA)).toEqual({ todas: 5, lembretes: 2, vencidas: 1, resolvidas: 1, lixeira: 0 });
  });
});
