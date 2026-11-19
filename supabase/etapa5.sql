-- =====================================================================
-- US — Our Universe | ETAPA 5
-- Conexão confirmada, desconexão, dados individuais e autoria
-- =====================================================================
-- Executar DEPOIS do bootstrap-couples.sql (ou depois do schema.sql).
-- Seguro executar mais de uma vez.
-- RLS habilitado logo após cada tabela.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estado da conexão
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 2. Dados individuais (um registro por conta, nunca compartilhado)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. Funções de vínculo
--    - is_couple_member: apenas vínculo ATIVO (usado nos dados compartilhados)
--    - is_couple_member_any: qualquer vínculo (usado só para ler o casal)
--    - is_partner: dois membros ativos
--    - is_invited_by: convite pendente recebido de determinada conta
-- ---------------------------------------------------------------------
create or replace function public.is_couple_member(p_couple uuid, p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members m
    join public.couples c on c.id = m.couple_id
    where m.couple_id = p_couple
      and m.user_id = p_user
      and m.status = 'active'
      and c.status = 'active'
  );
end;
$$;

create or replace function public.is_couple_member_any(p_couple uuid, p_user uuid default auth.uid())
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
    join public.couples c on c.id = mine.couple_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user
      and mine.status = 'active'
      and theirs.status = 'active'
      and c.status = 'active'
  );
end;
$$;

create or replace function public.is_invited_by(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    where mine.user_id = auth.uid()
      and mine.status = 'pending'
      and theirs.user_id = p_user
      and theirs.role = 'owner'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Criação e aceite (aceite NÃO conecta sozinho: fica pendente)
-- ---------------------------------------------------------------------
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
  -- Entra como PENDENTE: só o dono pode confirmar a conexão.
  insert into public.couple_members (couple_id, user_id, role, status)
  values (v_id, auth.uid(), 'partner', 'pending');
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Confirmação, recusa, desconexão e gerenciamento do convite
-- ---------------------------------------------------------------------
create or replace function public.confirm_connection()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select cm.couple_id into v_id
  from public.couple_members cm
  where cm.user_id = auth.uid() and cm.role = 'owner' and cm.status = 'active';
  if v_id is null then
    raise exception 'Você não é o dono de um casal ativo.';
  end if;
  update public.couple_members set status = 'active'
  where couple_id = v_id and status = 'pending';
  if not found then
    raise exception 'Não há convite pendente.';
  end if;
  update public.couples set status = 'active', updated_at = now() where id = v_id;
  return v_id;
end;
$$;

create or replace function public.reject_connection()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select cm.couple_id into v_id
  from public.couple_members cm
  where cm.user_id = auth.uid() and cm.role = 'owner' and cm.status = 'active';
  if v_id is null then
    raise exception 'Você não é o dono de um casal ativo.';
  end if;
  delete from public.couple_members where couple_id = v_id and status = 'pending';
end;
$$;

create or replace function public.disconnect_couple()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_left int;
begin
  select cm.couple_id into v_id
  from public.couple_members cm
  where cm.user_id = auth.uid() and cm.status = 'active';
  if v_id is null then
    raise exception 'Você não está conectado a um casal.';
  end if;
  delete from public.couple_members where couple_id = v_id and user_id = auth.uid();
  select count(*) into v_left
  from public.couple_members where couple_id = v_id and status = 'active';
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
  select cm.couple_id into v_id
  from public.couple_members cm
  where cm.user_id = auth.uid() and cm.role = 'owner' and cm.status = 'active';
  if v_id is null then
    raise exception 'Você não é o dono de um casal.';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;
  update public.couples set invite_code = v_code, updated_at = now() where id = v_id;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Políticas ajustadas (o dono vê o convite; pendente NÃO lê dados)
-- ---------------------------------------------------------------------
drop policy if exists "Ler casal do membro" on public.couples;
create policy "Ler casal do membro" on public.couples for select
  using (public.is_couple_member_any(id));

drop policy if exists "Ler membros do casal" on public.couple_members;
create policy "Ler membros do casal" on public.couple_members for select
  using (public.is_couple_member_any(couple_id));

drop policy if exists "Perfil próprio ou do parceiro" on public.profiles;
create policy "Perfil próprio ou do parceiro" on public.profiles for select
  using (id = auth.uid() or public.is_partner(id) or public.is_invited_by(id));

-- ---------------------------------------------------------------------
-- 7. Realtime e permissões
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['couples','couple_members','user_settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.is_couple_member(uuid, uuid) to authenticated;
grant execute on function public.is_couple_member_any(uuid, uuid) to authenticated;
grant execute on function public.is_partner(uuid) to authenticated;
grant execute on function public.is_invited_by(uuid) to authenticated;
grant execute on function public.create_couple(text, date) to authenticated;
grant execute on function public.join_couple_with_code(text) to authenticated;
grant execute on function public.confirm_connection() to authenticated;
grant execute on function public.reject_connection() to authenticated;
grant execute on function public.disconnect_couple() to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;

notify pgrst, 'reload schema';

-- Fim da Etapa 5.
