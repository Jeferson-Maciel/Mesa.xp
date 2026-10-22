import { describe, expect, it } from 'vitest';
import { ROTULOS, comValor, regrasPadrao } from './regras.js';
import { PARTES, htmlFormularioDasRegras, htmlResumoDaColagem, lerCampo, textoDoCampo, tituloDoSelo } from './telaDasRegras.js';

// A gaveta "Regras" do Renda Fixa (21/10/2026): "tudo o que faz a aba funcionar" configurável.

describe('a gaveta das regras', () => {
  it('tem um campo para cada regra, uma vez cada: nenhuma fica de fora', () => {
    const caminhos = PARTES.flatMap((p) => p.campos.map(([caminho]) => caminho));
    expect([...caminhos].sort()).toEqual(Object.keys(ROTULOS).sort());
    const html = htmlFormularioDasRegras(regrasPadrao('primario'));
    for (const caminho of caminhos) expect(html.split(`data-regra="${caminho}"`).length - 1).toBe(1);
  });

  it('o que a pessoa digita volta escapado', () => {
    const regras = comValor(regrasPadrao('primario'), 'mensagem.cabecalho', '<img src=x onerror=alert(1)>');
    const html = htmlFormularioDasRegras(regras);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('as partes vêm abertas, menos o Avançado', () => {
    const html = htmlFormularioDasRegras(regrasPadrao('primario'));
    expect(html).toMatch(/data-parte="filtros" open/);
    expect(html).toMatch(/data-parte="avancado">/);
  });
});

describe('o campo e o valor', () => {
  it('lê cada tipo do jeito que se escreve', () => {
    expect(lerCampo('numero', '1.300')).toBe(1300);
    expect(lerCampo('numero', '1.500,50')).toBe(1500.5);
    expect(lerCampo('numero', '')).toBeNaN();
    expect(lerCampo('anos', '1, 2; 3 x')).toEqual([1, 2, 3, NaN]);
    expect(lerCampo('siglas', 'lca, lci')).toEqual(['LCA', 'LCI']);
    expect(lerCampo('lista', 'tax.min, taxa ,')).toEqual(['tax.min', 'taxa']);
    expect(lerCampo('linhas', 'XP\n\n BTG \n')).toEqual(['XP', 'BTG']);
    expect(lerCampo('pares', 'letra financeira = LF\nsem igual')).toEqual([['letra financeira', 'LF'], ['', '']]);
  });

  it('o texto do campo volta ao mesmo valor', () => {
    const p = regrasPadrao('primario');
    expect(lerCampo('pares', textoDoCampo('pares', p.avancado.tiposPorNome))).toEqual(p.avancado.tiposPorNome);
    expect(lerCampo('anos', textoDoCampo('anos', p.prazos.pos))).toEqual(p.prazos.pos);
    expect(lerCampo('linhas', textoDoCampo('linhas', p.bancos))).toEqual(p.bancos);
  });
});

describe('o que muda ao colar, e o selo', () => {
  it('mercado a mercado, escapado; sem mudança, diz que nada muda', () => {
    const atual = { primario: regrasPadrao('primario'), secundario: regrasPadrao('secundario') };
    const colada = { ...atual, primario: comValor(atual.primario, 'mensagem.rodape', '<b>oi</b>') };
    const html = htmlResumoDaColagem(atual, colada);
    expect(html).toContain('Rodapé: <s>(vazio)</s> → <b>&lt;b&gt;oi&lt;/b&gt;</b>');
    expect(html).toContain('nada muda');
  });

  it('o selo lista o que difere do padrão', () => {
    expect(tituloDoSelo([{ rotulo: 'PU máximo (R$)', de: '1.300', para: '1.500' }])).toBe('PU máximo (R$): 1.300 → 1.500');
  });
});
