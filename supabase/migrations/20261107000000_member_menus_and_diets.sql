-- Menus that members type in for places with no published menu, and three more diets.

-- ---------------------------------------------------------------- the lists of food keys

-- Keep in step with src/lib/diet.ts; a test compares the two lists.
create function public.allergen_keys()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'egg', 'milk', 'peanut', 'walnut', 'pine_nut', 'soy', 'wheat', 'buckwheat', 'pork', 'beef', 'chicken',
    'shrimp', 'crab', 'squid', 'shellfish', 'mackerel', 'peach', 'tomato', 'sulfites',
    'lamb', 'turkey', 'duck', 'fish', 'tree_nuts', 'sesame', 'mustard', 'honey', 'mushroom', 'corn',
    'garlic', 'onion', 'alcohol'
  ]::text[];
$$;

create function public.diet_keys()
returns text[] language sql immutable set search_path = '' as $$
  select array['vegan', 'vegetarian', 'no_meat', 'no_seafood', 'no_nuts', 'no_pork_alcohol']::text[];
$$;

create or replace function public.set_food_needs(p_avoid text[], p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not coalesce(p_avoid, '{}') <@ (public.diet_keys() || public.allergen_keys()) then
    raise exception 'unknown_food_need';
  end if;
  insert into public.food_needs (user_id, avoid, note)
    values (auth.uid(), coalesce(p_avoid, '{}'), nullif(trim(p_note), ''))
    on conflict (user_id) do update
      set avoid = excluded.avoid, note = excluded.note, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- member menus

-- A member menu belongs to one place. Chain menus come from the brands and stay read-only.
alter table public.restaurants add column added_by uuid references public.profiles on delete set null;
alter table public.restaurants add column place_id uuid unique references public.places on delete cascade;
alter table public.menu_items add column added_by uuid references public.profiles on delete set null;
alter table public.menu_items add column updated_at timestamptz;

-- The menu for a place, made when its first dish is saved. Internal: save_member_dish calls it.
create function public.start_place_menu(p_place uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_place public.places;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_place from public.places where id = p_place for update;
  if not found then raise exception 'place_not_found'; end if;
  if v_place.restaurant_id is not null then return v_place.restaurant_id; end if;
  insert into public.restaurants (name, cuisine, address, lat, lng, phone, added_by, place_id)
    values (v_place.name, coalesce(v_place.cuisine, v_place.kind), v_place.address, v_place.lat, v_place.lng,
            v_place.phone, auth.uid(), v_place.id)
    returning id into v_id;
  update public.places set restaurant_id = v_id where id = v_place.id;
  return v_id;
end;
$$;
revoke execute on function public.start_place_menu(uuid) from public, anon, authenticated;

-- Adds a dish (p_dish null) or changes one on a place's member menu, and returns the dish.
-- Allergens count only when the member says they checked with the restaurant; otherwise they
-- stay unknown, the same as a brand that publishes nothing.
create function public.save_member_dish(
  p_place uuid, p_dish uuid, p_name text, p_category text, p_price integer, p_description text,
  p_ingredients text[], p_allergens_checked boolean, p_contains text[], p_may_contain text[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_category text := coalesce(nullif(trim(p_category), ''), 'Menu');
  v_ingredients text[] := array(select trim(i) from unnest(coalesce(p_ingredients, '{}')) i where trim(i) <> '');
  v_checked boolean := coalesce(p_allergens_checked, false);
  v_id uuid;
  v_restaurant uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.places where id = p_place) then raise exception 'place_not_found'; end if;
  -- A chain's branch serves the chain's menu, which only the brand changes.
  if exists (select 1 from public.places p join public.restaurants r on r.id = p.restaurant_id
             where p.id = p_place and r.place_id is null) then
    raise exception 'menu_locked';
  end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'bad_dish_name'; end if;
  if char_length(v_category) > 40 then raise exception 'bad_category'; end if;
  if p_price is not null and p_price not between 0 and 1000000 then raise exception 'bad_price'; end if;
  if char_length(coalesce(p_description, '')) > 300 then raise exception 'bad_description'; end if;
  if cardinality(v_ingredients) > 30 or exists (select 1 from unnest(v_ingredients) i where char_length(i) > 40) then
    raise exception 'bad_ingredients';
  end if;
  if not (coalesce(p_contains, '{}') || coalesce(p_may_contain, '{}')) <@ public.allergen_keys() then
    raise exception 'unknown_allergen';
  end if;

  v_restaurant := public.start_place_menu(p_place);
  if p_dish is null then
    insert into public.menu_items (restaurant_id, name, category, price, description, sort_order, ingredients,
                                   contains, may_contain, allergen_source, added_by, updated_at)
    values (v_restaurant, v_name, v_category, p_price, nullif(trim(p_description), ''),
            (select coalesce(max(sort_order), -1) + 1 from public.menu_items where restaurant_id = v_restaurant),
            v_ingredients,
            case when v_checked then coalesce(p_contains, '{}') end,
            case when v_checked then array(select k from unnest(coalesce(p_may_contain, '{}')) k where not k = any(coalesce(p_contains, '{}'))) end,
            case when v_checked then 'A member who says they checked with the restaurant' end,
            auth.uid(), now())
    returning id into v_id;
  else
    update public.menu_items set
      name = v_name, category = v_category, price = p_price, description = nullif(trim(p_description), ''),
      ingredients = v_ingredients,
      contains = case when v_checked then coalesce(p_contains, '{}') end,
      may_contain = case when v_checked then array(select k from unnest(coalesce(p_may_contain, '{}')) k where not k = any(coalesce(p_contains, '{}'))) end,
      allergen_source = case when v_checked then 'A member who says they checked with the restaurant' end,
      added_by = auth.uid(), updated_at = now()
    where id = p_dish and restaurant_id = v_restaurant
    returning id into v_id;
    if v_id is null then raise exception 'dish_not_found'; end if;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.save_member_dish(uuid, uuid, text, text, integer, text, text[], boolean, text[], text[]) from public, anon;

grant execute on function public.save_member_dish(uuid, uuid, text, text, integer, text, text[], boolean, text[], text[]) to authenticated;

-- Removes a dish from a member menu. A menu left empty goes too, so rounds never offer it.
create function public.delete_member_dish(p_dish uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select r.* into v_restaurant from public.menu_items m join public.restaurants r on r.id = m.restaurant_id where m.id = p_dish;
  if not found then raise exception 'dish_not_found'; end if;
  if v_restaurant.place_id is null then raise exception 'menu_locked'; end if;
  -- Past picks point at the dish, so it stays.
  if exists (select 1 from public.order_items where menu_item_id = p_dish) then raise exception 'dish_was_picked'; end if;
  delete from public.menu_items where id = p_dish;
  if not exists (select 1 from public.menu_items where restaurant_id = v_restaurant.id) then
    update public.places set restaurant_id = null where id = v_restaurant.place_id;
    delete from public.restaurants where id = v_restaurant.id;
  end if;
end;
$$;
revoke execute on function public.delete_member_dish(uuid) from public, anon;
grant execute on function public.delete_member_dish(uuid) to authenticated;
