import { describe, expect, it } from "vitest";
import {
  answerCounts, buildSummary, deadlineFromTime, distanceMeters, formatDistance, formatTime,
  friendlyError, memberAnswers, roundState, summaryText,
} from "../src/lib/round";
import type { Member, Pick, PickStatus, Restaurant } from "../src/lib/types";

const at = "2026-11-06T02:20:00.000Z"; // 11:20 in Seoul
const minutes = (m: number) => new Date(at).getTime() + m * 60_000;

describe("roundState", () => {
  it("follows the clock until the leader acts", () => {
    const round = { status: "open" as const, deadline: at };
    expect(roundState(round, minutes(-31))).toBe("open");
    expect(roundState(round, minutes(-30))).toBe("closing_soon");
    expect(roundState(round, minutes(0))).toBe("closed");
    expect(roundState({ ...round, status: "finalized" }, minutes(-60))).toBe("finalized");
    expect(roundState({ ...round, status: "ordered" }, minutes(60))).toBe("ordered");
  });
});

const place = (id: string): Restaurant => ({
  id, name: `Place ${id}`, cuisine: "Korean", logo: null, address: null, lat: 0, lng: 0, phone: null, delivery_link: null,
});
const member = (id: string): Member => ({ user_id: id, role: "member", name: id, avatar: null });
function pick(user: string, status: PickStatus, rest: Partial<Pick> & { dish?: string; at?: string } = {}): Pick {
  const { dish = "Bibimbap", at: where = "a", ...fields } = rest;
  const hasDish = !["skipped", "cancelled", "removed"].includes(status);
  return {
    id: user, round_id: "r", user_id: user, qty: 1, options: {}, note: null, price_at_pick: 9000, status,
    menu_item: hasDish
      ? { id: dish, restaurant_id: where, name: dish, photo: null, price: 9000, options: [], restaurant: place(where) }
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

describe("time and distance", () => {
  it("reads a typed time as Seoul time, whatever the server's zone", () => {
    expect(deadlineFromTime("11:20", new Date("2026-11-06T01:00:00Z"))).toBe(at);
    // 23:30 UTC on the 5th is already the 6th in Seoul
    expect(deadlineFromTime("11:20", new Date("2026-11-05T23:30:00Z"))).toBe(at);
    expect(deadlineFromTime("11:20:00", new Date("2026-11-06T01:00:00Z"))).toBe(at);
    expect(formatTime(at)).toBe("11:20");
  });

  it("measures walking-scale distances sensibly", () => {
    const meters = distanceMeters({ lat: 37.503, lng: 127.0436 }, { lat: 37.5026, lng: 127.0402 });
    expect(meters).toBeGreaterThan(280);
    expect(meters).toBeLessThan(320);
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1250)).toBe("1.3 km");
  });
});

it("translates database error codes and hides unknown errors", () => {
  expect(friendlyError("round_closed")).toContain("closed");
  expect(friendlyError('duplicate key on table "secret"')).toBe("Something went wrong. Please try again.");
});
