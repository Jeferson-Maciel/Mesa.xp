import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroDeConflito, ErroDoRepositorio } from '../../dados/erros.js';
import { CHAVE_LOCAL, criarRepositorioLocal } from './adaptadores/local.js';
import { criarRepositorioSupabase } from './adaptadores/supabase.js';
import * as semente from './conteudo.js';
import { criarSupabaseFalso } from './testes/supabase-falso.js';

/**
 * O contrato do repositório do Operacional, rodado contra os dois adaptadores. Os dois começam com a
 * mesma semente (a cópia do Slab): o local a carrega sozinho; o banco a recebe do
 * supabase/operacional.sql, que o fake imita com `semear`.
 */

const armazenamentoFalso = (inicial = {}) => {
  const dados = new Map(Object.entries(inicial));
  return { getItem: (k) => (dados.has(k) ? dados.get(k) : null), setItem: (k, v) => dados.set(k, String(v)), dados };
};

const ADAPTADORES = [
  ['localStorage', () => criarRepositorioLocal(armazenamentoFalso())],
  [
    'Supabase',
    () => {
      const banco = criarSupabaseFalso();
      banco.semear(semente);
      return criarRepositorioSupabase(banco);
    }
  ]
];

describe.each(ADAPTADORES)('repositório do Operacional (%s)', (_, criar) => {
  let repo;
  let topicos;
  let posts;
  const topico = (slug) => topicos.find((t) => t.slug === slug);
  const post = (slug) => posts.find((p) => p.slug === slug);

  beforeEach(async () => {
    repo = criar();
    topicos = await repo.listarTopicos();
    posts = await repo.listarPosts();
  });

  it('começa com a cópia do Slab: a raiz, os cinco tópicos e os 34 posts', () => {
    expect(topicos.map((t) => t.nome)).toEqual(semente.TOPICOS.map((t) => t.nome));
    expect(topico('padroes-de-email').paiId).toBe(topico('mesa-de-operacoes-argentum').id);
    expect(topico('mesa-de-operacoes-argentum').paiId).toBeNull();
    expect(posts).toHaveLength(34);
    expect(post('confirmacao-de-ordem-venda')).toMatchObject({
      titulo: 'Confirmação de ordem Venda',
      topicoId: topico('padroes-de-email').id,
      versao: 1
    });
    expect(post('confirmacao-de-ordem-venda').conteudo).toBe(semente.POSTS[0].conteudo);
  });

  it('cria um tópico debaixo da raiz, com slug para o link', async () => {
    const novo = await repo.criarTopico({ nome: 'Câmbio', descricao: 'Rotinas de câmbio', paiId: topico('mesa-de-operacoes-argentum').id });
    expect(novo).toMatchObject({ nome: 'Câmbio', descricao: 'Rotinas de câmbio', paiId: topico('mesa-de-operacoes-argentum').id });
    expect(novo.slug).toMatch(/^cambio-[a-z0-9]{4}$/);
    expect((await repo.listarTopicos()).map((t) => t.nome)).toContain('Câmbio');
  });

  it('recusa tópico e post com nome de menos de duas letras', async () => {
    await expect(repo.criarTopico({ nome: ' x ', descricao: '', paiId: null })).rejects.toBeInstanceOf(ErroDoRepositorio);
    await expect(repo.criarPost({ topicoId: topico('disparos').id, titulo: '', conteudo: 'a', ordem: 9 })).rejects.toBeInstanceOf(ErroDoRepositorio);
  });

  it('cria post no tópico e ele aparece para todos na próxima leitura', async () => {
    const novo = await repo.criarPost({ topicoId: topico('disparos').id, titulo: 'Disparo FII', conteudo: 'texto do disparo', ordem: 3 });
    expect(novo).toMatchObject({ titulo: 'Disparo FII', conteudo: 'texto do disparo', topicoId: topico('disparos').id, versao: 1 });
    expect(novo.slug).toMatch(/^disparo-fii-[a-z0-9]{4}$/);
    expect((await repo.listarPosts()).some((p) => p.id === novo.id)).toBe(true);
  });

  it('atualiza o post e sobe a versão; o slug do link não muda', async () => {
    const venda = post('confirmacao-de-ordem-venda');
    const salvo = await repo.atualizarPost({ ...venda, titulo: 'Confirmação de ordem de Venda', conteudo: 'novo texto' });
    expect(salvo).toMatchObject({ titulo: 'Confirmação de ordem de Venda', conteudo: 'novo texto', versao: 2, slug: venda.slug });
    const relido = (await repo.listarPosts()).find((p) => p.id === venda.id);
    expect(relido).toMatchObject({ conteudo: 'novo texto', versao: 2 });
  });

  it('move o post de tópico', async () => {
    const venda = post('confirmacao-de-ordem-venda');
    await repo.atualizarPost({ ...venda, topicoId: topico('execucao-de-ordens').id });
    expect((await repo.listarPosts()).find((p) => p.id === venda.id).topicoId).toBe(topico('execucao-de-ordens').id);
  });

  // Duas pessoas abriram o mesmo post. A segunda a salvar não pode apagar o que a primeira gravou.
  it('recusa salvar por cima de quem salvou antes: conflito, nada sobrescrito', async () => {
    const aberto = post('confirmacao-de-ordem-compra');
    await repo.atualizarPost({ ...aberto, conteudo: 'versão da Ana' });
    await expect(repo.atualizarPost({ ...aberto, conteudo: 'versão do Bruno' })).rejects.toBeInstanceOf(ErroDeConflito);
    expect((await repo.listarPosts()).find((p) => p.id === aberto.id).conteudo).toBe('versão da Ana');
  });

  it('exclui escondendo: o post some da lista', async () => {
    const venda = post('confirmacao-de-ordem-venda');
    await repo.excluirPost(venda);
    const depois = await repo.listarPosts();
    expect(depois.some((p) => p.id === venda.id)).toBe(false);
    expect(depois).toHaveLength(33);
  });

  it('não exclui um post que outra pessoa acabou de editar', async () => {
    const venda = post('confirmacao-de-ordem-venda');
    await repo.atualizarPost({ ...venda, conteudo: 'editado por outra pessoa' });
    await expect(repo.excluirPost(venda)).rejects.toBeInstanceOf(ErroDeConflito);
    expect((await repo.listarPosts()).some((p) => p.id === venda.id)).toBe(true);
  });

  it('guarda título e texto com marcação literalmente: escapar é trabalho da tela', async () => {
    const xss = '<img src=x onerror=alert(1)>';
    const novo = await repo.criarPost({ topicoId: topico('disparos').id, titulo: xss, conteudo: `<script>${xss}</script>`, ordem: 3 });
    const relido = (await repo.listarPosts()).find((p) => p.id === novo.id);
    expect(relido.titulo).toBe(xss);
    expect(relido.conteudo).toBe(`<script>${xss}</script>`);
  });

  it('assinarMudancas devolve a função que cancela', () => {
    const cancelar = repo.assinarMudancas(() => {}, () => {});
    expect(typeof cancelar).toBe('function');
    cancelar();
  });
});

