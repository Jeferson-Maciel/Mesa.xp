import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroDoRepositorio } from '../../dados/erros.js';
import { criarRepositorioIndexedDB } from './adaptadores/indexeddb.js';
import { criarRepositorioEmMemoria } from './adaptadores/memoria.js';
import { exportarBackup, importarBackup } from './backup.js';
import { novaNota } from './notas.js';

/**
 * O contrato do repositório das Anotações, rodado contra os dois adaptadores: o de IndexedDB (com
 * um IndexedDB falso, o fake-indexeddb, um banco novo a cada teste) e o em memória.
 */

const ADAPTADORES = [
  ['IndexedDB', () => criarRepositorioIndexedDB(new IDBFactory())],
  ['memória', () => criarRepositorioEmMemoria()]
];

const print = (conteudo = 'png de mentira') => new Blob([conteudo], { type: 'image/png' });

describe.each(ADAPTADORES)('repositório das Anotações (%s)', (_, criar) => {
  let repo;
  beforeEach(() => {
    repo = criar();
  });

  it('começa vazio', async () => {
    expect(await repo.listarNotas()).toEqual([]);
  });

  it('salva, lê de volta e carimba a hora da edição', async () => {
    const antes = Date.now();
    const salva = await repo.salvarNota({ ...novaNota('a', 1000), titulo: 'Estorno dia 25', etiquetas: ['estorno'], lembrete: { data: '2026-10-02', hora: null } });
    expect(salva.atualizadaEm).toBeGreaterThanOrEqual(antes);
    const [lida] = await repo.listarNotas();
    expect(lida).toMatchObject({ id: 'a', titulo: 'Estorno dia 25', etiquetas: ['estorno'], lembrete: { data: '2026-10-02', hora: null }, criadaEm: 1000 });
  });

  it('salvar de novo substitui, sem duplicar; a mais recente vem primeiro', async () => {
    await repo.salvarNota({ ...novaNota('a'), titulo: 'primeira' });
    await repo.salvarNota({ ...novaNota('b'), titulo: 'segunda' });
    await new Promise((r) => setTimeout(r, 5));
    await repo.salvarNota({ ...novaNota('a'), titulo: 'primeira editada' });
    expect((await repo.listarNotas()).map((n) => n.titulo)).toEqual(['primeira editada', 'segunda']);
  });

  it('guarda o que tem marcação literalmente: escapar é trabalho da tela', async () => {
    const xss = '<img src=x onerror=alert(1)>';
    await repo.salvarNota({ ...novaNota('a'), titulo: xss, texto: `<script>${xss}</script>`, etiquetas: [xss] });
    const [lida] = await repo.listarNotas();
    expect([lida.titulo, lida.texto, lida.etiquetas[0]]).toEqual([xss, `<script>${xss}</script>`, xss]);
  });

  it('recusa lembrete com data inválida e título grande demais', async () => {
    await expect(repo.salvarNota({ ...novaNota('a'), lembrete: { data: '30/09/2026', hora: null } })).rejects.toBeInstanceOf(ErroDoRepositorio);
    await expect(repo.salvarNota({ ...novaNota('a'), lembrete: { data: '2026-09-30', hora: '9h' } })).rejects.toBeInstanceOf(ErroDoRepositorio);
    await expect(repo.salvarNota({ ...novaNota('a'), titulo: 'x'.repeat(201) })).rejects.toBeInstanceOf(ErroDoRepositorio);
    expect(await repo.listarNotas()).toEqual([]);
  });

  it('anexa o print: a anotação ganha a ficha e o arquivo volta igual', async () => {
    await repo.salvarNota({ ...novaNota('a'), titulo: 'com print' });
    const ficha = await repo.adicionarAnexo('a', print('abc'), { nome: 'print.png' });
    expect(ficha).toMatchObject({ nome: 'print.png', tipo: 'image/png', tamanho: 3 });
    const [nota] = await repo.listarNotas();
    expect(nota.anexos).toEqual([ficha]);
    const blob = await repo.lerAnexo(ficha.id);
    expect([blob.type, await blob.text()]).toEqual(['image/png', 'abc']);
  });

  it('recusa anexo numa anotação que não existe e arquivo acima de 15 MB', async () => {
    await expect(repo.adicionarAnexo('nao-existe', print(), { nome: 'x.png' })).rejects.toThrow(/não existe/);
    await repo.salvarNota(novaNota('a'));
    const grande = new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], { type: 'image/png' });
    await expect(repo.adicionarAnexo('a', grande, { nome: 'grande.png' })).rejects.toThrow(/limite é 15 MB/);
    expect((await repo.listarNotas())[0].anexos).toEqual([]);
  });

  it('remove um anexo: some a ficha e o arquivo', async () => {
    await repo.salvarNota(novaNota('a'));
    const um = await repo.adicionarAnexo('a', print('1'), { nome: '1.png' });
    const dois = await repo.adicionarAnexo('a', print('2'), { nome: '2.png' });
    await repo.removerAnexo('a', um.id);
    expect((await repo.listarNotas())[0].anexos.map((a) => a.id)).toEqual([dois.id]);
    expect(await repo.lerAnexo(um.id)).toBeNull();
  });

  it('apagar a anotação leva os anexos dela, e só os dela', async () => {
    await repo.salvarNota(novaNota('a'));
    await repo.salvarNota(novaNota('b'));
    const deA = await repo.adicionarAnexo('a', print('a'), { nome: 'a.png' });
    const deB = await repo.adicionarAnexo('b', print('b'), { nome: 'b.png' });
    await repo.excluirNota('a');
    expect((await repo.listarNotas()).map((n) => n.id)).toEqual(['b']);
    expect(await repo.lerAnexo(deA.id)).toBeNull();
    expect(await repo.lerAnexo(deB.id)).not.toBeNull();
  });

  it('backup: exporta e importa noutro navegador com os prints; importar de novo não duplica', async () => {
    await repo.salvarNota({ ...novaNota('a', 1000), titulo: 'Estorno', lembrete: { data: '2026-10-02', hora: '09:00' } });
    await repo.adicionarAnexo('a', print('conteúdo do print'), { nome: 'print.png' });
    await repo.salvarNota({ ...novaNota('b', 2000), titulo: 'Sem anexo' });
    const arquivo = JSON.parse(JSON.stringify(await exportarBackup(repo)));

    const outro = criar();
    expect(await importarBackup(outro, arquivo)).toEqual({ importadas: 2, ignoradas: 0, anexos: 1 });
    const [a] = (await outro.listarNotas()).filter((n) => n.id === 'a');
    expect(a).toMatchObject({ titulo: 'Estorno', lembrete: { data: '2026-10-02', hora: '09:00' } });
    expect(await (await outro.lerAnexo(a.anexos[0].id)).text()).toBe('conteúdo do print');
    expect(a.atualizadaEm).toBe(arquivo.notas.find((n) => n.id === 'a').atualizadaEm);

    expect(await importarBackup(outro, arquivo)).toEqual({ importadas: 0, ignoradas: 2, anexos: 0 });
    expect(await outro.listarNotas()).toHaveLength(2);
  });

  it('backup: a anotação mais nova deste navegador não é trocada pela velha do arquivo', async () => {
    await repo.salvarNota({ ...novaNota('a'), titulo: 'versão do arquivo' });
    const arquivo = await exportarBackup(repo);
    await new Promise((r) => setTimeout(r, 5));
    await repo.salvarNota({ ...novaNota('a'), titulo: 'editada depois' });
    await importarBackup(repo, arquivo);
    expect((await repo.listarNotas())[0].titulo).toBe('editada depois');
  });

  it('backup: recusa arquivo que não é backup de anotações', async () => {
    await expect(importarBackup(repo, { notas: [] })).rejects.toThrow(/não é um backup/);
    await expect(importarBackup(repo, null)).rejects.toBeInstanceOf(ErroDoRepositorio);
  });
});

describe('repositório das Anotações no IndexedDB', () => {
  it('sem IndexedDB, o erro aparece — nada cai calado em outro lugar', async () => {
    const repo = criarRepositorioIndexedDB(null);
    await expect(repo.listarNotas()).rejects.toThrow(/IndexedDB indisponível/);
  });

  it('continua de onde parou ao reabrir o banco', async () => {
    const idb = new IDBFactory();
    await criarRepositorioIndexedDB(idb).salvarNota({ ...novaNota('a'), titulo: 'persistente' });
    expect((await criarRepositorioIndexedDB(idb).listarNotas())[0].titulo).toBe('persistente');
  });
});
