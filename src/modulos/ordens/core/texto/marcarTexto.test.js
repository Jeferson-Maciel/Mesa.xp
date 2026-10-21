import { describe, expect, it } from 'vitest';
import { parseSolicitacoes } from '../parse/parseSolicitacoes.js';
import { contarMarcas, marcarTexto } from './marcarTexto.js';

// Contas fictícias.
const marcar = (texto) => marcarTexto(texto, parseSolicitacoes(texto).solicitacoes);

describe('o texto colado, linha a linha', () => {
  it('marca a lida, a ignorada (o ruído do grupo) e a em branco, com o carimbo do WhatsApp à vista', () => {
    const texto = ['[13:46, 21/09/2026] Paulo Mendes: 1234567', 'COMPRA', 'PETR4 100', '', 'enviado mesa', '@Paulo Mendes'].join('\n');
    const marcas = marcar(texto);
    expect(marcas.map((m) => m.situacao)).toEqual(['lida', 'lida', 'lida', 'vazia', 'ignorada', 'ignorada']);
    expect(marcas[0].carimbo).toBe(true);
    expect(marcas[4].motivo).toBe('confirmação da mesa');
    expect(marcas[5].motivo).toBe('menção a participante do grupo');
  });

  it('a descartada pelo parser vem com o motivo dele', () => {
    const marcas = marcar('1234567\nCOMPRA\nvender XPML11 100 e comprar BTLG11 100\nPETR4 100');
    const descartada = marcas.find((m) => m.situacao === 'descartada');
    expect(descartada.original).toBe('vender XPML11 100 e comprar BTLG11 100');
    expect(descartada.motivo).toContain('mais de um ativo na mesma linha');
  });

  it('conta cada situação, e uma linha marcada para cada linha colada', () => {
    const texto = '1234567\nCOMPRA\nPETR4 100\nenviado mesa';
    const marcas = marcar(texto);
    expect(marcas).toHaveLength(4);
    expect(contarMarcas(marcas)).toEqual({ lidas: 3, descartadas: 0, ignoradas: 1 });
  });
});
