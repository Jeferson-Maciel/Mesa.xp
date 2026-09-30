import { assinarTabelas } from '../../../dados/realtime.js';
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
 * A base Operacional no banco da mesa (Supabase). Tabelas e regras em supabase/operacional.sql.
 *
 * Recebe o cliente pronto — em produção o de `src/dados/banco.js`, nos testes um fake em memória.
 * A trava de versão está no filtro: o UPDATE só casa com a linha se a `versao` ainda for a que foi
 * aberta; se nenhuma linha voltar, outra pessoa salvou no meio.
 */

const COLUNAS_TOPICO = 'id, slug, nome, descricao, pai_id, ordem';
const COLUNAS_POST = 'id, slug, topico_id, titulo, conteudo, ordem, versao, atualizado_em';

const conferir = ({ data, error }, acao) => {
  if (error) throw new ErroDoRepositorio(`Não foi possível ${acao}: ${error.message}`, { cause: error });
  return data;
};

const paraTopico = (l) => ({ id: l.id, slug: l.slug, nome: l.nome, descricao: l.descricao ?? '', paiId: l.pai_id ?? null, ordem: l.ordem ?? 0 });

const paraPost = (l) => ({
  id: l.id,
  slug: l.slug,
  topicoId: l.topico_id,
  titulo: l.titulo,
  conteudo: l.conteudo ?? '',
  ordem: l.ordem ?? 0,
  versao: l.versao,
  atualizadoEm: l.atualizado_em ?? null
});

/** @returns {import('../repositorio.js').Repositorio} */
export const criarRepositorioSupabase = (cliente) => ({
  modo: 'supabase',

  async listarTopicos() {
    const linhas = conferir(await cliente.from('operacional_topicos').select(COLUNAS_TOPICO).order('ordem'), 'carregar os tópicos');
    return ordenarTopicos((linhas ?? []).map(paraTopico));
  },

  async listarPosts() {
    const linhas = conferir(
      await cliente.from('operacional_posts').select(COLUNAS_POST).is('excluido_em', null).order('ordem'),
      'carregar os posts'
    );
    return ordenarPosts((linhas ?? []).map(paraPost));
  },

  async criarTopico({ nome, descricao, paiId }) {
    const limpo = validarTexto(nome, 'O nome do tópico', LIMITES.nome);
    const linhas = conferir(
      await cliente
        .from('operacional_topicos')
        .insert([{ slug: novoSlug(limpo), nome: limpo, descricao: String(descricao ?? '').trim(), pai_id: paiId ?? null, ordem: 100 }])
        .select(COLUNAS_TOPICO),
      'criar o tópico'
    );
    return paraTopico(linhas[0]);
  },

  async criarPost({ topicoId, titulo, conteudo, ordem }) {
    const limpo = validarTexto(titulo, 'O título', LIMITES.titulo);
    const linhas = conferir(
      await cliente
        .from('operacional_posts')
        .insert([{ slug: novoSlug(limpo), topico_id: topicoId, titulo: limpo, conteudo: conteudo ?? '', ordem: ordem ?? 0 }])
        .select(COLUNAS_POST),
      'criar o post'
    );
    return paraPost(linhas[0]);
  },

  async atualizarPost({ id, versao, topicoId, titulo, conteudo }) {
    const limpo = validarTexto(titulo, 'O título', LIMITES.titulo);
    const linhas = conferir(
      await cliente
        .from('operacional_posts')
        .update({ topico_id: topicoId, titulo: limpo, conteudo: conteudo ?? '', versao: versao + 1 })
        .eq('id', id)
        .eq('versao', versao)
        .is('excluido_em', null)
        .select(COLUNAS_POST),
      'salvar o post'
    );
    if (!linhas?.length) throw new ErroDeConflito(MENSAGEM_CONFLITO);
    return paraPost(linhas[0]);
  },

  async excluirPost({ id, versao }) {
    const linhas = conferir(
      await cliente
        .from('operacional_posts')
        .update({ excluido_em: new Date().toISOString(), versao: versao + 1 })
        .eq('id', id)
        .eq('versao', versao)
        .is('excluido_em', null)
        .select('id'),
      'excluir o post'
    );
    if (!linhas?.length) throw new ErroDeConflito(MENSAGEM_CONFLITO);
  },

  assinarMudancas(aoMudar, aoStatus) {
    return assinarTabelas(cliente, 'mesa-xp-operacional', ['operacional_topicos', 'operacional_posts'], aoMudar, aoStatus);
  }
});
