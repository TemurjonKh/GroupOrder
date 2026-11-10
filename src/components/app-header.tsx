import Link from "next/link";
import { Bell, Carrot, MapTrifold, Plus, SignOut, UsersThree } from "@phosphor-icons/react/ssr";
import { signOut } from "@/app/actions";
import { getUser } from "@/lib/data";
import { HeaderNav } from "./client-bits";
import { LangSwitch } from "./lang";
import { getT } from "@/lib/i18n";
import { NotificationPopups } from "./notification-popups";
import { Avatar, buttonStyles } from "./ui";

const MAX_BADGE = 20;


export async function AppHeader() {
  const { supabase, user } = await getUser();
  const { t } = await getT();
  const LINKS = [
    { href: "/map", label: t("Food map", "푸드맵"), icon: <MapTrifold aria-hidden size={16} weight="bold" /> },
    { href: "/account/food", label: t("My food needs", "내 식단 정보"), icon: <Carrot aria-hidden size={16} weight="bold" /> },
  ];
  const [{ data }, { data: profile }] = await Promise.all([
    supabase.from("notifications").select("id").is("read_at", null).limit(MAX_BADGE),
    supabase.from("profiles").select("name, avatar").eq("id", user.id).maybeSingle<{ name: string; avatar: string | null }>(),
  ]);
  const unread = data?.length ?? 0;
  return (
    <>
    <header className="sticky top-0 z-20 border-b border-line bg-page/85 backdrop-blur-md print:hidden">
      <div className="flex h-16 w-full items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight sm:text-2xl">
            Group<span className="text-accent">Order</span>
          </Link>
          <HeaderNav links={LINKS} className="hidden md:flex" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {unread > 0 && (
            <Link href="/" aria-label={t(`${unread} unread notices`, `읽지 않은 알림 ${unread}개`)} className="flex min-h-11 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-bold text-on-accent-soft">
              <Bell weight="fill" aria-hidden size={16} /> {unread}
            </Link>
          )}
          {/* On a phone, Join group sits in the second row so the language switch and profile fit. */}
          <span className="hidden sm:block">
            <Link href="/groups/join" aria-label={t("Join group", "그룹 참여")} className={`${buttonStyles.secondary} px-5!`}>
              {t("Join group", "그룹 참여")}
            </Link>
          </span>
          <Link href="/groups/new" aria-label={t("Create group", "그룹 만들기")} className={`${buttonStyles.primary} w-11 px-0! sm:w-auto sm:px-5!`}>
            <Plus weight="bold" aria-hidden size={16} className="shrink-0" />
            <span className="hidden sm:inline">{t("Create group", "그룹 만들기")}</span>
          </Link>
          <LangSwitch />
          <Link href="/account" aria-label={t("My account", "내 계정")} title={t("My account", "내 계정")}
            className="rounded-xl ring-2 ring-transparent transition hover:ring-ink focus-visible:ring-ink">
            <Avatar src={profile?.avatar} name={profile?.name ?? "?"} size={36} />
          </Link>
          {/* On a phone, Log out is on the My account page. */}
          <form action={signOut} className="hidden sm:block">
            <button aria-label={t("Log out", "로그아웃")} className="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink">
              <SignOut aria-hidden size={20} />
            </button>
          </form>
        </div>
      </div>
    </header>
    {/* On a phone the links get their own row, which scrolls away so menus keep their sticky categories. */}
    <HeaderNav links={[...LINKS, { href: "/groups/join", label: t("Join group", "그룹 참여"), icon: <UsersThree aria-hidden size={16} weight="bold" /> }]}
      className="no-scrollbar overflow-x-auto border-b border-line px-3 py-1.5 md:hidden print:hidden" />
    <NotificationPopups />
    </>
  );
}
