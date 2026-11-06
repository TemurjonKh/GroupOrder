# GroupOrder

Group lunch ordering. Members of a group pick a dish, every pick shows live, and the leader
finalizes one clean summary per restaurant to place in Baemin, Coupang Eats or by phone.

This is Version A (software only). See [docs/structure.md](docs/structure.md) for how the
code maps to the proposed structure, and what is not built yet.

## Run it locally

You only need Node 22 or newer. No Supabase account, no Docker.

```sh
npm install
npm run dev:local
```

Open http://localhost:3000 and log in with a demo account. The password for all of them
is `demo1234`:

| Account | Role in "Krafton work team" |
|---------|-----------------------------|
| `temur@demo.test` | Leader |
| `minji@demo.test`, `jisoo@demo.test`, `dana@demo.test` | Members |

Use a private window for a second person. Data is kept in `.local/`; to start over, stop
the app and run `npm run dev:local:reset`.

Local mode runs your real migrations and access rules on embedded Postgres, behind a small
imitation of Supabase's Auth and REST APIs (`scripts/local-backend.mjs`). Two things differ
from production: the live panel polls every 3 seconds instead of using Realtime, and sign-up
does not send a confirmation email. Invite links and QR codes point to `localhost` until the app is deployed, so a phone
cannot follow them yet.

## Run it on a real Supabase project

1. In the Supabase SQL Editor, run these files in order:
   - `supabase/migrations/20261106000000_schema.sql`
   - `supabase/migrations/20261106000100_reminders_cron.sql`
   - `supabase/migrations/20261106000200_leader_edit_and_location.sql`
   - `supabase/migrations/20261106000300_always_open_and_real_menus.sql`
   - `supabase/migrations/20261106000400_food_needs_and_places.sql`
   - `supabase/seed.sql` (the real menus and the places around Inha)
2. For quick testing, turn off **Authentication > Sign In / Providers > Confirm email**.
   If it stays on, set the Site URL and add `<your site>/auth/callback` to the redirect
   URLs under **Authentication > URL Configuration**.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key
   from **Project Settings > API**.
4. Run `npm install` and `npm run dev`.

## Menus

Chain menus come from each brand's public site. To refresh them:

```sh
npm run menus:import    # BBQ, Burger King and Subway, into supabase/menus/*.json
npm run menus:chains    # the other chains with a branch near Inha (name brands to do only those)
npm run places:import   # fetches the places around Inha into supabase/places/inha.json
                        # (add -- --relink to only match saved places to the chains again)
npm run menus:seed      # rebuilds supabase/seed.sql from those files
```

Then run `npm run dev:local:reset` so local mode loads the new seed.

- **Subway publishes no prices.** Its dishes show "Price not listed", and totals say how many
  items are unpriced. Burger King's prices are its own dine-in prices; delivery can cost more.
- **Each site's robots.txt is respected.** BHC and Yupdduk are not included because theirs shut out
  bots like this one. Ediya is not included because its full list sits on a path its robots.txt
  disallows. Isaac Toast has no photos for the same reason. To add a brand by hand, write
  `supabase/menus/<brand>.json` in the same format and add its photo host to `next.config.ts`.
- **Independent restaurants have no menus.** They publish none, and delivery and map apps do not
  allow copying theirs. Their menus would have to come from the owners or be typed in by hand.
- **A chain's menu is its national menu.** A branch may not sell every dish, or may charge differently.
- **BBQ's adult-only drinks are left out**, because the app has no age check.
- **Photos stay on the brands' servers.** The database stores their URLs and the app resizes
  them on demand, so no brand images are in this repo. A photo disappears if a brand moves it.
- **Get permission before going public.** Names, photos, logos and descriptions belong to the
  brands. This is fine for a private demo, not for a public launch.

## Allergens and food needs

Each person ticks what they avoid at `/account/food`, and menus and the food map check against it.
Only they can read that list. The rule throughout is that missing data is never good news:

| The app says | It means |
|---|---|
| Contains | The brand lists it, or the dish's name or ingredients name it |
| May contain | The brand says it may be present |
| No data | The brand publishes nothing for this dish, or for part of this set |
| None listed | The brand publishes data and none of the person's items are on it. Never "safe" |

- **Sources.** BBQ, Burger King, Starbucks, Mega, Paik's, Baskin-Robbins, Sulbing, The Venti and Pizza
  School publish allergens with their dishes. Subway publishes a chart image, read by `scripts/read-subway-chart.py`
  into `supabase/menus/sources/subway-allergy-chart.json`. Kyochon's table names older products, so
  most of its dishes have no match and stay "No data". Mammoth, Puradak, Popeyes and Isaac publish
  no allergens that the importer can read, so all their dishes are "No data".
- **Korea labels 19 foods.** Others, such as turkey, lamb, most fish and sesame, are only found when
  a dish names them, so "None listed" says when those cannot be ruled out. Vegan and vegetarian
  results mean "nothing listed", not certified.
- **Subway's chart covers the base dish.** The chosen bread, cheese and sauce can add more.
- **Burger King does not list most sets, fries or drinks.** A set shows what its listed parts
  contain and names the parts with no data, so it can never read as "None listed".

## Food map

`/map` shows every place within 2 km of Inha University, on OpenStreetMap, with a search for meals.

- **Places come from OpenStreetMap** (© OpenStreetMap contributors, ODbL, so keep the credit on the
  map) plus Burger King's store finder. Volunteers map OpenStreetMap, so some places are missing,
  and it has no menus. Only the chains above have dishes to search; other places can only be found by name.
- **Before going public, use a tile provider.** The default OpenStreetMap tiles are for light use
  and can be withdrawn. Set `NEXT_PUBLIC_MAP_TILE_URL` to change them.

## Checks

```sh
npm test        # business rules and database access rules, no Supabase needed
npm run lint
npm run build
```

`npm run test:e2e` drives the whole platform in a browser; the top of
`test/e2e/flow.mjs` explains how to run it.

`npm test` runs the real migration on embedded Postgres (PGlite) as client roles, so the
access rules are tested without Docker or a Supabase project.

## Deploy

Import the repo in Vercel and set the same two environment variables. Add the deployed
URL to Supabase's redirect URLs.
