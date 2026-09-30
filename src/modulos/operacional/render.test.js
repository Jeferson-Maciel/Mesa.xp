import { describe, expect, it } from 'vitest';
import { criarRepositorioLocal } from './adaptadores/local.js';
import { buscar, dataCurta, htmlBusca, htmlEditor, htmlEquipe, htmlLateral, htmlPost, htmlTopico, rotaDe, trecho } from './render.js';

const memoria = () => {
  const d = new Map();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => d.set(k, v) };
};
const repo = criarRepositorioLocal(memoria());
const topicos = await repo.listarTopicos();
const posts = await repo.listarPosts();
const t = (slug) => topicos.find((x) => x.slug === slug);
const p = (slug) => posts.find((x) => x.slug === slug);
const XSS = '<img src=x onerror=alert(1)>';

describe('rotas da aba', () => {
  it('lê o hash em início, tópico, post e desconhecido', () => {
    expect(rotaDe('#operacional')).toEqual({ tipo: 'inicio' });
    expect(rotaDe('#operacional/')).toEqual({ tipo: 'inicio' });
    expect(rotaDe('#operacional/topico/disparos')).toEqual({ tipo: 'topico', slug: 'disparos' });
    expect(rotaDe('#operacional/post/disparo-rf')).toEqual({ tipo: 'post', slug: 'disparo-rf' });
    expect(rotaDe('#operacional/xyz')).toEqual({ tipo: 'inicio' });
  });
});

describe('barra lateral', () => {
  const html = htmlLateral({ topicos, posts, ativo: t('disparos').id });

  it('mostra a equipe do Slab no topo', () => {
    expect(htmlEquipe("Gregori's Team")).toContain('Gregori&#39;s Team');
  });

  it('mostra a árvore: a raiz e os cinco tópicos, com a contagem de posts', () => {
    for (const nome of ['Mesa de Operações Argentum', 'Padrões de Email', 'Disparos', 'Passo a Passo', 'Padrões de Fixing', 'Execução de Ordens']) {
      expect(html).toContain(nome);
    }
    expect(html).toMatch(/Padrões de Email<\/span><span class="op-contagem">14</);
    expect(html).toContain('href="#operacional/topico/disparos"');
  });

  it('marca o tópico aberto', () => {
    expect(html).toMatch(/class="op-no ativo"[^>]*href="#operacional\/topico\/disparos"/);
  });

  it('escapa o nome de um tópico criado pela mesa', () => {
    const outro = htmlLateral({ topicos: [...topicos, { id: 'z', slug: 'z', nome: XSS, descricao: '', paiId: t('mesa-de-operacoes-argentum').id, ordem: 100 }], posts, ativo: null });
    expect(outro).not.toContain('<img');
  });
});

describe('página de tópico', () => {
  it('a raiz agrupa os posts por tópico, com a trilha, como o Slab', () => {
    const html = htmlTopico({ topico: t('mesa-de-operacoes-argentum'), topicos, posts });
    expect(html).toContain('Material de conhecimento e uso de colaboradores da mesa de operações');
    expect(html.match(/class="op-grupo"/g)).toHaveLength(5);
    expect(html).toMatch(/Mesa de Operações Argentum<\/span>\s*<span[^>]*>›<\/span>\s*<a[^>]*>Padrões de Email/);
    expect(html).toContain('href="#operacional/post/confirmacao-de-ordem-venda"');
  });

  it('um tópico lista os posts dele, com trecho do texto, e oferece criar post', () => {
    const html = htmlTopico({ topico: t('disparos'), topicos, posts });
    expect(html.match(/class="op-linha"/g)).toHaveLength(3);
    expect(html).toContain('Tabela de Cetipados');
    expect(html).toContain('*Tabela de Cetipados (12/09/2024):*');
    expect(html).toContain('data-acao="criar-post"');
    expect(html).toContain('href="#operacional"');
  });

  it('post sem texto aparece como pendente, sem trecho inventado', () => {
    const html = htmlTopico({ topico: t('padroes-de-fixing'), topicos, posts });
    expect(html.match(/texto pendente/g)).toHaveLength(12);
  });
});

