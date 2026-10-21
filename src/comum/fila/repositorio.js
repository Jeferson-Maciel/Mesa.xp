/**
 * Os cartões da Fila do dia, guardados no navegador.
 *
 * No IndexedDB (banco `mesa_fila`, loja `pedidos`, índice `dia`), como as Anotações, e pelo mesmo
 * motivo: o cartão tem o nome, o e-mail e a conta do cliente, e o banco da mesa ainda é aberto a quem
 * tiver o link (a fase 2 de segurança). Ficam 90 dias (`regras.js`), e o resto sai ao abrir.
 *
 * Dois adaptadores com o mesmo contrato — o do IndexedDB e o em memória, dos testes —, testados pela
 * mesma bateria em `repositorio.test.js`. Sem IndexedDB (uma janela anônima que o bloqueia), o erro
 * aparece na tela: nada volta calado para outro lugar.
 *
 * Contrato:
 *  - `listarDoDia(dia)` → os cartões do dia (`AAAA-MM-DD`), do mais antigo ao mais novo;
 *  - `listarTodos()` → todos, para as contas conhecidas e a limpeza;
 *  - `salvar(pedido)` → grava (cria ou substitui pelo id);
 *  - `apagar(ids)` → apaga os ids.
 */

export class ErroDaFila extends Error {}

export const BANCO = 'mesa_fila';
const VERSAO = 1;

const pedido = (req) =>
  new Promise((ok, falha) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });

const concluir = (tx) =>
  new Promise((ok, falha) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => falha(tx.error);
    tx.onabort = () => falha(tx.error ?? new Error('operação cancelada'));
  });

const porCriacao = (a, b) => a.criadoEm - b.criadoEm;

/** @param {IDBFactory} [idb] o IndexedDB; os testes passam um falso (fake-indexeddb). */
export const criarRepositorioDaFila = (idb = globalThis.indexedDB) => {
  let conexao = null;

  const abrir = () => {
    conexao ??= new Promise((ok, falha) => {
      if (!idb) {
        falha(new ErroDaFila('Este navegador não deixa guardar a Fila do dia (IndexedDB indisponível — janela anônima?).'));
        return;
      }
      const req = idb.open(BANCO, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pedidos')) db.createObjectStore('pedidos', { keyPath: 'id' }).createIndex('dia', 'dia');
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(new ErroDaFila(`Não foi possível abrir a Fila do dia: ${req.error?.message ?? req.error}`));
      req.onblocked = () => falha(new ErroDaFila('A Fila está aberta numa versão antiga da Mesa XP em outra aba. Feche-a e recarregue.'));
    }).catch((erro) => {
      conexao = null;
      throw erro;
    });
    return conexao;
  };

  const executar = async (acao, fn) => {
    try {
      return await fn(await abrir());
    } catch (erro) {
      if (erro instanceof ErroDaFila) throw erro;
      if (erro?.name === 'QuotaExceededError') throw new ErroDaFila('O navegador ficou sem espaço para a Fila do dia.', { cause: erro });
      throw new ErroDaFila(`Não foi possível ${acao}: ${erro?.message ?? erro}`, { cause: erro });
    }
  };

  return {
    modo: 'indexeddb',

    listarDoDia: (dia) =>
      executar('ler a Fila', async (db) => {
        const lista = await pedido(db.transaction('pedidos').objectStore('pedidos').index('dia').getAll(dia));
        return lista.sort(porCriacao);
      }),

    listarTodos: () =>
      executar('ler a Fila', async (db) => (await pedido(db.transaction('pedidos').objectStore('pedidos').getAll())).sort(porCriacao)),

    salvar: (registro) =>
      executar('gravar na Fila', async (db) => {
        const tx = db.transaction('pedidos', 'readwrite');
        tx.objectStore('pedidos').put(registro);
        await concluir(tx);
        return registro;
      }),

    apagar: (ids) =>
      executar('apagar da Fila', async (db) => {
        const tx = db.transaction('pedidos', 'readwrite');
        for (const id of ids) tx.objectStore('pedidos').delete(id);
        await concluir(tx);
      })
  };
};

/** O mesmo contrato, em memória: para os testes. */
export const criarRepositorioEmMemoria = () => {
  const pedidos = new Map();
  const copia = (p) => structuredClone(p);
  return {
    modo: 'memoria',
    listarDoDia: async (dia) => [...pedidos.values()].filter((p) => p.dia === dia).sort(porCriacao).map(copia),
    listarTodos: async () => [...pedidos.values()].sort(porCriacao).map(copia),
    salvar: async (registro) => {
      pedidos.set(registro.id, copia(registro));
      return registro;
    },
    apagar: async (ids) => {
      for (const id of ids) pedidos.delete(id);
    }
  };
};

let daPagina = null;
/** Um repositório só para a página: o Ordens grava, a aba Fila lê, pela mesma conexão. */
export const filaDaPagina = () => (daPagina ??= criarRepositorioDaFila());
