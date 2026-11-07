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
npm run menus:chains    # the 15 other chains with a branch near Inha (name brands to do only those)
npm run menus:local     # independent restaurants, from Daangn and Polle, into supabase/menus/local/
npm run places:import   # fetches the places around Inha into supabase/places/inha.json
                        # (add -- --relink to only match saved places to the chains again)
npm run menus:seed      # rebuilds supabase/seed.sql from those files
```

Then run `npm run dev:local:reset` so local mode loads the new seed.

- **Subway publishes no prices.** Its dishes show "Price not listed", and totals say how many
  items are unpriced. Burger King's prices are its own dine-in prices; delivery can cost more.
- **Each site's robots.txt is respected.** BHC and Yupdduk are not included because theirs shut out
  bots like this one. Ediya is not included because its full list sits on a path its robots.txt
  disallows. Isaac Toast and Gong Cha have no photos for the same reason. Mom's Touch publishes
  allergens only as a chart image, so its dishes are "No data". To add a brand by hand, write
  `supabase/menus/<brand>.json` in the same format and add its photo host to `next.config.ts`.
- **Independent restaurants come from Daangn and Polle.** See "Local menus" below.
- **Alcohol and merchandise are left out**, because the app has no age check: rice wine on Kyochon's
  menu and a set with draft beer at Popeyes. Drinks a brand labels non-alcoholic stay in.
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

- **Sources.** BBQ, Burger King, Starbucks, Mega, Paik's, Baskin-Robbins, Sulbing, The Venti, Pizza
  School, Gong Cha and Compose publish allergens with their dishes (Compose also lists what its
  kitchen handles, shown as "may contain"). Subway publishes a chart image, read by `scripts/read-subway-chart.py`
  into `supabase/menus/sources/subway-allergy-chart.json`. Kyochon's table names older products, so
  most of its dishes have no match and stay "No data". Mammoth, Puradak, Popeyes, Isaac and Mom's
  Touch publish no allergens that the importer can read, so all their dishes are "No data".
- **The importer only accepts words it knows.** An unknown allergen word stops that brand's import,
  so a list is never half read. Spelling variants (밀가루, 메추리알) and one typo (대대두) are mapped
  in `scripts/menu-helpers.mjs`, always to the allergen they name. `IMPORT_CACHE=<folder>` keeps the
  fetched pages, so a rerun after a fix does not ask the site again.
- **Korea labels 19 foods.** Others, such as turkey, lamb, most fish and sesame, are only found when
  a dish names them, so "None listed" says when those cannot be ruled out. Vegan and vegetarian
  results mean "nothing listed", not certified.
- **Subway's chart covers the base dish.** The chosen bread, cheese and sauce can add more.
- **Burger King does not list most sets, fries or drinks.** A set shows what its listed parts
  contain and names the parts with no data, so it can never read as "None listed".

## Local menus

Small restaurants have no menu site, so `npm run menus:local` reads the pages listed in
`supabase/menus/local-sources.json` from two listing sites whose robots.txt allows it:

- **Daangn business profiles** (`daangn.com/kr/local-profile/`), where the owner types the price
  list. Daangn's robots.txt names AI user agents and allows them on exactly these pages. A list
  may stop at 30 dishes.
- **Polle place pages** (`polle.com/place/`), typed in by Polle's users, so prices can be old.
  Pages Polle marks closed are skipped.

Naver blogs, Naver Map, Kakao Map, Instagram, Brunch, Diningcode, Tripadvisor and Baemin shut out
bots like this one, so nothing comes from them.

- **Only places within 2 km of Inha are kept.** Each is matched to the OpenStreetMap place at the
  same spot with a similar name, or added to the map as a new place. A page can name its place by
  hand when the names differ ("소블링" is "SoBling" on OpenStreetMap).
- **A franchise with no page for its branch near Inha** borrows the price list another branch
  posted on Daangn, and says which branch, since prices and dishes can differ.
- **No allergen data.** Neither site lists allergens, so every dish is "No data". The dish name is
  still searched, so "돼지국밥" is hidden from someone avoiding pork.
- **Read-only.** Nobody edits menus in the app; rerun the importer to refresh them. Each menu shows
  where it came from, when the source last changed it (Daangn only) and when it was imported.
- **Menus with fewer than 3 dishes are left out**, so a place never looks covered when it is not.

## Food map

`/map` shows every place within 2 km of Inha University, on OpenStreetMap, with a search for meals.
The search filters by diet and allergen (vegan, vegetarian, no meat, no pork or alcohol, no chicken,
no beef, no seafood, no nuts, no dairy, no egg, no wheat and 30 more), by kind of dish (meals,
drinks, desserts and sides, sorted from each brand's own categories), by price, and sorts by
distance or price. "No pork or alcohol" is not halal: no brand here says how its meat is prepared.

- **Places come from OpenStreetMap** (© OpenStreetMap contributors, ODbL, so keep the credit on the
  map), Burger King's store finder, and the Daangn and Polle pages of local menus. Volunteers map
  OpenStreetMap, so some places are missing, and it has no menus.
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
