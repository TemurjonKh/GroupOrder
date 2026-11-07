import type { Member, OrderPick, Restaurant } from "./types";

const TIME_ZONE = "Asia/Seoul";

export type Answer =
  | { member: Member; kind: "picked"; pick: OrderPick }
  | { member: Member; kind: "skipped" }
  | { member: Member; kind: "no_answer"; removed: boolean };

export function memberAnswers(members: Member[], picks: OrderPick[]): Answer[] {
  const byUser = new Map(picks.map((p) => [p.user_id, p]));
  return members.map((member): Answer => {
    const pick = byUser.get(member.user_id);
    if (pick?.status === "skipped") return { member, kind: "skipped" };
    if (pick && pick.menu_item && (pick.status === "draft" || pick.status === "confirmed")) {
      return { member, kind: "picked", pick };
    }
    return { member, kind: "no_answer", removed: pick?.status === "removed" };
  });
}

export function answerCounts(answers: Answer[]) {
  const count = (kind: Answer["kind"]) => answers.filter((a) => a.kind === kind).length;
  return {
    picked: count("picked"),
    skipped: count("skipped"),
    noAnswer: count("no_answer"),
    total: answers.length,
  };
}

export type SummaryLine = {
  dish: string;
  options: string;
  qty: number;
  /** Sum of the known prices; `unpriced` counts the units without one. */
  amount: number;
  unpriced: number;
  notes: { who: string; note: string }[];
};
export type RestaurantSummary = {
  restaurant: Restaurant;
  lines: SummaryLine[];
  total: number;
  unpriced: number;
  people: { user_id: string; name: string; amount: number | null; qty: number; dish: string; options: string; note: string | null }[];
};

export const optionsLabel = (options: Record<string, string>) => Object.values(options).join(", ");

/** One list per restaurant: same dish with same options merges into one line. */
export function buildSummary(answers: Answer[]): RestaurantSummary[] {
  const summaries = new Map<string, RestaurantSummary>();
  for (const answer of answers) {
    if (answer.kind !== "picked" || !answer.pick.menu_item) continue;
    const { pick, member } = answer;
    const dish = pick.menu_item!;
    let summary = summaries.get(dish.restaurant.id);
    if (!summary) {
      summary = { restaurant: dish.restaurant, lines: [], total: 0, unpriced: 0, people: [] };
      summaries.set(dish.restaurant.id, summary);
    }
    const options = optionsLabel(pick.options);
    const amount = pick.price_at_pick === null ? null : pick.price_at_pick * pick.qty;
    let line = summary.lines.find((l) => l.dish === dish.name && l.options === options);
    if (!line) {
      line = { dish: dish.name, options, qty: 0, amount: 0, unpriced: 0, notes: [] };
      summary.lines.push(line);
    }
    line.qty += pick.qty;
    if (amount === null) {
      line.unpriced += pick.qty;
      summary.unpriced += pick.qty;
    } else {
      line.amount += amount;
      summary.total += amount;
    }
    if (pick.note) line.notes.push({ who: member.name, note: pick.note });
    summary.people.push({ user_id: member.user_id, name: member.name, amount, qty: pick.qty, dish: dish.name, options, note: pick.note });
  }
  return [...summaries.values()].sort((a, b) => b.total - a.total || a.restaurant.name.localeCompare(b.restaurant.name));
}

export const PRICE_NOT_LISTED = "Price not listed";

export const formatKrw = (amount: number | null) =>
  amount === null ? PRICE_NOT_LISTED : `₩${amount.toLocaleString("en-US")}`;

/** A total that never pretends to be complete when some prices are unknown. */
export function totalLabel(total: number, unpriced: number) {
  if (unpriced === 0) return formatKrw(total);
  const items = unpriced === 1 ? "1 item" : `${unpriced} items`;
  return total === 0 ? "Prices not listed" : `${formatKrw(total)} + ${items} not priced`;
}

export const lineAmountLabel = (line: Pick<SummaryLine, "amount" | "unpriced">) => totalLabel(line.amount, line.unpriced);

/** Plain text for pasting into a delivery app, a phone call script or KakaoTalk. */
export function summaryText(summary: RestaurantSummary, roundTitle: string): string {
  const lines = summary.lines.flatMap((line) => [
    `${line.dish}${line.options ? ` (${line.options})` : ""} x${line.qty}  ${lineAmountLabel(line)}`,
    ...line.notes.map((n) => `  - ${n.who}: ${n.note}`),
  ]);
  return [`${summary.restaurant.name} · ${roundTitle}`, ...lines, `Total ${totalLabel(summary.total, summary.unpriced)}`].join("\n");
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const NEARBY_METERS = 3000;

/**
 * Restaurants for a round: the leader's pins if any, otherwise chains (which have no single
 * location) plus anything near the group, closest first.
 */
export function restaurantsForRound<R extends { id: string; lat: number | null; lng: number | null }>(
  group: { lat: number; lng: number },
  restaurants: R[],
  pinned: string[] = [],
) {
  return restaurants
    .map((r) => ({ ...r, distance: r.lat === null || r.lng === null ? null : distanceMeters(group, { lat: r.lat, lng: r.lng }) }))
    .filter((r) => (pinned.length ? pinned.includes(r.id) : r.distance === null || r.distance <= NEARBY_METERS))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}

// Seoul time always: the server runs in UTC, and server and browser must agree.
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

const ERROR_MESSAGES: Record<string, string> = {
  leader_only: "Only a group leader can do that.",
  target_not_a_member: "That person is no longer in this group.",
  not_a_member: "You are not a member of this group.",
  round_closed: "This round is finalized, so answers can no longer change.",
  round_not_open: "This round has already been finalized.",
  round_not_finalized: "Finalize the round first.",
  restaurant_not_allowed: "The leader did not allow this restaurant for this round.",
  unknown_menu_item: "That dish is no longer on the menu.",
  invalid_invite_code: "That invite code does not exist.",
  group_needs_a_leader: "Promote another leader first: a group always needs one.",
  menu_locked: "This menu comes from the brand, so it cannot be changed here.",
  place_not_found: "That place is no longer on the map.",
  dish_not_found: "That dish is no longer on the menu.",
  dish_was_picked: "Someone has picked this dish, so it stays. You can still change it.",
  bad_dish_name: "Please give the dish a name (up to 80 characters).",
  bad_category: "Please keep the section name under 40 characters.",
  bad_price: "Please enter the price in won, or leave it empty.",
  bad_description: "Please keep the description under 300 characters.",
  bad_ingredients: "Please list up to 30 ingredients, each under 40 characters.",
  unknown_allergen: "One of the allergens is not on the list. Please reload and try again.",
};

/** Database functions raise short codes; turn them into a sentence for the user. */
export function friendlyError(message: string) {
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  return code ? ERROR_MESSAGES[code] : "Something went wrong. Please try again.";
}
