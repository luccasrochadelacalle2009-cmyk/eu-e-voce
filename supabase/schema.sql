-- =====================================================================
-- US — Our Universe | Etapa 4
-- Banco de dados, casais, RLS e sincronização real
-- =====================================================================
-- Execute este arquivo no SQL Editor do Supabase (projeto já criado).
-- Nenhuma chave service_role é usada pelo aplicativo: todo o acesso é
-- feito com a anon/public key + RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensões e funções auxiliares
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Um usuário é membro de um casal?
-- (plpgsql: o corpo só é validado na execução, então pode referenciar
--  couple_members antes da tabela ser criada mais abaixo no script.)
create or replace function public.is_couple_member(p_couple uuid, p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members m
    join public.couples c on c.id = m.couple_id
    where m.couple_id = p_couple and m.user_id = p_user
      and m.status = 'active' and c.status = 'active'
  );
end;
$$;

-- Qualquer vínculo (inclusive pendente): usado apenas para ler dados do casal.
create or replace function public.is_couple_member_any(p_couple uuid, p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members
    where couple_id = p_couple and user_id = p_user
  );
end;
$$;

-- Dois usuários são parceiros ativos no mesmo casal?
create or replace function public.is_partner(p_user uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    join public.couples c on c.id = mine.couple_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
      and mine.status = 'active' and theirs.status = 'active'
      and c.status = 'active'
  );
end;
$$;

