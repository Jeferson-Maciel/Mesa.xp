import { conexaoDoBanco } from '../../dados/banco.js';
import { aviso } from '../../ui/avisos.js';
import { esc } from '../../ui/html.js';
import { criarRepositorioLocal } from './adaptadores/local.js';
import { criarRepositorioSupabase } from './adaptadores/supabase.js';
import { EQUIPE } from './conteudo.js';
import { ErroDeConflito, ehErroDeRede } from './repositorio.js';
import {
  buscar,
  htmlBusca,
  htmlEditor,
  htmlEquipe,
  htmlLateral,
  htmlPost,
  htmlTopico,
  linkDoPost,
  linkDoTopico,
  rotaDe
} from './render.js';
import './operacional.css';

/**
 * A base de conhecimento da mesa — o Slab dentro da Mesa XP.
 *
 * Tópicos na barra lateral, posts no meio, cada post com link próprio
 * (`#operacional/post/<slug>`) para mandar a um colega. Todo mundo vê e edita a mesma base, no
 * banco da mesa, e o que um salva aparece na tela dos outros pelo Realtime.
 *
 * Só inicia quando a aba abre, e exige rede, como o Calendário: erro de conexão aparece na tela e
 * nada cai calado no modo local. Sem banco configurado (as duas variáveis vazias), roda no modo
 * local, só neste navegador.
 *
 * A edição é protegida em duas pontas: o editor não é redesenhado por uma atualização ao vivo (o
 * texto digitado não some), e salvar por cima de uma versão mais nova é recusado pelo repositório
 * (ErroDeConflito) com o texto ainda na tela.
 *
 * @param {HTMLElement} secao a seção `#modulo-operacional`
 */
