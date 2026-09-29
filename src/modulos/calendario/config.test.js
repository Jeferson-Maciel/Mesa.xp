import { describe, expect, it } from 'vitest';
import { PADRAO, resolverConfig } from './config.js';

describe('configuração do banco do Calendário', () => {
  it('sem variáveis de ambiente, usa o projeto Supabase atual da mesa', () => {
    expect(resolverConfig({})).toEqual({ modo: 'supabase', url: PADRAO.url, chave: PADRAO.chave });
    expect(PADRAO.url).toBe('https://ekughbuuvjoojgfgbqbz.supabase.co');
    expect(PADRAO.chave.split('.')).toHaveLength(3);
  });

  it('as variáveis VITE_ substituem o padrão', () => {
    expect(resolverConfig({ VITE_SUPABASE_URL: 'https://outro.supabase.co', VITE_SUPABASE_ANON_KEY: 'abc' })).toEqual({
      modo: 'supabase',
      url: 'https://outro.supabase.co',
      chave: 'abc'
    });
  });

  it('as duas vazias ligam o modo local (localStorage)', () => {
    expect(resolverConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' })).toEqual({ modo: 'local' });
    expect(resolverConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: '' })).toEqual({ modo: 'local' });
  });

  // Só uma preenchida é engano de configuração. Cair no modo local seria esconder o erro:
  // cada pessoa gravaria no próprio navegador achando que grava no banco da mesa.
  it('só uma das duas vazia é erro de configuração, não modo local', () => {
    const r = resolverConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'abc' });
    expect(r.modo).toBe('invalido');
    expect(r.erro).toMatch(/VITE_SUPABASE_URL/);
    expect(resolverConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: '' }).modo).toBe('invalido');
  });
});
