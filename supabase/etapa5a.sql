-- ETAPA 5 — PARTE A de 3 (estrutura)
-- Rode em uma aba nova. Depois rode etapa5b.sql e etapa5c.sql.

alter table public.couples
  add column if not exists status text not null default 'pending';

alter table public.couple_members
  add column if not exists status text not null default 'active';

do $$
begin
  alter table public.couples
    add constraint couples_status_check check (status in ('pending','active','disconnected'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.couple_members
    add constraint couple_members_status_check check (status in ('pending','active'));
exception when duplicate_object then null;
end $$;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Ler preferências próprias" on public.user_settings;
create policy "Ler preferências próprias" on public.user_settings for select
  using (user_id = auth.uid());

drop policy if exists "Salvar preferências próprias" on public.user_settings;
create policy "Salvar preferências próprias" on public.user_settings for insert
  with check (user_id = auth.uid());

drop policy if exists "Atualizar preferências próprias" on public.user_settings;
create policy "Atualizar preferências próprias" on public.user_settings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Fim da parte A.
