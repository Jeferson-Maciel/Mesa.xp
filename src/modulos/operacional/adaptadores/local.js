import { POSTS, TOPICOS } from '../conteudo.js';
import {
  ErroDeConflito,
  ErroDoRepositorio,
  LIMITES,
  MENSAGEM_CONFLITO,
  novoSlug,
  ordenarPosts,
  ordenarTopicos,
  validarTexto
} from '../repositorio.js';

/**
 * A base Operacional no próprio navegador (`localStorage`, chave `mesa_operacional`) — o modo local,
 * ligado quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão as duas vazias.
 *
 * Começa com a mesma semente do banco (a cópia do Slab) e faz o que o banco faria: esconde em vez de
 * apagar, recusa salvar por cima de uma versão mais nova e recusa post em tópico que não existe. Os
 * dados ficam só neste navegador; não há histórico de versões nem atualização ao vivo entre abas.
 */

export const CHAVE_LOCAL = 'mesa_operacional';

const semente = () => {
  const idDe = Object.fromEntries(TOPICOS.map((t) => [t.slug, `local-${t.slug}`]));
  return {
    topicos: TOPICOS.map((t) => ({ id: idDe[t.slug], slug: t.slug, nome: t.nome, descricao: t.descricao, paiId: t.pai ? idDe[t.pai] : null, ordem: t.ordem })),
    posts: POSTS.map((p) => ({
      id: `local-${p.slug}`,
      slug: p.slug,
      topicoId: idDe[p.topico],
      titulo: p.titulo,
      conteudo: p.conteudo,
      ordem: p.ordem,
      versao: 1,
      atualizadoEm: null,
      excluidoEm: null
    }))
  };
};

const semExcluido = ({ excluidoEm, ...post }) => post;

/** @returns {import('../repositorio.js').Repositorio} */
export const criarRepositorioLocal = (armazenamento = globalThis.localStorage) => {
  const ler = () => {
    try {
      const dados = JSON.parse(armazenamento.getItem(CHAVE_LOCAL) || 'null');
      if (dados && Array.isArray(dados.topicos) && Array.isArray(dados.posts)) return dados;
    } catch {
      // cai para a semente
    }
    return semente();
  };

  const gravar = (dados) => {
    try {
      armazenamento.setItem(CHAVE_LOCAL, JSON.stringify(dados));
    } catch (erro) {
      throw new ErroDoRepositorio('Não foi possível gravar no navegador: o armazenamento está cheio ou bloqueado.', { cause: erro });
    }
  };

  const agora = () => new Date().toISOString();

  // Só casa com a versão que foi aberta, e nunca com um post já excluído — como o UPDATE do banco.
  const aberto = (dados, { id, versao }) => {
    const post = dados.posts.find((p) => p.id === id && !p.excluidoEm && p.versao === versao);
    if (!post) throw new ErroDeConflito(MENSAGEM_CONFLITO);
    return post;
  };

  const exigirTopico = (dados, topicoId) => {
    if (!dados.topicos.some((t) => t.id === topicoId)) throw new ErroDoRepositorio('Não foi possível salvar: o tópico não existe mais.');
  };

  return {
    modo: 'local',

    async listarTopicos() {
      return ordenarTopicos(ler().topicos);
    },

    async listarPosts() {
      return ordenarPosts(ler().posts.filter((p) => !p.excluidoEm).map(semExcluido));
    },

    async criarTopico({ nome, descricao, paiId }) {
      const limpo = validarTexto(nome, 'O nome do tópico', LIMITES.nome);
      const dados = ler();
      if (paiId) exigirTopico(dados, paiId);
      const slug = novoSlug(limpo);
      const topico = { id: `local-${slug}`, slug, nome: limpo, descricao: String(descricao ?? '').trim(), paiId: paiId ?? null, ordem: 100 };
      dados.topicos.push(topico);
      gravar(dados);
      return { ...topico };
    },

    async criarPost({ topicoId, titulo, conteudo, ordem }) {
      const limpo = validarTexto(titulo, 'O título', LIMITES.titulo);
      const dados = ler();
      exigirTopico(dados, topicoId);
      const slug = novoSlug(limpo);
      const post = { id: `local-${slug}`, slug, topicoId, titulo: limpo, conteudo: conteudo ?? '', ordem: ordem ?? 0, versao: 1, atualizadoEm: agora(), excluidoEm: null };
      dados.posts.push(post);
      gravar(dados);
      return semExcluido(post);
    },

    async atualizarPost({ id, versao, topicoId, titulo, conteudo }) {
      const limpo = validarTexto(titulo, 'O título', LIMITES.titulo);
      const dados = ler();
      const post = aberto(dados, { id, versao });
      exigirTopico(dados, topicoId);
      Object.assign(post, { topicoId, titulo: limpo, conteudo: conteudo ?? '', versao: versao + 1, atualizadoEm: agora() });
      gravar(dados);
      return semExcluido(post);
    },

    async excluirPost({ id, versao }) {
      const dados = ler();
      const post = aberto(dados, { id, versao });
      Object.assign(post, { excluidoEm: agora(), versao: versao + 1 });
      gravar(dados);
    },

    // Sem banco não há atualização ao vivo: nada a assinar.
    assinarMudancas() {
      return () => {};
    }
  };
};