export const iniciarOperacional = (secao) => {
  secao.innerHTML = MARCACAO;
  const el = (nome) => secao.querySelector(`[data-op="${nome}"]`);
  el('equipe').innerHTML = htmlEquipe(EQUIPE);

  const { config, cliente } = conexaoDoBanco();
  if (config.modo === 'invalido') {
    el('erro').innerHTML = `<div class="alert alert-danger">Base sem banco configurado: ${esc(config.erro)}</div>`;
    for (const controle of secao.querySelectorAll('button, input')) controle.disabled = true;
    return;
  }
  const repo = config.modo === 'local' ? criarRepositorioLocal() : criarRepositorioSupabase(cliente);

  const estado = {
    topicos: [],
    posts: [],
    carregou: false,
    falhou: false, // a última carga deu erro
    tempoReal: null, // null enquanto conecta, 'AO_VIVO' ou 'ERRO'
    sequencia: 0,
    termo: '',
    // Editor aberto: { post: Post | null, topicoId, original: { titulo, topicoId, conteudo } }
    editor: null
  };

  const principal = el('principal');
  const raiz = () => estado.topicos.find((t) => t.paiId === null) ?? null;
  const topicoDoSlug = (slug) => estado.topicos.find((t) => t.slug === slug) ?? null;
  const postDoSlug = (slug) => estado.posts.find((p) => p.slug === slug) ?? null;
  const naAba = () => location.hash === '#operacional' || location.hash.startsWith('#operacional/');

  /* ── Conexão e erros ──────────────────────────────────────────────────────────────── */

  const mostrarConexao = (texto, classe = '') => {
    el('conexao').textContent = texto;
    el('conexao').className = `meta-counter op-conexao ${classe}`;
  };

  // O status vem da carga e do Realtime juntos, e não do último evento que chegou: o Realtime
  // costuma ficar pronto antes da primeira carga terminar, e "ao vivo" só vale com a base lida.
  const atualizarConexao = () => {
    if (repo.modo === 'local') mostrarConexao('modo local: dados só neste navegador', 'op-aviso');
    else if (!estado.carregou) mostrarConexao(estado.falhou ? 'sem conexão' : 'carregando…', estado.falhou ? 'op-aviso' : '');
    else if (estado.tempoReal === 'ERRO') mostrarConexao('sem atualização ao vivo', 'op-aviso');
    else if (estado.tempoReal === 'AO_VIVO') mostrarConexao('ao vivo', 'op-vivo');
    else mostrarConexao('conectado');
  };

  const mensagemDeErro = (erro) =>
    ehErroDeRede(erro) ? `Sem conexão com a base da mesa. ${erro.message}` : erro?.message || 'Erro desconhecido na base da mesa.';

  const mostrarErro = (erro) => {
    el('erro').innerHTML = `
      <div class="alert alert-danger" role="alert">
        <span>${esc(mensagemDeErro(erro))} O que está na tela pode estar desatualizado.</span>
        <button type="button" class="copy-btn" data-op="tentar">Tentar de novo</button>
      </div>`;
  };

  /* ── Carga ────────────────────────────────────────────────────────────────────────── */

  async function carregar() {
    const numero = ++estado.sequencia;
    try {
      const [topicos, posts] = await Promise.all([repo.listarTopicos(), repo.listarPosts()]);
      if (numero !== estado.sequencia) return;
      Object.assign(estado, { topicos, posts, carregou: true, falhou: false });
      el('erro').innerHTML = '';
      atualizarConexao();
      render();
    } catch (erro) {
      if (numero !== estado.sequencia) return;
      console.error(erro);
      estado.falhou = true;
      mostrarErro(erro);
      atualizarConexao();
      if (!estado.carregou) principal.innerHTML = '';
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────────────────── */

  // O tópico marcado na barra: o aberto, o do post aberto, ou a raiz no início da aba.
  const topicoAtivo = () => {
    const rota = rotaDe(location.hash);
    if (estado.editor) return estado.editor.topicoId;
    if (rota.tipo === 'topico') return topicoDoSlug(rota.slug)?.id ?? null;
    if (rota.tipo === 'post') return postDoSlug(rota.slug)?.topicoId ?? null;
    return raiz()?.id ?? null;
  };

  function render() {
    if (!estado.carregou) return;
    el('arvore').innerHTML = htmlLateral({ topicos: estado.topicos, posts: estado.posts, ativo: topicoAtivo() });

    // O editor aberto não é redesenhado: uma atualização ao vivo apagaria o que está sendo digitado.
    if (estado.editor) {
      if (!principal.querySelector('[data-op="editor"]')) montarEditor();
      avisarSeMudouNoBanco();
      return;
    }

    if (estado.termo.trim()) {
      principal.innerHTML = htmlBusca({ termo: estado.termo.trim(), resultados: buscar(estado.posts, estado.termo), topicos: estado.topicos });
      return;
    }

    const rota = rotaDe(location.hash);
    if (rota.tipo === 'post') {
      const post = postDoSlug(rota.slug);
      principal.innerHTML = post ? htmlPost({ post, topicos: estado.topicos }) : naoEncontrado('Post');
      return;
    }
    const topico = rota.tipo === 'topico' ? topicoDoSlug(rota.slug) : raiz();
    principal.innerHTML = topico ? htmlTopico({ topico, topicos: estado.topicos, posts: estado.posts }) : naoEncontrado('Tópico');
  }

  const naoEncontrado = (o) => `
    <div class="empty-state">
      <p>${o} não encontrado.</p>
      <span>Ele pode ter sido excluído, ou o link está incompleto.</span>
      <a class="copy-btn" href="#operacional">Voltar ao início</a>
    </div>`;

  /* ── Editor ───────────────────────────────────────────────────────────────────────── */

  function abrirEditor(post, topicoId) {
    estado.termo = '';
    el('busca').value = '';
    estado.editor = { post, topicoId, original: { titulo: post?.titulo ?? '', topicoId, conteudo: post?.conteudo ?? '' } };
    principal.innerHTML = '';
    render();
    const form = principal.querySelector('[data-op="editor"]');
    (post ? form.conteudo : form.titulo).focus();
  }

  function montarEditor() {
    const { post, topicoId } = estado.editor;
    principal.innerHTML = htmlEditor({ post, topicos: estado.topicos, topicoId });
  }

  const valoresDoEditor = () => {
    const form = principal.querySelector('[data-op="editor"]');
    return { titulo: form.titulo.value, topicoId: form.topico.value, conteudo: form.conteudo.value };
  };

  const editorSujo = () => {
    if (!estado.editor) return false;
    const agora = valoresDoEditor();
    const antes = estado.editor.original;
    return agora.titulo !== antes.titulo || agora.topicoId !== antes.topicoId || agora.conteudo !== antes.conteudo;
  };

  function avisarSeMudouNoBanco() {
    const aberto = estado.editor?.post;
    if (!aberto) return;
    const noBanco = estado.posts.find((p) => p.id === aberto.id);
    const mudou = !noBanco || noBanco.versao !== aberto.versao;
    principal.querySelector('[data-op="aviso-editor"]').innerHTML = mudou
      ? `<div class="alert alert-warning" role="alert">${
          noBanco ? 'Outra pessoa acabou de salvar este post.' : 'Outra pessoa acabou de excluir este post.'
        } Se você salvar, o sistema vai recusar para não apagar o que ela fez — copie o seu texto antes de fechar.</div>`
      : '';
  }

  function fecharEditor({ perguntar = true } = {}) {
    if (perguntar && editorSujo() && !confirm('Descartar as alterações deste post?')) return false;
    estado.editor = null;
    render();
    return true;
  }

  async function salvarEditor() {
    const { titulo, topicoId, conteudo } = valoresDoEditor();
    const form = principal.querySelector('[data-op="editor"]');
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      const { post } = estado.editor;
      const salvo = post
        ? await repo.atualizarPost({ ...post, titulo, topicoId, conteudo })
        : await repo.criarPost({ topicoId, titulo, conteudo, ordem: proximaOrdem(topicoId) });
      estado.editor = null;
      // O post salvo vale já, sem esperar a releitura: uma carga disparada pelo Realtime no meio do
      // caminho descarta a de baixo, e sem isto o post novo apareceria como "não encontrado" (ou o
      // editado com o texto antigo) até ela terminar.
      estado.posts = post ? estado.posts.map((p) => (p.id === salvo.id ? salvo : p)) : [...estado.posts, salvo];
      aviso(post ? 'Post salvo para toda a mesa.' : 'Post criado.');
      await carregar();
      irPara(linkDoPost(salvo));
    } catch (erro) {
      // Conflito é situação prevista, tratada na tela; o console fica para o que é defeito.
      if (!(erro instanceof ErroDeConflito)) console.error(erro);
      // O editor continua aberto, com o texto: nada se perde por causa de um erro.
      principal.querySelector('[data-op="aviso-editor"]').innerHTML = `<div class="alert alert-danger" role="alert">${esc(
        erro instanceof ErroDeConflito ? erro.message : `${mensagemDeErro(erro)} O texto continua aqui: tente salvar de novo.`
      )}</div>`;
      aviso('O post não foi salvo.', { tipo: 'erro' });
    } finally {
      botao.disabled = false;
    }
  }

  const proximaOrdem = (topicoId) =>
    estado.posts.filter((p) => p.topicoId === topicoId).reduce((maior, p) => Math.max(maior, p.ordem), -1) + 1;

  // Muda o hash; se já é o mesmo, o hashchange não vem, então desenha na mão.
  const irPara = (hash) => {
    if (location.hash === hash) render();
    else location.hash = hash;
  };

  /* ── Ações do post ────────────────────────────────────────────────────────────────── */

  const postAberto = () => {
    const rota = rotaDe(location.hash);
    return rota.tipo === 'post' ? postDoSlug(rota.slug) : null;
  };

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  async function copiarPost(botao) {
    const post = postAberto();
    if (!post) return;
    const ok = await copiarTexto(post.conteudo);
    if (!ok) return aviso('Não foi possível copiar. Selecione o texto e copie com Ctrl+C.', { tipo: 'erro' });
    botao.textContent = 'Copiado';
    setTimeout(() => (botao.textContent = 'Copiar texto'), 1800);
    aviso('Texto copiado.');
  }

  async function excluirPost() {
    const post = postAberto();
    if (!post) return;
    if (!confirm(`Excluir "${post.titulo}"? Ele some para toda a mesa.`)) return;
    try {
      await repo.excluirPost(post);
      estado.posts = estado.posts.filter((p) => p.id !== post.id); // idem: não esperar a releitura
      aviso('Post excluído.');
      const topico = estado.topicos.find((t) => t.id === post.topicoId);
      await carregar();
      irPara(topico ? linkDoTopico(topico) : '#operacional');
    } catch (erro) {
      if (!(erro instanceof ErroDeConflito)) console.error(erro);
      aviso(erro instanceof ErroDeConflito ? erro.message : mensagemDeErro(erro), { tipo: 'erro' });
      if (!(erro instanceof ErroDeConflito)) mostrarErro(erro);
      else carregar();
    }
  }

  // Post novo nasce no tópico aberto; na raiz, no primeiro tópico dela.
  function criarPostAqui() {
    const rota = rotaDe(location.hash);
    const aberto = rota.tipo === 'topico' ? topicoDoSlug(rota.slug) : raiz();
    const topico = aberto && aberto.paiId !== null ? aberto : estado.topicos.find((t) => t.paiId === raiz()?.id);
    if (!topico) return aviso('Crie um tópico antes do primeiro post.', { tipo: 'erro' });
    abrirEditor(null, topico.id);
  }

  /* ── Novo tópico ──────────────────────────────────────────────────────────────────── */

  const dialogo = el('dialogo-topico');

  async function criarTopico() {
    const form = el('form-topico');
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    el('erro-dialogo').innerHTML = '';
    try {
      const topico = await repo.criarTopico({ nome: form.nome.value, descricao: form.descricao.value, paiId: raiz()?.id ?? null });
      dialogo.close();
      form.reset();
      aviso(`Tópico “${topico.nome}” criado.`);
      await carregar();
      irPara(linkDoTopico(topico));
    } catch (erro) {
      console.error(erro);
      el('erro-dialogo').innerHTML = `<div class="alert alert-danger" role="alert">${esc(mensagemDeErro(erro))}</div>`;
    } finally {
      botao.disabled = false;
    }
  }

  /* ── Eventos ──────────────────────────────────────────────────────────────────────── */

  let rotaAnterior = location.hash;
  window.addEventListener('hashchange', () => {
    if (!naAba()) return;
    // Sair do editor com alteração pede confirmação; se a pessoa desiste, o link volta.
    if (estado.editor && editorSujo() && !confirm('Descartar as alterações deste post?')) {
      history.replaceState(null, '', rotaAnterior);
      return;
    }
    rotaAnterior = location.hash;
    estado.editor = null;
    estado.termo = '';
    el('busca').value = '';
    render();
    if (!secao.hidden) window.scrollTo({ top: 0 });
  });

  principal.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;
    if (acao === 'criar-post') criarPostAqui();
    else if (acao === 'copiar') copiarPost(botao);
    else if (acao === 'editar') {
      const post = postAberto();
      if (post) abrirEditor(post, post.topicoId);
    } else if (acao === 'excluir') excluirPost();
    else if (acao === 'cancelar') fecharEditor();
  });

  principal.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-op="editor"]')) return;
    e.preventDefault();
    salvarEditor();
  });

  principal.addEventListener('keydown', (e) => {
    if (!e.target.closest('[data-op="editor"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      salvarEditor();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fecharEditor();
    }
  });

  el('erro').addEventListener('click', (e) => {
    if (e.target.closest('[data-op="tentar"]')) carregar();
  });

  el('busca').addEventListener('input', () => {
    if (estado.editor && !fecharEditor()) {
      el('busca').value = '';
      return;
    }
    estado.termo = el('busca').value;
    render();
  });
  el('busca').addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    el('busca').value = '';
    estado.termo = '';
    render();
  });

  el('novo-topico').addEventListener('click', () => {
    el('erro-dialogo').innerHTML = '';
    dialogo.showModal();
    el('form-topico').nome.focus();
  });
  el('form-topico').addEventListener('submit', (e) => {
    e.preventDefault();
    criarTopico();
  });
  el('cancelar-dialogo').addEventListener('click', () => dialogo.close());
  el('fechar-dialogo').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) dialogo.close();
  });

  /* ── Tempo real ───────────────────────────────────────────────────────────────────── */

  // Uma gravação gera mais de um evento: junta tudo numa recarga só.
  let espera = null;
  repo.assinarMudancas(
    () => {
      clearTimeout(espera);
      espera = setTimeout(carregar, 300);
    },
    (status) => {
      if (status !== 'AO_VIVO' && status !== 'ERRO') return;
      estado.tempoReal = status;
      atualizarConexao();
      // O que mudou entre a carga (ou a queda) e a inscrição ficar pronta não vem por evento.
      if (status === 'AO_VIVO') carregar();
    }
  );

  principal.innerHTML = '<div class="empty-state pequeno"><p>Carregando a base da mesa…</p></div>';
  atualizarConexao();
  carregar();
};

