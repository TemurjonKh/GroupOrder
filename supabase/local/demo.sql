-- Demo content for local mode only. Accounts are created by scripts/local-backend.mjs.
insert into public.groups (id, name, icon, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Krafton work team', '🏢', 'demoteam01', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Taekwondo club', '🥋', 'demotkd001', '00000000-0000-0000-0000-000000000003');

insert into public.group_members (group_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'leader'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'member'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'leader'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'member');

-- Last week's finished round, so History and "Same as last time" have something to show.
insert into public.order_rounds (id, group_id, title, deadline, status, created_by, finalized_at, created_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Last Friday lunch',
   now() - interval '7 days', 'ordered', '00000000-0000-0000-0000-000000000001',
   now() - interval '7 days', now() - interval '7 days 2 hours'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Team lunch',
   now() + interval '2 hours', 'open', '00000000-0000-0000-0000-000000000001', null, now());

insert into public.order_items (round_id, user_id, menu_item_id, qty, options, note, price_at_pick, status)
select r, u, m.id, 1, o::jsonb, n, m.price, s
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '%Kimchi stew', '{"Spicy level":"Hot"}', null, 'confirmed'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '%Bibimbap', '{"Spicy level":"Mild"}', 'No egg', 'confirmed'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '%Bibimbap', '{"Spicy level":"Medium"}', 'No egg', 'draft'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '%Half-half chicken', '{"Size":"Regular"}', null, 'draft')
) as v (r, u, dish, o, n, s)
join public.menu_items m on m.name like v.dish;
