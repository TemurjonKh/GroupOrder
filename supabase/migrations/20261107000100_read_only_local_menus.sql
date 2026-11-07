-- Menus are no longer typed in by members: every menu is imported, with the page it came from.
-- Independent restaurants' menus come from Daangn business profiles and Polle place pages.

drop function public.delete_member_dish(uuid);
drop function public.save_member_dish(uuid, uuid, text, text, integer, text, text[], boolean, text[], text[]);
drop function public.start_place_menu(uuid);

alter table public.restaurants drop column added_by;
alter table public.menu_items drop column added_by;
alter table public.menu_items drop column updated_at;

-- Where a menu came from. place_id stays: a local menu belongs to one place, a chain's to none.
alter table public.restaurants add column menu_source text;
alter table public.restaurants add column menu_source_name text;
alter table public.restaurants add column menu_note text;
-- When the source last changed the menu (Daangn shows it), and when it was imported.
alter table public.restaurants add column menu_updated date;
alter table public.restaurants add column menu_checked date;

-- Places that OpenStreetMap does not have yet, from the same listing sites.
alter table public.places drop constraint places_source_check;
alter table public.places add constraint places_source_check check (source in ('openstreetmap', 'brand', 'daangn', 'polle'));
