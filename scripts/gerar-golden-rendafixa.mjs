/**
 * Gera os golden files do Renda Fixa com o motor ORIGINAL do RendaFixaDisparo.
 *
 * O texto de `montarTexto` é o produto: o assessor cola direto no WhatsApp do cliente, e um
 * asterisco, um "-> " ou um "–" fora do lugar chega ao cliente. Os goldens registram o que o motor
 * original produz, e `motor.golden.test.js` exige que o motor da Mesa XP produza igual.
 *
 * Rode de novo só quando o motor ORIGINAL for a referência — por exemplo, ao acrescentar uma
 * exportação nova da XP em fixtures/. Depois que o motor da Mesa XP mudar de propósito, os
 * goldens passam a ser editados à mão, com o antes/depois à vista na revisão.
 *
 * Uso: node scripts/gerar-golden-rendafixa.mjs <pasta do repositório RendaFixaDisparo>
 *
 * Para cada planilha de src/modulos/rendafixa/fixtures/ (as .xlsx reais, fora do git, e a
 * sintetica.js) e para cada mercado, grava em golden/:
 *   <nome>.<mercado>.json  { texto, resultado }: o texto de montarTexto e o processRows inteiro
 *   <nome>.<mercado>.txt   o mesmo texto, para ler na revisão
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINHAS_SINTETICAS } from '../src/modulos/rendafixa/fixtures/sintetica.js';
import { DATA_GOLDEN, FUSO_GOLDEN, MODOS } from '../src/modulos/rendafixa/golden/referencia.js';

// Antes de qualquer data: o SheetJS converte a célula de data no fuso do processo.
process.env.TZ = FUSO_GOLDEN;

const repositorio = process.argv[2];
if (!repositorio) {
  console.error('Informe a pasta do repositório RendaFixaDisparo (a do motor original).');
  console.error('Uso: node scripts/gerar-golden-rendafixa.mjs ../RendaFixaDisparo');
  process.exit(1);
}

const exigir = createRequire(import.meta.url);
const original = exigir(resolve(repositorio, 'frontend/motor.js'));
const XLSX = exigir(resolve(repositorio, 'frontend/vendor/xlsx.full.min.js'));
if (typeof original.processRows !== 'function') throw new Error('motor original sem processRows');

const raiz = fileURLToPath(new URL('../src/modulos/rendafixa/', import.meta.url));
const fixtures = join(raiz, 'fixtures');
const golden = join(raiz, 'golden');
const hoje = new Date(DATA_GOLDEN);

// O mesmo caminho do handleFile original: ArrayBuffer, primeira aba, datas como Date.
const lerComoOriginal = (arquivo) => {
  const buffer = readFileSync(arquivo);
  const dados = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const workbook = XLSX.read(dados, { type: 'array', cellDates: true });
  const aba = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[aba], { header: 1 });
};

const planilhas = [
  { nome: 'sintetica', rows: LINHAS_SINTETICAS },
  ...readdirSync(fixtures)
    .filter((n) => n.endsWith('.xlsx'))
    .sort()
    .map((n) => ({ nome: basename(n, '.xlsx'), rows: lerComoOriginal(join(fixtures, n)) }))
];

for (const { nome, rows } of planilhas) {
  for (const modo of MODOS) {
    const resultado = original.processRows(rows, modo.secundario, hoje);
    const texto = original.montarTexto(resultado);
    const base = join(golden, `${nome}.${modo.nome}`);
    writeFileSync(`${base}.json`, JSON.stringify({ texto, resultado }, null, 2) + '\n');
    writeFileSync(`${base}.txt`, texto);
    console.log(`${nome}.${modo.nome}: ${resultado.totais.lidos} linhas, ${resultado.totais.exibidos} na mensagem`);
  }
}
