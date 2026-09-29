/**
 * O repositório de presença: tudo que a tela do Calendário lê e grava passa por aqui.
 *
 * Dois adaptadores equivalentes cumprem o mesmo contrato — `adaptadores/supabase.js` (o banco da
 * mesa) e `adaptadores/local.js` (`localStorage`, chave `presenca_app_data`, para rodar sem
 * banco). `repositorio.test.js` roda a mesma bateria contra os dois, com fakes; um método novo ou
 * alterado entra nos dois lados e na bateria.
 *
 * O domínio fala português; o banco e o formato local continuam com os nomes do app original
 * (collaborators, daily_entries, unavailable_slots, presenca_app_data), porque os dois apps
 * dividem o mesmo banco enquanto a mesa migra.
 *
 * @typedef {{ id: string, nome: string, cor: string }} Colaborador
 * @typedef {{ inicio: string, fim: string, motivo: string }} Horario  horas em "HH:MM"
 * @typedef {{ data: string, colaboradorId: string, presencial: boolean, observacao: string,
 *             indisponiveis: Horario[] }} Registro  data em "YYYY-MM-DD", fuso local
 *
 * @typedef {object} Repositorio
 * @property {'supabase' | 'local'} modo
 * @property {() => Promise<Colaborador[]>} listarColaboradores  em ordem de nome
 * @property {(nome: string, cor: string) => Promise<Colaborador>} adicionarColaborador
 * @property {(id: string) => Promise<void>} removerColaborador  leva os registros junto
 * @property {(inicio: string, fim: string) => Promise<Registro[]>} listarRegistros  as duas pontas inclusas
 * @property {(registro: Registro) => Promise<void>} salvarRegistro  substitui o dia inteiro
 * @property {(aoMudar: () => void, aoStatus?: (status: string, erro?: unknown) => void) => () => void} assinarMudancas
 *
 * Todo erro sai como `ErroDoRepositorio`, com a mensagem pronta para a tela. Nenhum adaptador
 * engole erro nem troca de adaptador sozinho: falha de rede aparece para quem está usando.
 */

export class ErroDoRepositorio extends Error {
  constructor(mensagem, opcoes) {
    super(mensagem, opcoes);
    this.name = 'ErroDoRepositorio';
  }
}

/** Ordem de nome como uma pessoa espera: sem diferenciar maiúscula nem acento. */
export const ordenarColaboradores = (lista) =>
  [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

/** Os horários do dia na ordem em que acontecem. */
export const ordenarHorarios = (lista) =>
  [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));

/** Erro de rede do navegador, do jeito que o supabase-js o repassa. */
export const ehErroDeRede = (erro) =>
  /Failed to fetch|NetworkError|Load failed|fetch failed|AbortError|TimeoutError|timed out/i.test(String(erro?.message ?? erro));
