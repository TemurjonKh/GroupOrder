-- Lets a leader change or enter a member's pick, and lets a group set its own location.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reminder_30', 'reminder_10', 'reminder_manual', 'repick', 'ordered', 'pick_edited'));

alter table public.groups add column location_label text not null default 'Teheran-ro 231, Seoul'
  check (char_length(location_label) <= 120);
alter table public.groups add constraint groups_lat_range check (lat between -90 and 90);
alter table public.groups add constraint groups_lng_range check (lng between -180 and 180);
grant update (lat, lng, location_label) on public.groups to authenticated;

-- A leader can still correct picks after the deadline, until the round is finalized.
create function public.leader_set_pick(
  p_round uuid, p_user uuid, p_menu_item uuid, p_qty integer default 1,
  p_options jsonb default '{}', p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
  v_item public.menu_items;
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
  select * into v_item from public.menu_items where id = p_menu_item;
  if v_item.id is null then raise exception 'unknown_menu_item'; end if;
  if cardinality(v_round.allowed_restaurant_ids) > 0
      and not v_item.restaurant_id = any (v_round.allowed_restaurant_ids) then
    raise exception 'restaurant_not_allowed';
  end if;
  insert into public.order_items
    (round_id, user_id, menu_item_id, qty, options, note, price_at_pick, status)
    values (p_round, p_user, p_menu_item, p_qty, coalesce(p_options, '{}'),
            nullif(trim(p_note), ''), v_item.price, 'draft')
  on conflict (round_id, user_id) do update set
    menu_item_id = excluded.menu_item_id, qty = excluded.qty, options = excluded.options,
    note = excluded.note, price_at_pick = excluded.price_at_pick, status = 'draft',
    updated_at = now();
  if p_user <> auth.uid() then
    insert into public.notifications (user_id, round_id, type) values (p_user, p_round, 'pick_edited');
  end if;
end;
$$;

revoke execute on function public.leader_set_pick(uuid, uuid, uuid, integer, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.leader_set_pick(uuid, uuid, uuid, integer, jsonb, text)
  to authenticated;
