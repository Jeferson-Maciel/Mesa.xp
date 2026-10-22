import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * F20 (22/10/2026): os atalhos do Ordens à vista na tela, e não só no `title` dos botões. A dica
 * diz só o que o teclado faz de verdade (o `keydown` do index.js).
 */
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const codigo = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
const dica = html.match(/<p class="atalhos-dica"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';

describe('os atalhos do Ordens à vista', () => {
  it('abaixo dos botões, Ctrl+Enter analisa e Alt+H abre o histórico, em teclas', () => {
    expect(dica).toContain('<kbd>Ctrl</kbd>+<kbd>Enter</kbd> analisa');
    expect(dica).toContain('<kbd>Alt</kbd>+<kbd>H</kbd> histórico');
    expect(html.indexOf('class="atalhos-dica"')).toBeGreaterThan(html.indexOf('id="btn-analisar"'));
  });

  it('cada tecla da dica tem o atalho no código', () => {
    expect(codigo).toMatch(/\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'Enter'\)[\s\S]{0,60}analisar\(\)/);
    expect(codigo).toMatch(/e\.altKey && \(e\.key === 'h'/);
  });

  it('o Limpar não promete um Esc que não existe (o Esc do Ordens só fecha o histórico)', () => {
    expect(html).not.toMatch(/id="btn-limpar"[^>]*Esc/);
  });
});
