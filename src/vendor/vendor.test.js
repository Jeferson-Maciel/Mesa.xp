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
