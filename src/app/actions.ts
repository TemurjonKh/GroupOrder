"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/names";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/round";
import { getLang, getT } from "@/lib/i18n";
import { inviteCodeFrom, safeNext } from "@/lib/url";

export type ActionState = { error?: string; ok?: string } | null;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const groupPath = (form: FormData) => `/g/${encodeURIComponent(text(form, "code"))}`;

/** Calls a database function, then refreshes the group's pages. Returns an error for the form to show. */
async function call(form: FormData, fn: string, args: Record<string, unknown>): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: friendlyError(error.message, await getLang()) };
  revalidatePath(groupPath(form), "layout");
  return null;
}

// ------------------------------------------------------------------ accounts

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(form, "email"),
    password: String(form.get("password") ?? ""),
  });
  if (error) {
    return { error: error.code === "email_not_confirmed" ? t("Please confirm your email first.", "먼저 이메일 인증을 완료해 주세요.") : t("Wrong email or password.", "이메일 또는 비밀번호가 틀렸습니다.") };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const name = text(form, "name");
  if (!name) return { error: t("Please enter your name.", "이름을 입력해 주세요.") };
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
    if (error.code === "weak_password") return { error: t("Please use a longer password (at least 6 characters).", "비밀번호를 더 길게 해 주세요 (6자 이상).") };
    if (error.code === "user_already_exists") return { error: t("That email already has an account. Please log in.", "이미 가입된 이메일입니다. 로그인해 주세요.") };
    if (error.code === "validation_failed" || error.code === "email_address_invalid") return { error: t("Please check your email address.", "이메일 주소를 확인해 주세요.") };
    // Shows up in the hosting logs (Vercel > Logs), with Supabase's own reason.
    console.error("sign-up failed", error.code, error.status, error.message);
    if (error.code === "over_email_send_rate_limit") {
      return { error: t("Too many confirmation emails were sent. Wait an hour, or turn off \"Confirm email\" in Supabase for testing.", "인증 메일을 너무 많이 보냈습니다. 1시간 기다리거나, 테스트 중이면 Supabase에서 \"Confirm email\"을 끄세요.") };
    }
    if (error.code === "email_address_not_authorized") {
      return { error: t("Supabase's built-in email only sends to its project team. Turn off \"Confirm email\" in Supabase, or set up your own SMTP.", "Supabase 기본 메일은 프로젝트 팀에게만 발송됩니다. Supabase에서 \"Confirm email\"을 끄거나 SMTP를 설정하세요.") };
    }
    if (error.code === "signup_disabled") return { error: t("Sign-up is turned off in Supabase (Authentication > Sign In / Providers).", "Supabase에서 가입이 꺼져 있습니다 (Authentication > Sign In / Providers).") };
    if (error.code === "unexpected_failure" || /database error/i.test(error.message)) {
      return { error: t("The database is not set up yet: run the files in supabase/migrations, then supabase/seed.sql.", "데이터베이스가 아직 준비되지 않았습니다: supabase/migrations 파일을 실행한 뒤 supabase/seed.sql을 실행하세요.") };
    }
    return { error: t(`Could not create the account: ${error.message}`, `계정을 만들지 못했습니다: ${error.message}`) };
  }
  if (!data.session) return { ok: t("Almost done: check your email and click the confirmation link.", "거의 끝났어요: 이메일에서 인증 링크를 눌러 주세요.") };
  redirect(`/account/food?welcome=1&next=${encodeURIComponent(next)}`);
}

export async function updateName(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const name = text(form, "name");
  if (!name) return { error: t("Please enter your name.", "이름을 입력해 주세요.") };
  if (name.length > 80) return { error: t("Please keep your name under 80 characters.", "이름은 80자 이내로 해 주세요.") };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("Please log in again.", "다시 로그인해 주세요.") };
  // Row-level security limits this to the caller's own profile.
  const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
  if (error) return { error: t(`Could not save your name: ${error.message}`, `이름을 저장하지 못했습니다: ${error.message}`) };
  revalidatePath("/", "layout");
  return { ok: t("Saved. Your groups now see this name.", "저장했습니다. 이제 그룹에 이 이름이 보입니다.") };
}

/** Saves a profile photo (a small image made in the browser), or removes it when empty. */
export async function updateAvatar(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const avatar = String(form.get("avatar") ?? "");
  if (avatar && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) || avatar.length > 200_000)) {
    return { error: t("That photo is too large or not an image. Please try another.", "사진이 너무 크거나 이미지가 아닙니다. 다른 사진을 골라 주세요.") };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("Please log in again.", "다시 로그인해 주세요.") };
  const { error } = await supabase.from("profiles").update({ avatar: avatar || null }).eq("id", user.id);
  if (error) return { error: t(`Could not save your photo: ${error.message}`, `사진을 저장하지 못했습니다: ${error.message}`) };
  revalidatePath("/", "layout");
  return { ok: avatar ? t("Saved. Your groups now see your photo.", "저장했습니다. 이제 그룹에 내 사진이 보입니다.") : t("Photo removed.", "사진을 지웠습니다.") };
}