describe('post aberto', () => {
  it('mostra trilha, título, ações e o texto como está, com as quebras de linha', () => {
    const html = htmlPost({ post: p('confirmacao-de-ordem-venda'), topicos });
    expect(html).toContain('<h1 class="op-titulo">Confirmação de ordem Venda</h1>');
    expect(html).toContain('href="#operacional/topico/padroes-de-email"');
    for (const acao of ['copiar', 'editar', 'excluir']) expect(html).toContain(`data-acao="${acao}"`);
    expect(html).toContain('PARA AÇÕES:');
    expect(html).toContain('class="op-texto"');
  });

  it('post sem texto convida a colar o texto do Slab, e não oferece copiar vazio', () => {
    const html = htmlPost({ post: p('rubi'), topicos });
    expect(html).toContain('ainda não foi copiado do Slab');
    expect(html).not.toContain('data-acao="copiar"');
  });

  it('escapa título e texto gravados por qualquer pessoa', () => {
    const html = htmlPost({ post: { ...p('rubi'), titulo: XSS, conteudo: `<script>${XSS}</script>` }, topicos });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
  });

  it('diz quando foi atualizado, se se sabe', () => {
    expect(htmlPost({ post: { ...p('rubi'), atualizadoEm: '2026-09-30T14:05:00Z' }, topicos })).toContain('Atualizado em 30/09/2026');
  });
});

describe('editor', () => {
  it('abre com o post, o tópico dele marcado e o texto intacto', () => {
    const post = p('confirmacao-de-ordem-compra');
    const html = htmlEditor({ post, topicos, topicoId: post.topicoId });
    expect(html).toContain('value="Confirmação de ordem Compra"');
    expect(html).toMatch(new RegExp(`<option value="${post.topicoId}" selected>`));
    expect(html).toContain('Aguardo confirmação para realizar a ordem.');
  });

  it('não deixa escolher a raiz: post mora num tópico', () => {
    const html = htmlEditor({ post: null, topicos, topicoId: t('disparos').id });
    expect(html).not.toContain(`value="${t('mesa-de-operacoes-argentum').id}"`);
  });

  it('escapa título e texto dentro dos campos', () => {
    const html = htmlEditor({ post: { ...p('rubi'), titulo: `"><img src=x onerror=1>`, conteudo: '</textarea><img src=x>' }, topicos, topicoId: p('rubi').topicoId });
    expect(html).not.toContain('<img');
  });
});

describe('busca', () => {
  it('acha por título e por texto, sem ligar para acento nem maiúscula', () => {
    const titulos = buscar(posts, 'tesouro').map((r) => r.post.titulo);
    expect(titulos).toEqual(['Confirmação aplicação Tesouro Direto', 'Confirmação resgate Tesouro Direto']);
    expect(buscar(posts, 'SUBSCRICAO').map((r) => r.post.titulo)).toEqual(['Subscrição – Exercício']);
    expect(buscar(posts, 'btcvarejo').map((r) => r.post.titulo)).toEqual(['Contratar/Cancelar Custódia remunerada']);
  });

  it('põe quem casa no título antes de quem casa só no texto', () => {
    const titulos = buscar(posts, 'cetipados').map((r) => r.post.titulo);
    expect(titulos.slice(0, 2).sort()).toEqual(['Cetipados', 'Tabela de Cetipados']);
  });

  it('mostra o trecho em volta do que foi achado, marcado e escapado', () => {
    const [r] = buscar(posts, 'btcvarejo');
    const html = htmlBusca({ termo: 'btcvarejo', resultados: [r], topicos });
    expect(html).toContain('<mark>btcvarejo</mark>');
    expect(htmlBusca({ termo: '<b>', resultados: buscar([{ ...r.post, conteudo: 'a <b> c' }], '<b>'), topicos })).toContain('<mark>&lt;b&gt;</mark>');
  });

  it('diz quando não acha nada', () => {
    expect(htmlBusca({ termo: 'zzz', resultados: [], topicos })).toContain('Nada encontrado');
  });
});

describe('miúdos', () => {
  it('trecho junta as linhas e corta com reticências', () => {
    expect(trecho('a\n\nb   c', 50)).toBe('a b c');
    expect(trecho('x'.repeat(200), 20)).toBe('x'.repeat(20) + '…');
  });

  it('data curta no padrão brasileiro, no fuso local', () => {
    expect(dataCurta('2026-09-30T23:30:00-03:00')).toBe('30/09/2026');
    expect(dataCurta(null)).toBe('');
  });
});
