import type { Member, Pick, Restaurant, Round } from "./types";

const CLOSING_SOON_MS = 30 * 60_000;
const TIME_ZONE = "Asia/Seoul";

export type RoundState = "open" | "closing_soon" | "closed" | "finalized" | "ordered";

/** The five lifecycle states. Only finalized and ordered are stored; the rest follow the clock. */
export function roundState(round: { status: Round["status"]; deadline: string }, now = Date.now()): RoundState {
  if (round.status !== "open") return round.status;
  const left = new Date(round.deadline).getTime() - now;
  if (left <= 0) return "closed";
  return left <= CLOSING_SOON_MS ? "closing_soon" : "open";
}

export type Answer =
  | { member: Member; kind: "picked"; pick: Pick }
  | { member: Member; kind: "skipped" }
  | { member: Member; kind: "no_answer"; removed: boolean };

export function memberAnswers(members: Member[], picks: Pick[]): Answer[] {
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
  amount: number;
  notes: { who: string; note: string }[];
};
export type RestaurantSummary = {
  restaurant: Restaurant;
  lines: SummaryLine[];
  total: number;
  people: { user_id: string; name: string; amount: number; qty: number; dish: string; options: string; note: string | null }[];
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
      summary = { restaurant: dish.restaurant, lines: [], total: 0, people: [] };
      summaries.set(dish.restaurant.id, summary);
    }
    const options = optionsLabel(pick.options);
    const amount = pick.price_at_pick * pick.qty;
    let line = summary.lines.find((l) => l.dish === dish.name && l.options === options);
    if (!line) {
      line = { dish: dish.name, options, qty: 0, amount: 0, notes: [] };
      summary.lines.push(line);
    }
    line.qty += pick.qty;
    line.amount += amount;
    if (pick.note) line.notes.push({ who: member.name, note: pick.note });
    summary.total += amount;
    summary.people.push({ user_id: member.user_id, name: member.name, amount, qty: pick.qty, dish: dish.name, options, note: pick.note });
  }
  return [...summaries.values()].sort((a, b) => b.total - a.total);
}

/** Plain text for pasting into a delivery app, a phone call script or KakaoTalk. */
export function summaryText(summary: RestaurantSummary, roundTitle: string): string {
  const lines = summary.lines.flatMap((line) => [
    `${line.dish}${line.options ? ` (${line.options})` : ""} x${line.qty}  ${formatKrw(line.amount)}`,
    ...line.notes.map((n) => `  - ${n.who}: ${n.note}`),
  ]);
  return [`${summary.restaurant.name} · ${roundTitle}`, ...lines, `Total ${formatKrw(summary.total)}`].join("\n");
}

export const formatKrw = (amount: number) => `₩${amount.toLocaleString("en-US")}`;

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

// Times always use Seoul: the server runs in UTC, and server and browser must agree.
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

/** "11:20" typed by a leader means today at 11:20 in Seoul. */
export function deadlineFromTime(time: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  return new Date(`${today}T${time.slice(0, 5)}:00+09:00`).toISOString();
}

const ERROR_MESSAGES: Record<string, string> = {
  leader_only: "Only a group leader can do that.",
  not_a_member: "You are not a member of this group.",
  round_closed: "This round is closed, so answers can no longer change.",
  round_not_open: "This round has already been finalized.",
  round_not_finalized: "Finalize the round first.",
  round_already_open: "This group already has an open round.",
  deadline_in_past: "That time has already passed today. Choose a later time.",
  restaurant_not_allowed: "The leader did not allow this restaurant for this round.",
  unknown_menu_item: "That dish is no longer on the menu.",
  invalid_invite_code: "That invite code does not exist.",
  group_needs_a_leader: "Promote another leader first: a group always needs one.",
};

/** Database functions raise short codes; turn them into a sentence for the user. */
export function friendlyError(message: string) {
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  return code ? ERROR_MESSAGES[code] : "Something went wrong. Please try again.";
}
