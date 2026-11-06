-- GroupOrder schema: docs/structure.md explains the model.
--
-- Security model: clients read through row-level security, and every write that
-- has a business rule goes through a security-definer function below. There are
-- deliberately no insert/update policies on rounds or picks, so a client cannot
-- forge a price, write after the deadline, or finalize without being a leader.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  office_address text,
  lat double precision,
  lng double precision,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- The document's "users" table. Email and password hash live in auth.users.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  avatar text,
  company_id uuid references public.companies on delete set null,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default '🍱' check (char_length(icon) <= 8),
  company_id uuid references public.companies on delete set null,
  -- Default location is the sample office (Teheran-ro 231, Seoul) until groups
  -- and companies can set their own address.
  lat double precision not null default 37.5030,
  lng double precision not null default 127.0436,
  invite_code text not null unique
    default substr(md5(gen_random_uuid()::text), 1, 10),
  default_restaurant_ids uuid[] not null default '{}',
  default_deadline time not null default '11:20',
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('member', 'leader')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cuisine text not null,
  logo text,
  address text,
  lat double precision not null,
  lng double precision not null,
  phone text,
  delivery_link text
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants on delete cascade,
  name text not null,
  photo text,
  price integer not null check (price >= 0),
  -- [{"name": "Spicy level", "choices": ["Mild", "Hot"]}]
  options jsonb not null default '[]'
);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id);

-- One lunch = one round. Stored status only moves on a leader's action:
-- "closing soon" and "closed" are derived from the deadline (see round.ts), so
-- no background job is needed for a round to close on time.
create table public.order_rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  deadline timestamptz not null,
  mode text not null default 'delivery'
    check (mode in ('delivery', 'pickup', 'dine-in')),
  status text not null default 'open'
    check (status in ('open', 'finalized', 'ordered')),
  -- Empty means any nearby restaurant.
  allowed_restaurant_ids uuid[] not null default '{}'
    check (cardinality(allowed_restaurant_ids) <= 3),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index order_rounds_group_idx on public.order_rounds (group_id, created_at desc);
create unique index one_open_round_per_group on public.order_rounds (group_id)
  where status = 'open';

-- One answer per person per round. Cancelling or being removed keeps the row
-- (status changes) so live subscribers always receive an update event.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.order_rounds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  menu_item_id uuid references public.menu_items,
  qty integer not null default 1 check (qty between 1 and 20),
  options jsonb not null default '{}' check (jsonb_typeof(options) = 'object'),
  note text check (char_length(note) <= 200),
  price_at_pick integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'skipped', 'confirmed', 'removed', 'cancelled')),
  updated_at timestamptz not null default now(),
  unique (round_id, user_id),
  check (status in ('skipped', 'cancelled', 'removed') or menu_item_id is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  round_id uuid not null references public.order_rounds on delete cascade,
  type text not null
    check (type in ('reminder_30', 'reminder_10', 'reminder_manual', 'repick', 'ordered')),
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, sent_at desc);
-- Automatic reminders fire once per person; the job can safely run repeatedly.
create unique index one_auto_reminder on public.notifications (user_id, round_id, type)
  where type in ('reminder_30', 'reminder_10');

-- ---------------------------------------------------------------- helpers

-- Security definer so policies on group_members can look at group_members
-- without recursing into themselves.
create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid());
$$;

create function public.is_group_leader(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid() and role = 'leader');
$$;

create function public.shares_group_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user);
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- row-level security

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.order_rounds enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

create policy "members of the company read it" on public.companies for select to authenticated
  using (id = (select company_id from public.profiles where id = auth.uid()));

create policy "read self and groupmates" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "members read their groups" on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy "leaders edit their groups" on public.groups for update to authenticated
  using (public.is_group_leader(id)) with check (public.is_group_leader(id));

create policy "members read the member list" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy "anyone logged in reads restaurants" on public.restaurants for select to authenticated
  using (true);
create policy "anyone logged in reads menus" on public.menu_items for select to authenticated
  using (true);

create policy "members read rounds" on public.order_rounds for select to authenticated
  using (public.is_group_member(group_id));

create policy "members read picks" on public.order_items for select to authenticated
  using (public.is_group_member(
    (select group_id from public.order_rounds r where r.id = round_id)));

create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Row policies cannot limit columns, so narrow what the update policies can touch.
revoke update on public.profiles, public.groups, public.notifications from anon, authenticated;
grant update (name, avatar) on public.profiles to authenticated;
grant update (name, icon, default_restaurant_ids, default_deadline) on public.groups to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------- groups

