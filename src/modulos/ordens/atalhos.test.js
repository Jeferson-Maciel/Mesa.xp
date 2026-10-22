import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Os atalhos do Ordens. O F20 (22/10/2026) os pôs numa linha à vista; no mesmo dia o usuário pediu
 * "tudo menos poluído", e a linha saiu: cada atalho fica no `title` do botão dele. O que o title diz
 * tem de ser o que o teclado faz de verdade (o `keydown` do index.js).
 */
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const codigo = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
const titulo = (id) => html.match(new RegExp(`id="${id}"[^>]*title="([^"]*)"`))?.[1] ?? '';

describe('os atalhos do Ordens', () => {
  it('ficam no title dos botões, e não numa linha à vista', () => {
    expect(titulo('btn-analisar')).toContain('Ctrl + Enter');
    expect(titulo('btn-historico')).toContain('Alt + H');
    expect(html).not.toContain('atalhos-dica');
  });

  it('cada atalho do title tem o atalho no código', () => {
    expect(codigo).toMatch(/\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'Enter'\)[\s\S]{0,60}analisar\(\)/);
    expect(codigo).toMatch(/e\.altKey && \(e\.key === 'h'/);
  });

  it('o Limpar não promete um Esc que não existe (o Esc do Ordens só fecha o histórico)', () => {
    expect(html).not.toMatch(/id="btn-limpar"[^>]*Esc/);
  });
});
