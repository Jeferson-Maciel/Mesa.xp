import { createClient } from '@supabase/supabase-js';

/**
 * O cliente do Supabase, empacotado no build (nada de CDN: o arquivo único não busca script
 * nenhum na rede).
 *
 * O app não tem login, então a parte de autenticação fica desligada: nada de sessão gravada no
 * navegador nem de leitura de token no hash da URL — que aqui é a rota das abas.
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
