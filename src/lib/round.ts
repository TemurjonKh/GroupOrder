import type { Member, OrderPick, Restaurant } from "./types";

const TIME_ZONE = "Asia/Seoul";

export type Answer =
  | { member: Member; kind: "picked"; picks: OrderPick[] }
  | { member: Member; kind: "skipped" }
  | { member: Member; kind: "no_answer"; removed: boolean };

/** A dish someone is having: picked and not removed, cancelled or replaced by "not joining". */
export const isDish = (pick: OrderPick) => Boolean(pick.menu_item) && (pick.status === "draft" || pick.status === "confirmed");

/** A person can pick several dishes, from different restaurants; any one of them is an answer. */
export function memberAnswers(members: Member[], picks: OrderPick[]): Answer[] {
  return members.map((member): Answer => {
    const mine = picks.filter((p) => p.user_id === member.user_id);
    const dishes = mine.filter(isDish);
    if (dishes.length > 0) return { member, kind: "picked", picks: dishes };
    if (mine.some((p) => p.status === "skipped")) return { member, kind: "skipped" };
    return { member, kind: "no_answer", removed: mine.some((p) => p.status === "removed") };
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
  /** The English name for the screen; the copied order keeps the restaurant's own name. */
  dishEn: string | null;
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
  people: { user_id: string; pick_id: string; name: string; amount: number | null; qty: number; dish: string; dishEn: string | null; options: string; note: string | null }[];
};

export const optionsLabel = (options: Record<string, string>) => Object.values(options).join(", ");

/** One list per restaurant: same dish with same options merges into one line. */
export function buildSummary(answers: Answer[]): RestaurantSummary[] {
  const summaries = new Map<string, RestaurantSummary>();
  for (const answer of answers) {
    if (answer.kind !== "picked") continue;
    const { member } = answer;
    for (const pick of answer.picks) {
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
        line = { dish: dish.name, dishEn: dish.name_en ?? null, options, qty: 0, amount: 0, unpriced: 0, notes: [] };
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
      summary.people.push({ user_id: member.user_id, pick_id: pick.id, name: member.name, amount, qty: pick.qty, dish: dish.name, dishEn: dish.name_en ?? null, options, note: pick.note });
    }
  }
  return [...summaries.values()].sort((a, b) => b.total - a.total || a.restaurant.name.localeCompare(b.restaurant.name));
}

export const PRICE_NOT_LISTED = "Price not listed";

export const formatKrw = (amount: number | null, lang: "en" | "ko" = "en") =>
  amount === null ? (lang === "ko" ? "가격 미공개" : PRICE_NOT_LISTED) : `₩${amount.toLocaleString("en-US")}`;

/** A total that never pretends to be complete when some prices are unknown. */
export function totalLabel(total: number, unpriced: number, lang: "en" | "ko" = "en") {
  if (unpriced === 0) return formatKrw(total, lang);
  if (lang === "ko") return total === 0 ? "가격 미공개" : `${formatKrw(total, lang)} + 가격 미공개 ${unpriced}개`;
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
export function formatDate(iso: string, lang: "en" | "ko" = "en") {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

const ERROR_MESSAGES: Record<string, [string, string]> = {
  leader_only: ["Only a group leader can do that.", "그룹 리더만 할 수 있습니다."],
  target_not_a_member: ["That person is no longer in this group.", "그 사람은 더 이상 이 그룹에 없습니다."],
  not_a_member: ["You are not a member of this group.", "이 그룹의 멤버가 아닙니다."],
  round_closed: ["This round is finalized, so answers can no longer change.", "라운드가 확정되어 응답을 더 바꿀 수 없습니다."],
  round_not_open: ["This round has already been finalized.", "이미 확정된 라운드입니다."],
  round_not_finalized: ["Finalize the round first.", "먼저 라운드를 확정하세요."],
  restaurant_not_allowed: ["The leader did not allow this restaurant for this round.", "리더가 이번 라운드에 이 식당을 허용하지 않았습니다."],
  unknown_menu_item: ["That dish is no longer on the menu.", "더 이상 메뉴에 없는 음식입니다."],
  unknown_dish: ["That dish is no longer on the menu.", "더 이상 메뉴에 없는 음식입니다."],
  unknown_restaurant: ["That restaurant is no longer listed.", "더 이상 등록되지 않은 식당입니다."],
  invalid_invite_code: ["That invite code does not exist.", "없는 초대 코드입니다."],
  group_needs_a_leader: ["Promote another leader first: a group always needs one.", "먼저 다른 리더를 지정하세요. 그룹에는 리더가 꼭 있어야 합니다."],
};

/** Database functions raise short codes; turn them into a sentence for the user. */
export function friendlyError(message: string, lang: "en" | "ko" = "en") {
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  const [en, ko] = code ? ERROR_MESSAGES[code] : ["Something went wrong. Please try again.", "문제가 생겼습니다. 다시 시도해 주세요."];
  return lang === "ko" ? ko : en;
}
