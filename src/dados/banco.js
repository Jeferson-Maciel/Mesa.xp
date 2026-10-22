import { createClient } from '@supabase/supabase-js';
import { resolverConfig } from './config.js';

/**
 * A conexão com o banco da mesa (Supabase), uma só para o app inteiro.
 *
 * Calendário e Operacional falam com o mesmo projeto. Um cliente por módulo abriria duas conexões
 * do Realtime e dois clientes de autenticação na mesma página; aqui o primeiro módulo que abre cria
 * a conexão, e o segundo reaproveita. Quem só usa Ordens e Renda Fixa nunca chega a criá-la.
 *
 * O cliente vem empacotado no build (nada de CDN: o arquivo único não busca script nenhum na rede).
 * O app não tem login, então a autenticação fica desligada: nada de sessão gravada no navegador nem
 * de leitura de token no hash da URL — que aqui é a rota das abas.
 *
 * Cada requisição tem 15 segundos. Sem limite, uma rede travada deixaria a tela esperando para
 * sempre; com ele, a espera vira um erro na tela, com o botão de tentar de novo.
 */

const TEMPO_LIMITE_MS = 15_000;

/**
 * Quantas vezes o supabase-js repete, sozinho, a leitura (GET) que caiu na rede: 3, depois de 1, 2 e
 * 4 s. A gravação não é repetida. Com isso o erro de rede chegava à tela uns 12 s depois da queda; a
 * cada tentativa que falha, quem está ouvindo (`aoFalharTentativa`) é avisado, e a tela diz
 * "tentando conectar" já na primeira. `banco.test.js` confere o número contra o supabase-js de
 * verdade.
 */
export const TENTATIVAS_A_MAIS = 3;
const REPETIDOS = ['GET', 'HEAD', 'OPTIONS'];

const ouvintes = new Set();

/**
 * Ouve as tentativas que falham na rede, de qualquer módulo. Recebe `{ url, falha, de, ultima }`:
 * `falha` é a contagem desta requisição (1, 2…), `de` o total que ela terá e `ultima` diz que o erro
 * vem em seguida.
 * @returns {() => void} para de ouvir
 */
export const aoFalharTentativa = (ouvinte) => {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
};

const avisarFalha = (url, opcoes) => {
  const repete = REPETIDOS.includes((opcoes.method ?? 'GET').toUpperCase());
  const de = repete ? 1 + TENTATIVAS_A_MAIS : 1;
  const falha = 1 + (Number(new Headers(opcoes.headers).get('X-Retry-Count')) || 0);
  const aviso = { url: String(url), falha, de, ultima: falha >= de };
  for (const ouvinte of ouvintes) ouvinte(aviso);
};

const fetchComTempo = (fetchBase) => async (url, opcoes = {}) => {
  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS);
  const signal = opcoes.signal ? AbortSignal.any([opcoes.signal, limite]) : limite;
  try {
    return await fetchBase(url, { ...opcoes, signal });
  } catch (erro) {
    // Cancelada por quem pediu não é queda de rede (o tempo esgotado sai como TimeoutError).
    if (erro?.name !== 'AbortError') avisarFalha(url, opcoes);
    throw erro;
  }
};

/** @param {{ fetch?: typeof fetch }} [opcoes] o `fetch` só muda nos testes. */
export const criarCliente = (url, chave, { fetch: fetchBase = (...a) => fetch(...a) } = {}) =>
  createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchComTempo(fetchBase) }
  });

let conexao = null;

/**
 * @returns {{ config: ReturnType<typeof resolverConfig>, cliente: import('@supabase/supabase-js').SupabaseClient | null }}
 *   `cliente` é null no modo local e na configuração inválida.
 */
export const conexaoDoBanco = () => {
  if (conexao) return conexao;
  const config = resolverConfig({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
  });
  conexao = { config, cliente: config.modo === 'supabase' ? criarCliente(config.url, config.chave) : null };
  return conexao;
};
