// Runs the real migration and seed on embedded Postgres, with a stand-in for what
// Supabase provides (roles, auth schema, default grants), then checks the rules
// as real client roles rather than as the superuser.
import { readdirSync, readFileSync } from "node:fs";
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

// Every group has an open round from the moment it exists; tests only adjust it.
async function startRound(deadline: string | null = null, allowed: string[] = []) {
  const { rows } = await db.query<{ id: string }>(
    "update order_rounds set deadline = $2, allowed_restaurant_ids = $3 where group_id = $1 and status = 'open' returning id",
    [groupId, deadline, allowed]);
  return rows[0].id;
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
  await db.exec(readFileSync("supabase/local/bootstrap.sql", "utf8"));
  // pg_cron only exists on hosted Supabase.
  for (const file of readdirSync("supabase/migrations").filter((f) => !f.endsWith("_cron.sql")).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
    ('${LEADER}', 'leader@x.co', '{"name":"Temur"}'), ('${MINJI}', 'minji@x.co', '{"name":"Minji"}'),
    ('${DANA}', 'dana@x.co', '{}'), ('${OUTSIDER}', 'out@x.co', '{"name":"Out"}')`);
  dish = (await db.query<typeof dish>("select id, price, restaurant_id from menu_items where price is not null limit 1")).rows[0];
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

  it("shows anonymous visitors menus and nothing else", async () => {
    for (const table of ["groups", "group_members", "profiles", "order_rounds", "order_items", "notifications"]) {
      expect(await as(null, `select * from ${table}`), table).toEqual([]);
    }
    expect((await as(null, "select * from menu_items")).length).toBeGreaterThan(0);
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

  it("blocks outsiders, and a passed deadline does not close picks", async () => {
    const round = await startRound();
    await expect(pick(OUTSIDER, round)).rejects.toThrow("not_a_member");
    await db.query("update order_rounds set deadline = now() - interval '1 minute' where id = $1", [round]);
    await pick(MINJI, round);
    expect(await pickStatus(MINJI, round)).toBe("draft");
  });

  it("accepts dishes whose brand publishes no price", async () => {
    const round = await startRound();
    const { rows } = await db.query<{ id: string }>("select id from menu_items where price is null limit 1");
    await as(MINJI, "select set_my_pick($1, $2)", [round, rows[0].id]);
    const picked = await db.query("select price_at_pick from order_items where user_id = $1", [MINJI]);
    expect(picked.rows).toEqual([{ price_at_pick: null }]);
  });

  it("enforces the leader's restaurant limit", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from restaurants where id <> $1 limit 1", [dish.restaurant_id]);
    const round = await startRound(hoursFromNow(2), [rows[0].id]);
    await expect(pick(MINJI, round)).rejects.toThrow("restaurant_not_allowed");
  });

  it("tells a removed member to repick, and the repick counts", async () => {
    const round = await startRound();
    await pick(MINJI, round);
    await as(LEADER, "select remove_pick($1, $2)", [round, MINJI]);
    expect(await pickStatus(MINJI, round)).toBe("removed");
    expect(await as<{ type: string }>(MINJI, "select type from notifications")).toEqual([{ type: "repick" }]);
    await pick(MINJI, round);
    expect(await pickStatus(MINJI, round)).toBe("draft");
  });
});

describe("leader editing picks", () => {
  const edit = (who: string, round: string, target: string) =>
    as(who, "select leader_set_pick($1, $2, $3, 2, '{}', 'from leader')", [round, target, dish.id]);

  it("lets a leader set a member's pick after the deadline, and tells the member", async () => {
    const round = await startRound();
    await db.query("update order_rounds set deadline = now() - interval '1 minute' where id = $1", [round]);
    await edit(LEADER, round, DANA);
    expect(await pickStatus(DANA, round)).toBe("draft");
    expect(await as(DANA, "select type from notifications")).toEqual([{ type: "pick_edited" }]);
    const { rows } = await db.query<{ price_at_pick: number; qty: number }>("select price_at_pick, qty from order_items");
    expect(rows).toEqual([{ price_at_pick: dish.price, qty: 2 }]);
  });

  it("refuses non-leaders, outsiders as targets, and finalized rounds", async () => {
    const round = await startRound();
    await expect(edit(MINJI, round, DANA)).rejects.toThrow("leader_only");
    await expect(edit(LEADER, round, OUTSIDER)).rejects.toThrow("target_not_a_member");
    await as(LEADER, "select finalize_round($1)", [round]);
    await expect(edit(LEADER, round, DANA)).rejects.toThrow("round_not_open");
  });
});

describe("group location", () => {
  it("can be changed by leaders only, within valid coordinates", async () => {
    await as(LEADER, "update groups set lat = 35.1, lng = 129.0, location_label = 'Busan office'");
    const read = await as<{ lat: number }>(LEADER, "select lat from groups");
    expect(read[0].lat).toBe(35.1);
    await as(MINJI, "update groups set lat = 1");
    expect((await as<{ lat: number }>(LEADER, "select lat from groups"))[0].lat).toBe(35.1);
    await expect(as(LEADER, "update groups set lat = 500")).rejects.toThrow("groups_lat_range");
  });
});

describe("round lifecycle", () => {
  it("allows only leaders to run a round", async () => {
    const round = await startRound();
    for (const fn of ["finalize_round", "mark_ordered", "remind_no_answer"]) {
      await expect(as(MINJI, `select ${fn}($1)`, [round]), fn).rejects.toThrow("leader_only");
    }
    await expect(as(MINJI, "select remove_pick($1, $2)", [round, DANA])).rejects.toThrow("leader_only");
  });

  it("gives every new group exactly one open round", async () => {
    const rows = await as<{ title: string; status: string; deadline: string | null }>(MINJI,
      "select title, status, deadline from order_rounds");
    expect(rows).toEqual([{ title: "Lunch", status: "open", deadline: null }]);
    await expect(db.query("insert into order_rounds (group_id, title) values ($1, 'x')", [groupId]))
      .rejects.toThrow("one_open_round_per_group");
    await expect(as(LEADER, "select open_round($1, $2)", [groupId, LEADER])).rejects.toThrow("permission denied");
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
    const open = await as<{ id: string }>(MINJI, "select id from order_rounds where status = 'open'");
    expect(open).toHaveLength(1); // the next round opens by itself
    expect(open[0].id).not.toBe(round);
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

describe("food needs", () => {
  beforeEach(() => db.exec("delete from food_needs"));

  it("are saved and changed through the function", async () => {
    await as(MINJI, "select set_food_needs($1, $2)", [["pork", "vegan"], " kiwi "]);
    expect(await as(MINJI, "select avoid, note from food_needs")).toEqual([{ avoid: ["pork", "vegan"], note: "kiwi" }]);
    await as(MINJI, "select set_food_needs($1, $2)", [[], ""]);
    expect(await as(MINJI, "select avoid, note from food_needs")).toEqual([{ avoid: [], note: null }]);
  });
  it("stay private, even from a leader in the same group", async () => {
    await as(MINJI, "select set_food_needs($1)", [["peanut"]]);
    expect(await as(LEADER, "select * from food_needs where user_id = $1", [MINJI])).toEqual([]);
    expect(await as(OUTSIDER, "select * from food_needs")).toEqual([]);
    await expect(as(null, "select * from food_needs")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select set_food_needs('{}')")).rejects.toThrow(/permission denied/);
  });
  it("cannot be written directly or filled with unknown values", async () => {
    await expect(as(MINJI, "insert into food_needs (user_id) values ($1)", [MINJI])).rejects.toThrow(/permission denied/);
    await as(MINJI, "select set_food_needs($1)", [["pork"]]);
    await expect(as(MINJI, "update food_needs set avoid = '{}'")).rejects.toThrow(/permission denied/);
    await expect(as(MINJI, "select set_food_needs($1)", [["pork", "<script>"]])).rejects.toThrow(/unknown_food_need/);
    await expect(as(MINJI, "select set_food_needs($1, $2)", [[], "x".repeat(301)])).rejects.toThrow();
  });
});

describe("places", () => {
  it("are everywhere to eat within 2 km of campus, for logged-in people only", async () => {
    const rows = await as<{ count: number; furthest: number }>(MINJI, "select count(*)::int as count, max(distance_m) as furthest from places");
    expect(rows[0].count).toBeGreaterThan(200);
    expect(rows[0].furthest).toBeLessThanOrEqual(2000);
    expect(await as(null, "select * from places")).toEqual([]);
    await expect(as(MINJI, "insert into places (source, source_id, name, kind, lat, lng, distance_m) values ('brand', 'x', 'x', 'x', 0, 0, 0)")).rejects.toThrow(/row-level security/);
  });
  it("link the chains' branches to their menus", async () => {
    const rows = await as<{ name: string; count: number }>(MINJI, `select r.name, count(*)::int as count from places p join restaurants r on r.id = p.restaurant_id group by r.name order by r.name`);
    expect(rows).toEqual([{ name: "BBQ", count: 1 }, { name: "Burger King", count: 3 }, { name: "Subway", count: 1 }]);
  });
});

describe("seed", () => {
  it("keeps unknown allergens unknown instead of empty", async () => {
    const { rows } = await db.query<{ unknown: number; empty_with_no_gaps: number; no_source: number }>(`select
      (select count(*)::int from menu_items where contains is null) as unknown,
      (select count(*)::int from menu_items where contains = '{}' and may_contain = '{}') as empty_with_no_gaps,
      (select count(*)::int from menu_items where contains is not null and allergen_source is null) as no_source`);
    expect(rows[0].unknown).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ no_source: 0 });
    await expect(db.query("update menu_items set allergen_source = null where contains is not null")).rejects.toThrow(/allergen_data_has_a_source/);
  });

  it("holds real menus with a photo for every dish", async () => {
    const names = await db.query<{ name: string }>("select name from restaurants order by name");
    expect(names.rows.map((r) => r.name)).toEqual(expect.arrayContaining(["BBQ", "Burger King", "Subway"]));
    const { rows } = await db.query<{ dishes: number; no_photo: number; no_menu: number }>(`select
      (select count(*)::int from menu_items) as dishes,
      (select count(*)::int from menu_items where photo is null) as no_photo,
      (select count(*)::int from restaurants r where not exists (select 1 from menu_items m where m.restaurant_id = r.id)) as no_menu`);
    expect(rows[0].dishes).toBeGreaterThan(300);
    expect(rows[0]).toMatchObject({ no_photo: 0, no_menu: 0 });
  });
});
