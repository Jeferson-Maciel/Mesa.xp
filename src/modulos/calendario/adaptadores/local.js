import { ErroDoRepositorio, ordenarColaboradores, ordenarHorarios } from '../repositorio.js';

/**
 * O repositório no próprio navegador (`localStorage`), para rodar sem banco — o modo local, ligado
 * quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão as duas vazias.
 *
 * Chave e formato são os do app original (`presenca_app_data`):
 *   { collaborators: [{ id, name, color }],
 *     entries: { "YYYY-MM-DD": { [colaboradorId]: { presencial, obs, unavailable: [{ start, end, reason }] } } } }
 *
 * Faz o que o banco faria: apaga os registros junto com o colaborador (o `on delete cascade`),
 * recusa horário com início depois do fim (o `check`) e registro de colaborador inexistente (a
 * chave estrangeira). Os dados ficam só neste navegador, e não há atualização ao vivo entre abas.
 *
 * Diferente do original, armazenamento cheio ou bloqueado vira erro na tela: antes o registro
 * sumia com um aviso só no console.
 */

export const CHAVE_LOCAL = 'presenca_app_data';

const vazio = () => ({ collaborators: [], entries: {} });

/** @returns {import('../repositorio.js').Repositorio} */
export const criarRepositorioLocal = (armazenamento = globalThis.localStorage) => {
  const ler = () => {
    try {
      const dados = JSON.parse(armazenamento.getItem(CHAVE_LOCAL) || 'null');
      if (!dados || typeof dados !== 'object') return vazio();
      return {
        collaborators: Array.isArray(dados.collaborators) ? dados.collaborators : [],
        entries: dados.entries && typeof dados.entries === 'object' ? dados.entries : {}
      };
    } catch {
      return vazio();
    }
  };

  const gravar = (dados) => {
    try {
      armazenamento.setItem(CHAVE_LOCAL, JSON.stringify(dados));
    } catch (erro) {
      throw new ErroDoRepositorio('Não foi possível gravar no navegador: o armazenamento está cheio ou bloqueado.', { cause: erro });
    }
  };

  return {
    modo: 'local',

    async listarColaboradores() {
      return ordenarColaboradores(ler().collaborators.map((c) => ({ id: c.id, nome: c.name, cor: c.color })));
    },

    async adicionarColaborador(nome, cor) {
      const dados = ler();
      const id = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      dados.collaborators.push({ id, name: nome, color: cor });
      gravar(dados);
      return { id, nome, cor };
    },

    async removerColaborador(id) {
      const dados = ler();
      dados.collaborators = dados.collaborators.filter((c) => c.id !== id);
      for (const dia of Object.keys(dados.entries)) {
        delete dados.entries[dia][id];
        if (Object.keys(dados.entries[dia]).length === 0) delete dados.entries[dia];
      }
      gravar(dados);
    },

    async listarRegistros(inicio, fim) {
      const { entries } = ler();
      const registros = [];
      for (const [data, porColaborador] of Object.entries(entries)) {
        if (data < inicio || data > fim) continue;
        for (const [colaboradorId, e] of Object.entries(porColaborador)) {
          registros.push({
            data,
            colaboradorId,
            presencial: Boolean(e.presencial),
            observacao: e.obs || '',
            indisponiveis: ordenarHorarios((e.unavailable || []).map((h) => ({ inicio: h.start, fim: h.end, motivo: h.reason || '' })))
          });
        }
      }
      return registros;
    },

    async salvarRegistro({ colaboradorId, data, presencial, observacao, indisponiveis }) {
      for (const h of indisponiveis) {
        if (!(h.inicio < h.fim)) throw new ErroDoRepositorio(`Horário inválido: ${h.inicio} até ${h.fim}. O início vem antes do fim.`);
      }
      const dados = ler();
      if (!dados.collaborators.some((c) => c.id === colaboradorId)) {
        throw new ErroDoRepositorio('Não foi possível salvar o dia: o colaborador não existe mais.');
      }
      dados.entries[data] ??= {};
      dados.entries[data][colaboradorId] = {
        presencial: Boolean(presencial),
        obs: observacao ?? '',
        unavailable: indisponiveis.map((h) => ({ start: h.inicio, end: h.fim, reason: h.motivo || '' }))
      };
      gravar(dados);
    },

    // Sem banco não há atualização ao vivo: nada a assinar.
    assinarMudancas() {
      return () => {};
    }
  };
};
