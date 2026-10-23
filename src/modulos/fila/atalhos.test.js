import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlLista, htmlPastas } from './render.js';
import { mudarEstado, novoPedido } from '../../comum/fila/regras.js';

const codigoIndex = readFileSync(new URL('./index.js', import.meta.url), 'utf8');

describe('os atalhos da Fila do Dia (Fase 1)', () => {
  it('o código possui proteção para disparar apenas quando a seção estiver visível e fora de inputs', () => {
    expect(codigoIndex).toContain('if (secao.hidden) return;');
    expect(codigoIndex).toContain("e.target.closest?.('input, textarea, select, [contenteditable=\"true\"]')");
    expect(codigoIndex).toContain('if (e.ctrlKey || e.metaKey || e.altKey) return;');
  });

  it('possui navegação vertical com J/K e setas', () => {
    expect(codigoIndex).toMatch(/tecla === 'j' \|\| e\.key === 'ArrowDown'/);
    expect(codigoIndex).toMatch(/tecla === 'k' \|\| e\.key === 'ArrowUp'/);
    expect(codigoIndex).toContain('moverSelecao(1)');
    expect(codigoIndex).toContain('moverSelecao(-1)');
  });

  it('possui ações rápidas no pedido selecionado (E para executar/aprovar, L para lote, F para ficha)', () => {
    expect(codigoIndex).toMatch(/tecla === 'e'[\s\S]*?acaoNoPedidoSelecionado\('executar'\)/);
    expect(codigoIndex).toMatch(/tecla === 'l'[\s\S]*?acaoNoPedidoSelecionado\('lote'\)/);
    expect(codigoIndex).toMatch(/tecla === 'f'[\s\S]*?acaoNoPedidoSelecionado\('ficha'\)/);
    expect(codigoIndex).toMatch(/tecla === 'b'[\s\S]*?acaoNoPedidoSelecionado\('boleta'\)/);
    expect(codigoIndex).toMatch(/tecla === 'm'[\s\S]*?acaoNoPedidoSelecionado\('email'\)/);
  });

  it('possui alternância de vista com T e troca de pastas com 1-4', () => {
    expect(codigoIndex).toMatch(/tecla === 't'[\s\S]*?alternarVista\(\)/);
    expect(codigoIndex).toMatch(/e\.key >= '1' && e\.key <= '4'[\s\S]*?mudarPastaPorIndice\(Number\(e\.key\) - 1\)/);
  });

  it('as pastas e os botões de ação indicam os atalhos de teclado em seus títulos', () => {
    const pedidos = [
      mudarEstado(
        novoPedido({
          conta: '1234567',
          grupo: 'bolsa',
          ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }],
          em: Date.now()
        }),
        'aprovado'
      )
    ];
    const pastasHtml = htmlPastas(pedidos, 'executar');
    expect(pastasHtml).toContain('tecla 1');

    const listaHtml = htmlLista(pedidos, 'executar');
    expect(listaHtml).toContain('tecla E');
    expect(listaHtml).toContain('tecla L');
  });
});
