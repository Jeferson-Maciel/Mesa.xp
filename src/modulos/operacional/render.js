/**
 * O HTML da base Operacional: funções puras, sem DOM, testadas em `render.test.js`.
 *
 * O desenho segue o Slab da mesa — barra lateral com a equipe e a árvore de tópicos; página de
 * tópico com os posts (a raiz os agrupa por tópico, com a trilha); post aberto com a trilha, o
 * título grande e o texto — no visual da Mesa XP: tokens, painel e botões de src/ui/.
 *
 * Qualquer pessoa com o link grava título e texto, então tudo passa por `esc`. O texto do post é
 * mostrado como está, sem interpretar nada: os asteriscos do WhatsApp aparecem como asteriscos,
 * porque é assim que o texto vai ser copiado e colado.
 */

import { esc } from '../../ui/html.js';

/* ── Rotas ────────────────────────────────────────────────────────────────────────────── */

/** `#operacional` → início · `#operacional/topico/<slug>` · `#operacional/post/<slug>`. */
export const rotaDe = (hash) => {
  const [, tipo, slug] = String(hash ?? '').replace(/^#\/?/, '').split('/');
  if ((tipo === 'topico' || tipo === 'post') && slug) return { tipo, slug: decodeURIComponent(slug) };
  return { tipo: 'inicio' };
};

// A raiz é o início da aba, como no Slab: o link dela é o da aba.
export const linkDoTopico = (topico) => (topico.paiId === null ? '#operacional' : `#operacional/topico/${encodeURIComponent(topico.slug)}`);
export const linkDoPost = (post) => `#operacional/post/${encodeURIComponent(post.slug)}`;

/* ── Miúdos ───────────────────────────────────────────────────────────────────────────── */

/** O texto numa linha só, cortado em `limite` caracteres. */
export const trecho = (texto, limite = 150) => {
  const linha = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return linha.length > limite ? linha.slice(0, limite).trimEnd() + '…' : linha;
};

export const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

const dataEHora = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const ICONE_POST =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

/** A árvore: os tópicos sem pai são raízes; os demais, filhos do seu pai. */
const arvore = (topicos) => {
  const filhos = new Map();
  for (const t of topicos) {
    const chave = t.paiId ?? null;
    if (!filhos.has(chave)) filhos.set(chave, []);
    filhos.get(chave).push(t);
  }
  return { raizes: filhos.get(null) ?? [], filhosDe: (t) => filhos.get(t.id) ?? [] };
};

const descendentes = (topico, filhosDe) => [topico, ...filhosDe(topico).flatMap((f) => descendentes(f, filhosDe))];

const postsDe = (topico, posts) => posts.filter((p) => p.topicoId === topico.id);

/** A trilha do tópico até a raiz: [raiz, …, pai]. */
const ancestrais = (topico, topicos) => {
  const trilha = [];
  for (let atual = topicos.find((t) => t.id === topico.paiId); atual; atual = topicos.find((t) => t.id === atual.paiId)) {
    trilha.unshift(atual);
  }
  return trilha;
};

const htmlTrilha = (itens) =>
  `<nav class="op-trilha" aria-label="Trilha">${itens
    .map((t) => `<a href="${linkDoTopico(t)}">${esc(t.nome)}</a>`)
    .join('<span aria-hidden="true">›</span>')}</nav>`;

/* ── Barra lateral ────────────────────────────────────────────────────────────────────── */

export const htmlEquipe = (equipe) => `
  <span class="op-avatar" aria-hidden="true">${esc(String(equipe).trim().charAt(0).toUpperCase())}</span>
  <div><strong>${esc(equipe)}</strong><span>base de conhecimento da mesa</span></div>`;

/**
 * @param {{ topicos: object[], posts: object[], ativo: string | null }} dados
 *   `ativo`: o id do tópico aberto (a raiz, no início da aba).
 */
export const htmlLateral = ({ topicos, posts, ativo }) => {
  const { raizes, filhosDe } = arvore(topicos);
  const no = (t) => {
    const total = descendentes(t, filhosDe).reduce((soma, d) => soma + postsDe(d, posts).length, 0);
    const filhos = filhosDe(t);
    return `
      <li>
        <a class="op-no${ativo === t.id ? ' ativo' : ''}" href="${linkDoTopico(t)}"${ativo === t.id ? ' aria-current="page"' : ''}>
          <span class="op-nome">${esc(t.nome)}</span><span class="op-contagem">${total}</span>
        </a>
        ${filhos.length ? `<ul>${filhos.map(no).join('')}</ul>` : ''}
      </li>`;
  };
  return `
    <p class="op-secao">Tópicos</p>
    <ul class="op-arvore">${raizes.map(no).join('')}</ul>`;
};

/* ── Listas de posts ──────────────────────────────────────────────────────────────────── */

const htmlLinha = (post, extra = '') => {
  const pendente = !post.conteudo.trim();
  return `
    <a class="op-linha" href="${linkDoPost(post)}">
      <span class="op-linha-icone">${ICONE_POST}</span>
      <span class="op-linha-texto">
        <strong>${esc(post.titulo)}</strong>
        ${extra || (pendente ? '' : `<span class="op-trecho">${esc(trecho(post.conteudo))}</span>`)}
      </span>
      <span class="op-linha-meta">${pendente ? '<span class="badge op-pendente">texto pendente</span>' : esc(dataCurta(post.atualizadoEm))}</span>
    </a>`;
};

const htmlLista = (posts) =>
  posts.length
    ? `<div class="op-lista">${posts.map((p) => htmlLinha(p)).join('')}</div>`
    : '<div class="empty-state pequeno"><p>Nenhum post neste tópico ainda.</p></div>';

/* ── Página de tópico ─────────────────────────────────────────────────────────────────── */

/** A raiz agrupa os posts por tópico, com a trilha no cabeçalho de cada grupo, como o Slab. */
export const htmlTopico = ({ topico, topicos, posts }) => {
  const { filhosDe } = arvore(topicos);
  const trilha = ancestrais(topico, topicos);
  const diretos = postsDe(topico, posts);
  const filhos = filhosDe(topico);
  const total = descendentes(topico, filhosDe).reduce((soma, d) => soma + postsDe(d, posts).length, 0);

  const grupos = filhos
    .map(
      (filho) => `
      <section class="op-grupo">
        <h3 class="op-grupo-titulo">
          <span>${esc(topico.nome)}</span>
          <span aria-hidden="true">›</span>
          <a href="${linkDoTopico(filho)}">${esc(filho.nome)}</a>
        </h3>
        ${htmlLista(postsDe(filho, posts))}
      </section>`
    )
    .join('');

  return `
    <header class="op-cabeca">
      ${trilha.length ? htmlTrilha(trilha) : ''}
      <div class="op-cabeca-linha">
        <h1 class="op-titulo">${esc(topico.nome)}</h1>
        <button type="button" class="copy-btn op-primario" data-acao="criar-post">Criar post</button>
      </div>
      ${topico.descricao ? `<p class="op-descricao">${esc(topico.descricao)}</p>` : ''}
    </header>
    <div class="op-abas-posts"><strong>Posts</strong><span class="meta-counter">${total}</span></div>
    ${diretos.length || !filhos.length ? htmlLista(diretos) : ''}
    ${grupos}`;
};

/* ── Post ─────────────────────────────────────────────────────────────────────────────── */

export const htmlPost = ({ post, topicos }) => {
  const topico = topicos.find((t) => t.id === post.topicoId);
  const trilha = topico ? [...ancestrais(topico, topicos), topico] : [];
  const pendente = !post.conteudo.trim();

  return `
    <article class="op-post">
      ${htmlTrilha(trilha)}
      <div class="op-cabeca-linha">
        <h1 class="op-titulo">${esc(post.titulo)}</h1>
        <div class="op-acoes">
          ${pendente ? '' : '<button type="button" class="copy-btn op-primario" data-acao="copiar">Copiar texto</button>'}
          <button type="button" class="copy-btn" data-acao="editar">Editar</button>
          <button type="button" class="copy-btn op-perigo" data-acao="excluir">Excluir</button>
        </div>
      </div>
      <p class="op-meta">${post.atualizadoEm ? `Atualizado em ${esc(dataEHora(post.atualizadoEm))}` : 'Cópia do Slab'}</p>
      ${
        pendente
          ? `<div class="empty-state op-vazio">
               <p>O texto deste post ainda não foi copiado do Slab.</p>
               <span>Clique em Editar e cole o texto — ele passa a valer para toda a mesa.</span>
             </div>`
          : `<div class="op-texto">${esc(post.conteudo)}</div>`
      }
    </article>`;
};

/* ── Editor ───────────────────────────────────────────────────────────────────────────── */

/**
 * @param {{ post: object | null, topicos: object[], topicoId: string }} dados
 *   `post` null é post novo.
 */
export const htmlEditor = ({ post, topicos, topicoId }) => {
  // Post mora num tópico, não na raiz: a raiz só agrupa.
  const opcoes = topicos
    .filter((t) => t.paiId !== null)
    .map((t) => `<option value="${esc(t.id)}"${t.id === topicoId ? ' selected' : ''}>${esc(t.nome)}</option>`)
    .join('');

  return `
    <form class="op-editor" data-op="editor" novalidate>
      <div class="op-cabeca-linha">
        <span class="meta-counter">${post ? 'Editando o post' : 'Post novo'}</span>
        <div class="op-acoes">
          <button type="button" class="copy-btn" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="copy-btn op-primario">Salvar</button>
        </div>
      </div>
      <div data-op="aviso-editor"></div>
      <input class="op-campo-titulo" name="titulo" value="${esc(post?.titulo ?? '')}" placeholder="Título do post" maxlength="160" aria-label="Título" autocomplete="off" />
      <label class="op-campo">
        <span>Tópico</span>
        <select name="topico">${opcoes}</select>
      </label>
      <label class="op-campo">
        <span>Texto</span>
        <textarea name="conteudo" rows="18" spellcheck="true" placeholder="Cole ou escreva o texto do post">${esc(post?.conteudo ?? '')}</textarea>
      </label>
      <p class="op-dica">Ctrl + Enter salva, Esc cancela. O texto vai exatamente como está — quebras de linha e asteriscos do WhatsApp incluídos.</p>
    </form>`;
};

/* ── Busca ────────────────────────────────────────────────────────────────────────────── */

// Minúsculo e sem acento, caractere por caractere: o texto dobrado tem o mesmo tamanho do original,
// e a posição achada num vale no outro.
const dobrar = (texto) => {
  let saida = '';
  for (const ch of String(texto)) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    saida += base.length === ch.length ? base : ch;
  }
  return saida;
};