create function public.create_group(p_name text, p_icon text default '🍱')
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.groups (name, icon, created_by)
    values (trim(p_name), coalesce(nullif(trim(p_icon), ''), '🍱'), auth.uid())
    returning * into v_group;
  insert into public.group_members (group_id, user_id, role)
    values (v_group.id, auth.uid(), 'leader');
  return v_group.invite_code;
end;
$$;

-- What a logged-in visitor sees on an invite link before joining. Knowing the
-- code is the permission, so this reveals nothing beyond the group's face.
create function public.group_preview(p_code text)
returns table (name text, icon text, member_count bigint)
language sql stable security definer set search_path = '' as $$
  select g.name, g.icon, (select count(*) from public.group_members m where m.group_id = g.id)
  from public.groups g
  where g.invite_code = p_code and auth.uid() is not null;
$$;

create function public.join_group(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into v_group from public.groups where invite_code = p_code;
  if v_group is null then raise exception 'invalid_invite_code'; end if;
  insert into public.group_members (group_id, user_id) values (v_group, auth.uid())
    on conflict do nothing;
end;
$$;

create function public.set_member_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_leader(p_group) then raise exception 'leader_only'; end if;
  perform 1 from public.groups where id = p_group for update; -- serialize role changes
  if p_role = 'member' and (select count(*) from public.group_members
      where group_id = p_group and role = 'leader' and user_id <> p_user) = 0 then
    raise exception 'group_needs_a_leader';
  end if;
  update public.group_members set role = p_role where group_id = p_group and user_id = p_user;
end;
$$;

-- Leaders remove anyone; anyone can remove themselves.
create function public.remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_group_leader(p_group)
      or (p_user = auth.uid() and public.is_group_member(p_group))) then
    raise exception 'leader_only';
  end if;
  perform 1 from public.groups where id = p_group for update;
  if (select count(*) from public.group_members
      where group_id = p_group and role = 'leader' and user_id <> p_user) = 0 then
    raise exception 'group_needs_a_leader';
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  update public.order_items i set status = 'cancelled', updated_at = now()
    from public.order_rounds r
    where i.round_id = r.id and r.group_id = p_group and r.status = 'open' and i.user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------- rounds (leader)

