-- ETAPA 5 — PARTE C de 3 (confirmação, desconexão, políticas)
-- Rode depois da parte B, em uma aba nova.

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

drop policy if exists "Ler casal do membro" on public.couples;
create policy "Ler casal do membro" on public.couples for select
  using (public.is_couple_member_any(id));

drop policy if exists "Ler membros do casal" on public.couple_members;
create policy "Ler membros do casal" on public.couple_members for select
  using (public.is_couple_member_any(couple_id));

drop policy if exists "Perfil próprio ou do parceiro" on public.profiles;
create policy "Perfil próprio ou do parceiro" on public.profiles for select
  using (id = auth.uid() or public.is_partner(id) or public.is_invited_by(id));

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
