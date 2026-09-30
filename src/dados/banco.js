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

const fetchComTempo = (url, opcoes = {}) => {
  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS);
  const signal = opcoes.signal ? AbortSignal.any([opcoes.signal, limite]) : limite;
  return fetch(url, { ...opcoes, signal });
};

export const criarCliente = (url, chave) =>
  createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchComTempo }
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
