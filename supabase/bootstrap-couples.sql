-- =====================================================================
-- US — Our Universe | Bootstrap mínimo de casais
-- =====================================================================
-- Use este arquivo se o schema completo falhou. Ele cria somente o
-- necessário para "Criar casal" e "Entrar no casal" funcionarem.
-- Depois rode o schema.sql completo em uma ABA NOVA do SQL Editor.
-- É seguro executar mais de uma vez.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. Perfis (precisa existir antes de couples, por causa da FK)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Casais
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Nosso universo',
  since date,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Membros do casal
create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;

-- 4. Funções auxiliares (plpgsql: corpo validado só na execução)
create or replace function public.is_couple_member(p_couple uuid, p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members
    where couple_id = p_couple and user_id = p_user
  );
end;
$$;

create or replace function public.is_partner(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
end;
$$;

-- 5. Perfil automático para cada conta nova
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

-- 6. Políticas RLS
drop policy if exists "Perfil próprio" on public.profiles;
create policy "Perfil próprio" on public.profiles for select
  using (id = auth.uid() or public.is_partner(id));
drop policy if exists "Inserir próprio perfil" on public.profiles;
create policy "Inserir próprio perfil" on public.profiles for insert
  with check (id = auth.uid());
drop policy if exists "Atualizar próprio perfil" on public.profiles;
create policy "Atualizar próprio perfil" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Ler casal do membro" on public.couples;
create policy "Ler casal do membro" on public.couples for select
  using (public.is_couple_member(id));
drop policy if exists "Criar próprio casal" on public.couples;
create policy "Criar próprio casal" on public.couples for insert
  with check (created_by = auth.uid());
drop policy if exists "Atualizar casal do membro" on public.couples;
create policy "Atualizar casal do membro" on public.couples for update
  using (public.is_couple_member(id));

drop policy if exists "Ler membros do casal" on public.couple_members;
create policy "Ler membros do casal" on public.couple_members for select
  using (public.is_couple_member(couple_id));
drop policy if exists "Dono adiciona membro" on public.couple_members;
create policy "Dono adiciona membro" on public.couple_members for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.couples c where c.id = couple_id and c.created_by = auth.uid()
    )
  );

-- 7. RPCs usados pelo app
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
  insert into public.couples (created_by, name, since, invite_code)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Nosso universo'), p_since, v_code)
  returning id into v_id;
  insert into public.couple_members (couple_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

create or replace function public.join_couple_with_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_count int;
begin
  select id into v_id from public.couples
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
  insert into public.couple_members (couple_id, user_id, role)
  values (v_id, auth.uid(), 'partner');
  return v_id;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.create_couple(text, date) to authenticated;
grant execute on function public.join_couple_with_code(text) to authenticated;
grant execute on function public.is_couple_member(uuid, uuid) to authenticated;
grant execute on function public.is_partner(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Fim do bootstrap de casais.
