import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as motor from './motor.js';

/**
 * Guardas do porte do motor. As regras de negócio estão cobertas pelos goldens
 * (motor.golden.test.js); aqui ficam as armadilhas registradas no CLAUDE.md do RendaFixa Pro.
 */

const caminho = (relativo) => fileURLToPath(new URL(relativo, import.meta.url));

describe('motor do Renda Fixa', () => {
  it('expõe a mesma API do motor original', () => {
    expect(Object.keys(motor).sort()).toEqual(
      [
        'processRows', 'montarTexto', 'partesDaTaxa', 'parseTaxaLocal', 'parsePULocal', 'parsePrazoLocal',
        'classificarDiasEmAnos', 'normalizeTipoLocal', 'detectarIndexador', 'extrairEmissor', 'parseNumero',
        'fmtT', 'fmtP', 'MOTIVOS_DESCARTE', 'PRAZOS_EXIBIDOS'
      ].sort()
    );
  });

  // Se os escapes virarem os próprios caracteres combinantes, a regex continua "funcionando" no
  // olho e some da leitura — e um editor pode normalizá-los sem ninguém ver.
  it('mantém os escapes de removeAccents como texto', () => {
    const fonte = readFileSync(caminho('./motor.js'), 'utf8');
    expect(fonte).toContain('.replace(/[\\u0300-\\u036f]/g, "")');
    expect(/[̀-ͯ]/.test(fonte)).toBe(false);
  });

  it('tira o acento na normalização, que é o que o mapeamento de colunas usa', () => {
    expect(motor.normalizeTipoLocal('Letra de Crédito do Desenvolvimento')).toBe('LCD');
    expect(motor.normalizeTipoLocal('CERTIFICADO DE DEPÓSITO BANCÁRIO')).toBe('CDB');
  });
});

describe('a planilha não sai do navegador', () => {
  it('nenhum arquivo do módulo faz chamada de rede', () => {
    const arquivos = readdirSync(caminho('./')).filter((n) => n.endsWith('.js') && !n.endsWith('.test.js'));
    expect(arquivos).toContain('index.js');
    for (const nome of arquivos) {
      const fonte = readFileSync(caminho(`./${nome}`), 'utf8');
      expect(fonte, nome).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.sendBeacon/);
    }
  });
});
