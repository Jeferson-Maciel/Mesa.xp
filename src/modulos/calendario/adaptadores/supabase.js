import { assinarTabelas } from '../../../dados/realtime.js';
import { ErroDoRepositorio, ordenarColaboradores, ordenarHorarios } from '../repositorio.js';

/**
 * O repositório no banco da mesa (Supabase: Postgres + Realtime).
 *
 * Recebe o cliente pronto — em produção o do @supabase/supabase-js, nos testes um fake em
 * memória — e não sabe de onde ele veio.
 *
 * Salvar um dia não é atômico no PostgREST, então a ordem das etapas é o que protege o dado:
 *   1. grava o dia (upsert em daily_entries);
 *   2. anota os horários que já existiam;
 *   3. insere os horários novos;
 *   4. só então apaga os anotados em 2.
 * Uma falha em 3 deixa os horários antigos intactos; uma falha em 4 deixa antigos e novos juntos
 * — repetido, mas nada perdido —, e nos dois casos o erro vai para a tela. O app original apagava
 * antes de inserir, e uma queda de rede no meio deixava o dia sem horário nenhum. Apagar pelos ids
 * anotados, e não "tudo do dia menos os novos", preserva o que outra pessoa gravou no meio tempo.
 *
 * `in()` vai em lotes de 100 ids: a lista entra na URL da requisição, e uma URL longa demais é
 * recusada pelo servidor.
 */

export const LOTE = 100;

const TABELAS = ['collaborators', 'daily_entries', 'unavailable_slots'];

const emLotes = (lista, tamanho) => {
  const partes = [];
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
  return partes;
};

const conferir = ({ data, error }, acao) => {
  if (error) throw new ErroDoRepositorio(`Não foi possível ${acao}: ${error.message}`, { cause: error });
  return data;
};

const paraColaborador = (linha) => ({ id: linha.id, nome: linha.name, cor: linha.color });

// A coluna `time` do Postgres volta como "HH:MM:SS".
const paraHorario = (linha) => ({
  inicio: String(linha.start_time).slice(0, 5),
  fim: String(linha.end_time).slice(0, 5),
  motivo: linha.reason ?? ''
});

/** @returns {import('../repositorio.js').Repositorio} */
export const criarRepositorioSupabase = (cliente) => ({
  modo: 'supabase',

  async listarColaboradores() {
    const linhas = conferir(await cliente.from('collaborators').select('id, name, color').order('name'), 'carregar os colaboradores');
    return ordenarColaboradores((linhas ?? []).map(paraColaborador));
  },

  async adicionarColaborador(nome, cor) {
    const linhas = conferir(
      await cliente.from('collaborators').insert([{ name: nome, color: cor }]).select('id, name, color'),
      'adicionar o colaborador'
    );
    return paraColaborador(linhas[0]);
  },

  async removerColaborador(id) {
    // Os registros do colaborador saem junto pelo `on delete cascade` do banco.
    conferir(await cliente.from('collaborators').delete().eq('id', id), 'remover o colaborador');
  },

  async listarRegistros(inicio, fim) {
    const entradas =
      conferir(
        await cliente
          .from('daily_entries')
          .select('id, collaborator_id, date, presencial, observation')
          .gte('date', inicio)
          .lte('date', fim),
        'carregar as presenças'
      ) ?? [];

    const horarios = new Map(entradas.map((e) => [e.id, []]));
    for (const lote of emLotes([...horarios.keys()], LOTE)) {
      const linhas =
        conferir(
          await cliente.from('unavailable_slots').select('entry_id, start_time, end_time, reason').in('entry_id', lote),
          'carregar os horários indisponíveis'
        ) ?? [];
      for (const linha of linhas) horarios.get(linha.entry_id)?.push(paraHorario(linha));
    }

    return entradas.map((e) => ({
      data: e.date,
      colaboradorId: e.collaborator_id,
      presencial: Boolean(e.presencial),
      observacao: e.observation ?? '',
      indisponiveis: ordenarHorarios(horarios.get(e.id))
    }));
  },

  async salvarRegistro({ colaboradorId, data, presencial, observacao, indisponiveis }) {
    const [entrada] = conferir(
      await cliente
        .from('daily_entries')
        .upsert(
          { collaborator_id: colaboradorId, date: data, presencial: Boolean(presencial), observation: observacao ?? '' },
          { onConflict: 'collaborator_id,date' }
        )
        .select('id'),
      'salvar o dia'
    );

    const antigos = (
      conferir(await cliente.from('unavailable_slots').select('id').eq('entry_id', entrada.id), 'ler os horários do dia') ?? []
    ).map((h) => h.id);

    if (indisponiveis.length > 0) {
      conferir(
        await cliente.from('unavailable_slots').insert(
          indisponiveis.map((h) => ({ entry_id: entrada.id, start_time: h.inicio, end_time: h.fim, reason: h.motivo || '' }))
        ),
        'gravar os horários indisponíveis (os anteriores foram mantidos)'
      );
    }

    for (const lote of emLotes(antigos, LOTE)) {
      conferir(
        await cliente.from('unavailable_slots').delete().in('id', lote),
        'apagar os horários anteriores (os novos já estão gravados; confira o dia)'
      );
    }
  },

  assinarMudancas(aoMudar, aoStatus) {
    return assinarTabelas(cliente, 'mesa-xp-presenca', TABELAS, aoMudar, aoStatus);
  }
});
