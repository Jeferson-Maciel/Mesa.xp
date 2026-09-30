import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVE_LOCAL, criarRepositorioLocal } from './adaptadores/local.js';
import { LOTE, criarRepositorioSupabase } from './adaptadores/supabase.js';
import { criarSupabaseFalso } from './testes/supabase-falso.js';

/**
 * O contrato do repositório, rodado contra os dois adaptadores. Tudo que a tela faz passa por
 * estes seis métodos, e os dois lados têm que responder igual: quem testa no modo local está
 * testando o mesmo comportamento que vai para o banco.
 */

const armazenamentoFalso = (inicial = {}) => {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    dados
  };
};

const ADAPTADORES = [
  ['localStorage', () => criarRepositorioLocal(armazenamentoFalso())],
  ['Supabase', () => criarRepositorioSupabase(criarSupabaseFalso())]
];

const registro = (colaboradorId, data, extra = {}) => ({
  colaboradorId,
  data,
  presencial: true,
  observacao: '',
  indisponiveis: [],
  ...extra
});

describe.each(ADAPTADORES)('repositório (%s)', (_, criar) => {
  let repo;
  beforeEach(() => {
    repo = criar();
  });

  it('começa sem colaboradores nem registros', async () => {
    expect(await repo.listarColaboradores()).toEqual([]);
    expect(await repo.listarRegistros('2026-09-01', '2026-09-30')).toEqual([]);
  });

  it('adiciona colaborador e lista em ordem de nome, com acento no lugar certo', async () => {
    const zeca = await repo.adicionarColaborador('Zeca', '#22c55e');
    await repo.adicionarColaborador('Ágata', '#6366f1');
    await repo.adicionarColaborador('bruno', '#f59e0b');
    expect(zeca).toMatchObject({ nome: 'Zeca', cor: '#22c55e' });
    expect(zeca.id).toBeTruthy();
    expect((await repo.listarColaboradores()).map((c) => c.nome)).toEqual(['Ágata', 'bruno', 'Zeca']);
  });

  it('grava o dia e lê de volta, com os horários em HH:MM e na ordem do dia', async () => {
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await repo.salvarRegistro(
      registro(c.id, '2026-09-30', {
        observacao: 'Reunião externa',
        indisponiveis: [
          { inicio: '14:00', fim: '15:30', motivo: 'Médico' },
          { inicio: '09:00', fim: '10:00', motivo: '' }
        ]
      })
    );
    expect(await repo.listarRegistros('2026-09-28', '2026-10-04')).toEqual([
      {
        data: '2026-09-30',
        colaboradorId: c.id,
        presencial: true,
        observacao: 'Reunião externa',
        indisponiveis: [
          { inicio: '09:00', fim: '10:00', motivo: '' },
          { inicio: '14:00', fim: '15:30', motivo: 'Médico' }
        ]
      }
    ]);
  });

  it('o intervalo inclui as duas pontas e nada fora delas', async () => {
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    for (const data of ['2026-09-27', '2026-09-28', '2026-10-04', '2026-10-05']) await repo.salvarRegistro(registro(c.id, data));
    const datas = (await repo.listarRegistros('2026-09-28', '2026-10-04')).map((r) => r.data).sort();
    expect(datas).toEqual(['2026-09-28', '2026-10-04']);
  });

  it('salvar o mesmo dia de novo substitui, sem duplicar registro nem horário', async () => {
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await repo.salvarRegistro(registro(c.id, '2026-09-30', { indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: 'a' }] }));
    await repo.salvarRegistro(
      registro(c.id, '2026-09-30', { presencial: false, observacao: 'home office', indisponiveis: [{ inicio: '10:00', fim: '11:00', motivo: 'b' }] })
    );
    const lista = await repo.listarRegistros('2026-09-30', '2026-09-30');
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ presencial: false, observacao: 'home office', indisponiveis: [{ inicio: '10:00', fim: '11:00', motivo: 'b' }] });
  });

  it('salvar sem horários apaga os que havia', async () => {
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await repo.salvarRegistro(registro(c.id, '2026-09-30', { indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: '' }] }));
    await repo.salvarRegistro(registro(c.id, '2026-09-30'));
    expect((await repo.listarRegistros('2026-09-30', '2026-09-30'))[0].indisponiveis).toEqual([]);
  });

  it('remover o colaborador leva os registros dele junto, e só os dele', async () => {
    const ana = await repo.adicionarColaborador('Ana', '#6366f1');
    const bia = await repo.adicionarColaborador('Bia', '#22c55e');
    await repo.salvarRegistro(registro(ana.id, '2026-09-30', { indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: '' }] }));
    await repo.salvarRegistro(registro(bia.id, '2026-09-30'));
    await repo.removerColaborador(ana.id);
    expect((await repo.listarColaboradores()).map((c) => c.nome)).toEqual(['Bia']);
    expect((await repo.listarRegistros('2026-09-01', '2026-10-31')).map((r) => r.colaboradorId)).toEqual([bia.id]);
  });

  // Escapar é trabalho da tela: o repositório guarda e devolve o texto como veio.
  it('guarda texto com marcação literalmente', async () => {
    const nome = '<img src=x onerror=alert(1)>';
    const c = await repo.adicionarColaborador(nome, '#6366f1');
    await repo.salvarRegistro(registro(c.id, '2026-09-30', { observacao: '<b>obs</b>', indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: '"><script>' }] }));
    expect((await repo.listarColaboradores())[0].nome).toBe(nome);
    const [r] = await repo.listarRegistros('2026-09-30', '2026-09-30');
    expect(r.observacao).toBe('<b>obs</b>');
    expect(r.indisponiveis[0].motivo).toBe('"><script>');
  });

  it('assinarMudancas devolve a função que cancela a assinatura', async () => {
    const cancelar = repo.assinarMudancas(() => {}, () => {});
    expect(typeof cancelar).toBe('function');
    cancelar();
  });
});