/**
 * @returns {{ post: object, noTitulo: boolean, antes: string, achado: string, depois: string }[]}
 *   quem casa no título vem antes de quem casa só no texto.
 */
export const buscar = (posts, termo) => {
  const alvo = dobrar(String(termo ?? '').trim());
  if (!alvo) return [];
  const resultados = [];
  for (const post of posts) {
    const noTitulo = dobrar(post.titulo).includes(alvo);
    const posicao = dobrar(post.conteudo).indexOf(alvo);
    if (!noTitulo && posicao < 0) continue;
    const texto = post.conteudo;
    const inicio = Math.max(0, posicao - 70);
    const fim = posicao < 0 ? 0 : posicao + alvo.length;
    resultados.push({
      post,
      noTitulo,
      antes: posicao < 0 ? '' : (inicio > 0 ? '…' : '') + texto.slice(inicio, posicao).replace(/\s+/g, ' ').trimStart(),
      achado: posicao < 0 ? '' : texto.slice(posicao, fim),
      depois: posicao < 0 ? '' : trecho(texto.slice(fim), 90)
    });
  }
  return [...resultados.filter((r) => r.noTitulo), ...resultados.filter((r) => !r.noTitulo)];
};

export const htmlBusca = ({ termo, resultados, topicos }) => {
  if (!resultados.length) {
    return `<div class="empty-state"><p>Nada encontrado para “${esc(termo)}”.</p><span>A busca olha o título e o texto de todos os posts, sem ligar para acento.</span></div>`;
  }
  const nomeDo = (id) => topicos.find((t) => t.id === id)?.nome ?? '';
  return `
    <div class="op-abas-posts"><strong>Busca</strong><span class="meta-counter">${resultados.length} ${resultados.length === 1 ? 'post' : 'posts'} para “${esc(termo)}”</span></div>
    <div class="op-lista">${resultados
      .map((r) =>
        htmlLinha(
          r.post,
          `<span class="op-trecho"><span class="op-rotulo">${esc(nomeDo(r.post.topicoId))}</span>${
            r.achado ? ` ${esc(r.antes)}<mark>${esc(r.achado)}</mark>${esc(r.depois)}` : ''
          }</span>`
        )
      )
      .join('')}</div>`;
};
