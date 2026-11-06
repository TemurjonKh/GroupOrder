-- For now picks never close on a timer: every group always has one open round, and the
-- leader decides when it ends. Deadlines come back when open and close times are added.
-- Also makes room for real chain menus, which have categories and may not publish prices.

-- ---------------------------------------------------------------- menus

-- A chain has no single location, so a null position means "available anywhere".
alter table public.restaurants alter column lat drop not null;
alter table public.restaurants alter column lng drop not null;
alter table public.restaurants add column logo_bg text;

alter table public.menu_items alter column price drop not null;
alter table public.menu_items add column category text not null default 'Menu';
alter table public.menu_items add column description text;
alter table public.menu_items add column sort_order integer not null default 0;
create index menu_items_sort_idx on public.menu_items (restaurant_id, sort_order);

alter table public.order_items alter column price_at_pick drop not null;

-- Menus are public on the brands' own sites, and the login page shows them.
drop policy "anyone logged in reads restaurants" on public.restaurants;
drop policy "anyone logged in reads menus" on public.menu_items;
create policy "anyone reads restaurants" on public.restaurants for select to anon, authenticated using (true);
create policy "anyone reads menus" on public.menu_items for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- always-open rounds

alter table public.order_rounds alter column deadline drop not null;
update public.order_rounds set deadline = null where status = 'open';
drop function public.start_round(uuid, text, timestamptz, text, uuid[]);

create function public.open_round(p_group uuid, p_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.order_rounds (group_id, title, allowed_restaurant_ids, created_by)
  select g.id, 'Lunch', g.default_restaurant_ids[1:3], p_user
  from public.groups g
  where g.id = p_group
  on conflict (group_id) where status = 'open' do nothing;
$$;
revoke execute on function public.open_round(uuid, uuid) from public, anon, authenticated;

-- Groups waiting on a finalized round get their next one when the leader marks it ordered.
select public.open_round(g.id, g.created_by)
from public.groups g
where not exists (select 1 from public.order_rounds r where r.group_id = g.id and r.status <> 'ordered');

create or replace function public.create_group(p_name text, p_icon text default '🍱')
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
  perform public.open_round(v_group.id, auth.uid());
  return v_group.invite_code;
end;
$$;

create or replace function public.mark_ordered(p_round uuid)
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
  perform public.open_round(v_round.group_id, auth.uid());
end;
$$;

-- Only finalizing closes a round now. A deadline, if one is ever set, is ignored.
create or replace function public.answerable_round(p_round uuid)
returns public.order_rounds language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  select * into v_round from public.order_rounds where id = p_round for share;
  if v_round.id is null or not public.is_group_member(v_round.group_id) then
    raise exception 'not_a_member';
  end if;
  if v_round.status <> 'open' then raise exception 'round_closed'; end if;
  return v_round;
end;
$$;