describe('repositório no Supabase', () => {
  let banco;
  let repo;
  beforeEach(() => {
    banco = criarSupabaseFalso();
    repo = criarRepositorioSupabase(banco);
  });

  const comHorarios = async () => {
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await repo.salvarRegistro(registro(c.id, '2026-09-30', { indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: 'antigo' }] }));
    return c;
  };

  const novos = (c) => registro(c.id, '2026-09-30', { indisponiveis: [{ inicio: '14:00', fim: '15:00', motivo: 'novo' }] });

  it('insere os horários novos ANTES de apagar os antigos', async () => {
    const c = await comHorarios();
    banco.chamadas.length = 0;
    await repo.salvarRegistro(novos(c));
    const nosHorarios = banco.chamadas.filter((q) => q.tabela === 'unavailable_slots' && q.op !== 'select').map((q) => q.op);
    expect(nosHorarios).toEqual(['insert', 'delete']);
  });

  it('se a inserção dos novos falhar, os horários antigos continuam lá', async () => {
    const c = await comHorarios();
    banco.falharQuando((q) => (q.tabela === 'unavailable_slots' && q.op === 'insert' ? 'TypeError: Failed to fetch' : null));
    await expect(repo.salvarRegistro(novos(c))).rejects.toThrow(/Failed to fetch/);
    banco.falharQuando(null);
    const [r] = await repo.listarRegistros('2026-09-30', '2026-09-30');
    expect(r.indisponiveis).toEqual([{ inicio: '08:00', fim: '09:00', motivo: 'antigo' }]);
  });

  it('se apagar os antigos falhar, nada se perde: os novos já estão gravados e o erro aparece', async () => {
    const c = await comHorarios();
    banco.falharQuando((q) => (q.tabela === 'unavailable_slots' && q.op === 'delete' ? 'TypeError: Failed to fetch' : null));
    await expect(repo.salvarRegistro(novos(c))).rejects.toThrow();
    banco.falharQuando(null);
    const [r] = await repo.listarRegistros('2026-09-30', '2026-09-30');
    expect(r.indisponiveis.map((h) => h.motivo)).toEqual(['antigo', 'novo']);
  });

  it('apaga só os horários que existiam antes: um gravado por outra pessoa no meio fica', async () => {
    const c = await comHorarios();
    const entrada = banco.tabelas.daily_entries[0];
    // Outra pessoa grava um horário entre a leitura dos antigos e a exclusão deles.
    banco.falharQuando((q) => {
      if (q.tabela === 'unavailable_slots' && q.op === 'insert' && !banco._alheio) {
        banco._alheio = true;
        banco.tabelas.unavailable_slots.push({ id: 'alheio', entry_id: entrada.id, start_time: '18:00:00', end_time: '19:00:00', reason: 'alheio' });
      }
      return null;
    });
    await repo.salvarRegistro(novos(c));
    const [r] = await repo.listarRegistros('2026-09-30', '2026-09-30');
    expect(r.indisponiveis.map((h) => h.motivo)).toEqual(['novo', 'alheio']);
  });

  it(`consulta os horários em lotes de ${LOTE} ids`, async () => {
    expect(LOTE).toBe(100);
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    for (let i = 0; i < 250; i++) {
      banco.tabelas.daily_entries.push({ id: `e${i}`, collaborator_id: c.id, date: '2026-09-30', presencial: true, observation: '' });
    }
    banco.chamadas.length = 0;
    await repo.listarRegistros('2026-09-01', '2026-09-30');
    const lotes = banco.chamadas.filter((q) => q.tabela === 'unavailable_slots').map((q) => q.filtros.find((f) => f[0] === 'in')[2].length);
    expect(lotes).toEqual([100, 100, 50]);
  });

  it('não consulta horários quando não há registro', async () => {
    await repo.listarRegistros('2026-09-01', '2026-09-30');
    expect(banco.chamadas.some((q) => q.tabela === 'unavailable_slots')).toBe(false);
  });

  // Sem fallback silencioso para o localStorage: cada pessoa gravaria no próprio navegador
  // achando que gravou no banco da mesa.
  it('erro de rede vira erro, com a mensagem, e nada cai no modo local', async () => {
    banco.falharQuando(() => 'TypeError: Failed to fetch');
    await expect(repo.listarColaboradores()).rejects.toThrow(/Failed to fetch/);
    await expect(repo.adicionarColaborador('Ana', '#6366f1')).rejects.toThrow();
    expect(repo.modo).toBe('supabase');
  });

  it('erro do banco (restrição violada) também aparece', async () => {
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await expect(repo.salvarRegistro(registro(c.id, '2026-09-30', { indisponiveis: [{ inicio: '10:00', fim: '09:00', motivo: '' }] }))).rejects.toThrow(/check/);
  });

  it('escuta as três tabelas e cancela o canal', () => {
    const aoMudar = vi.fn();
    const aoStatus = vi.fn();
    const cancelar = repo.assinarMudancas(aoMudar, aoStatus);
    expect(banco.canais).toHaveLength(1);
    const tabelas = banco.canais[0].assinaturas.filter((a) => a.tipo === 'postgres_changes').map((a) => a.filtro.table);
    expect(tabelas.sort()).toEqual(['collaborators', 'daily_entries', 'unavailable_slots']);
    expect(aoStatus).toHaveBeenLastCalledWith('AO_VIVO');
    banco.emitir('daily_entries');
    expect(aoMudar).toHaveBeenCalledTimes(1);
    cancelar();
    expect(banco.canais).toHaveLength(0);
  });
});

