import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { LINHAS_SINTETICAS } from './fixtures/sintetica.js';
import { DATA_GOLDEN, MODOS } from './golden/referencia.js';
import { montarTexto, processRows } from './motor.js';
import { lerPlanilha } from './planilha.js';

/**
 * O motor da Mesa XP contra o motor original do RendaFixaDisparo.
 *
 * Os goldens (golden/*.json) foram gerados pelo motor ORIGINAL (scripts/gerar-golden-rendafixa.mjs)
 * lendo cada planilha do jeito do app original. Aqui o motor novo lê as mesmas planilhas pelo
 * caminho novo — SheetJS vendorizado, `lerPlanilha` — e tem que produzir o mesmo texto, caractere
 * por caractere, e o mesmo `processRows` inteiro: funil, descartes, bloqueados e colunas.
 *
 * As exportações reais da XP ficam fora do git; sem elas, os goldens delas são pulados e só o da
 * planilha sintética roda.
 */

const XLSX = createRequire(import.meta.url)('../../vendor/xlsx.full.min.js');
const caminho = (relativo) => fileURLToPath(new URL(relativo, import.meta.url));
const hoje = new Date(DATA_GOLDEN);

const nomes = [
  ...new Set(
    readdirSync(caminho('./golden/'))
      .filter((n) => n.endsWith('.json'))
      .map((n) => n.replace(/\.(primario|secundario)\.json$/, ''))
  )
];

const planilhaDe = (nome) => caminho(`./fixtures/${nome}.xlsx`);

describe('ambiente dos goldens', () => {
  it('roda no fuso de Brasília, o mesmo em que os goldens foram gerados', () => {
    expect(new Date(DATA_GOLDEN).getTimezoneOffset()).toBe(180);
  });

  it('tem golden da planilha sintética, que roda mesmo sem as exportações reais', () => {
    expect(nomes).toContain('sintetica');
  });

  it('toda exportação em fixtures/ tem golden: rode o gerador ao acrescentar uma', () => {
    const planilhas = existsSync(caminho('./fixtures/'))
      ? readdirSync(caminho('./fixtures/')).filter((n) => n.endsWith('.xlsx'))
      : [];
    for (const arquivo of planilhas) expect(nomes).toContain(arquivo.replace(/\.xlsx$/, ''));
  });
});

for (const nome of nomes) {
  const sintetica = nome === 'sintetica';
  const disponivel = sintetica || existsSync(planilhaDe(nome));

  describe.skipIf(!disponivel)(`golden: ${nome}`, () => {
    let rows;

    beforeAll(() => {
      rows = sintetica ? LINHAS_SINTETICAS : lerPlanilha(new Uint8Array(readFileSync(planilhaDe(nome))), XLSX).rows;
    });

    for (const modo of MODOS) {
      const golden = JSON.parse(readFileSync(caminho(`./golden/${nome}.${modo.nome}.json`), 'utf8'));

      it(`${modo.nome}: mensagem idêntica à do motor original`, () => {
        expect(montarTexto(processRows(rows, modo.secundario, hoje))).toBe(golden.texto);
      });

      it(`${modo.nome}: funil, descartes, bloqueados e seções idênticos`, () => {
        const resultado = JSON.parse(JSON.stringify(processRows(rows, modo.secundario, hoje)));
        expect(resultado).toEqual(golden.resultado);
      });

      it(`${modo.nome}: o .txt de revisão é o mesmo texto do golden`, () => {
        expect(readFileSync(caminho(`./golden/${nome}.${modo.nome}.txt`), 'utf8')).toBe(golden.texto);
      });
    }
  });
}
