// Runs the real migration and seed on embedded Postgres, with a stand-in for what
// Supabase provides (roles, auth schema, default grants), then checks the rules
// as real client roles rather than as the superuser.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const LEADER = "00000000-0000-0000-0000-000000000001";
const MINJI = "00000000-0000-0000-0000-000000000002";
const DANA = "00000000-0000-0000-0000-000000000003";
const OUTSIDER = "00000000-0000-0000-0000-000000000004";

let db: PGlite;

async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(user ? `set role authenticated; set request.jwt.claim.sub = '${user}'`
    : `set role anon; set request.jwt.claim.sub = ''`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

let groupId: string;
let code: string;
let dish: { id: string; price: number; restaurant_id: string };

async function startRound(deadline = hoursFromNow(2), allowed: string[] = []) {
  const [r] = await as<{ id: string }>(LEADER,
    "select start_round($1, 'Friday lunch', $2, 'delivery', $3) as id", [groupId, deadline, allowed]);
  return r.id;
}
const pick = (user: string, round: string) =>
  as(user, "select set_my_pick($1, $2, 1, '{}', null)", [round, dish.id]);
async function pickStatus(user: string, round: string) {
  const rows = await db.query<{ status: string }>(
    "select status from order_items where round_id = $1 and user_id = $2", [round, user]);
  return rows.rows[0]?.status;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(readFileSync("supabase/migrations/20261106000000_schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`insert into auth.users values
    ('${LEADER}', 'leader@x.co', '{"name":"Temur"}'), ('${MINJI}', 'minji@x.co', '{"name":"Minji"}'),
    ('${DANA}', 'dana@x.co', '{}'), ('${OUTSIDER}', 'out@x.co', '{"name":"Out"}')`);
  dish = (await db.query<typeof dish>("select id, price, restaurant_id from menu_items limit 1")).rows[0];
});

beforeEach(async () => {
  await db.exec("delete from groups; delete from notifications;");
  [{ code }] = await as<{ code: string }>(LEADER, "select create_group('Team', '🍱') as code");
  await as(MINJI, "select join_group($1)", [code]);
  await as(DANA, "select join_group($1)", [code]);
  groupId = (await db.query<{ id: string }>("select id from groups")).rows[0].id;
});

describe("accounts and groups", () => {
  it("creates a profile on sign up, falling back to the email name", async () => {
    const { rows } = await db.query<{ name: string }>("select name from profiles where id = $1", [DANA]);
    expect(rows[0].name).toBe("dana");
  });

  it("makes the creator a leader and joiners members", async () => {
    const rows = await as<{ user_id: string; role: string }>(LEADER,
      "select user_id, role from group_members order by user_id");
    expect(rows.map((r) => r.role)).toEqual(["leader", "member", "member"]);
  });

  it("rejects a wrong invite code", async () => {
    await expect(as(OUTSIDER, "select join_group('nope')")).rejects.toThrow("invalid_invite_code");
  });

  it("keeps groups, members and picks away from outsiders", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    for (const table of ["groups", "group_members", "order_rounds", "order_items"]) {
      expect(await as(OUTSIDER, `select * from ${table}`), table).toEqual([]);
    }
    expect(await as(OUTSIDER, "select * from profiles where id = $1", [MINJI])).toEqual([]);
  });

  it("gives anonymous visitors nothing", async () => {
    for (const table of ["groups", "restaurants", "menu_items", "profiles"]) {
      expect(await as(null, `select * from ${table}`), table).toEqual([]);
    }
    await expect(as(null, "select group_preview($1)", [code])).rejects.toThrow("permission denied");
  });

  it("does not let a user move themselves into a company or edit others", async () => {
    await expect(as(MINJI, "update profiles set company_id = null where id = $1", [MINJI]))
      .rejects.toThrow("permission denied");
    await as(MINJI, "update profiles set name = 'hacked' where id = $1", [DANA]);
    const { rows } = await db.query<{ name: string }>("select name from profiles where id = $1", [DANA]);
    expect(rows[0].name).toBe("dana");
  });

  it("does not let a member promote themselves", async () => {
    await expect(as(MINJI, "select set_member_role($1, $2, 'leader')", [groupId, MINJI]))
      .rejects.toThrow("leader_only");
    await expect(as(MINJI, "update group_members set role = 'leader' where user_id = $1", [MINJI]))
      .resolves.toEqual([]);
    const { rows } = await db.query<{ role: string }>(
      "select role from group_members where user_id = $1", [MINJI]);
    expect(rows[0].role).toBe("member");
  });

  it("always keeps one leader", async () => {
    await expect(as(LEADER, "select remove_member($1, $2)", [groupId, LEADER]))
      .rejects.toThrow("group_needs_a_leader");
    await expect(as(LEADER, "select set_member_role($1, $2, 'member')", [groupId, LEADER]))
      .rejects.toThrow("group_needs_a_leader");
  });

  it("cancels a member's open pick when they leave", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    await as(MINJI, "select remove_member($1, $2)", [groupId, MINJI]);
    expect(await pickStatus(MINJI, round)).toBe("cancelled");
  });
});

describe("picks", () => {
  it("takes the price from the menu and ignores direct writes", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    const { rows } = await db.query<{ price_at_pick: number }>("select price_at_pick from order_items");
    expect(rows[0].price_at_pick).toBe(dish.price);
    await expect(as(MINJI, "update order_items set price_at_pick = 1")).resolves.toEqual([]);
    await expect(as(MINJI,
      "insert into order_items (round_id, user_id, menu_item_id, price_at_pick) values ($1, $2, $3, 1)",
      [round, DANA, dish.id])).rejects.toThrow("row-level security");
    expect((await db.query<{ price_at_pick: number }>("select price_at_pick from order_items")).rows)
      .toEqual([{ price_at_pick: dish.price }]);
  });

  it("keeps a finalized price when the menu changes later", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    await as(LEADER, "select finalize_round($1)", [round]);
    await db.query("update menu_items set price = price + 5000 where id = $1", [dish.id]);
    const { rows } = await db.query<{ price_at_pick: number }>("select price_at_pick from order_items");
    expect(rows[0].price_at_pick).toBe(dish.price);
    await db.query("update menu_items set price = $2 where id = $1", [dish.id, dish.price]);
  });

  it("allows one answer per person, which can change", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    await as(MINJI, "select set_my_answer($1, 'skipped')", [round]);
    expect(await pickStatus(MINJI, round)).toBe("skipped");
    await pick(MINJI, round);
    const { rows } = await db.query("select * from order_items where round_id = $1", [round]);
    expect(rows).toHaveLength(1);
  });

  it("blocks outsiders and picks after the deadline", async () => {
    const round = await startRound();
    await expect(pick(OUTSIDER, round)).rejects.toThrow("not_a_member");
    await db.query("update order_rounds set deadline = now() - interval '1 minute' where id = $1", [round]);
    await expect(pick(MINJI, round)).rejects.toThrow("round_closed");
    await expect(as(MINJI, "select set_my_answer($1, 'skipped')", [round])).rejects.toThrow("round_closed");
  });

  it("enforces the leader's restaurant limit", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from restaurants where id <> $1 limit 1", [dish.restaurant_id]);
    const round = await startRound(hoursFromNow(2), [rows[0].id]);
    await expect(pick(MINJI, round)).rejects.toThrow("restaurant_not_allowed");
  });

  it("lets a removed member repick after the deadline, and nobody else", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    await pick(DANA, round);
    await db.query("update order_rounds set deadline = now() - interval '1 minute' where id = $1", [round]);
    await as(LEADER, "select remove_pick($1, $2)", [round, MINJI]);
    expect(await pickStatus(MINJI, round)).toBe("removed");
    await pick(MINJI, round);
    expect(await pickStatus(MINJI, round)).toBe("draft");
    await expect(pick(DANA, round)).rejects.toThrow("round_closed");
    const notes = await as<{ type: string }>(MINJI, "select type from notifications");
    expect(notes).toEqual([{ type: "repick" }]);
  });
});

describe("round lifecycle", () => {
  it("allows only leaders to run a round", async () => {
    await expect(as(MINJI, "select start_round($1, 'x', $2)", [groupId, hoursFromNow(1)]))
      .rejects.toThrow("leader_only");
    const round = await startRound();
    for (const fn of ["finalize_round", "mark_ordered", "remind_no_answer"]) {
      await expect(as(MINJI, `select ${fn}($1)`, [round]), fn).rejects.toThrow("leader_only");
    }
    await expect(as(MINJI, "select remove_pick($1, $2)", [round, DANA])).rejects.toThrow("leader_only");
  });

  it("allows one open round per group and no past deadlines", async () => {
    await expect(startRound(hoursFromNow(-1))).rejects.toThrow("deadline_in_past");
    await startRound();
    await expect(startRound()).rejects.toThrow("round_already_open");
  });

  it("goes open, finalized, ordered and notifies people who ordered", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    await as(DANA, "select set_my_answer($1, 'skipped')", [round]);
    await expect(as(LEADER, "select mark_ordered($1)", [round])).rejects.toThrow("round_not_finalized");
    await as(LEADER, "select finalize_round($1)", [round]); // before the deadline
    expect(await pickStatus(MINJI, round)).toBe("confirmed");
    expect(await pickStatus(DANA, round)).toBe("skipped");
    await expect(pick(MINJI, round)).rejects.toThrow("round_closed");
    await as(LEADER, "select mark_ordered($1)", [round]);
    expect(await as(MINJI, "select type from notifications")).toEqual([{ type: "ordered" }]);
    expect(await as(DANA, "select type from notifications")).toEqual([]);
    await startRound(); // a new round can start
  });
});

describe("reminders", () => {
  const queue = () => db.query("select queue_reminders()");
  const typesFor = async (user: string) => (await db.query<{ type: string }>(
    "select type from notifications where user_id = $1 order by sent_at", [user])).rows.map((r) => r.type);

  it("reminds only people with no answer, once per window", async () => {
    const round = await startRound(hoursFromNow(0.4));
    await pick(MINJI, round);
    await as(LEADER, "select set_my_answer($1, 'skipped')", [round]);
    await queue();
    await queue();
    expect(await typesFor(DANA)).toEqual(["reminder_30"]);
    expect(await typesFor(MINJI)).toEqual([]);
    expect(await typesFor(LEADER)).toEqual([]);
    await db.query("update order_rounds set deadline = now() + interval '5 minutes' where id = $1", [round]);
    await queue();
    expect(await typesFor(DANA)).toEqual(["reminder_30", "reminder_10"]);
  });

  it("stays quiet far from the deadline and after it", async () => {
    const round = await startRound(hoursFromNow(2));
    await queue();
    await db.query("update order_rounds set deadline = now() - interval '1 minute' where id = $1", [round]);
    await queue();
    expect(await typesFor(DANA)).toEqual([]);
  });

  it("cannot be triggered by clients", async () => {
    await expect(as(LEADER, "select queue_reminders()")).rejects.toThrow("permission denied");
    await expect(as(LEADER, "select handle_new_user()")).rejects.toThrow();
  });

  it("lets the leader remind no-answers and a user read only their own", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    const [{ n }] = await as<{ n: number }>(LEADER, "select remind_no_answer($1) as n", [round]);
    expect(n).toBe(2); // leader and Dana
    await as(MINJI, "update notifications set read_at = now()");
    const { rows } = await db.query("select * from notifications where read_at is not null");
    expect(rows).toEqual([]);
    await expect(as(DANA, "update notifications set user_id = $1", [MINJI])).rejects.toThrow("permission denied");
  });
});

describe("seed", () => {
  it("gives every restaurant a menu", async () => {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from restaurants r
      where not exists (select 1 from menu_items m where m.restaurant_id = r.id)`);
    expect(rows[0].n).toBe(0);
    expect((await db.query("select * from restaurants")).rows.length).toBeGreaterThan(5);
  });
});
