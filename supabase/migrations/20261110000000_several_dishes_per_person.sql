-- A person can pick several dishes in a round, from any of the allowed restaurants: a burger
-- from one place and a coffee from another. Each dish appears once per person (picking it
-- again changes its quantity, options and note); "not joining" stays a single answer with no dish.

alter table public.order_items drop constraint order_items_round_id_user_id_key;
create unique index order_items_one_line_per_dish on public.order_items (round_id, user_id, menu_item_id)
  where menu_item_id is not null;
create unique index order_items_one_answer_without_dish on public.order_items (round_id, user_id)
  where menu_item_id is null;

-- Adds a dish, or changes it if it is already among the person's picks. Clears "not joining"
-- and any dishes the leader removed, since the person is answering again.
create function public.upsert_pick_line(
  p_round public.order_rounds, p_user uuid, p_menu_item uuid, p_qty integer, p_options jsonb, p_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item public.menu_items;
begin
  select * into v_item from public.menu_items where id = p_menu_item;
  if v_item.id is null then raise exception 'unknown_menu_item'; end if;
  if cardinality(p_round.allowed_restaurant_ids) > 0
      and not v_item.restaurant_id = any (p_round.allowed_restaurant_ids) then
    raise exception 'restaurant_not_allowed';
  end if;
  delete from public.order_items
    where round_id = p_round.id and user_id = p_user
      and (menu_item_id is null or (status in ('removed', 'cancelled') and menu_item_id <> p_menu_item));
  insert into public.order_items
    (round_id, user_id, menu_item_id, qty, options, note, price_at_pick, status)
    values (p_round.id, p_user, p_menu_item, coalesce(p_qty, 1), coalesce(p_options, '{}'),
            nullif(trim(p_note), ''), v_item.price, 'draft')
  on conflict (round_id, user_id, menu_item_id) where menu_item_id is not null do update set
    qty = excluded.qty, options = excluded.options, note = excluded.note,
    price_at_pick = excluded.price_at_pick, status = 'draft', updated_at = now();
end;
$$;
revoke execute on function public.upsert_pick_line(public.order_rounds, uuid, uuid, integer, jsonb, text) from public, anon, authenticated;

create or replace function public.set_my_pick(
  p_round uuid, p_menu_item uuid, p_qty integer default 1,
  p_options jsonb default '{}', p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.upsert_pick_line(public.answerable_round(p_round), auth.uid(), p_menu_item, p_qty, p_options, p_note);
end;
$$;

-- Takes one dish off the caller's own picks.
create function public.remove_my_pick(p_line uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round uuid;
begin
  select round_id into v_round from public.order_items where id = p_line and user_id = auth.uid();
  if v_round is null then raise exception 'unknown_menu_item'; end if;
  perform public.answerable_round(v_round);
  delete from public.order_items where id = p_line and user_id = auth.uid() and status = 'draft';
end;
$$;

-- "Not joining" or "cancel" replaces all of the person's dishes with one answer.
create or replace function public.set_my_answer(p_round uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('skipped', 'cancelled') then raise exception 'invalid_status'; end if;
  perform public.answerable_round(p_round);
  delete from public.order_items where round_id = p_round and user_id = auth.uid();
  insert into public.order_items (round_id, user_id, menu_item_id, status)
    values (p_round, auth.uid(), null, p_status);
end;
$$;

create or replace function public.leader_set_pick(
  p_round uuid, p_user uuid, p_menu_item uuid, p_qty integer default 1,
  p_options jsonb default '{}', p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  select * into v_round from public.order_rounds where id = p_round for share;
  if v_round.id is null or not public.is_group_leader(v_round.group_id) then
    raise exception 'leader_only';
  end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  if not exists (select 1 from public.group_members
      where group_id = v_round.group_id and user_id = p_user) then
    raise exception 'target_not_a_member';
  end if;
  perform public.upsert_pick_line(v_round, p_user, p_menu_item, p_qty, p_options, p_note);
  if p_user <> auth.uid() then
    insert into public.notifications (user_id, round_id, type) values (p_user, p_round, 'pick_edited');
  end if;
end;
$$;

-- A leader takes one dish off someone's picks. With nothing left, they are asked to pick again.
create function public.remove_pick_line(p_line uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_line public.order_items;
  v_round public.order_rounds;
begin
  select * into v_line from public.order_items where id = p_line;
  select * into v_round from public.order_rounds where id = v_line.round_id;
  if v_round.id is null or not public.is_group_leader(v_round.group_id) then
    raise exception 'leader_only';
  end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  update public.order_items set status = 'removed', updated_at = now() where id = p_line and status = 'draft';
  if found then
    insert into public.notifications (user_id, round_id, type)
      values (v_line.user_id, v_round.id,
        case when exists (select 1 from public.order_items where round_id = v_round.id
                          and user_id = v_line.user_id and status = 'draft') then 'pick_edited' else 'repick' end);
  end if;
end;
$$;

-- One "ordered" notice per person, however many dishes they picked.
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
    select distinct user_id, p_round, 'ordered' from public.order_items
    where round_id = p_round and status = 'confirmed';
  perform public.open_round(v_round.group_id, auth.uid());
end;
$$;

revoke execute on function public.remove_my_pick(uuid), public.remove_pick_line(uuid) from public, anon;
grant execute on function public.remove_my_pick(uuid), public.remove_pick_line(uuid) to authenticated;
