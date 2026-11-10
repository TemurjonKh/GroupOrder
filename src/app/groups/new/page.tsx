import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { createGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { getT } from "@/lib/i18n";

const ICONS = ["🍱", "🏢", "🥋", "🏋️", "🎓", "🍗", "🍔", "☕"];

export default async function NewGroupPage() {
  const { t } = await getT();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-8">
        <Link href="/" className={textLink}><ArrowLeft aria-hidden size={16} /> {t("My groups", "내 그룹")}</Link>
        <div className="rise mt-4">
          <PageTitle>{t("Create a group", "그룹 만들기")}</PageTitle>
          <p className="mt-3 mb-8 text-muted">{t("A work team, a club, the gym crew. You become its leader, and lunch picks open right away.", "회사 팀, 동아리, 운동 모임 등. 내가 리더가 되고 점심 메뉴 고르기가 바로 시작됩니다.")}</p>
          <ActionForm action={createGroup} className="space-y-6">
            <Field label={t("Group name", "그룹 이름")}><input name="name" required maxLength={80} autoFocus className={inputStyles} /></Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("Icon", "아이콘")}</legend>
              <div className="grid grid-cols-4 gap-2">
                {ICONS.map((icon, i) => (
                  <label key={icon} className="relative block cursor-pointer">
                    <input type="radio" name="icon" value={icon} defaultChecked={i === 0} className="peer absolute opacity-0" />
                    <span className="flex h-14 items-center justify-center rounded-xl border border-line bg-surface text-2xl transition-colors peer-checked:border-2 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{icon}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button className="w-full">{t("Create group", "그룹 만들기")}</Button>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
