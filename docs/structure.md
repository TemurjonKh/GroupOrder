# Code structure

How the code maps to "Group Order Platform: Proposed Structure" (6 Nov 2026), where it
differs, and what remains.

## Pages

| # | Page | Route |
|---|------|-------|
| 1 | Login / sign up | `/login`, `/signup`, `/auth/callback` |
| 2 | My groups | `/` |
| 3 | Group page | `/g/<code>` (also the invite page for non-members) |
| 4 | Restaurant menu | `/g/<code>/r/<restaurant>` |
| 5 | My pick | `/g/<code>/my-pick` |
| 6 | Leader: finalize | `/g/<code>/finalize`, `/g/<code>/finalize/pick/<user>` |
| 7 | Group settings | `/g/<code>/settings` |
| 8 | History | `/g/<code>/history` |
| - | Create and join a group | `/groups/new`, `/groups/join` |
| - | Food map and meal search | `/map` |
| - | A place, its menu, and adding dishes to a local menu | `/places/<id>` |
| - | My food needs (allergies and diets) | `/account/food`, also shown after signing up |
| - | Stable link for QR and the future Hub | `/g/<code>/now` |

## Where things live

| Path | What it holds |
|------|---------------|
| `supabase/migrations/` | Tables, access rules, and all order-flow rules as database functions |
| `supabase/menus/`, `supabase/seed.sql` | Real menus as imported JSON, and the seed generated from them |
| `supabase/places/inha.json` | Everywhere to eat within 2 km of Inha, with its sources |
| `scripts/import-menus.mjs`, `scripts/import-chains.mjs`, `scripts/import-places.mjs`, `scripts/build-seed.mjs` | Refresh the menus and places |
| `src/lib/diet.ts`, `src/lib/dish-kind.ts` | Checking a dish against food needs; sorting dishes into meals, drinks and sides |
| `src/lib/diet.ts` | Pure logic: what a person avoids, and how a dish measures up |
| `src/lib/round.ts` | Pure logic: round states, answers, summaries, Seoul time, error messages |
| `src/lib/data.ts` | Reads shared by the group pages |
| `src/app/actions.ts` | Server actions behind every form |
| `src/proxy.ts` | Session refresh and redirect to login |
| `src/components/` | UI, including the live refresh and countdown |
| `test/` | Tests for the logic and for the database rules |
| `scripts/local-backend.mjs` | Stand-in for Supabase used by `npm run dev:local`; never deployed |
| `supabase/local/` | What Supabase normally provides, plus demo content, for local mode and tests |

## Security model

Clients read through row-level security. Rounds and picks have no write policies at all,
so every change goes through a database function that checks membership, leadership,
deadline and restaurant limit, and copies the price from the menu. The Next.js code holds
no special key: it acts as the logged-in user, so a bug in a page cannot bypass these rules.

Food needs are health information, so they have their own table rather than a column on profiles,
which groupmates can read. Only the person can read theirs, not even their group's leader.

## Differences from the document

| Document | Code | Why |
|----------|------|-----|
| `users` table | `profiles` table | Supabase Auth already owns `auth.users`, including the password hash |
| Five round states with a deadline | For now only `open`, `finalized`, `ordered`, with no deadline: every group always has one open round, and the next opens when the leader marks one ordered | Requested for now. Open and close times come back later; `deadline` and the reminder job are kept for that |
| Leader starts each round | Rounds open by themselves | Follows from picks always being open |
| Nearby restaurants by distance | Chains have no location and always show; distance only applies to local restaurants | One chain has many branches |
| Menu prices required | `price` may be null, shown as "Price not listed" and never counted as zero | Subway publishes no prices |
| `order_items` statuses | Adds `cancelled` | Cancelling keeps the row, so live subscribers get an update event |
| Next.js API routes | Server actions | Less code for form submissions; the Hub status endpoint can still be a route |
| Reminder job on Vercel | `pg_cron` in Supabase | Vercel's free tier only runs cron once a day |
| Extra fields | `restaurants.cuisine`, `notifications.read_at`, `groups.default_*`, `groups.location_label` and `lat/lng`, `order_rounds.allowed_restaurant_ids` | Needed by the wireframe, the in-app notices, group location and the restaurant limit |

## Decisions used

The document's bracketed defaults: eight MVP pages, email and password login, English UI with Korean restaurant and dish names, one pick per
person per round.

## Not built yet

MVP items still open, all of which depend on a deployed site or an outside service:

- **Web Push and email delivery.** Reminders and "ordered" notices are created on schedule
  but only appear in the app (a badge in the header and a list on My groups).
- **Offline PWA features.** The app can be installed, but there is no service worker yet.

Group location is set by coordinates or "Use my current location", because turning an
address into coordinates needs a map API.

The food map covers Inha University only. Chains' menus come from their sites; local restaurants
publish none, so members type them in on each place's page (`/places/<id>`). Those dishes have no
allergen data unless the member checked with the restaurant.

## Checked only in local mode so far

Logged-in flows have been driven in a browser (`npm run test:e2e`) against
`npm run dev:local`, not against a real Supabase project. Before the first deployment, check Supabase Auth (including email
confirmation), Realtime live updates and the `pg_cron` schedule on a real project.

Later, per the document: company admin and billing, Kakao login and Alimtalk, restaurant
voting, coffee rounds, the Hub and its status endpoint, payment.
