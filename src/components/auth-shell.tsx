import { getShowcase } from "@/lib/data";
import { getT } from "@/lib/i18n";
import { LangSwitch } from "./lang";
import { DishPhoto } from "./ui";

const TURNS = ["-7deg", "4deg", "-3deg", "6deg", "-5deg", "3deg"];

/** Split screen for login and sign up: the form next to real dishes from the menus. */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const dishes = await getShowcase(6);
  const { t } = await getT();
  return (
    <main className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-20">
        <div className="mb-10 flex items-center justify-between gap-4">
          <p className="font-display text-2xl font-extrabold tracking-tight">Group<span className="text-accent">Order</span></p>
          <LangSwitch />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <aside aria-hidden className="relative hidden overflow-hidden bg-accent lg:flex lg:flex-col lg:justify-center lg:px-16">
        <p className="relative font-display text-6xl leading-[0.95] font-extrabold tracking-tight text-on-accent xl:text-7xl">
          {t("Everyone picks.", "각자 고르고,")}<br />{t("One order.", "한 번에 주문.")}
        </p>
        <div className="relative mt-12 grid max-w-xl grid-cols-3 gap-4">
          {dishes.map((dish, i) => (
            <span key={dish.name} className="settle" style={{ "--i": i, "--turn": TURNS[i], "--turn-from": "0deg" } as React.CSSProperties}>
              <DishPhoto src={dish.photo} sizes="200px" className="aspect-square w-full rounded-[20px] shadow-lift" />
            </span>
          ))}
        </div>
      </aside>
    </main>
  );
}
