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
| 6 | Leader: finalize | `/g/<code>/finalize` |
| 7 | Group settings | `/g/<code>/settings` |
| 8 | History | `/g/<code>/history` |
| - | Start a round | `/g/<code>/start` |
| - | Stable link for QR and the future Hub | `/g/<code>/now` |

## Where things live

| Path | What it holds |
|------|---------------|
| `supabase/migrations/` | Tables, access rules, and all order-flow rules as database functions |
| `supabase/seed.sql` | Made-up sample restaurants and menus |
| `src/lib/round.ts` | Pure logic: round states, answers, summaries, Seoul time, error messages |
| `src/lib/data.ts` | Reads shared by the group pages |
| `src/app/actions.ts` | Server actions behind every form |
| `src/proxy.ts` | Session refresh and redirect to login |
| `src/components/` | UI, including the live refresh and countdown |
| `test/` | Tests for the logic and for the database rules |

## Security model

Clients read through row-level security. Rounds and picks have no write policies at all,
so every change goes through a database function that checks membership, leadership,
deadline and restaurant limit, and copies the price from the menu. The Next.js code holds
no special key: it acts as the logged-in user, so a bug in a page cannot bypass these rules.

## Differences from the document

| Document | Code | Why |
|----------|------|-----|
| `users` table | `profiles` table | Supabase Auth already owns `auth.users`, including the password hash |
| Five stored round statuses | Stores `open`, `finalized`, `ordered`; derives `closing soon` and `closed` from the deadline | A round closes on time even if a background job fails |
| `order_items` statuses | Adds `cancelled` | Cancelling keeps the row, so live subscribers get an update event |
| Next.js API routes | Server actions | Less code for form submissions; the Hub status endpoint can still be a route |
| Reminder job on Vercel | `pg_cron` in Supabase | Vercel's free tier only runs cron once a day |
| Extra fields | `restaurants.cuisine`, `notifications.read_at`, `groups.default_*` and `lat/lng`, `order_rounds.allowed_restaurant_ids` | Needed by the wireframe, the in-app notices and the restaurant limit |

## Decisions used

The document's bracketed defaults: eight MVP pages, sample data around one Seoul address,
email and password login, English UI with Korean restaurant and dish names, one pick per
person per round.

## Not built yet

MVP items still open:

- **Web Push and email delivery.** Reminders and "ordered" notices are created on schedule
  but only appear on the My groups page.
- **Leader editing a member's pick.** A leader can remove a pick, and the member is told to
  repick, even after the deadline. Direct editing is not there.
- **Choosing a group's location.** All groups use the sample office address for now.
- **Offline PWA features.** The app can be installed, but there is no service worker yet.

Later, per the document: company admin and billing, Kakao login and Alimtalk, restaurant
voting, coffee rounds, the Hub and its status endpoint, payment.
