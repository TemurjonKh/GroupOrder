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
   null, 'ordered', '00000000-0000-0000-0000-000000000001',
   now() - interval '7 days', now() - interval '7 days 2 hours'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Lunch',
   null, 'open', '00000000-0000-0000-0000-000000000001', null, now());

select public.open_round('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

insert into public.order_items (round_id, user_id, menu_item_id, qty, options, note, price_at_pick, status)
select v.r, v.u, m.id, 1, '{}'::jsonb, v.n, m.price, v.s
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '황금올리브치킨™', null, 'confirmed'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '와퍼', 'No pickles', 'confirmed'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '황금올리브치킨™', 'Extra radish', 'draft'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '램 & 후무스 Lamb & Hummus', null, 'draft')
) as v (r, u, dish, n, s)
join public.menu_items m on m.name = v.dish;
