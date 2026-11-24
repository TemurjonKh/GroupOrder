-- Stable ids from where a menu came from (for example "naver-949880" and "item-001"), so loading a
-- newer copy of the same menu updates its rows instead of adding a second restaurant.
-- Menus loaded before this have none; nulls never clash.
alter table public.restaurants add column external_id text unique;
alter table public.menu_items add column external_id text;
alter table public.menu_items add constraint menu_items_restaurant_external_id_key unique (restaurant_id, external_id);

-- Burger King's chain menu (from its own site, no location) gives way to the menu of its branch near
-- Inha (data/restaurants/burger-king-inha), which seed.sql loads. Dishes someone already picked stay,
-- so past rounds still show them; the chain row goes once nothing points at it.
delete from public.menu_items m using public.restaurants r
where m.restaurant_id = r.id and r.name = 'Burger King' and r.place_id is null
  and not exists (select 1 from public.order_items o where o.menu_item_id = m.id);
delete from public.restaurants r
where r.name = 'Burger King' and r.place_id is null
  and not exists (select 1 from public.menu_items m where m.restaurant_id = r.id);