const MARCACAO = `
<div class="op">
  <aside class="op-lateral" aria-label="Base de conhecimento">
    <div class="op-equipe" data-op="equipe"></div>
    <label class="op-busca">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
      <input type="search" data-op="busca" placeholder="Buscar nos posts" aria-label="Buscar nos posts" autocomplete="off" />
    </label>
    <nav data-op="arvore" aria-label="Tópicos"></nav>
    <button type="button" class="op-novo-topico" data-op="novo-topico">+ Novo tópico</button>
    <p class="meta-counter op-conexao" data-op="conexao" role="status"></p>
  </aside>

  <div class="op-principal">
    <div data-op="erro"></div>
    <div class="op-folha" data-op="principal"></div>
  </div>

  <dialog class="op-dialogo" data-op="dialogo-topico" aria-labelledby="op-dialogo-titulo">
    <form data-op="form-topico" novalidate>
      <div class="panel-header-row">
        <h2 class="panel-title" id="op-dialogo-titulo">Novo tópico</h2>
        <button type="button" class="icon-close-btn" data-op="fechar-dialogo" aria-label="Fechar" title="Fechar (Esc)">&times;</button>
      </div>
      <label class="op-campo"><span>Nome</span><input name="nome" maxlength="80" autocomplete="off" /></label>
      <label class="op-campo"><span>Descrição</span><input name="descricao" maxlength="200" autocomplete="off" placeholder="Opcional" /></label>
      <p class="op-dica">O tópico entra debaixo de “Mesa de Operações Argentum”.</p>
      <div data-op="erro-dialogo"></div>
      <div class="op-acoes">
        <button type="button" class="copy-btn" data-op="cancelar-dialogo">Cancelar</button>
        <button type="submit" class="copy-btn op-primario">Criar tópico</button>
      </div>
    </form>
  </dialog>
</div>`;
