-- ============================================
--   PRESENÇA - Schema do banco (Supabase / Postgres)
-- ============================================
-- Reconstruído a partir do que js/api.js espera do banco.
-- Para criar um projeto novo: cole tudo no SQL Editor do Supabase e execute.

-- ─── Colaboradores ───
create table if not exists public.collaborators (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    color       text not null,
    created_at  timestamptz not null default now()
);

-- ─── Registro diário (um por colaborador por dia) ───
create table if not exists public.daily_entries (
    id               uuid primary key default gen_random_uuid(),
    collaborator_id  uuid not null references public.collaborators (id) on delete cascade,
    date             date not null,
    presencial       boolean not null default false,
    observation      text not null default '',
    -- api.saveEntry faz upsert com onConflict 'collaborator_id, date'
    unique (collaborator_id, date)
);

create index if not exists daily_entries_date_idx on public.daily_entries (date);

-- ─── Horários indisponíveis de um registro diário ───
create table if not exists public.unavailable_slots (
    id          uuid primary key default gen_random_uuid(),
    entry_id    uuid not null references public.daily_entries (id) on delete cascade,
    start_time  time not null,
    end_time    time not null,
    reason      text not null default '',
    check (start_time < end_time)
);

create index if not exists unavailable_slots_entry_id_idx on public.unavailable_slots (entry_id);

-- ─── RLS ───
-- O app não tem login: qualquer pessoa com a URL do site lê e escreve com a chave anon.
alter table public.collaborators     enable row level security;
alter table public.daily_entries     enable row level security;
alter table public.unavailable_slots enable row level security;

create policy "acesso publico" on public.collaborators     for all to anon, authenticated using (true) with check (true);
create policy "acesso publico" on public.daily_entries     for all to anon, authenticated using (true) with check (true);
create policy "acesso publico" on public.unavailable_slots for all to anon, authenticated using (true) with check (true);

-- ─── Realtime (atualização ao vivo entre abas/usuários) ───
alter publication supabase_realtime add table
    public.collaborators,
    public.daily_entries,
    public.unavailable_slots;
