import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { answerCounts, memberAnswers, roundState } from "./round";
import type { Group, Member, MenuItem, OrderPick, Restaurant, Round } from "./types";

export const PICK_COLUMNS =
  "id, round_id, user_id, qty, options, note, price_at_pick, status, menu_item:menu_items(*, restaurant:restaurants(*))";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

export const getPicks = cache(async (roundIds: string[]) => {
  if (roundIds.length === 0) return [];
  const { supabase } = await getUser();
  const { data } = await supabase.from("order_items").select(PICK_COLUMNS).in("round_id", roundIds);
  return (data ?? []) as unknown as OrderPick[];
});

/** Everything the group pages share. Null when the visitor is not a member (row-level security hides the group). */
export const getGroupContext = cache(async (code: string) => {
  const { supabase, user } = await getUser();
  const { data: group } = await supabase.from("groups").select("*").eq("invite_code", code).maybeSingle<Group>();
  if (!group) return null;

  const { data: rows } = await supabase
    .from("group_members")
    .select("user_id, role, profile:profiles(name, avatar)")
    .eq("group_id", group.id);
  const members = ((rows ?? []) as unknown as { user_id: string; role: Member["role"]; profile: { name: string; avatar: string | null } }[])
    .map((r): Member => ({ user_id: r.user_id, role: r.role, name: r.profile.name, avatar: r.profile.avatar }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // The current round is the newest one not yet ordered, so the Hub and share links always land on it.
  const { data: round } = await supabase
    .from("order_rounds")
    .select("*")
    .eq("group_id", group.id)
    .neq("status", "ordered")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Round>();

  const picks = await getPicks(round ? [round.id] : []);
  const answers = memberAnswers(members, picks);
  const myPick = picks.find((p) => p.user_id === user.id) ?? null;
  const state = round ? roundState(round) : null;

  return {
    group,
    members,
    userId: user.id,
    isLeader: members.some((m) => m.user_id === user.id && m.role === "leader"),
    round,
    state,
    answers,
    counts: answerCounts(answers),
    myPick,
    // A member whose pick the leader removed may repick after the deadline.
    canAnswer:
      state === "open" || state === "closing_soon" || (state === "closed" && myPick?.status === "removed"),
  };
});

export type RestaurantWithMenu = Restaurant & { menu_items: { price: MenuItem["price"] }[] };

export async function getRestaurants() {
  const { supabase } = await getUser();
  const { data } = await supabase.from("restaurants").select("*, menu_items(price)");
  return (data ?? []) as RestaurantWithMenu[];
}
