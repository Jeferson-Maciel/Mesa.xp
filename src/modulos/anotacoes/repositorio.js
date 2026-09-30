/**
 * O repositório das Anotações — o contrato que os dois adaptadores cumprem.
 *
 * **As anotações ficam no navegador de cada pessoa**, em IndexedDB (`adaptadores/indexeddb.js`),
 * e não no banco da mesa. É o que faz "cada um ter o seu" sem login: o Supabase da mesa ainda
 * libera leitura para quem tem a chave anon, que é pública, e uma anotação com o print de um
 * estorno ou a conta de um cliente não pode ficar legível para qualquer um com o link. Quando a
 * Mesa XP tiver login (fase 2 de segurança), um adaptador do Supabase com uma política por usuário
 * cumpre este mesmo contrato e as anotações passam a acompanhar a pessoa entre computadores.
 *
 * `adaptadores/memoria.js` cumpre o contrato em memória: é o que os testes usam.
 *
 * @typedef {{ id: string, nome: string, tipo: string, tamanho: number, criadoEm: number }} Anexo
 *
 * @typedef {object} RepositorioDeAnotacoes
 * @property {() => Promise<object[]>} listarNotas
 * @property {(nota: object, opcoes?: { manterData?: boolean }) => Promise<object>} salvarNota
 *   grava (nova ou existente) e carimba `atualizadaEm`; `manterData` é para a importação de backup.
 * @property {(id: string) => Promise<void>} excluirNota  leva os anexos junto
 * @property {(notaId: string, arquivo: Blob, ficha: { nome: string, id?: string, criadoEm?: number },
 *             opcoes?: { manterData?: boolean }) => Promise<Anexo>} adicionarAnexo
 *   guarda o arquivo e acrescenta a ficha dele na anotação.
 * @property {(anexoId: string) => Promise<Blob | null>} lerAnexo
 * @property {(notaId: string, anexoId: string) => Promise<void>} removerAnexo
 */

import { ErroDoRepositorio } from '../../dados/erros.js';
import { LIMITES } from './notas.js';

export { ErroDoRepositorio };

/** Um id novo. `crypto.randomUUID` existe no navegador (inclusive em file://) e no Node. */
export const novoId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/** Recusa a anotação que não cabe no formato — antes de gravar, nos dois adaptadores. */
export const validarNota = (nota) => {
  if (!nota?.id) throw new ErroDoRepositorio('Anotação sem identificador.');
  if (String(nota.titulo ?? '').length > LIMITES.titulo) throw new ErroDoRepositorio(`O título passa de ${LIMITES.titulo} caracteres.`);
  if (String(nota.texto ?? '').length > LIMITES.texto) throw new ErroDoRepositorio('O texto da anotação ficou grande demais.');
  if (!Array.isArray(nota.etiquetas) || nota.etiquetas.length > LIMITES.etiquetas) throw new ErroDoRepositorio(`No máximo ${LIMITES.etiquetas} etiquetas.`);
  if (nota.lembrete && (!DATA.test(nota.lembrete.data ?? '') || (nota.lembrete.hora !== null && !HORA.test(nota.lembrete.hora ?? '')))) {
    throw new ErroDoRepositorio('Lembrete com data ou hora inválida.');
  }
};

/** Recusa o anexo grande demais: o navegador aguenta, mas um print não passa disso. */
export const validarAnexo = (arquivo) => {
  if (!(arquivo instanceof Blob)) throw new ErroDoRepositorio('Anexo inválido.');
  if (arquivo.size > LIMITES.anexo) {
    throw new ErroDoRepositorio(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB; o limite é ${LIMITES.anexo / 1024 / 1024} MB.`);
  }
};

/** A ficha que a anotação guarda de cada anexo. */
export const fichaDoAnexo = (arquivo, { nome, id = novoId(), criadoEm = Date.now() }) => ({
  id,
  nome: String(nome || 'anexo').slice(0, 160),
  tipo: arquivo.type || 'application/octet-stream',
  tamanho: arquivo.size,
  criadoEm
});

/** Mais recente primeiro: é a ordem crua do repositório; a tela reordena (notas.js). */
export const porEdicao = (a, b) => b.atualizadaEm - a.atualizadaEm;
