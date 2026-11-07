import { describe, expect, it } from "vitest";
import {
  answerCounts, buildSummary, distanceMeters, formatDistance,
  friendlyError, memberAnswers, restaurantsForRound, summaryText, totalLabel,
} from "../src/lib/round";
import type { Member, OrderPick, PickStatus, Restaurant } from "../src/lib/types";

const place = (id: string): Restaurant => ({
  id, name: `Place ${id}`, cuisine: "Korean", logo: null, logo_bg: null, address: null, lat: 0, lng: 0, phone: null, delivery_link: null, place_id: null, added_by: null,
});
const member = (id: string): Member => ({ user_id: id, role: "member", name: id, avatar: null });
function pick(user: string, status: PickStatus, rest: Partial<OrderPick> & { dish?: string; at?: string } = {}): OrderPick {
  const { dish = "Bibimbap", at: where = "a", ...fields } = rest;
  const hasDish = !["skipped", "cancelled", "removed"].includes(status);
  return {
    id: user, round_id: "r", user_id: user, qty: 1, options: {}, note: null, price_at_pick: 9000, status,
    menu_item: hasDish
      ? { id: dish, restaurant_id: where, name: dish, photo: null, price: 9000, category: "Menu", description: null, sort_order: 0, options: [], contains: null, may_contain: null, ingredients: [], allergen_source: null, allergen_note: null, allergen_gaps: [], added_by: null, updated_at: null, restaurant: place(where) }
      : null,
    ...fields,
  };
}

describe("memberAnswers", () => {
  it("sorts everyone into picked, skipped or no answer", () => {
    const answers = memberAnswers(["a", "b", "c", "d", "e"].map(member), [
      pick("a", "draft"), pick("b", "skipped"), pick("c", "removed"), pick("d", "cancelled"),
    ]);
    expect(answers.map((x) => x.kind)).toEqual(["picked", "skipped", "no_answer", "no_answer", "no_answer"]);
    expect(answers[2]).toMatchObject({ removed: true });
    expect(answers[3]).toMatchObject({ removed: false });
    expect(answerCounts(answers)).toEqual({ picked: 1, skipped: 1, noAnswer: 3, total: 5 });
  });

  it("ignores picks from people who left the group", () => {
    expect(memberAnswers([member("a")], [pick("gone", "draft")]).map((x) => x.kind)).toEqual(["no_answer"]);
  });
});

describe("buildSummary", () => {
  const answers = memberAnswers(["a", "b", "c", "d"].map(member), [
    pick("a", "confirmed", { qty: 2, options: { Spicy: "Hot" }, note: "no egg" }),
    pick("b", "confirmed", { options: { Spicy: "Hot" } }),
    pick("c", "confirmed", { options: { Spicy: "Mild" } }),
    pick("d", "confirmed", { dish: "Chicken", at: "b", price_at_pick: 19000, qty: 2 }),
  ]);
  const [chicken, bibimbap] = buildSummary(answers);

  it("makes one list per restaurant with merged lines and totals", () => {
    expect(chicken.total).toBe(38000);
    expect(bibimbap.total).toBe(36000);
    expect(bibimbap.lines.map((l) => [l.options, l.qty, l.amount])).toEqual([["Hot", 3, 27000], ["Mild", 1, 9000]]);
    expect(bibimbap.people.find((p) => p.name === "a")?.amount).toBe(18000);
  });

  it("produces text ready to paste", () => {
    expect(summaryText(bibimbap, "Friday lunch")).toBe(
      "Place a · Friday lunch\nBibimbap (Hot) x3  ₩27,000\n  - a: no egg\nBibimbap (Mild) x1  ₩9,000\nTotal ₩36,000");
  });
});

describe("dishes without a published price", () => {
  const answers = memberAnswers(["a", "b", "c"].map(member), [
    pick("a", "draft", { price_at_pick: null, qty: 2 }),
    pick("b", "draft", { price_at_pick: 9000 }),
    pick("c", "draft", { dish: "Sub", at: "b", price_at_pick: null }),
  ]);
  const [mixed, none] = buildSummary(answers);

  it("never counts an unknown price as zero", () => {
    expect(mixed.total).toBe(9000);
    expect(mixed.unpriced).toBe(2);
    expect(totalLabel(mixed.total, mixed.unpriced)).toBe("₩9,000 + 2 items not priced");
    expect(totalLabel(none.total, none.unpriced)).toBe("Prices not listed");
    expect(mixed.people.find((p) => p.name === "a")?.amount).toBeNull();
  });

  it("says so in the text for the restaurant", () => {
    expect(summaryText(none, "Lunch")).toBe("Place b · Lunch\nSub x1  Prices not listed\nTotal Prices not listed");
  });
});

describe("distance", () => {
  it("measures walking-scale distances sensibly", () => {
    const meters = distanceMeters({ lat: 37.503, lng: 127.0436 }, { lat: 37.5026, lng: 127.0402 });
    expect(meters).toBeGreaterThan(280);
    expect(meters).toBeLessThan(320);
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1250)).toBe("1.3 km");
  });
});

describe("restaurantsForRound", () => {
  const office = { lat: 37.503, lng: 127.0436 };
  const near = { id: "near", lat: 37.5026, lng: 127.0402 };
  const nearer = { id: "nearer", lat: 37.5031, lng: 127.044 };
  const busan = { id: "busan", lat: 35.1, lng: 129.0 };

  it("lists nearby places, closest first", () => {
    expect(restaurantsForRound(office, [near, busan, nearer]).map((r) => r.id)).toEqual(["nearer", "near"]);
  });

  it("always includes chains, which have no single location", () => {
    const chain = { id: "chain", lat: null, lng: null };
    expect(restaurantsForRound(office, [chain, busan, near]).map((r) => [r.id, r.distance === null])).toEqual([["near", false], ["chain", true]]);
  });

  it("uses the leader's pins whatever the distance", () => {
    expect(restaurantsForRound(office, [near, busan], ["busan"]).map((r) => r.id)).toEqual(["busan"]);
  });
});

it("translates database error codes and hides unknown errors", () => {
  expect(friendlyError("round_closed")).toContain("finalized");
  expect(friendlyError('duplicate key on table "secret"')).toBe("Something went wrong. Please try again.");
});
