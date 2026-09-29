import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * O CSS do Ordens tem seletores genéricos (`.panel`, `.badge`, `.history-item`…) e, antes da
 * fusão, seletores de elemento (`table`, `textarea`, `header`). Os módulos novos não podem pisar
 * nisso nem ser pisados: todo seletor deles começa pela raiz do módulo.
 *
 * O teste lê o CSS como texto e lista os seletores de cada regra, fora os de @keyframes.
 */

const seletores = (css) => {
  const texto = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const encontrados = [];
  const pilha = [];
  let inicio = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '{') {
      const cabeca = texto.slice(inicio, i).trim();
      const emKeyframes = pilha.some((p) => p.startsWith('@keyframes'));
      pilha.push(cabeca);
      if (!cabeca.startsWith('@') && !emKeyframes) encontrados.push(...cabeca.split(',').map((s) => s.trim()));
      inicio = i + 1;
    } else if (c === '}') {
      pilha.pop();
      inicio = i + 1;
    } else if (c === ';') {
      inicio = i + 1;
    }
  }
  return encontrados;
};

const MODULOS = [
  { arquivo: '../modulos/rendafixa/rendafixa.css', raizes: ['.rf', '#modulo-rendafixa'] },
  { arquivo: '../modulos/calendario/calendario.css', raizes: ['.cal', '#modulo-calendario'] }
];

describe('CSS escopado dos módulos novos', () => {
  it('o leitor de seletores entende regras, @media e @keyframes', () => {
    const css = '.a b, .a c { x: 1; } @media (x) { .a d { y: 2 } } @keyframes k { from { o: 0 } to { o: 1 } }';
    expect(seletores(css)).toEqual(['.a b', '.a c', '.a d']);
  });

  for (const { arquivo, raizes } of MODULOS) {
    const caminho = fileURLToPath(new URL(arquivo, import.meta.url));

    it.skipIf(!existsSync(caminho))(`${arquivo}: todo seletor começa por ${raizes.join(' ou ')}`, () => {
      const lista = seletores(readFileSync(caminho, 'utf8'));
      expect(lista.length).toBeGreaterThan(10);
      const fora = lista.filter((s) => !raizes.some((r) => s === r || s.startsWith(r + ' ') || s.startsWith(r + '.') || s.startsWith(r + ':') || s.startsWith(r + '[')));
      expect(fora).toEqual([]);
    });
  }

  it('o Ordens não tem mais seletor de elemento solto', () => {
    const css = readFileSync(fileURLToPath(new URL('../modulos/ordens/ordens.css', import.meta.url)), 'utf8');
    // `table.preview th` já está preso à classe; solto é o elemento sem nada depois.
    const soltos = seletores(css).filter((s) => /^(header|table|thead|tbody|textarea|input|select|button|dialog)(?=$|[\s:>+~])/.test(s));
    expect(soltos).toEqual([]);
  });
});
