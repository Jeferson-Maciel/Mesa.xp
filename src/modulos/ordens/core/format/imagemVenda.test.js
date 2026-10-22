import { describe, expect, it, vi } from 'vitest';
import { desenharComprovanteVenda, gerarComprovanteVendaPng, layoutDoComprovanteVenda } from './imagemVenda.js';

describe('imagemVenda — Comprovante de Cotação de Venda', () => {
  const ordemExemplo = {
    ativo: 'CYHF11',
    operacao: 'V',
    quantidade: 985,
    venda: {
      situacao: 'pronto',
      modalidade: 'xp',
      fundoId: 'cyhf11-id',
      quantidade: 985,
      valorDaCota: 9.907923,
      lidaEm: new Date('2026-10-22T10:28:00').getTime(),
      validaAte: new Date('2026-10-23T10:28:00'),
      condicoes: {
        desagio: 1.75,
        corretagem: 0,
        aberta: true
      },
      conta: {
        posicao: 9759.304155,
        desagio: 170.787822,
        comDesagio: 9588.516333,
        corretagem: 0,
        total: 9588.516333
      }
    }
  };

  it('monta o layout puro com todos os elementos da boleta do secundário', () => {
    const layout = layoutDoComprovanteVenda(ordemExemplo, { conta: '11062084' });
    expect(layout.largura).toBe(620);
    expect(layout.altura).toBeGreaterThan(250);

    const textos = layout.itens.filter((i) => i.tipo === 'texto').map((i) => i.texto);
    expect(textos).toContain('MERCADO SECUNDÁRIO XP');
    expect(textos).toContain('Estoque XP');
    expect(textos).toContain('Cotação de Venda · CYHF11');
    expect(textos).toContain('Quantidade de cotas');
    expect(textos).toContain('985');
    expect(textos).toContain('Preço unitário (PU)');
    expect(textos.some((t) => t.includes('9,907923'))).toBe(true);
    expect(textos).toContain('Deságio da operação');
    expect(textos.some((t) => t.includes('1,75%'))).toBe(true);
    expect(textos).toContain('VALOR LÍQUIDO A RECEBER');
    expect(textos.some((t) => t.includes('9.588,52'))).toBe(true);
  });

  it('adapta a etiqueta para Estoque clientes', () => {
    const ordemClientes = {
      ...ordemExemplo,
      venda: {
        ...ordemExemplo.venda,
        modalidade: 'clientes'
      }
    };
    const layout = layoutDoComprovanteVenda(ordemClientes);
    const textos = layout.itens.filter((i) => i.tipo === 'texto').map((i) => i.texto);
    expect(textos).toContain('Estoque clientes');
  });

  it('formata cotas fracionadas com 8 casas decimais', () => {
    const ordemFracionada = {
      ...ordemExemplo,
      venda: {
        ...ordemExemplo.venda,
        quantidade: 123.4567891
      }
    };
    const layout = layoutDoComprovanteVenda(ordemFracionada);
    const textos = layout.itens.filter((i) => i.tipo === 'texto').map((i) => i.texto);
    expect(textos).toContain('123,45678910');
  });

  it('pinta o layout em um canvas mockado', () => {
    const layout = layoutDoComprovanteVenda(ordemExemplo);
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillText: vi.fn()
    };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      width: 0,
      height: 0
    };

    desenharComprovanteVenda(mockCanvas, layout, { escala: 2 });
    expect(mockCanvas.width).toBe(layout.largura * 2);
    expect(mockCanvas.height).toBe(layout.altura * 2);
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
    expect(mockCtx.scale).toHaveBeenCalledWith(2, 2);
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('retorna null se a ordem não tiver venda pronta', () => {
    expect(gerarComprovanteVendaPng(null)).toBeNull();
    expect(gerarComprovanteVendaPng({ ativo: 'CYHF11' })).toBeNull();
    expect(gerarComprovanteVendaPng({ ativo: 'CYHF11', venda: { situacao: 'sem-boleta' } })).toBeNull();
  });
});
