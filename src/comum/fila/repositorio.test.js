import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { ErroDaFila, criarRepositorioDaFila, criarRepositorioEmMemoria } from './repositorio.js';
import { mudarEstado, novoPedido } from './regras.js';

// O navegador tem o IDBKeyRange global; o Node dos testes, o do fake-indexeddb.
globalThis.IDBKeyRange ??= IDBKeyRange;

/** A mesma bateria para os dois adaptadores: o do IndexedDB (falso, um banco novo a cada teste) e o em memória. */
const adaptadores = [
  ['IndexedDB', () => criarRepositorioDaFila(new IDBFactory())],
  ['memória', () => criarRepositorioEmMemoria()]
];

const em = (dia, hora) => new Date(2026, 9, dia, hora).getTime();
const pedido = (dia, hora, conta = '1234567') =>
  novoPedido({ conta, grupo: 'bolsa', formato: 'email', assunto: 'Confirmação de ordem', ordens: [{ ativo: 'PETR4', operacao: 'C', quantidade: 100 }], texto: '', em: em(dia, hora) });

describe.each(adaptadores)('repositório da Fila: %s', (_nome, criar) => {
  it('grava e lista os cartões do dia, do mais antigo ao mais novo', async () => {
    const repo = criar();
    const [b, a, c] = [pedido(21, 11), pedido(21, 9), pedido(22, 10)];
    for (const p of [b, a, c]) await repo.salvar(p);
    expect((await repo.listarDoDia('2026-10-21')).map((p) => p.id)).toEqual([a.id, b.id]);
    expect(await repo.listarTodos()).toHaveLength(3);
  });

  it('salvar de novo substitui o cartão pelo id', async () => {
    const repo = criar();
    const p = pedido(21, 9);
    await repo.salvar(p);
    await repo.salvar(mudarEstado(p, 'aprovado', em(21, 10)));
    const [lido] = await repo.listarDoDia('2026-10-21');
    expect(lido.estado).toBe('aprovado');
  });

  it('apaga pelos ids', async () => {
    const repo = criar();
    const [a, b] = [pedido(21, 9), pedido(21, 10)];
    await repo.salvar(a);
    await repo.salvar(b);
    await repo.apagar([a.id]);
    expect((await repo.listarTodos()).map((p) => p.id)).toEqual([b.id]);
  });

  // Só a janela aberta (os últimos dias), pelo índice do dia: a Fila de hoje, o contador da aba e o
  // vigia do Outlook leem isto a cada 30 s, e não os 90 dias guardados.
  it('lista desde um dia, inclusive, do mais antigo ao mais novo', async () => {
    const repo = criar();
    const [velho, a, b] = [pedido(10, 9), pedido(15, 9), pedido(21, 9)];
    for (const p of [b, velho, a]) await repo.salvar(p);
    expect((await repo.listarDesde('2026-10-15')).map((p) => p.id)).toEqual([a.id, b.id]);
  });
});

describe('sem IndexedDB', () => {
  it('o erro diz o que houve, e nada volta calado para outro lugar', async () => {
    await expect(criarRepositorioDaFila(null).listarDoDia('2026-10-21')).rejects.toBeInstanceOf(ErroDaFila);
  });
});
