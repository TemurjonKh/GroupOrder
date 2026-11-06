"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/round";
import { inviteCodeFrom, safeNext } from "@/lib/url";

export type ActionState = { error?: string; ok?: string } | null;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const groupPath = (form: FormData) => `/g/${encodeURIComponent(text(form, "code"))}`;

/** Calls a database function, then refreshes the group's pages. Returns an error for the form to show. */
async function call(form: FormData, fn: string, args: Record<string, unknown>): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(groupPath(form), "layout");
  return null;
}

// ------------------------------------------------------------------ accounts

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(form, "email"),
    password: String(form.get("password") ?? ""),
  });
  if (error) {
    return { error: error.code === "email_not_confirmed" ? "Please confirm your email first." : "Wrong email or password." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const name = text(form, "name");
  if (!name) return { error: "Please enter your name." };
  const next = safeNext(form.get("next"));
  const head = await headers();
  const origin = `${head.get("x-forwarded-proto") ?? "http"}://${head.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: text(form, "email"),
    password: String(form.get("password") ?? ""),
    options: {
      data: { name },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "Please use a longer password (at least 6 characters)." };
    if (error.code === "user_already_exists") return { error: "That email already has an account. Please log in." };
    if (error.code === "validation_failed" || error.code === "email_address_invalid") return { error: "Please check your email address." };
    return { error: "Could not create the account. Please try again." };
  }
  if (!data.session) return { ok: "Almost done: check your email and click the confirmation link." };
  redirect(`/account/food?welcome=1&next=${encodeURIComponent(next)}`);
}

export async function saveFoodNeeds(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_food_needs", {
    p_avoid: form.getAll("avoid").map(String),
    p_note: text(form, "note"),
  });
  if (error) return { error: "Could not save your list. Please try again." };
  revalidatePath("/", "layout");
  if (form.get("next")) redirect(safeNext(form.get("next")));
  return { ok: "Saved. Menus and the map now check against this list." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ------------------------------------------------------------------ groups

export async function createGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", { p_name: text(form, "name"), p_icon: text(form, "icon") });
  if (error) return { error: "Please enter a group name of up to 80 characters." };
  redirect(`/g/${data}`);
}

/** Sends the visitor to the invite page, which shows the group and a Join button. */
export async function goToInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const code = inviteCodeFrom(text(form, "invite"));
  if (!code) return { error: "Please enter an invite code." };
  redirect(`/g/${encodeURIComponent(code)}`);
}

export async function joinGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await call(form, "join_group", { p_code: text(form, "code") });
  if (result) return result;
  redirect(groupPath(form));
}

export async function updateGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const restaurants = form.getAll("restaurants").map(String);
  if (restaurants.length > 3) return { error: "Choose up to 3 default restaurants." };
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  if (!text(form, "lat") || !text(form, "lng") || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) {
    return { error: "Please enter a valid latitude and longitude." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update({
      name: text(form, "name"),
      icon: text(form, "icon"),
      default_restaurant_ids: restaurants,
      location_label: text(form, "location"),
      lat,
      lng,
    })
    .eq("id", text(form, "group"))
    .select("id");
  if (error || !data?.length) return { error: "Could not save. Only leaders can change group settings." };
  revalidatePath(groupPath(form), "layout");
  return { ok: "Saved." };
}

export async function setMemberRole(_: ActionState, form: FormData) {
  return call(form, "set_member_role", {
    p_group: text(form, "group"), p_user: text(form, "user"), p_role: text(form, "role"),
  });
}

export async function removeMember(_: ActionState, form: FormData) {
  return call(form, "remove_member", { p_group: text(form, "group"), p_user: text(form, "user") });
}

export async function leaveGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const result = await call(form, "remove_member", { p_group: text(form, "group"), p_user: user?.id });
  if (result) return result;
  redirect("/");
}

// ------------------------------------------------------------------ rounds (leader)

export async function finalizeRound(_: ActionState, form: FormData) {
  return call(form, "finalize_round", { p_round: text(form, "round") });
}

export async function markOrdered(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await call(form, "mark_ordered", { p_round: text(form, "round") });
  if (result) return result;
  redirect(`${groupPath(form)}/history`);
}

export async function removePick(_: ActionState, form: FormData) {
  return call(form, "remove_pick", { p_round: text(form, "round"), p_user: text(form, "user") });
}

export async function remindNoAnswer(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remind_no_answer", { p_round: text(form, "round") });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(groupPath(form), "layout");
  return { ok: data === 1 ? "Reminded 1 person." : `Reminded ${data} people.` };
}

// ------------------------------------------------------------------ picks (member)

function pickArgs(form: FormData) {
  return {
    p_round: text(form, "round"),
    p_menu_item: text(form, "item"),
    p_qty: Math.min(20, Math.max(1, Number(form.get("qty")) || 1)),
    p_options: Object.fromEntries(
      [...form.entries()]
        .filter(([key]) => key.startsWith("option:"))
        .map(([key, value]) => [key.slice("option:".length), String(value)]),
    ),
    p_note: text(form, "note").slice(0, 200),
  };
}

export async function setPick(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await call(form, "set_my_pick", pickArgs(form));
  if (result) return result;
  redirect(groupPath(form));
}

export async function leaderSetPick(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await call(form, "leader_set_pick", { ...pickArgs(form), p_user: text(form, "user") });
  if (result) return result;
  redirect(`${groupPath(form)}/finalize`);
}

export async function setAnswer(_: ActionState, form: FormData) {
  return call(form, "set_my_answer", { p_round: text(form, "round"), p_status: text(form, "status") });
}

export async function repeatLastPick(_: ActionState, form: FormData) {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("order_items")
    .select("id, menu_item_id, qty, options, note")
    .eq("id", text(form, "pick"))
    .maybeSingle();
  if (!last) return { error: "That order could not be found." };
  return call(form, "set_my_pick", {
    p_round: text(form, "round"),
    p_menu_item: last.menu_item_id,
    p_qty: last.qty,
    p_options: last.options,
    p_note: last.note,
  });
}

// ------------------------------------------------------------------ notifications

export async function dismissNotification(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", text(form, "id"));
  revalidatePath("/");
  return null;
}
