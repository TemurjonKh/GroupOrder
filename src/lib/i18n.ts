import { cache } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, translator, type Lang } from "./names";

/** The visitor's language, from the KOR/ENG switch. English unless they chose Korean. */
export const getLang = cache(async (): Promise<Lang> =>
  ((await cookies()).get(LANG_COOKIE)?.value === "ko" ? "ko" : "en"));

export async function getT() {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
