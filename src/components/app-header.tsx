import Link from "next/link";
import { Bell, Carrot, MapTrifold, Plus, SignOut, UserCircle } from "@phosphor-icons/react/ssr";
import { signOut } from "@/app/actions";
import { getUser } from "@/lib/data";
import { HeaderNav } from "./client-bits";
import { NotificationPopups } from "./notification-popups";
import { buttonStyles } from "./ui";

const MAX_BADGE = 20;
const LINKS = [
  { href: "/map", label: "Food map", icon: <MapTrifold aria-hidden size={16} weight="bold" /> },
  { href: "/account/food", label: "My food needs", icon: <Carrot aria-hidden size={16} weight="bold" /> },
  { href: "/account", label: "My account", icon: <UserCircle aria-hidden size={16} weight="bold" /> },
];

export async function AppHeader() {
  const { supabase } = await getUser();
  const { data } = await supabase.from("notifications").select("id").is("read_at", null).limit(MAX_BADGE);
  const unread = data?.length ?? 0;
  return (
    <>
    <header className="sticky top-0 z-20 border-b border-line bg-page/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            Group<span className="text-accent">Order</span>
          </Link>
          <HeaderNav links={LINKS} className="hidden md:flex" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {unread > 0 && (
            <Link href="/" aria-label={`${unread} unread notices`} className="flex min-h-11 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-bold text-on-accent-soft">
              <Bell weight="fill" aria-hidden size={16} /> {unread}
            </Link>
          )}
          <Link href="/groups/join" aria-label="Join group" className={`${buttonStyles.secondary} px-3.5! sm:px-5!`}>
            <span>Join<span className="hidden sm:inline"> group</span></span>
          </Link>
          <Link href="/groups/new" aria-label="Create group" className={`${buttonStyles.primary} w-11 px-0! sm:w-auto sm:px-5!`}>
            <Plus weight="bold" aria-hidden size={16} className="shrink-0" />
            <span className="hidden sm:inline">Create group</span>
          </Link>
          <form action={signOut}>
            <button aria-label="Log out" className="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink">
              <SignOut aria-hidden size={20} />
            </button>
          </form>
        </div>
      </div>
    </header>
    {/* On a phone the links get their own row, which scrolls away so menus keep their sticky categories. */}
    <HeaderNav links={LINKS} className="no-scrollbar overflow-x-auto border-b border-line px-3 py-1.5 md:hidden print:hidden" />
    <NotificationPopups />
    </>
  );
}
