import { ErroDoRepositorio, fichaDoAnexo, porEdicao, validarAnexo, validarNota } from '../repositorio.js';

/**
 * As anotações no IndexedDB do navegador: o contrato de repositorio.js.
 *
 * Duas lojas no banco `mesa_anotacoes`: `notas` (a anotação, com a ficha dos anexos) e `anexos`
 * (o arquivo em si, como Blob — sem converter para base64, que ocupa um terço a mais e é lento de
 * ler; é o que as ferramentas de print no navegador fazem). O índice `notaId` acha os anexos de
 * uma anotação para apagá-los junto com ela.
 *
 * IndexedDB funciona do mesmo jeito no Netlify e aberto do disco (`file://`), mas cada um é um
 * endereço diferente para o navegador: as anotações de um não aparecem no outro. O backup
 * (backup.js) leva de um para o outro.
 *
 * Nada de voltar calado para outro lugar: sem IndexedDB (uma janela anônima que o bloqueia, um
 * navegador sem espaço), o erro aparece na tela.
 */

export const BANCO = 'mesa_anotacoes';
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

const traduzir = (erro, acao) => {
  if (erro instanceof ErroDoRepositorio) return erro;
  if (erro?.name === 'QuotaExceededError') {
    return new ErroDoRepositorio('O navegador ficou sem espaço para as anotações. Exporte um backup e apague anexos antigos.', { cause: erro });
  }
  return new ErroDoRepositorio(`Não foi possível ${acao}: ${erro?.message ?? erro}`, { cause: erro });
};

/** @param {IDBFactory} [idb] o IndexedDB; os testes passam um falso (fake-indexeddb). */
export const criarRepositorioIndexedDB = (idb = globalThis.indexedDB) => {
  let conexao = null;

  const abrir = () => {
    conexao ??= new Promise((ok, falha) => {
      if (!idb) {
        falha(new ErroDoRepositorio('Este navegador não deixa guardar anotações (IndexedDB indisponível — janela anônima?).'));
        return;
      }
      const req = idb.open(BANCO, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('notas')) db.createObjectStore('notas', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('anexos')) db.createObjectStore('anexos', { keyPath: 'id' }).createIndex('notaId', 'notaId');
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(traduzir(req.error, 'abrir as anotações'));
      req.onblocked = () => falha(new ErroDoRepositorio('As anotações estão abertas numa versão antiga da Mesa XP em outra aba. Feche-a e recarregue.'));
    }).catch((erro) => {
      conexao = null; // a próxima tentativa abre de novo
      throw erro;
    });
    return conexao;
  };

  const executar = async (acao, fn) => {
    try {
      return await fn(await abrir());
    } catch (erro) {
      throw traduzir(erro, acao);
    }
  };

  return {
    modo: 'indexeddb',

    listarNotas: () =>
      executar('ler as anotações', async (db) => {
        const notas = await pedido(db.transaction('notas').objectStore('notas').getAll());
        return notas.sort(porEdicao);
      }),

    salvarNota: (nota, { manterData = false } = {}) =>
      executar('salvar a anotação', async (db) => {
        validarNota(nota);
        const gravada = { ...nota, atualizadaEm: manterData ? nota.atualizadaEm : Date.now() };
        const tx = db.transaction('notas', 'readwrite');
        tx.objectStore('notas').put(gravada);
        await concluir(tx);
        return structuredClone(gravada);
      }),

    excluirNota: (id) =>
      executar('apagar a anotação', async (db) => {
        const tx = db.transaction(['notas', 'anexos'], 'readwrite');
        tx.objectStore('notas').delete(id);
        const chaves = tx.objectStore('anexos').index('notaId').getAllKeys(id);
        chaves.onsuccess = () => {
          for (const chave of chaves.result) tx.objectStore('anexos').delete(chave);
        };
        await concluir(tx);
      }),

    adicionarAnexo: (notaId, arquivo, ficha, { manterData = false } = {}) =>
      executar('guardar o anexo', async (db) => {
        validarAnexo(arquivo);
        const nova = fichaDoAnexo(arquivo, ficha);
        const tx = db.transaction(['notas', 'anexos'], 'readwrite');
        let semNota = false;
        const leitura = tx.objectStore('notas').get(notaId);
        // Tudo na mesma transação: ou a anotação ganha a ficha e o arquivo fica guardado, ou nada.
        leitura.onsuccess = () => {
          const nota = leitura.result;
          if (!nota) {
            semNota = true;
            tx.abort();
            return;
          }
          nota.anexos = [...nota.anexos.filter((a) => a.id !== nova.id), nova];
          if (!manterData) nota.atualizadaEm = Date.now();
          tx.objectStore('anexos').put({ id: nova.id, notaId, blob: arquivo });
          tx.objectStore('notas').put(nota);
        };
        try {
          await concluir(tx);
        } catch (erro) {
          if (semNota) throw new ErroDoRepositorio('A anotação não existe mais.');
          throw erro;
        }
        return nova;
      }),

    lerAnexo: (anexoId) =>
      executar('abrir o anexo', async (db) => {
        const registro = await pedido(db.transaction('anexos').objectStore('anexos').get(anexoId));
        return registro?.blob ?? null;
      }),

    removerAnexo: (notaId, anexoId) =>
      executar('remover o anexo', async (db) => {
        const tx = db.transaction(['notas', 'anexos'], 'readwrite');
        tx.objectStore('anexos').delete(anexoId);
        const leitura = tx.objectStore('notas').get(notaId);
        leitura.onsuccess = () => {
          const nota = leitura.result;
          if (!nota) return;
          nota.anexos = nota.anexos.filter((a) => a.id !== anexoId);
          nota.atualizadaEm = Date.now();
          tx.objectStore('notas').put(nota);
        };
        await concluir(tx);
      })
  };
};
