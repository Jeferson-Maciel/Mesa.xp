/**
 * Onde o Calendário grava.
 *
 * URL e chave vêm de VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, lidas no build. Sem elas vale o
 * projeto Supabase que a mesa já usa; as duas vazias ligam o modo local, que grava só no
 * navegador (`localStorage`). Só uma das duas vazia é erro de configuração e aparece na tela.
 *
 * A chave anon é pública por desenho — ela vai para o navegador de qualquer jeito. Quem protege os
 * dados são as políticas RLS do banco, e as atuais liberam tudo para a anon: ver a pendência de
 * segurança da fase 2 no CLAUDE.md.
 */

export const PADRAO = {
  url: 'https://ekughbuuvjoojgfgbqbz.supabase.co',
  chave:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdWdoYnV1dmpvb2pnZmdicWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODYwNzcsImV4cCI6MjEwMDc2MjA3N30.r-bohAQamvezhY-O0aVA25XQMlyuFFiihgWbAyhywfU'
};

/**
 * @param {{ VITE_SUPABASE_URL?: string, VITE_SUPABASE_ANON_KEY?: string }} env
 * @returns {{ modo: 'supabase', url: string, chave: string } | { modo: 'local' } | { modo: 'invalido', erro: string }}
 */
export const resolverConfig = (env) => {
  const url = String(env.VITE_SUPABASE_URL ?? PADRAO.url).trim();
  const chave = String(env.VITE_SUPABASE_ANON_KEY ?? PADRAO.chave).trim();

  if (!url && !chave) return { modo: 'local' };
  if (!url || !chave) {
    return {
      modo: 'invalido',
      erro: 'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar as duas preenchidas, ou as duas vazias para o modo local.'
    };
  }
  return { modo: 'supabase', url, chave };
};
