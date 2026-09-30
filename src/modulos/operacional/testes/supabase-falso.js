/**
 * Um Supabase de mentira, em memória, para os testes do repositório do Operacional.
 *
 * Imita o que o adaptador usa do cliente real — `from(tabela)` com select/insert/update, os filtros
 * eq/is, `order`, e `channel().on().subscribe()` — e o que supabase/operacional.sql garante: o slug
 * único, os `check` de tamanho de nome e título, as chaves estrangeiras, o `atualizado_em`
 * carimbado pelo gatilho e a ausência de política de DELETE (o app só esconde, nunca apaga).
 *
 * Cada chamada fica registrada em `chamadas`; `falharQuando` injeta um erro.
 */

export const criarSupabaseFalso = () => {
  const tabelas = { operacional_topicos: [], operacional_posts: [] };
  const chamadas = [];
  const canais = [];
  let falha = null;
  let sequencia = 0;
  let relogio = Date.parse('2026-09-30T12:00:00Z');

  const novoId = () => `00000000-0000-4000-8000-${String(++sequencia).padStart(12, '0')}`;
  const agora = () => new Date((relogio += 1000)).toISOString();
  const erro = (message) => ({ data: null, error: { message } });
  const casa = (linha, filtros) =>
    filtros.every(([op, coluna, valor]) => (op === 'eq' ? linha[coluna] === valor : op === 'is' ? (linha[coluna] ?? null) === valor : false));

  const validar = (tabela, linha) => {
    if (tabela === 'operacional_topicos') {
      if (!(String(linha.nome ?? '').trim().length >= 2)) return 'new row violates check constraint "operacional_topicos_nome_check"';
      if (linha.pai_id && !tabelas.operacional_topicos.some((t) => t.id === linha.pai_id)) return 'violates foreign key constraint "operacional_topicos_pai_id_fkey"';
    }
    if (tabela === 'operacional_posts') {
      if (!(String(linha.titulo ?? '').trim().length >= 2)) return 'new row violates check constraint "operacional_posts_titulo_check"';
      if (!tabelas.operacional_topicos.some((t) => t.id === linha.topico_id)) return 'violates foreign key constraint "operacional_posts_topico_id_fkey"';
    }
    if (linha.slug && tabelas[tabela].some((l) => l.slug === linha.slug && l.id !== linha.id)) {
      return `duplicate key value violates unique constraint "${tabela}_slug_key"`;
    }
    return null;
  };

  const executar = (q) => {
    chamadas.push(q);
    const mensagem = falha?.(q);
    if (mensagem) return erro(mensagem);
    const tabela = tabelas[q.tabela];
    if (!tabela) return erro(`relation "${q.tabela}" does not exist`);

    if (q.op === 'select') {
      const linhas = tabela.filter((l) => casa(l, q.filtros)).map((l) => ({ ...l }));
      for (const coluna of [...q.ordem].reverse()) {
        linhas.sort((a, b) => (a[coluna] < b[coluna] ? -1 : a[coluna] > b[coluna] ? 1 : 0));
      }
      return { data: linhas, error: null };
    }

    if (q.op === 'insert') {
      const novas = [];
      for (const linha of q.linhas) {
        const nova = { id: novoId(), criado_em: agora(), ...linha };
        if (q.tabela === 'operacional_topicos') Object.assign(nova, { descricao: linha.descricao ?? '', pai_id: linha.pai_id ?? null, ordem: linha.ordem ?? 0 });
        if (q.tabela === 'operacional_posts') Object.assign(nova, { conteudo: linha.conteudo ?? '', ordem: linha.ordem ?? 0, versao: 1, atualizado_em: nova.criado_em, excluido_em: null });
        const problema = validar(q.tabela, nova);
        if (problema) return erro(problema);
        novas.push(nova);
      }
      tabela.push(...novas);
      return { data: q.retornar ? novas.map((l) => ({ ...l })) : null, error: null };
    }

    if (q.op === 'update') {
      const alvo = tabela.filter((l) => casa(l, q.filtros));
      for (const linha of alvo) {
        const problema = validar(q.tabela, { ...linha, ...q.valores });
        if (problema) return erro(problema);
      }
      for (const linha of alvo) {
        Object.assign(linha, q.valores);
        if (q.tabela === 'operacional_posts') linha.atualizado_em = agora(); // o gatilho do banco
      }
      return { data: q.retornar ? alvo.map((l) => ({ ...l })) : null, error: null };
    }

    // Sem política de DELETE para a chave anon: o PostgREST não apaga nada e não reclama.
    if (q.op === 'delete') return { data: q.retornar ? [] : null, error: null };

    return erro(`operação ${q.op} não imitada`);
  };

  const from = (tabela) => {
    const q = { tabela, op: 'select', filtros: [], linhas: null, valores: null, ordem: [], retornar: false };
    const c = {
      select() {
        if (q.op !== 'select') q.retornar = true;
        return c;
      },
      insert(linhas) {
        q.op = 'insert';
        q.linhas = [].concat(linhas);
        return c;
      },
      update(valores) {
        q.op = 'update';
        q.valores = valores;
        return c;
      },
      delete() {
        q.op = 'delete';
        return c;
      },
      eq: (coluna, valor) => (q.filtros.push(['eq', coluna, valor]), c),
      is: (coluna, valor) => (q.filtros.push(['is', coluna, valor]), c),
      order: (coluna) => (q.ordem.push(coluna), c),
      then: (ok, falhou) => Promise.resolve().then(() => executar(q)).then(ok, falhou)
    };
    return c;
  };

  const channel = (nome) => {
    const canal = {
      nome,
      assinaturas: [],
      on(tipo, filtro, callback) {
        canal.assinaturas.push({ tipo, filtro, callback });
        return canal;
      },
      // Como o servidor real: SUBSCRIBED e, em seguida, o aviso de que o banco está repassando.
      subscribe(aoStatus) {
        aoStatus?.('SUBSCRIBED');
        for (const a of canal.assinaturas) if (a.tipo === 'system') a.callback({ message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes' });
        return canal;
      }
    };
    canais.push(canal);
    return canal;
  };

  /** O que o supabase/operacional.sql semeia: a cópia do Slab. */
  const semear = ({ TOPICOS, POSTS }) => {
    const idDe = {};
    for (const t of TOPICOS) {
      const id = novoId();
      idDe[t.slug] = id;
      tabelas.operacional_topicos.push({ id, slug: t.slug, nome: t.nome, descricao: t.descricao, pai_id: t.pai ? idDe[t.pai] : null, ordem: t.ordem, criado_em: agora() });
    }
    for (const p of POSTS) {
      const quando = agora();
      tabelas.operacional_posts.push({ id: novoId(), slug: p.slug, topico_id: idDe[p.topico], titulo: p.titulo, conteudo: p.conteudo, ordem: p.ordem, versao: 1, criado_em: quando, atualizado_em: quando, excluido_em: null });
    }
  };

  return {
    tabelas,
    chamadas,
    canais,
    from,
    channel,
    semear,
    removeChannel: (canal) => {
      canais.splice(canais.indexOf(canal), 1);
      return Promise.resolve('ok');
    },
    falharQuando: (regra) => {
      falha = regra;
    },
    emitir: (tabela) => {
      for (const canal of canais) for (const a of canal.assinaturas) if (a.tipo === 'postgres_changes' && a.filtro.table === tabela) a.callback({ table: tabela });
    }
  };
};
