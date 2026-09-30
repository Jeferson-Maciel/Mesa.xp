import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as semente from './conteudo.js';
import { gerarSql } from './sql.js';

const sql = gerarSql(semente);

describe('supabase/operacional.sql', () => {
  it('é exatamente o que a semente gera: rode `npm run sql:operacional` ao mudar conteudo.js', () => {
    const versionado = readFileSync(fileURLToPath(new URL('../../../supabase/operacional.sql', import.meta.url)), 'utf8');
    expect(versionado).toBe(sql);
  });

  it('semeia os seis tópicos e os 34 posts, sem duplicar ao rodar de novo', () => {
    for (const t of semente.TOPICOS) expect(sql).toContain(`'${t.slug}'`);
    for (const p of semente.POSTS) expect(sql).toContain(`('${p.slug}', '${p.topico}',`);
    expect(sql.match(/on conflict \(slug\) do nothing/g)).toHaveLength(3);
  });

  it('leva o texto do Slab intacto, em dollar quoting', () => {
    expect(sql).toContain('$slab$Prezado(a) CLIENTE,\nConforme conversado');
    expect(sql).toContain('*Oportunidades de RENDA FIXA hoje!* ⭐');
  });

  // Sem login, a chave anon edita. Apagar, não: nem post, nem tópico, nem histórico.
  it('não dá à chave anon política de DELETE, e o histórico fica fora do alcance dela', () => {
    expect(sql).not.toMatch(/for delete/i);
    expect(sql).not.toMatch(/for all/i);
    expect(sql).not.toMatch(/create policy[^;]*operacional_revisoes/i);
    expect(sql).toMatch(/after insert or update on public\.operacional_posts/);
  });

  it('põe tópicos e posts no Realtime sem quebrar ao rodar de novo', () => {
    expect(sql).toContain("tablename = 'operacional_posts'");
    expect(sql).toContain('alter publication supabase_realtime add table public.operacional_topicos;');
  });
});