-- Esta conta recebeu um convite pendente da conta informada?
create or replace function public.is_invited_by(p_user uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    where mine.user_id = auth.uid() and mine.status = 'pending'
      and theirs.user_id = p_user and theirs.role = 'owner'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Perfis (espelho público de auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.profiles enable row level security;

drop policy if exists "Perfil próprio ou do parceiro" on public.profiles;
create policy "Perfil próprio ou do parceiro"
  on public.profiles for select
  using (id = auth.uid() or public.is_partner(id) or public.is_invited_by(id));

drop policy if exists "Inserir próprio perfil" on public.profiles;
create policy "Inserir próprio perfil"
  on public.profiles for insert with check (id = auth.uid());

drop policy if exists "Atualizar próprio perfil" on public.profiles;
create policy "Atualizar próprio perfil"
  on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Ler preferências próprias" on public.user_settings;
create policy "Ler preferências próprias" on public.user_settings for select
  using (user_id = auth.uid());
drop policy if exists "Salvar preferências próprias" on public.user_settings;
create policy "Salvar preferências próprias" on public.user_settings for insert
  with check (user_id = auth.uid());
drop policy if exists "Atualizar preferências próprias" on public.user_settings;
create policy "Atualizar preferências próprias" on public.user_settings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cria o perfil automaticamente quando uma conta é confirmada.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas criadas ANTES do trigger não têm perfil. Cria agora, sem apagar nada.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Casais e relacionamento entre contas
-- ---------------------------------------------------------------------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Nosso universo',
  since date,
  invite_code text not null unique,
  status text not null default 'pending' check (status in ('pending','active','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couples enable row level security;

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','partner')),
  status text not null default 'active' check (status in ('pending','active')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

alter table public.couple_members enable row level security;

-- Dados estritamente individuais: cada conta só acessa os seus.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;

drop policy if exists "Ler casal do membro" on public.couples;
create policy "Ler casal do membro"
  on public.couples for select using (public.is_couple_member_any(id));

drop policy if exists "Criar próprio casal" on public.couples;
create policy "Criar próprio casal"
  on public.couples for insert with check (created_by = auth.uid());

drop policy if exists "Atualizar casal do membro" on public.couples;
create policy "Atualizar casal do membro"
  on public.couples for update using (public.is_couple_member(id));

drop policy if exists "Ler membros do casal" on public.couple_members;
create policy "Ler membros do casal"
  on public.couple_members for select using (public.is_couple_member_any(couple_id));

drop policy if exists "Dono adiciona membro" on public.couple_members;
create policy "Dono adiciona membro"
  on public.couple_members for insert with check (
    user_id = auth.uid() and exists (
      select 1 from public.couples c where c.id = couple_id and c.created_by = auth.uid()
    )
  );

-- Cria o casal e já vincula o criador.
create or replace function public.create_couple(p_name text default 'Nosso universo', p_since date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
begin
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Você já pertence a um casal.';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (created_by, name, since, invite_code, status)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Nosso universo'), p_since, v_code, 'pending')
  returning id into v_id;

  insert into public.couple_members (couple_id, user_id, role, status)
  values (v_id, auth.uid(), 'owner', 'active');

  return v_id;
end;
$$;

-- Entra em um casal usando o código convidado pelo parceiro.
create or replace function public.join_couple_with_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_count int;
begin
  select id into v_id
  from public.couples
  where invite_code = upper(trim(coalesce(p_code, '')));

  if v_id is null then
    raise exception 'Código inválido.';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Você já pertence a um casal.';
  end if;

  select count(*) into v_count from public.couple_members where couple_id = v_id;
  if v_count >= 2 then
    raise exception 'Este casal já tem duas pessoas.';
  end if;

  -- Entra pendente: ninguém é conectado automaticamente.
  insert into public.couple_members (couple_id, user_id, role, status)
  values (v_id, auth.uid(), 'partner', 'pending');

  return v_id;
end;
$$;

-- Confirmação feita pelo dono do casal.
create or replace function public.confirm_connection()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select cm.couple_id into v_id from public.couple_members cm
  where cm.user_id = auth.uid() and cm.role = 'owner' and cm.status = 'active';
  if v_id is null then raise exception 'Você não é o dono de um casal ativo.'; end if;
  update public.couple_members set status = 'active'
  where couple_id = v_id and status = 'pending';
  if not found then raise exception 'Não há convite pendente.'; end if;
  update public.couples set status = 'active', updated_at = now() where id = v_id;
  return v_id;
end;
$$;

create or replace function public.reject_connection()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select cm.couple_id into v_id from public.couple_members cm
  where cm.user_id = auth.uid() and cm.role = 'owner' and cm.status = 'active';
  if v_id is null then raise exception 'Você não é o dono de um casal ativo.'; end if;
  delete from public.couple_members where couple_id = v_id and status = 'pending';
end;
$$;

create or replace function public.disconnect_couple()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_left int;
begin
  select cm.couple_id into v_id from public.couple_members cm
  where cm.user_id = auth.uid() and cm.status = 'active';
  if v_id is null then raise exception 'Você não está conectado a um casal.'; end if;
  delete from public.couple_members where couple_id = v_id and user_id = auth.uid();
  select count(*) into v_left from public.couple_members
  where couple_id = v_id and status = 'active';
  if v_left = 0 then
    update public.couples set status = 'disconnected', updated_at = now() where id = v_id;
  end if;
end;
$$;

create or replace function public.regenerate_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
begin
  select cm.couple_id into v_id from public.couple_members cm
  where cm.user_id = auth.uid() and cm.role = 'owner' and cm.status = 'active';
  if v_id is null then raise exception 'Você não é o dono de um casal.'; end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;
  update public.couples set invite_code = v_code, updated_at = now() where id = v_id;
  return v_code;
end;
$$;

revoke all on function public.create_couple(text, date) from public;
revoke all on function public.join_couple_with_code(text) from public;
grant execute on function public.create_couple(text, date) to authenticated;
grant execute on function public.join_couple_with_code(text) to authenticated;
grant execute on function public.confirm_connection() to authenticated;
grant execute on function public.reject_connection() to authenticated;
grant execute on function public.disconnect_couple() to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.is_couple_member(uuid, uuid) to authenticated;
grant execute on function public.is_couple_member_any(uuid, uuid) to authenticated;
grant execute on function public.is_partner(uuid) to authenticated;
grant execute on function public.is_invited_by(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Tabelas de conteúdo compartilhado
-- ---------------------------------------------------------------------
-- Todas seguem o mesmo contrato:
--   couple_id  -> casal dono do registro
--   legacy_id  -> id gerado localmente (usado para evitar duplicação)
--   data       -> jsonb com os campos do aplicativo (título, texto, data...)
--   updated_at -> relógio lógico da sincronização (last-write-wins)
--   deleted_at -> tombstone: exclusões também sincronizam
-- ---------------------------------------------------------------------

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.memories enable row level security;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.calendar_events enable row level security;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.plans enable row level security;

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.letters enable row level security;

create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.journal enable row level security;

create table if not exists public.music (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.music enable row level security;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.places enable row level security;

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.answers enable row level security;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  legacy_id text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (couple_id, legacy_id)
);

alter table public.challenges enable row level security;

create table if not exists public.couple_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.couple_settings enable row level security;

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  collection text not null,
  legacy_id text not null,
  winner_updated_at timestamptz,
  loser_payload jsonb not null,
  detected_by uuid references public.profiles(id),
  detected_at timestamptz not null default now()
);

alter table public.sync_conflicts enable row level security;

-- ---------------------------------------------------------------------
-- 4. RLS das tabelas de conteúdo
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'memories','calendar_events','plans','letters','journal',
    'music','places','answers','challenges'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Ler registros do casal" on public.%I', t);
    execute format($p$
      create policy "Ler registros do casal" on public.%I for select
      using (public.is_couple_member(couple_id))
    $p$, t);

    execute format('drop policy if exists "Inserir registros do casal" on public.%I', t);
    execute format($p$
      create policy "Inserir registros do casal" on public.%I for insert
      with check (public.is_couple_member(couple_id) and updated_by = auth.uid())
    $p$, t);

    execute format('drop policy if exists "Atualizar registros do casal" on public.%I', t);
    execute format($p$
      create policy "Atualizar registros do casal" on public.%I for update
      using (public.is_couple_member(couple_id))
      with check (public.is_couple_member(couple_id) and updated_by = auth.uid())
    $p$, t);

    execute format('drop policy if exists "Excluir registros do casal" on public.%I', t);
    execute format($p$
      create policy "Excluir registros do casal" on public.%I for delete
      using (public.is_couple_member(couple_id))
    $p$, t);

    execute format('create index if not exists %I on public.%I (couple_id, updated_at)', t || '_couple_updated_idx', t);
  end loop;
end;
$$;

alter table public.couple_settings enable row level security;
drop policy if exists "Ler configurações do casal" on public.couple_settings;
create policy "Ler configurações do casal" on public.couple_settings for select
  using (public.is_couple_member(couple_id));
drop policy if exists "Inserir configurações do casal" on public.couple_settings;
create policy "Inserir configurações do casal" on public.couple_settings for insert
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());
drop policy if exists "Atualizar configurações do casal" on public.couple_settings;
create policy "Atualizar configurações do casal" on public.couple_settings for update
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

alter table public.sync_conflicts enable row level security;
drop policy if exists "Ler conflitos do casal" on public.sync_conflicts;
create policy "Ler conflitos do casal" on public.sync_conflicts for select
  using (public.is_couple_member(couple_id));
drop policy if exists "Registrar conflitos" on public.sync_conflicts;
create policy "Registrar conflitos" on public.sync_conflicts for insert
  with check (public.is_couple_member(couple_id) and detected_by = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','couples','couple_members','user_settings','memories','calendar_events','plans',
    'letters','journal','music','places','answers','challenges','couple_settings'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Permissões
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Recarrega o cache do PostgREST para as tabelas/funções aparecerem na API.
notify pgrst, 'reload schema';

-- Fim do schema.
