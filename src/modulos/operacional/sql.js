/**
 * Gera o supabase/operacional.sql: tabelas, travas, histórico, RLS, Realtime e a semente do Slab.
 *
 * O SQL sai deste módulo, e não é escrito à mão, para a semente do banco e a do modo local serem a
 * mesma coisa (`conteudo.js`). `sql.test.js` confere que o arquivo versionado é o que este módulo
 * gera; ao mudar a semente, rode `npm run sql:operacional`.
 *
 * Pode rodar de novo no mesmo banco: tudo é `if not exists` / `on conflict do nothing`, e um post que
 * a mesa já editou não volta para a versão da semente.
 */

const literal = (texto) => `'${String(texto).replace(/'/g, "''")}'`;

// Texto longo com aspas e quebras vai em dollar quoting, sem escapar nada.
const bloco = (texto) => {
  if (texto.includes('$slab$')) throw new Error('o texto contém $slab$');
  return `$slab$${texto}$slab$`;
};

const ESQUEMA = `-- ============================================
--   MESA XP — Operacional (base de conhecimento da mesa)
-- ============================================
-- GERADO por scripts/gerar-sql-operacional.mjs a partir de src/modulos/operacional/conteudo.js.
-- Não edite à mão: mude a semente e rode \`npm run sql:operacional\`.
--
-- Para criar: cole tudo no SQL Editor do Supabase e execute. Pode rodar de novo: não duplica nada
-- e não desfaz o que a mesa já editou.

-- ─── Tópicos ───
create table if not exists public.operacional_topicos (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    nome        text not null check (char_length(btrim(nome)) between 2 and 80),
    descricao   text not null default '',
    pai_id      uuid references public.operacional_topicos (id) on delete restrict,
    ordem       integer not null default 0,
    criado_em   timestamptz not null default now()
);

-- ─── Posts ───
-- Excluir é esconder: o app marca excluido_em e o post continua aqui.
-- versao sobe a cada gravação; o app só grava por cima da versão que abriu.
create table if not exists public.operacional_posts (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null unique,
    topico_id     uuid not null references public.operacional_topicos (id) on delete restrict,
    titulo        text not null check (char_length(btrim(titulo)) between 2 and 160),
    conteudo      text not null default '',
    ordem         integer not null default 0,
    versao        integer not null default 1,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    excluido_em   timestamptz
);

create index if not exists operacional_posts_topico_idx on public.operacional_posts (topico_id);

-- ─── Histórico ───
-- Cada versão de cada post, gravada pelo gatilho abaixo. Sem login, qualquer um com o link edita;
-- daqui dá para recuperar um texto apagado ou estragado (pelo painel do Supabase).
create table if not exists public.operacional_revisoes (
    id          bigint generated always as identity primary key,
    post_id     uuid not null references public.operacional_posts (id) on delete cascade,
    versao      integer not null,
    topico_id   uuid not null,
    titulo      text not null,
    conteudo    text not null,
    excluido_em timestamptz,
    gravado_em  timestamptz not null default now()
);

create index if not exists operacional_revisoes_post_idx on public.operacional_revisoes (post_id, versao);

create or replace function public.operacional_carimbar() returns trigger
    language plpgsql as $$
begin
    new.atualizado_em := now();
    return new;
end;
$$;

drop trigger if exists operacional_posts_carimbo on public.operacional_posts;
create trigger operacional_posts_carimbo before update on public.operacional_posts
    for each row execute function public.operacional_carimbar();

-- security definer: grava o histórico mesmo sem a chave anon ter acesso à tabela de revisões.
create or replace function public.operacional_guardar_revisao() returns trigger
    language plpgsql security definer set search_path = public as $$
begin
    insert into public.operacional_revisoes (post_id, versao, topico_id, titulo, conteudo, excluido_em)
    values (new.id, new.versao, new.topico_id, new.titulo, new.conteudo, new.excluido_em);
    return new;
end;
$$;

drop trigger if exists operacional_posts_revisao on public.operacional_posts;
create trigger operacional_posts_revisao after insert or update on public.operacional_posts
    for each row execute function public.operacional_guardar_revisao();

-- ─── RLS ───
-- O app não tem login (pendência de segurança da fase 2, ver CLAUDE.md): a chave anon lê, cria e
-- altera tópicos e posts. De propósito, NÃO há política de DELETE — nada é apagado pelo app — e a
-- tabela de revisões não tem política nenhuma: só o painel do Supabase a lê.
alter table public.operacional_topicos  enable row level security;
alter table public.operacional_posts    enable row level security;
alter table public.operacional_revisoes enable row level security;

drop policy if exists "operacional ler"     on public.operacional_topicos;
drop policy if exists "operacional criar"   on public.operacional_topicos;
drop policy if exists "operacional alterar" on public.operacional_topicos;
create policy "operacional ler"     on public.operacional_topicos for select to anon, authenticated using (true);
create policy "operacional criar"   on public.operacional_topicos for insert to anon, authenticated with check (true);
create policy "operacional alterar" on public.operacional_topicos for update to anon, authenticated using (true) with check (true);

drop policy if exists "operacional ler"     on public.operacional_posts;
drop policy if exists "operacional criar"   on public.operacional_posts;
drop policy if exists "operacional alterar" on public.operacional_posts;
create policy "operacional ler"     on public.operacional_posts for select to anon, authenticated using (true);
create policy "operacional criar"   on public.operacional_posts for insert to anon, authenticated with check (true);
create policy "operacional alterar" on public.operacional_posts for update to anon, authenticated using (true) with check (true);

-- ─── Realtime ───
do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'operacional_topicos') then
        alter publication supabase_realtime add table public.operacional_topicos;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'operacional_posts') then
        alter publication supabase_realtime add table public.operacional_posts;
    end if;
end;
$$;
`;

/** @param {{ TOPICOS: object[], POSTS: object[] }} semente */
export const gerarSql = ({ TOPICOS, POSTS }) => {
  const [raiz, ...filhos] = TOPICOS;

  const topicos = `insert into public.operacional_topicos (slug, nome, descricao, pai_id, ordem)
values (${literal(raiz.slug)}, ${literal(raiz.nome)}, ${literal(raiz.descricao)}, null, ${raiz.ordem})
on conflict (slug) do nothing;

insert into public.operacional_topicos (slug, nome, descricao, pai_id, ordem)
select v.slug, v.nome, v.descricao, pai.id, v.ordem
from (values
${filhos.map((t) => `    (${literal(t.slug)}, ${literal(t.nome)}, ${literal(t.descricao)}, ${literal(t.pai)}, ${t.ordem})`).join(',\n')}
) as v (slug, nome, descricao, pai, ordem)
join public.operacional_topicos pai on pai.slug = v.pai
on conflict (slug) do nothing;`;

  const posts = `insert into public.operacional_posts (slug, topico_id, titulo, conteudo, ordem)
select v.slug, t.id, v.titulo, v.conteudo, v.ordem
from (values
${POSTS.map((p) => `    (${literal(p.slug)}, ${literal(p.topico)}, ${literal(p.titulo)}, ${bloco(p.conteudo)}, ${p.ordem})`).join(',\n')}
) as v (slug, topico, titulo, conteudo, ordem)
join public.operacional_topicos t on t.slug = v.topico
on conflict (slug) do nothing;`;

  return `${ESQUEMA}
-- ─── Semente: a cópia do Slab da mesa (30/09/2026) ───
-- Posts com conteúdo vazio vieram do Slab só com o título.
${topicos}

${posts}
`;
};