export async function saveFoodNeeds(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_food_needs", {
    p_avoid: form.getAll("avoid").map(String),
    p_note: text(form, "note"),
  });
  if (error) {
    console.error("saving food needs failed", error.code, error.message);
    if (error.code === "PGRST202" || error.code === "42883") {
      return { error: t("The database is not set up yet: run the files in supabase/migrations in order, then supabase/seed.sql.", "데이터베이스가 아직 준비되지 않았습니다: supabase/migrations 파일을 순서대로 실행한 뒤 supabase/seed.sql을 실행하세요.") };
    }
    if (error.code === "23503") {
      return { error: t("Your account was made before the database was set up. Run supabase/migrations/20261109000000_backfill_profiles.sql in Supabase, then save again.", "데이터베이스 준비 전에 만든 계정입니다. Supabase에서 supabase/migrations/20261109000000_backfill_profiles.sql을 실행한 뒤 다시 저장하세요.") };
    }
    return { error: t(`Could not save your list: ${error.message}`, `목록을 저장하지 못했습니다: ${error.message}`) };
  }
  revalidatePath("/", "layout");
  if (form.get("next")) redirect(safeNext(form.get("next")));
  return { ok: t("Saved. Menus and the map now check against this list.", "저장했습니다. 이제 메뉴와 지도가 이 목록으로 확인합니다.") };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ------------------------------------------------------------------ groups

export async function createGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", { p_name: text(form, "name"), p_icon: text(form, "icon") });
  if (error) return { error: t("Please enter a group name of up to 80 characters.", "그룹 이름을 80자 이내로 입력해 주세요.") };
  redirect(`/g/${data}`);
}

/** Sends the visitor to the invite page, which shows the group and a Join button. */
export async function goToInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const code = inviteCodeFrom(text(form, "invite"));
  if (!code) return { error: t("Please enter an invite code.", "초대 코드를 입력해 주세요.") };
  redirect(`/g/${encodeURIComponent(code)}`);
}

export async function joinGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await call(form, "join_group", { p_code: text(form, "code") });
  if (result) return result;
  redirect(groupPath(form));
}

export async function updateGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const restaurants = form.getAll("restaurants").map(String);
  if (restaurants.length > 3) return { error: t("Choose up to 3 default restaurants.", "기본 식당은 최대 3곳까지 고를 수 있습니다.") };
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  if (!text(form, "lat") || !text(form, "lng") || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) {
    return { error: t("Please enter a valid latitude and longitude.", "올바른 위도와 경도를 입력해 주세요.") };
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
  if (error || !data?.length) return { error: t("Could not save. Only leaders can change group settings.", "저장하지 못했습니다. 그룹 설정은 리더만 바꿀 수 있습니다.") };
  revalidatePath(groupPath(form), "layout");
  return { ok: t("Saved.", "저장했습니다.") };
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

/** A leader takes one dish off someone's picks. */
export async function removePickLine(_: ActionState, form: FormData) {
  return call(form, "remove_pick_line", { p_line: text(form, "line") });
}

export async function remindNoAnswer(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remind_no_answer", { p_round: text(form, "round") });
  if (error) return { error: friendlyError(error.message, await getLang()) };
  revalidatePath(groupPath(form), "layout");
  return { ok: data === 1 ? t("Reminded 1 person.", "1명에게 알렸습니다.") : t(`Reminded ${data} people.`, `${data}명에게 알렸습니다.`) };
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
  // "Replace" swaps all of the person's dishes for this one; anything else adds it.
  const result = await call(form, form.get("mode") === "replace" ? "replace_my_picks" : "set_my_pick", pickArgs(form));
  if (result) return result;
  redirect(groupPath(form));
}

export async function leaderSetPick(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await call(form, "leader_set_pick", { ...pickArgs(form), p_user: text(form, "user") });
  if (result) return result;
  redirect(`${groupPath(form)}/finalize`);
}

/** Suggests a restaurant to the group for this round, or takes the caller's own suggestion back. */
export async function suggestRestaurant(_: ActionState, form: FormData) {
  return call(form, form.get("undo") ? "unsuggest_restaurant" : "suggest_restaurant",
    { p_round: text(form, "round"), p_restaurant: text(form, "restaurant") });
}

/** Hearts a dish, or takes the heart off. */
export async function toggleFavourite(_: ActionState, form: FormData) {
  return call(form, "toggle_favourite", { p_menu_item: text(form, "dish") });
}

/** Takes one dish off the caller's own picks. */
export async function removeMyPick(_: ActionState, form: FormData) {
  return call(form, "remove_my_pick", { p_line: text(form, "line") });
}

export async function setAnswer(_: ActionState, form: FormData) {
  return call(form, "set_my_answer", { p_round: text(form, "round"), p_status: text(form, "status") });
}

export async function repeatLastPick(_: ActionState, form: FormData) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("order_items")
    .select("id, menu_item_id, qty, options, note")
    .eq("id", text(form, "pick"))
    .maybeSingle();
  if (!last) return { error: t("That order could not be found.", "그 주문을 찾을 수 없습니다.") };
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

// ------------------------------------------------------------------ language

/** Remembers the KOR/ENG choice for a year. Setting a cookie in an action re-renders the page. */
export async function setLanguage(lang: Lang) {
  (await cookies()).set(LANG_COOKIE, lang === "ko" ? "ko" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
