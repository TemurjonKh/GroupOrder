import Link from "next/link";
import { Tag } from "@phosphor-icons/react/ssr";
import { AppHeader } from "@/components/app-header";
import { PageTitle, buttonStyles } from "@/components/ui";
import { getT } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("Lunch deals", "점심 특가") };
}

// Limited-time lunch offers from restaurants near Inha. Only the page for now: which restaurants
// take part and how a deal works are still to be decided.
export default async function DealsPage() {
  const { t } = await getT();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageTitle>{t("Lunch deals", "점심 특가")}</PageTitle>
        <p className="mt-3 max-w-[65ch] text-muted">
          {t("Limited-time lunch offers from restaurants near Inha.", "인하대 근처 식당의 기간 한정 점심 특가예요.")}
        </p>
        <div className="mt-8 rounded-[20px] border border-dashed border-line px-6 py-12 text-center">
          <Tag aria-hidden size={36} weight="bold" className="mx-auto text-accent" />
          <p className="mt-3 font-display text-2xl font-extrabold tracking-tight">{t("No deals yet", "아직 특가가 없어요")}</p>
          <p className="mt-2 mb-5 text-muted">{t("When a restaurant runs a lunch deal, it shows up here.", "식당에서 점심 특가를 열면 여기에 보여요.")}</p>
          <Link href="/map" className={buttonStyles.secondary}>{t("Find a meal near Inha", "인하대 근처 식사 찾기")}</Link>
        </div>
      </main>
    </>
  );
}
