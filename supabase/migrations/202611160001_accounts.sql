-- Run on a separate Supabase test project before production.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_name text not null default 'Chủ Tiệm An' check (char_length(owner_name) between 2 and 30),
  shop_name text not null default 'Tiệm Trà Mây',
  created_at timestamptz not null default now()
);
create table public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table public.game_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  revision bigint not null,
  primary key (user_id, request_id)
);
alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;
alter table public.game_requests enable row level security;
create policy own_profile_read on public.profiles for select to authenticated using (id = auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy own_save_read on public.game_saves for select to authenticated using (user_id = auth.uid());
-- No client write policy on saves or request IDs. Browser-supplied balances are never accepted.
revoke all on public.profiles, public.game_saves, public.game_requests from anon, authenticated;
grant select on public.profiles, public.game_saves to authenticated;
grant update(owner_name) on public.profiles to authenticated;
grant all on public.profiles, public.game_saves, public.game_requests to service_role;

create function public.create_may_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  candidate := trim(coalesce(new.raw_user_meta_data->>'owner_name', 'Chủ Tiệm An'));
  if char_length(candidate) not between 2 and 30
     or candidate !~ '^[[:alnum:] .''-]+$'
     or candidate ~* '(địt|lồn|cặc|fuck|shit)' then candidate := 'Chủ Tiệm An'; end if;
  insert into public.profiles(id, owner_name) values(new.id, candidate);
  return new;
end;
$$;
create trigger may_profile_after_signup after insert on auth.users for each row execute function public.create_may_profile();
-- Backfill users that existed before this migration without changing their game data.
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create function public.validate_may_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_name !~ '^[[:alnum:] .''-]+$' or new.owner_name ~* '(địt|lồn|cặc|fuck|shit)' then
    raise exception 'Invalid owner name';
  end if;
  return new;
end;
$$;
create trigger may_profile_before_update before update on public.profiles for each row execute function public.validate_may_profile();

-- Only the verified server function can call this atomic commit. A row lock, expected
-- revision and request ID prevent partial purchases, stale overwrites and double rewards.
create function public.commit_may_action(p_user uuid, p_request uuid, p_expected bigint, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_save public.game_saves%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into current_save from public.game_saves where user_id = p_user for update;
  if found then
    if exists(select 1 from public.game_requests where user_id = p_user and request_id = p_request) then
      return jsonb_build_object('state', current_save.state, 'revision', current_save.revision);
    end if;
    if p_expected is null or p_expected <> current_save.revision then raise sqlstate '40001' using message = 'revision_conflict'; end if;
    update public.game_saves set state = p_state, revision = revision + 1, updated_at = now() where user_id = p_user returning * into current_save;
  else
    if p_expected is not null then raise sqlstate '40001' using message = 'revision_conflict'; end if;
    insert into public.game_saves(user_id, state) values(p_user, p_state) returning * into current_save;
  end if;
  insert into public.game_requests(user_id, request_id, revision) values(p_user, p_request, current_save.revision);
  return jsonb_build_object('state', current_save.state, 'revision', current_save.revision);
end;
$$;
revoke all on function public.commit_may_action(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.commit_may_action(uuid, uuid, bigint, jsonb) to service_role;
revoke all on function public.create_may_profile() from public, anon, authenticated;
revoke all on function public.validate_may_profile() from public, anon, authenticated;
