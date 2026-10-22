import { describe, expect, it } from 'vitest';
import { arquivoDoLote, nomeDoArquivoDoLote } from './arquivo.js';

/**
 * F9 (22/10/2026): o lote baixado é o mesmo texto do Copiar, em .tsv (decisão do usuário: "TSV,
 * igual ao copiado"), sem marca de ordem de bytes nem troca de quebra de linha.
 */
describe('o arquivo do lote', () => {
  it('o nome diz o lote, a conta (ou quantas contas) e o dia local', () => {
    const dia = new Date(2026, 9, 22, 21, 30); // às 21h30 de Brasília, ainda dia 22
    expect(nomeDoArquivoDoLote({ formato: 'lote', contas: ['1234567'], momento: dia })).toBe('lote-simples-1234567-2026-10-22.tsv');
    expect(nomeDoArquivoDoLote({ formato: 'twap', contas: ['7654321'], momento: dia })).toBe('lote-twap-7654321-2026-10-22.tsv');
    expect(nomeDoArquivoDoLote({ formato: 'lote', contas: ['1234567', '7654321'], momento: dia })).toBe('lote-simples-2-contas-2026-10-22.tsv');
  });

  it('o conteúdo é o texto do Copiar, byte a byte, em UTF-8', async () => {
    const texto = 'Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total\nSimples\t1234567\tPETR4\tC\tA mercado\t100\n';
    const arquivo = arquivoDoLote(texto);
    expect(arquivo.type).toBe('text/tab-separated-values;charset=utf-8');
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    expect(Array.from(bytes)).toEqual(Array.from(new TextEncoder().encode(texto)));
  });
});