create function public.start_round(
  p_group uuid, p_title text, p_deadline timestamptz, p_mode text default 'delivery',
  p_allowed uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_round uuid;
begin
  if not public.is_group_leader(p_group) then raise exception 'leader_only'; end if;
  if p_deadline <= now() then raise exception 'deadline_in_past'; end if;
  if exists (select 1 from public.order_rounds where group_id = p_group and status = 'open') then
    raise exception 'round_already_open';
  end if;
  insert into public.order_rounds (group_id, title, deadline, mode, allowed_restaurant_ids, created_by)
    values (p_group, trim(p_title), p_deadline, p_mode, coalesce(p_allowed, '{}'), auth.uid())
    returning id into v_round;
  return v_round;
end;
$$;

-- Leader may finalize at any time, so absent colleagues never block lunch.
create function public.finalize_round(p_round uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  select * into v_round from public.order_rounds where id = p_round for update;
  if v_round.id is null or not public.is_group_leader(v_round.group_id) then
    raise exception 'leader_only';
  end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  update public.order_rounds set status = 'finalized', finalized_at = now() where id = p_round;
  update public.order_items set status = 'confirmed', updated_at = now()
    where round_id = p_round and status = 'draft';
end;
$$;

create function public.mark_ordered(p_round uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  select * into v_round from public.order_rounds where id = p_round for update;
  if v_round.id is null or not public.is_group_leader(v_round.group_id) then
    raise exception 'leader_only';
  end if;
  if v_round.status <> 'finalized' then raise exception 'round_not_finalized'; end if;
  update public.order_rounds set status = 'ordered' where id = p_round;
  insert into public.notifications (user_id, round_id, type)
    select user_id, p_round, 'ordered' from public.order_items
    where round_id = p_round and status = 'confirmed';
end;
$$;

-- Leader takes a pick out (for example the dish is sold out). The member is told
-- to repick, and may do so even after the deadline until the round is finalized.
create function public.remove_pick(p_round uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  select * into v_round from public.order_rounds where id = p_round;
  if v_round.id is null or not public.is_group_leader(v_round.group_id) then
    raise exception 'leader_only';
  end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  update public.order_items set status = 'removed', updated_at = now()
    where round_id = p_round and user_id = p_user and status = 'draft';
  if found then
    insert into public.notifications (user_id, round_id, type) values (p_user, p_round, 'repick');
  end if;
end;
$$;

-- Members who have not given a usable answer. A removed or cancelled pick counts
-- as no answer, because the leader still needs something from that person.
create function public.no_answer_members(p_round uuid)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select m.user_id
  from public.order_rounds r
  join public.group_members m on m.group_id = r.group_id
  where r.id = p_round and not exists (
    select 1 from public.order_items i
    where i.round_id = r.id and i.user_id = m.user_id
      and i.status in ('draft', 'skipped', 'confirmed'));
$$;

create function public.remind_no_answer(p_round uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
  v_count integer;
begin
  select * into v_round from public.order_rounds where id = p_round;
  if v_round.id is null or not public.is_group_leader(v_round.group_id) then
    raise exception 'leader_only';
  end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  insert into public.notifications (user_id, round_id, type)
    select n.user_id, p_round, 'reminder_manual' from public.no_answer_members(p_round) n;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Run every couple of minutes by pg_cron (next migration). Safe to run repeatedly.
create function public.queue_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, round_id, type)
    select n.user_id, r.id,
      case when r.deadline <= now() + interval '10 minutes' then 'reminder_10' else 'reminder_30' end
    from public.order_rounds r
    cross join lateral public.no_answer_members(r.id) n
    where r.status = 'open'
      and r.deadline > now()
      and r.deadline <= now() + interval '30 minutes'
    on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- picks (member)

-- Locks the round and returns it if the caller may answer right now.
create function public.answerable_round(p_round uuid)
returns public.order_rounds language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  select * into v_round from public.order_rounds where id = p_round for share;
  if v_round.id is null or not public.is_group_member(v_round.group_id) then
    raise exception 'not_a_member';
  end if;
  if v_round.status <> 'open' then raise exception 'round_closed'; end if;
  if v_round.deadline <= now() and not exists (
    select 1 from public.order_items
    where round_id = p_round and user_id = auth.uid() and status = 'removed'
  ) then
    raise exception 'round_closed';
  end if;
  return v_round;
end;
$$;

-- The price is copied from the menu here, never taken from the client, so a later
-- menu change cannot alter a finalized summary.
create function public.set_my_pick(
  p_round uuid, p_menu_item uuid, p_qty integer default 1,
  p_options jsonb default '{}', p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
  v_item public.menu_items;
begin
  v_round := public.answerable_round(p_round);
  select * into v_item from public.menu_items where id = p_menu_item;
  if v_item.id is null then raise exception 'unknown_menu_item'; end if;
  if cardinality(v_round.allowed_restaurant_ids) > 0
      and not v_item.restaurant_id = any (v_round.allowed_restaurant_ids) then
    raise exception 'restaurant_not_allowed';
  end if;
  insert into public.order_items
    (round_id, user_id, menu_item_id, qty, options, note, price_at_pick, status)
    values (p_round, auth.uid(), p_menu_item, p_qty, coalesce(p_options, '{}'),
            nullif(trim(p_note), ''), v_item.price, 'draft')
  on conflict (round_id, user_id) do update set
    menu_item_id = excluded.menu_item_id, qty = excluded.qty, options = excluded.options,
    note = excluded.note, price_at_pick = excluded.price_at_pick, status = 'draft',
    updated_at = now();
end;
$$;

create function public.set_my_answer(p_round uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('skipped', 'cancelled') then raise exception 'invalid_status'; end if;
  perform public.answerable_round(p_round);
  insert into public.order_items (round_id, user_id, menu_item_id, status)
    values (p_round, auth.uid(), null, p_status)
  on conflict (round_id, user_id) do update set
    menu_item_id = null, qty = 1, options = '{}', note = null, price_at_pick = 0,
    status = excluded.status, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- function access

-- Postgres grants EXECUTE to everyone by default, and Supabase adds anon and
-- authenticated explicitly. Start from nothing and open only what clients call.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_group_member(uuid),
  public.is_group_leader(uuid),
  public.shares_group_with(uuid),
  public.create_group(text, text),
  public.group_preview(text),
  public.join_group(text),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.start_round(uuid, text, timestamptz, text, uuid[]),
  public.finalize_round(uuid),
  public.mark_ordered(uuid),
  public.remove_pick(uuid, uuid),
  public.remind_no_answer(uuid),
  public.set_my_pick(uuid, uuid, integer, jsonb, text),
  public.set_my_answer(uuid, text)
to authenticated;

-- ---------------------------------------------------------------- live updates

alter publication supabase_realtime add table public.order_items, public.order_rounds;
