-- Sample data around one Seoul address (Teheran-ro 231). All restaurants are
-- made up; replace them with real ones before a pilot. Images are placeholder
-- SVGs built from an emoji, so the demo needs no photo uploads.
create function pg_temp.pic(emoji text, bg text) returns text language sql as $$
  select 'data:image/svg+xml,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 64 64''>'
    || '<rect width=''64'' height=''64'' fill=''' || replace(bg, '#', '%23') || '''/>'
    || '<text x=''32'' y=''44'' font-size=''34'' text-anchor=''middle''>' || emoji || '</text></svg>';
$$;

with r as (
  insert into public.restaurants (name, cuisine, logo, address, lat, lng, phone) values
    ('한식 키친 Hansik Kitchen', 'Korean', pg_temp.pic('🥘', '#f6e3cf'), 'Teheran-ro 225, Gangnam-gu', 37.5026, 127.0402, '02-0000-0001'),
    ('치킨 스토리 Chicken Story', 'Chicken', pg_temp.pic('🍗', '#fbe7b5'), 'Yeoksam-ro 180, Gangnam-gu', 37.4988, 127.0420, '02-0000-0002'),
    ('누들 하우스 Noodle House', 'Noodles', pg_temp.pic('🍜', '#f9d9c8'), 'Teheran-ro 201, Gangnam-gu', 37.5012, 127.0366, '02-0000-0003'),
    ('김밥 천국집 Gimbap Corner', 'Snack food', pg_temp.pic('🍙', '#dcecd5'), 'Eonju-ro 508, Gangnam-gu', 37.5052, 127.0448, '02-0000-0004'),
    ('스시 모아 Sushi Moa', 'Japanese', pg_temp.pic('🍣', '#fbd9d9'), 'Teheran-ro 245, Gangnam-gu', 37.5041, 127.0470, '02-0000-0005'),
    ('샐러드 박스 Salad Box', 'Salad', pg_temp.pic('🥗', '#d9efd0'), 'Yeoksam-ro 210, Gangnam-gu', 37.4999, 127.0455, '02-0000-0006')
  returning id, cuisine
), m (cuisine, name, emoji, bg, price, options) as (values
  ('Korean', '비빔밥 Bibimbap', '🍚', '#f6e3cf', 9000, '[{"name":"Spicy level","choices":["Mild","Medium","Hot"]}]'),
  ('Korean', '김치찌개 Kimchi stew', '🍲', '#f8d3c5', 9500, '[{"name":"Spicy level","choices":["Mild","Medium","Hot"]}]'),
  ('Korean', '불고기 정식 Bulgogi set', '🥩', '#f3d6c6', 12000, '[]'),
  ('Korean', '된장찌개 Soybean stew', '🥣', '#efe3c4', 9000, '[]'),
  ('Chicken', '반반 치킨 Half-half chicken', '🍗', '#fbe7b5', 19000, '[{"name":"Size","choices":["Regular","Large"]}]'),
  ('Chicken', '치킨 도시락 Chicken lunchbox', '🍱', '#fbe7b5', 12000, '[]'),
  ('Chicken', '치킨 샐러드 Chicken salad', '🥗', '#d9efd0', 12500, '[]'),
  ('Noodles', '칼국수 Knife-cut noodles', '🍜', '#f9d9c8', 8000, '[]'),
  ('Noodles', '비빔국수 Spicy cold noodles', '🍝', '#f8d3c5', 8500, '[{"name":"Spicy level","choices":["Mild","Hot"]}]'),
  ('Noodles', '만두국 Dumpling soup', '🥟', '#efe3c4', 9000, '[]'),
  ('Snack food', '참치 김밥 Tuna gimbap', '🍙', '#dcecd5', 4500, '[]'),
  ('Snack food', '떡볶이 Tteokbokki', '🌶️', '#f8d3c5', 6000, '[{"name":"Spicy level","choices":["Mild","Hot"]}]'),
  ('Snack food', '라볶이 Rabokki', '🍜', '#f9d9c8', 7000, '[]'),
  ('Japanese', '모둠 초밥 Assorted sushi', '🍣', '#fbd9d9', 15000, '[]'),
  ('Japanese', '연어 덮밥 Salmon rice bowl', '🍚', '#fbd9d9', 13000, '[]'),
  ('Japanese', '돈카츠 Pork cutlet', '🍛', '#f3d6c6', 11000, '[]'),
  ('Salad', '닭가슴살 샐러드 Chicken breast salad', '🥗', '#d9efd0', 10500, '[{"name":"Dressing","choices":["Balsamic","Sesame","None"]}]'),
  ('Salad', '연어 포케 Salmon poke', '🐟', '#d6e8f2', 12500, '[]'),
  ('Salad', '두부 샐러드 Tofu salad', '🥬', '#e5efc9', 9500, '[{"name":"Dressing","choices":["Balsamic","Sesame","None"]}]')
)
insert into public.menu_items (restaurant_id, name, photo, price, options)
select r.id, m.name, pg_temp.pic(m.emoji, m.bg), m.price, m.options::jsonb
from m join r using (cuisine);
