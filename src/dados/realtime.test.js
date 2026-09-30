import { describe, expect, it, vi } from 'vitest';
import { assinarTabelas } from './realtime.js';

/**
 * Um canal de mentira que se comporta como o do servidor real, medido em 30/09/2026 contra o
 * projeto da mesa: primeiro o SUBSCRIBED; ~150 ms depois, o aviso de sistema "Subscribed to
 * PostgreSQL". Só a partir desse aviso as mudanças do banco chegam.
 */
const clienteFalso = () => {
  const canais = [];
  return {
    canais,
    channel(nome) {
      const canal = {
        nome,
        ouvintes: [],
        on(tipo, filtro, callback) {
          canal.ouvintes.push({ tipo, filtro, callback });
          return canal;
        },
        subscribe(aoStatus) {
          canal.aoStatus = aoStatus;
          return canal;
        },
        sistema(payload) {
          for (const o of canal.ouvintes) if (o.tipo === 'system') o.callback(payload);
        },
        mudanca(tabela) {
          for (const o of canal.ouvintes) if (o.tipo === 'postgres_changes' && o.filtro.table === tabela) o.callback({ table: tabela });
        }
      };
      canais.push(canal);
      return canal;
    },
    removeChannel(canal) {
      canais.splice(canais.indexOf(canal), 1);
    }
  };
};

const PRONTO = { message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes', channel: 'x' };

describe('assinarTabelas', () => {
  it('escuta todos os eventos de cada tabela pedida', () => {
    const cliente = clienteFalso();
    const aoMudar = vi.fn();
    assinarTabelas(cliente, 'canal', ['a', 'b'], aoMudar, () => {});
    const [canal] = cliente.canais;
    expect(canal.ouvintes.filter((o) => o.tipo === 'postgres_changes').map((o) => o.filtro)).toEqual([
      { event: '*', schema: 'public', table: 'a' },
      { event: '*', schema: 'public', table: 'b' }
    ]);
    canal.mudanca('b');
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  // O SUBSCRIBED vem antes de o banco começar a repassar mudanças: "ao vivo" nele seria mentira,
  // e uma gravação nesse intervalo se perderia sem ninguém saber.
  it('só diz AO_VIVO depois do aviso "Subscribed to PostgreSQL", não no SUBSCRIBED', () => {
    const cliente = clienteFalso();
    const aoStatus = vi.fn();
    assinarTabelas(cliente, 'canal', ['a'], () => {}, aoStatus);
    const [canal] = cliente.canais;
    canal.aoStatus('SUBSCRIBED');
    expect(aoStatus).toHaveBeenLastCalledWith('CONECTANDO');
    canal.sistema(PRONTO);
    expect(aoStatus).toHaveBeenLastCalledWith('AO_VIVO');
  });

  it('avisa ERRO quando o canal cai, expira ou o banco recusa a inscrição', () => {
    const cliente = clienteFalso();
    const aoStatus = vi.fn();
    assinarTabelas(cliente, 'canal', ['a'], () => {}, aoStatus);
    const [canal] = cliente.canais;
    for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      canal.aoStatus(status, new Error(status));
      expect(aoStatus).toHaveBeenLastCalledWith('ERRO', expect.any(Error));
    }
    canal.sistema({ ...PRONTO, status: 'error', message: 'falhou' });
    expect(aoStatus).toHaveBeenLastCalledWith('ERRO', expect.objectContaining({ status: 'error' }));
  });

  it('ignora aviso de sistema de outra extensão', () => {
    const cliente = clienteFalso();
    const aoStatus = vi.fn();
    assinarTabelas(cliente, 'canal', ['a'], () => {}, aoStatus);
    cliente.canais[0].sistema({ extension: 'presence', status: 'ok' });
    expect(aoStatus).not.toHaveBeenCalled();
  });

  it('devolve a função que cancela o canal', () => {
    const cliente = clienteFalso();
    const cancelar = assinarTabelas(cliente, 'canal', ['a'], () => {}, () => {});
    cancelar();
    expect(cliente.canais).toHaveLength(0);
  });
});
