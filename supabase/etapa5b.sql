-- ETAPA 5 — PARTE B de 3 (funções)
-- Rode depois da parte A, em uma aba nova.

create or replace function public.is_couple_member(p_couple uuid, p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.couple_members m
    join public.couples c on c.id = m.couple_id
    where m.couple_id = p_couple and m.user_id = p_user
      and m.status = 'active' and c.status = 'active'
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
    where mine.user_id = auth.uid() and theirs.user_id = p_user
      and mine.status = 'active' and theirs.status = 'active'
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
    where mine.user_id = auth.uid() and mine.status = 'pending'
      and theirs.user_id = p_user and theirs.role = 'owner'
  );
end;
$$;

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
  if v_id is null then raise exception 'Código inválido.'; end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Você já pertence a um casal.';
  end if;
  select count(*) into v_count from public.couple_members where couple_id = v_id;
  if v_count >= 2 then raise exception 'Este casal já tem duas pessoas.'; end if;
  insert into public.couple_members (couple_id, user_id, role, status)
  values (v_id, auth.uid(), 'partner', 'pending');
  return v_id;
end;
$$;

-- Fim da parte B.
