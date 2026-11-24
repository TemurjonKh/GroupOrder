-- Restaurants near Inha whose menu comes from their Naver Place page (data/restaurants/naver-place-*)
-- are pinned on the map where Naver has them, when OpenStreetMap does not have them.
alter table public.places drop constraint places_source_check;
alter table public.places add constraint places_source_check check (source in ('openstreetmap', 'brand', 'daangn', 'polle', 'naver'));