describe('repositório no localStorage', () => {
  it(`usa a chave ${CHAVE_LOCAL} e lê o formato gravado pelo app original`, async () => {
    expect(CHAVE_LOCAL).toBe('presenca_app_data');
    const original = {
      collaborators: [{ id: 'local-1', name: 'Ana', color: '#6366f1', created_at: '2026-09-01T10:00:00.000Z' }],
      entries: { '2026-09-30': { 'local-1': { presencial: true, obs: 'obs', unavailable: [{ start: '08:00', end: '09:00', reason: 'médico' }] } } }
    };
    const repo = criarRepositorioLocal(armazenamentoFalso({ presenca_app_data: JSON.stringify(original) }));
    expect(await repo.listarColaboradores()).toEqual([{ id: 'local-1', nome: 'Ana', cor: '#6366f1' }]);
    expect(await repo.listarRegistros('2026-09-30', '2026-09-30')).toEqual([
      { data: '2026-09-30', colaboradorId: 'local-1', presencial: true, observacao: 'obs', indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: 'médico' }] }
    ]);
  });

  it('grava no formato do app original', async () => {
    const armazenamento = armazenamentoFalso();
    const repo = criarRepositorioLocal(armazenamento);
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await repo.salvarRegistro(registro(c.id, '2026-09-30', { observacao: 'x', indisponiveis: [{ inicio: '08:00', fim: '09:00', motivo: 'y' }] }));
    const gravado = JSON.parse(armazenamento.dados.get('presenca_app_data'));
    expect(gravado.collaborators[0]).toMatchObject({ id: c.id, name: 'Ana', color: '#6366f1' });
    expect(gravado.entries['2026-09-30'][c.id]).toEqual({ presencial: true, obs: 'x', unavailable: [{ start: '08:00', end: '09:00', reason: 'y' }] });
  });

  // O app original engolia o erro com um console.warn: o registro sumia sem ninguém saber.
  it('armazenamento cheio ou bloqueado vira erro visível', async () => {
    const repo = criarRepositorioLocal({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
    await expect(repo.adicionarColaborador('Ana', '#6366f1')).rejects.toThrow(/navegador/);
  });

  it('não quebra com dado corrompido', async () => {
    const repo = criarRepositorioLocal(armazenamentoFalso({ presenca_app_data: '{quebrado' }));
    expect(await repo.listarColaboradores()).toEqual([]);
  });

  it('valida o horário como o banco: início antes do fim', async () => {
    const repo = criarRepositorioLocal(armazenamentoFalso());
    const c = await repo.adicionarColaborador('Ana', '#6366f1');
    await expect(repo.salvarRegistro(registro(c.id, '2026-09-30', { indisponiveis: [{ inicio: '10:00', fim: '09:00', motivo: '' }] }))).rejects.toThrow();
  });
});
