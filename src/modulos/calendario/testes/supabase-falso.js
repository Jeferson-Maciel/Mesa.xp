/**
 * Um Supabase de mentira, em memória, para os testes do repositório.
 *
 * Imita o que o adaptador usa do cliente real — `from(tabela)` com select/insert/upsert/delete,
 * os filtros eq/in/gte/lte, `order`, e `channel().on().subscribe()` — e o que o banco garante:
 * as três tabelas de supabase/schema.sql, a chave única (collaborator_id, date), o
 * `check (start_time < end_time)`, as chaves estrangeiras e o `on delete cascade`. A coluna `time`
 * volta como `HH:MM:SS`, como no Postgres.
 *
 * Cada chamada fica registrada em `chamadas`, e `falharQuando` injeta um erro — é assim que os
 * testes provam que uma falha no meio do salvamento não perde dado.
 */

export const criarSupabaseFalso = () => {
  const tabelas = { collaborators: [], daily_entries: [], unavailable_slots: [] };
  const chamadas = [];
  const canais = [];
  let falha = null;
  let sequencia = 0;

  const novoId = () => `00000000-0000-4000-8000-${String(++sequencia).padStart(12, '0')}`;
  const copia = (linha) => ({ ...linha });
  const hora = (valor) => (/^\d{2}:\d{2}$/.test(valor) ? `${valor}:00` : valor);

  const casa = (linha, filtros) =>
    filtros.every(([op, coluna, valor]) => {
      const atual = linha[coluna];
      if (op === 'eq') return atual === valor;
      if (op === 'in') return valor.includes(atual);
      if (op === 'gte') return atual >= valor;
      if (op === 'lte') return atual <= valor;
      throw new Error(`filtro ${op} não imitado`);
    });

  const erro = (message) => ({ data: null, error: { message } });

  const validar = (tabela, linha) => {
    if (tabela === 'collaborators' && (!linha.name || !linha.color)) return 'null value in column';
    if (tabela === 'daily_entries' && !tabelas.collaborators.some((c) => c.id === linha.collaborator_id)) {
      return 'insert or update on table "daily_entries" violates foreign key constraint';
    }
    if (tabela === 'unavailable_slots') {
      if (!tabelas.daily_entries.some((e) => e.id === linha.entry_id)) {
        return 'insert or update on table "unavailable_slots" violates foreign key constraint';
      }
      if (!(hora(linha.start_time) < hora(linha.end_time))) return 'violates check constraint "unavailable_slots_check"';
    }
    return null;
  };

  const preencher = (tabela, linha) => {
    const nova = { id: novoId(), ...linha };
    if (tabela === 'daily_entries') {
      nova.presencial = linha.presencial ?? false;
      nova.observation = linha.observation ?? '';
    }
    if (tabela === 'unavailable_slots') {
      nova.start_time = hora(linha.start_time);
      nova.end_time = hora(linha.end_time);
      nova.reason = linha.reason ?? '';
    }
    return nova;
  };

  const apagarEmCascata = (tabela, linhas) => {
    const ids = new Set(linhas.map((l) => l.id));
    tabelas[tabela] = tabelas[tabela].filter((l) => !ids.has(l.id));
    if (tabela === 'collaborators') {
      apagarEmCascata('daily_entries', tabelas.daily_entries.filter((e) => ids.has(e.collaborator_id)));
    }
    if (tabela === 'daily_entries') {
      apagarEmCascata('unavailable_slots', tabelas.unavailable_slots.filter((s) => ids.has(s.entry_id)));
    }
  };

  const executar = (q) => {
    chamadas.push(q);
    const mensagem = falha?.(q);
    if (mensagem) return erro(mensagem);

    const tabela = tabelas[q.tabela];
    if (!tabela) return erro(`relation "${q.tabela}" does not exist`);

    if (q.op === 'select') {
      let linhas = tabela.filter((l) => casa(l, q.filtros)).map(copia);
      if (q.ordem) linhas.sort((a, b) => (a[q.ordem] < b[q.ordem] ? -1 : a[q.ordem] > b[q.ordem] ? 1 : 0));
      return { data: linhas, error: null };
    }

    if (q.op === 'insert' || q.op === 'upsert') {
      const resultado = [];
      for (const linha of q.linhas) {
        const problema = validar(q.tabela, linha);
        if (problema) return erro(problema);
      }
      for (const linha of q.linhas) {
        const conflito = q.op === 'upsert' && q.opcoes?.onConflict
          ? tabela.find((l) => q.opcoes.onConflict.split(',').every((c) => l[c.trim()] === linha[c.trim()]))
          : null;
        if (conflito) {
          Object.assign(conflito, linha);
          resultado.push(copia(conflito));
        } else {
          if (q.tabela === 'daily_entries' && tabela.some((l) => l.collaborator_id === linha.collaborator_id && l.date === linha.date)) {
            return erro('duplicate key value violates unique constraint');
          }
          const nova = preencher(q.tabela, linha);
          tabela.push(nova);
          resultado.push(copia(nova));
        }
      }
      return { data: q.retornar ? resultado : null, error: null };
    }

    if (q.op === 'delete') {
      apagarEmCascata(q.tabela, tabela.filter((l) => casa(l, q.filtros)));
      return { data: null, error: null };
    }

    return erro(`operação ${q.op} não imitada`);
  };

  const from = (tabela) => {
    const q = { tabela, op: 'select', filtros: [], linhas: null, opcoes: {}, ordem: null, retornar: false };
    const construtor = {
      select() {
        if (q.op !== 'select') q.retornar = true;
        return construtor;
      },
      insert(linhas) {
        q.op = 'insert';
        q.linhas = linhas;
        return construtor;
      },
      upsert(linha, opcoes) {
        q.op = 'upsert';
        q.linhas = [].concat(linha);
        q.opcoes = opcoes ?? {};
        return construtor;
      },
      delete() {
        q.op = 'delete';
        return construtor;
      },
      eq: (coluna, valor) => (q.filtros.push(['eq', coluna, valor]), construtor),
      in: (coluna, valores) => (q.filtros.push(['in', coluna, [...valores]]), construtor),
      gte: (coluna, valor) => (q.filtros.push(['gte', coluna, valor]), construtor),
      lte: (coluna, valor) => (q.filtros.push(['lte', coluna, valor]), construtor),
      order: (coluna) => ((q.ordem = coluna), construtor),
      then: (ok, falhou) => Promise.resolve().then(() => executar(q)).then(ok, falhou)
    };
    return construtor;
  };

  const channel = (nome) => {
    const canal = {
      nome,
      assinaturas: [],
      aoStatus: null,
      on(tipo, filtro, callback) {
        canal.assinaturas.push({ tipo, filtro, callback });
        return canal;
      },
      subscribe(aoStatus) {
        canal.aoStatus = aoStatus;
        aoStatus?.('SUBSCRIBED');
        return canal;
      }
    };
    canais.push(canal);
    return canal;
  };

  return {
    tabelas,
    chamadas,
    canais,
    from,
    channel,
    removeChannel: (canal) => {
      canais.splice(canais.indexOf(canal), 1);
      return Promise.resolve('ok');
    },
    /** @param {(chamada: object) => string | null} regra devolve a mensagem de erro, ou null */
    falharQuando: (regra) => {
      falha = regra;
    },
    /** Simula uma mudança vinda do banco (de outra aba ou outra pessoa). */
    emitir: (tabela) => {
      for (const canal of canais) {
        for (const a of canal.assinaturas) if (a.filtro.table === tabela) a.callback({ table: tabela });
      }
    }
  };
};
