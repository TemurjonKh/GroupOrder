import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { answerCounts, memberAnswers } from "./round";
import type { FoodNeeds, Group, Member, MenuItem, OrderPick, Place, Restaurant, Round } from "./types";

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
  const state = round?.status ?? null;

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
    canAnswer: state === "open",
  };
});

export type RestaurantWithMenu = Restaurant & {
  menu_items: Pick<MenuItem, "name" | "photo" | "price" | "category" | "sort_order">[];
};

export const getRestaurants = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("*, menu_items(name, photo, price, category, sort_order)")
    .order("name");
  return (data ?? []) as RestaurantWithMenu[];
});

/** Real dishes for decoration, taken in turn from each restaurant so all of them show. */
export async function getShowcase(count: number) {
  const restaurants = await getRestaurants();
  const pools = restaurants.map((r) =>
    [...r.menu_items].sort((a, b) => a.sort_order - b.sort_order).filter((d) => d.photo));
  const dishes: { name: string; photo: string | null }[] = [];
  for (let i = 0; dishes.length < count && pools.some((pool) => pool[i]); i++) {
    for (const pool of pools) if (pool[i * 3] && dishes.length < count) dishes.push(pool[i * 3]);
  }
  return dishes;
}

export async function getRestaurantMenu(id: string) {
  const { supabase } = await getUser();
  const { data } = await supabase.from("restaurants").select("*, menu_items(*)").eq("id", id).maybeSingle();
  if (!data) return null;
  const restaurant = data as Restaurant & { menu_items: MenuItem[] };
  restaurant.menu_items.sort((a, b) => a.sort_order - b.sort_order);
  return restaurant;
}

/** What the visitor avoids. Null until they have answered, which is different from avoiding nothing. */
export const getFoodNeeds = cache(async () => {
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("food_needs").select("avoid, note").eq("user_id", user.id).maybeSingle<FoodNeeds>();
  return data;
});

export async function getMapData() {
  const { supabase } = await getUser();
  const [{ data: places }, { data: restaurants }] = await Promise.all([
    supabase.from("places").select("*").order("distance_m"),
    supabase.from("restaurants").select("*, menu_items(*)").order("name"),
  ]);
  const menus = (restaurants ?? []) as (Restaurant & { menu_items: MenuItem[] })[];
  menus.forEach((r) => r.menu_items.sort((a, b) => a.sort_order - b.sort_order));
  return { places: (places ?? []) as Place[], restaurants: menus };
}

/** One place on the map, with the menu it serves: a brand's, one members typed in, or none. */
export async function getPlace(id: string) {
  const { supabase } = await getUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: place } = await supabase.from("places").select("*").eq("id", id).maybeSingle<Place>();
  if (!place) return null;
  const menu = place.restaurant_id ? await getRestaurantMenu(place.restaurant_id) : null;
  return { place, menu };
}
