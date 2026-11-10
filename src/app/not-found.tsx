import Link from "next/link";
import { buttonStyles } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{t("Nothing on this plate.", "접시가 비어 있어요.")}</h1>
      <p className="mt-3 mb-6 text-muted">{t("That page or invite code does not exist. Check the link with whoever sent it.", "페이지나 초대 코드가 없습니다. 링크를 보낸 사람에게 확인해 주세요.")}</p>
      <Link href="/" className={`${buttonStyles.primary} self-start`}>{t("Back to my groups", "내 그룹으로")}</Link>
    </main>
  );
}
