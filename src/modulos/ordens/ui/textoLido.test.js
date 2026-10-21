import { describe, expect, it } from 'vitest';
import { renderTextoLido } from './textoLido.js';

describe('o painel do texto lido', () => {
  it('escapa a linha colada e o motivo, e diz quando há o que fazer na mão', () => {
    const { resumo, html, temProblema } = renderTextoLido([
      { original: '<img src=x onerror=1>', situacao: 'lida', motivo: null, carimbo: true },
      { original: 'linha <b>ruim</b>', situacao: 'descartada', motivo: 'mais de um <ativo>', carimbo: false },
      { original: 'enviado mesa', situacao: 'ignorada', motivo: 'confirmação da mesa', carimbo: false }
    ]);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('mais de um &lt;ativo&gt;');
    expect(html).toContain('carimbo do WhatsApp tirado');
    expect(resumo).toBe('O que foi lido do texto: 1 linha lida · 1 descartada, para fazer na mão · 1 ignorada');
    expect(temProblema).toBe(true);
  });
});
