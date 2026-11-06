-- What is inside each dish, what each person avoids, and every place to eat around campus.

-- ---------------------------------------------------------------- what is in a dish

-- contains and may_contain are null when the brand publishes nothing for the dish.
-- Null means unknown. It must never be read as "free from".
alter table public.menu_items add column contains text[];
alter table public.menu_items add column may_contain text[];
alter table public.menu_items add column ingredients text[] not null default '{}';
alter table public.menu_items add column allergen_source text;
alter table public.menu_items add column allergen_note text;
-- Parts of a set with no published data. What the other parts declare still counts,
-- but a dish with a gap can never be reported as having nothing listed.
alter table public.menu_items add column allergen_gaps text[] not null default '{}';
alter table public.menu_items add constraint allergen_data_has_a_source
  check ((contains is null) = (allergen_source is null) and (contains is null) = (may_contain is null));

-- ---------------------------------------------------------------- what a person avoids

-- Health information, so it is not on profiles: groupmates can read profiles, and no one
-- but the person can read this. There are no client write policies; set_food_needs writes.
create table public.food_needs (
  user_id uuid primary key references public.profiles on delete cascade,
  avoid text[] not null default '{}',
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.food_needs enable row level security;
revoke all on public.food_needs from anon, authenticated;
grant select on public.food_needs to authenticated;
create policy "read own food needs" on public.food_needs for select to authenticated
  using (user_id = auth.uid());

create function public.set_food_needs(p_avoid text[], p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  -- Keep in step with src/lib/diet.ts; a test compares the two lists.
  if not coalesce(p_avoid, '{}') <@ array[
    'vegan', 'vegetarian', 'no_meat',
    'egg', 'milk', 'peanut', 'walnut', 'pine_nut', 'soy', 'wheat', 'buckwheat', 'pork', 'beef', 'chicken',
    'shrimp', 'crab', 'squid', 'shellfish', 'mackerel', 'peach', 'tomato', 'sulfites',
    'lamb', 'turkey', 'duck', 'fish', 'tree_nuts', 'sesame', 'mustard', 'honey', 'mushroom', 'corn',
    'garlic', 'onion', 'alcohol'
  ]::text[] then
    raise exception 'unknown_food_need';
  end if;
  insert into public.food_needs (user_id, avoid, note)
    values (auth.uid(), coalesce(p_avoid, '{}'), nullif(trim(p_note), ''))
    on conflict (user_id) do update
      set avoid = excluded.avoid, note = excluded.note, updated_at = now();
end;
$$;
revoke execute on function public.set_food_needs(text[], text) from public, anon;
grant execute on function public.set_food_needs(text[], text) to authenticated;

-- ---------------------------------------------------------------- places on the map

-- Separate from restaurants: a restaurant has a menu people can pick from, and most places
-- on the map do not. restaurant_id links a branch to its chain's menu when there is one.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('openstreetmap', 'brand')),
  source_id text not null,
  name text not null,
  name_en text,
  kind text not null,
  cuisine text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  distance_m integer not null check (distance_m >= 0),
  address text,
  phone text,
  opening_hours text,
  website text,
  diet_tags text[] not null default '{}',
  restaurant_id uuid references public.restaurants on delete set null,
  unique (source, source_id)
);
create index places_distance_idx on public.places (distance_m);
alter table public.places enable row level security;
create policy "anyone logged in reads places" on public.places for select to authenticated using (true);
