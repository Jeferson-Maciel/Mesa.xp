import { afterEach, describe, expect, it, vi } from 'vitest';
import { aoFalharTentativa, criarCliente, TENTATIVAS_A_MAIS } from './banco.js';

/**
 * A queda de rede avisada na hora (22/10/2026). O supabase-js tenta de novo a leitura que falhou na
 * rede, esperando 1, 2 e 4 s: o erro só chegava à tela uns 12 s depois. Cada tentativa que falha
 * agora é avisada a quem está ouvindo, com a contagem, e a tela diz "tentando conectar" já na
 * primeira. O cliente é o de verdade: se uma versão nova do supabase-js mudar as tentativas, o teste
 * quebra.
 */

const semRede = () => vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));

afterEach(() => vi.useRealTimers());

describe('o cliente do banco avisa cada tentativa que falha', () => {
  it('a leitura que cai na rede avisa as tentativas 1, 2, 3 e 4, de 4, e só então dá o erro', async () => {
    vi.useFakeTimers();
    const fetch = semRede();
    const cliente = criarCliente('https://exemplo.supabase.co', 'chave', { fetch });
    const avisos = [];
    const parar = aoFalharTentativa((a) => avisos.push(a));
    const leitura = cliente.from('collaborators').select('id');
    const resultado = leitura.then((r) => r);
    await vi.advanceTimersByTimeAsync(0);
    expect(avisos).toHaveLength(1); // já na primeira falha, sem esperar
    await vi.runAllTimersAsync();
    const { error } = await resultado;
    parar();
    expect(error?.message).toMatch(/Failed to fetch/);
    expect(TENTATIVAS_A_MAIS).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1 + TENTATIVAS_A_MAIS);
    expect(avisos.map((a) => [a.falha, a.de])).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    expect(avisos.every((a) => a.url.includes('/rest/v1/collaborators'))).toBe(true);
    expect(avisos.map((a) => a.ultima)).toEqual([false, false, false, true]);
  });

  it('a gravação não é repetida pelo supabase-js: uma falha só, já a última', async () => {
    const cliente = criarCliente('https://exemplo.supabase.co', 'chave', { fetch: semRede() });
    const avisos = [];
    const parar = aoFalharTentativa((a) => avisos.push(a));
    await cliente.from('daily_entries').insert([{ date: '2026-10-22' }]);
    parar();
    expect(avisos.map((a) => [a.falha, a.ultima])).toEqual([[1, true]]);
  });

  it('a resposta que chega não avisa nada, e quem parou de ouvir não recebe mais', async () => {
    const ok = vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
    const avisos = [];
    const parar = aoFalharTentativa((a) => avisos.push(a));
    await criarCliente('https://exemplo.supabase.co', 'chave', { fetch: ok }).from('collaborators').select('id');
    parar();
    await criarCliente('https://exemplo.supabase.co', 'chave', { fetch: semRede() }).from('daily_entries').insert([{}]);
    expect(avisos).toEqual([]);
  });
});
