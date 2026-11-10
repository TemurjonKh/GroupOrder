"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { setLanguage } from "@/app/actions";
import { translator, type Lang } from "@/lib/names";

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => translator(useLang());

/** KOR | ENG at the top right. The choice is kept in a cookie so every page renders in it. */
export function LangSwitch() {
  const lang = useLang();
  const [pending, start] = useTransition();
  const choose = (next: Lang) => start(() => setLanguage(next));
  const other: Lang = lang === "ko" ? "en" : "ko";
  return (
    <>
      {/* On a phone there is room for one button: it switches to the other language. */}
      <button type="button" onClick={() => choose(other)} aria-busy={pending}
        aria-label={other === "ko" ? "한국어로 보기 (KOR)" : "View in English (ENG)"}
        className="flex h-9 cursor-pointer items-center rounded-full border border-line bg-surface px-2.5 text-xs font-bold text-muted hover:text-ink sm:hidden">
        {other === "ko" ? "KOR" : "ENG"}
      </button>
      <div role="group" aria-label="Language / 언어" aria-busy={pending} className="hidden h-9 items-center rounded-full border border-line bg-surface p-0.5 text-xs font-bold sm:flex">
        {([["ko", "KOR"], ["en", "ENG"]] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={lang === value} onClick={() => choose(value)}
            className={`h-full cursor-pointer rounded-full px-2.5 transition-colors ${lang === value ? "bg-ink text-page" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