describe('repositório do Operacional no Supabase', () => {
  let banco;
  let repo;
  beforeEach(() => {
    banco = criarSupabaseFalso();
    banco.semear(semente);
    repo = criarRepositorioSupabase(banco);
  });

  it('nunca apaga de verdade: excluir é marcar excluido_em, e o banco guarda a linha', async () => {
    const [venda] = (await repo.listarPosts()).filter((p) => p.slug === 'confirmacao-de-ordem-venda');
    await repo.excluirPost(venda);
    expect(banco.chamadas.some((q) => q.op === 'delete')).toBe(false);
    const linha = banco.tabelas.operacional_posts.find((p) => p.id === venda.id);
    expect(linha.excluido_em).toBeTruthy();
    expect(linha.conteudo).toBe(venda.conteudo);
  });

  it('a atualização só vale para a versão que foi aberta', async () => {
    const [compra] = (await repo.listarPosts()).filter((p) => p.slug === 'confirmacao-de-ordem-compra');
    banco.chamadas.length = 0;
    await repo.atualizarPost({ ...compra, conteudo: 'x' });
    const update = banco.chamadas.find((q) => q.op === 'update');
    expect(update.filtros).toEqual(expect.arrayContaining([['eq', 'id', compra.id], ['eq', 'versao', 1], ['is', 'excluido_em', null]]));
    expect(update.valores).toMatchObject({ versao: 2, conteudo: 'x' });
  });

  it('erro de rede vira erro, e nada cai no modo local', async () => {
    banco.falharQuando(() => 'TypeError: Failed to fetch');
    await expect(repo.listarPosts()).rejects.toThrow(/Failed to fetch/);
    await expect(repo.criarTopico({ nome: 'Câmbio', descricao: '', paiId: null })).rejects.toThrow(/Failed to fetch/);
    expect(repo.modo).toBe('supabase');
  });

  it('escuta tópicos e posts, e cancela o canal', () => {
    const aoMudar = vi.fn();
    const aoStatus = vi.fn();
    const cancelar = repo.assinarMudancas(aoMudar, aoStatus);
    const tabelas = banco.canais[0].assinaturas.filter((a) => a.tipo === 'postgres_changes').map((a) => a.filtro.table);
    expect(tabelas.sort()).toEqual(['operacional_posts', 'operacional_topicos']);
    expect(aoStatus).toHaveBeenLastCalledWith('AO_VIVO');
    banco.emitir('operacional_posts');
    expect(aoMudar).toHaveBeenCalledTimes(1);
    cancelar();
    expect(banco.canais).toHaveLength(0);
  });
});

describe('repositório do Operacional no localStorage', () => {
  it(`grava na chave ${CHAVE_LOCAL} e continua de onde parou`, async () => {
    expect(CHAVE_LOCAL).toBe('mesa_operacional');
    const armazenamento = armazenamentoFalso();
    const repo = criarRepositorioLocal(armazenamento);
    const [venda] = (await repo.listarPosts()).filter((p) => p.slug === 'confirmacao-de-ordem-venda');
    await repo.atualizarPost({ ...venda, conteudo: 'editado' });
    const outro = criarRepositorioLocal(armazenamento);
    expect((await outro.listarPosts()).find((p) => p.id === venda.id).conteudo).toBe('editado');
  });

  it('armazenamento cheio ou bloqueado vira erro visível', async () => {
    const repo = criarRepositorioLocal({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
    await expect(repo.criarTopico({ nome: 'Câmbio', descricao: '', paiId: null })).rejects.toThrow(/navegador/);
  });

  it('dado corrompido no armazenamento volta para a semente', async () => {
    const repo = criarRepositorioLocal(armazenamentoFalso({ mesa_operacional: '{quebrado' }));
    expect(await repo.listarPosts()).toHaveLength(34);
  });
});
