/**
 * O repositório da base Operacional: tudo que a tela lê e grava passa por aqui.
 *
 * Dois adaptadores equivalentes cumprem o mesmo contrato — `adaptadores/supabase.js` (o banco da
 * mesa, compartilhado e ao vivo) e `adaptadores/local.js` (`localStorage`, chave `mesa_operacional`,
 * para rodar sem banco). `repositorio.test.js` roda a mesma bateria contra os dois.
 *
 * Duas regras protegem o conteúdo, porque o app não tem login e qualquer um com o link edita:
 *   - **Excluir é esconder.** O post ganha `excluido_em` e some da tela, mas continua no banco; o
 *     banco nem tem política de DELETE para a chave anon.
 *   - **Ninguém salva por cima de quem salvou antes.** Cada post tem `versao`; salvar exige a versão
 *     que foi aberta e sobe um número. Se outra pessoa salvou no meio, sai `ErroDeConflito` e nada é
 *     sobrescrito. No banco, um gatilho guarda cada versão em `operacional_revisoes`.
 *
 * @typedef {{ id: string, slug: string, nome: string, descricao: string, paiId: string | null, ordem: number }} Topico
 * @typedef {{ id: string, slug: string, topicoId: string, titulo: string, conteudo: string, ordem: number,
 *             versao: number, atualizadoEm: string | null }} Post
 *
 * @typedef {object} Repositorio
 * @property {'supabase' | 'local'} modo
 * @property {() => Promise<Topico[]>} listarTopicos  na ordem do Slab
 * @property {() => Promise<Post[]>} listarPosts  sem os excluídos, na ordem de cada tópico
 * @property {(t: { nome: string, descricao: string, paiId: string | null }) => Promise<Topico>} criarTopico
 * @property {(p: { topicoId: string, titulo: string, conteudo: string, ordem: number }) => Promise<Post>} criarPost
 * @property {(p: Post) => Promise<Post>} atualizarPost  exige a `versao` que foi aberta
 * @property {(p: Post) => Promise<void>} excluirPost  esconde; exige a `versao` que foi aberta
 * @property {(aoMudar: () => void, aoStatus?: (status: string, erro?: unknown) => void) => () => void} assinarMudancas
 */

import { ErroDoRepositorio } from '../../dados/erros.js';
import { slugDe } from './conteudo.js';

export { ErroDeConflito, ErroDoRepositorio, ehErroDeRede } from '../../dados/erros.js';

export const LIMITES = { nome: 80, titulo: 160 };

/** O texto aparado, ou erro se tiver menos de 2 ou mais de `maximo` caracteres. */
export const validarTexto = (valor, rotulo, maximo) => {
  const texto = String(valor ?? '').trim();
  if (texto.length < 2) throw new ErroDoRepositorio(`${rotulo} precisa de pelo menos 2 letras.`);
  if (texto.length > maximo) throw new ErroDoRepositorio(`${rotulo} passa de ${maximo} caracteres.`);
  return texto;
};

/** Slug para o link de um tópico ou post novo: o título e 4 caracteres, para não colidir. */
export const novoSlug = (texto) => `${slugDe(texto).slice(0, 60) || 'post'}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;

export const MENSAGEM_CONFLITO =
  'Outra pessoa alterou ou excluiu este post depois que você o abriu. Nada foi sobrescrito: o seu texto continua na tela — copie-o, feche e abra o post de novo.';

export const ordenarTopicos = (lista) => [...lista].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

export const ordenarPosts = (lista) => [...lista].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'));
