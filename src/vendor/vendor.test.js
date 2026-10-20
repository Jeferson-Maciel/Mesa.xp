import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * O SheetJS vem vendorizado, não do npm.
 *
 * O pacote `xlsx` do registro npm parou na 0.18.5, que tem vulnerabilidades conhecidas
 * (prototype pollution e ReDoS); a SheetJS passou a publicar só no próprio CDN. A cópia aqui é a
 * 0.20.1 do CDN oficial, a mesma que o RendaFixa Pro usava, byte a byte.
 */

const caminho = (relativo) => fileURLToPath(new URL(relativo, import.meta.url));

// sha256 de https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js
const SHA256_OFICIAL = '36a42f409fe9b8b8e4d112f0edc826883e40ed88eae071987a427a0389b06c03';

describe('SheetJS vendorizado', () => {
  it('é a 0.20.1', () => {
    const XLSX = createRequire(import.meta.url)('./xlsx.full.min.js');
    expect(XLSX.version).toBe('0.20.1');
  });

  it('é idêntico ao arquivo do CDN oficial', () => {
    const hash = createHash('sha256').update(readFileSync(caminho('./xlsx.full.min.js'))).digest('hex');
    expect(hash).toBe(SHA256_OFICIAL);
  });

  it('vem com a licença', () => {
    expect(readFileSync(caminho('./LICENSE-sheetjs.txt'), 'utf8')).toContain('Apache License');
  });

  it('o pacote "xlsx" do npm não entra no projeto', () => {
    const pacote = JSON.parse(readFileSync(caminho('../../package.json'), 'utf8'));
    const todas = { ...pacote.dependencies, ...pacote.devDependencies };
    expect(Object.keys(todas)).not.toContain('xlsx');
  });
});

/**
 * A SnapDOM vem vendorizada e entra no robô do Hub, que tira com ela o print da cotação de venda na
 * boleta (fase 2 do grilling de 20/10/2026). A boleta é feita de web components com shadow DOM, que o
 * html-to-image não copia; a SnapDOM copia. É a 3.2.0 do npm (`@zumer/snapdom`, MIT), o build IIFE
 * (`dist/snapdom.js`), byte a byte: o pacote baixado bateu com o shasum do registro
 * (002f53be2125365642e33a6c87574c4cfa9c1c0a). Nada é buscado de CDN.
 */
const SHA256_DA_SNAPDOM = '0109b0986f5ed6eb8881c3da9f57f328cb194c8551a4b34dbcab3ff755811cab';

describe('SnapDOM vendorizada', () => {
  it('é a 3.2.0, idêntica à do npm', () => {
    const fonte = readFileSync(caminho('./snapdom.js'));
    expect(fonte.toString('utf8').slice(0, 40)).toContain('v3.2.0');
    expect(createHash('sha256').update(fonte).digest('hex')).toBe(SHA256_DA_SNAPDOM);
  });

  it('vem com a licença MIT', () => {
    expect(readFileSync(caminho('./LICENSE-snapdom.txt'), 'utf8')).toMatch(/MIT License[\s\S]*ZumerLab/);
  });
});
