-- Members suggest a restaurant to their group for the current round, and can replace all their
-- dishes with a new one in one step.

-- ---------------------------------------------------------------- suggestions

create table public.restaurant_suggestions (
  round_id uuid not null references public.order_rounds on delete cascade,
  restaurant_id uuid not null references public.restaurants on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_id, restaurant_id, user_id)
);
alter table public.restaurant_suggestions enable row level security;
revoke all on public.restaurant_suggestions from anon, authenticated;
grant select on public.restaurant_suggestions to authenticated;
create policy "members read their rounds' suggestions" on public.restaurant_suggestions for select to authenticated
  using (exists (select 1 from public.order_rounds r where r.id = round_id and public.is_group_member(r.group_id)));

-- Suggests a restaurant for an open round. Suggesting it again changes nothing.
create function public.suggest_restaurant(p_round uuid, p_restaurant uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  v_round := public.answerable_round(p_round);
  if not exists (select 1 from public.restaurants where id = p_restaurant) then raise exception 'unknown_restaurant'; end if;
  if cardinality(v_round.allowed_restaurant_ids) > 0 and not p_restaurant = any (v_round.allowed_restaurant_ids) then
    raise exception 'restaurant_not_allowed';
  end if;
  insert into public.restaurant_suggestions (round_id, restaurant_id, user_id)
    values (p_round, p_restaurant, auth.uid())
  on conflict do nothing;
end;
$$;

-- Takes back the caller's own suggestion; nobody else's can be removed.
create function public.unsuggest_restaurant(p_round uuid, p_restaurant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.restaurant_suggestions
    where round_id = p_round and restaurant_id = p_restaurant and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------- replace

-- Swaps all of the caller's dishes for this one, for "replace" instead of "add".
create function public.replace_my_picks(
  p_round uuid, p_menu_item uuid, p_qty integer default 1,
  p_options jsonb default '{}', p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.order_rounds;
begin
  v_round := public.answerable_round(p_round);
  delete from public.order_items
    where round_id = p_round and user_id = auth.uid() and menu_item_id is distinct from p_menu_item;
  perform public.upsert_pick_line(v_round, auth.uid(), p_menu_item, p_qty, p_options, p_note);
end;
$$;

revoke execute on function public.suggest_restaurant(uuid, uuid), public.unsuggest_restaurant(uuid, uuid),
  public.replace_my_picks(uuid, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.suggest_restaurant(uuid, uuid), public.unsuggest_restaurant(uuid, uuid),
  public.replace_my_picks(uuid, uuid, integer, jsonb, text) to authenticated;

-- Suggestions show up on everyone's screen without a reload.
alter publication supabase_realtime add table public.restaurant_suggestions;
