import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CaretDown, Check, HourglassMedium, Prohibit } from "@phosphor-icons/react/ssr";
import { LangSwitch } from "./lang";
import { BrandLogo, DishPhoto, buttonStyles } from "./ui";
import { getRestaurants } from "@/lib/data";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName, type T } from "@/lib/names";
import { formatKrw } from "@/lib/round";

const SIGN_UP = "/signup?next=%2Fgroups%2Fnew";
// Floating food around the hero picture: [picture, position classes, size, delay].
const STICKERS: [string, string, number, number][] = [
  ["/kinds/chicken.png", "-top-14 -left-6 sm:-left-12", 96, 0],
  ["/kinds/pizza.png", "top-24 -right-8 sm:-right-16", 88, 1],
  ["/kinds/cafe.png", "-bottom-14 -left-4 sm:-left-12", 80, 2],
  ["/kinds/dessert.png", "-right-4 -bottom-14 sm:-right-10", 76, 3],
];

/** The front page for visitors who are not logged in: what GroupOrder is, and one way to start. */
export async function Landing() {
  const { lang, t } = await getT();
  const restaurants = await getRestaurants();
  const dishCount = restaurants.reduce((sum, r) => sum + r.menu_items.length, 0);
  // Real dishes for the example board: one photographed, priced dish from three restaurants, brands first.
  const examples = [...restaurants]
    .sort((a, b) => Number(Boolean(b.logo)) - Number(Boolean(a.logo)))
    .map((r) => ({ restaurant: r, dish: [...r.menu_items].sort((a, b) => a.sort_order - b.sort_order).find((d) => d.photo && d.price) }))
    .filter((x) => x.dish)
    .slice(0, 3);

  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">Group<span className="text-accent">Order</span></Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <LangSwitch />
            <Link href="/login" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold text-muted transition-colors hover:bg-soft hover:text-ink sm:inline-flex">{t("Log in", "로그인")}</Link>
            <Link href={SIGN_UP} className={buttonStyles.primary}>{t("Start free", "무료로 시작")}</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: what it is, one action, and proof right under it. */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-4 pt-12 pb-24 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
          <div className="rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-sm font-semibold text-on-accent-soft">
              <Image src="/emoji/plate.png" alt="" width={20} height={20} /> {t("For teams, clubs and classmates near Inha", "인하대 근처 팀, 동아리, 친구들을 위해")}
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              {t("Team lunch,", "팀 점심,")}<br /><span className="text-accent">{t("sorted in one link.", "링크 하나로 끝.")}</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted">
              {t("Share one link. Everyone picks their own dish from any restaurant nearby, with their allergies checked. The leader gets one tidy order with every price added up.",
                "링크 하나만 공유하세요. 각자 근처 어느 식당에서든 메뉴를 고르고, 알레르기도 확인됩니다. 리더는 가격까지 합쳐진 깔끔한 주문서 하나를 받아요.")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={SIGN_UP} className={`${buttonStyles.primary} min-h-13! px-7! text-base!`}>
                {t("Start a free group", "무료로 그룹 만들기")} <ArrowRight aria-hidden size={18} weight="bold" />
              </Link>
              <Link href="/login" className={`${buttonStyles.secondary} min-h-13! px-6! text-base!`}>{t("I have an invite", "초대받았어요")}</Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted">
              {[t("Free", "무료"), t("No app to install", "앱 설치 없음"), t(`${dishCount.toLocaleString("en-US")} real dishes from ${restaurants.length} places`, `식당 ${restaurants.length}곳, 실제 메뉴 ${dishCount.toLocaleString("en-US")}개`)].map((item) => (
                <li key={item} className="flex items-center gap-1.5"><Check aria-hidden size={16} weight="bold" className="text-accent" />{item}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden className="absolute inset-6 -z-10 rounded-full bg-accent-soft blur-2xl" />
            {STICKERS.map(([src, place, size, delay]) => (
              <Image key={src} src={src} alt="" width={size} height={size} aria-hidden
                className={`bob absolute drop-shadow-lg ${place}`} style={{ "--d": delay } as React.CSSProperties} />
            ))}
            {/* The board sits above the food, which peeks out from behind its corners. */}
            <div className="relative z-10"><ExampleBoard t={t} lang={lang} examples={examples} /></div>
          </div>
        </section>

        {/* Proof: real, checkable numbers rather than invented quotes. */}
        <section aria-label={t("GroupOrder in numbers", "숫자로 보는 GroupOrder")} className="border-y border-line bg-surface">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
            {[
              [String(restaurants.length), t("restaurants with real menus", "실제 메뉴가 있는 식당")],
              [dishCount.toLocaleString("en-US"), t("dishes to pick from", "고를 수 있는 메뉴")],
              ["2 km", t("around Inha University", "인하대 주변")],
              ["KOR · ENG", t("every screen in both", "모든 화면 두 언어")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{value}</dd>
                <dd className="mt-1 text-sm text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The problem, in the words of a group chat. */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl leading-tight font-extrabold tracking-tight md:text-5xl">{t("Lunch in the group chat is chaos.", "단톡방 점심 주문은 늘 혼란이죠.")}</h2>
            <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-muted">
              {t("Forty messages to decide on one order, someone's allergy lost on the way, and two people who never answered. GroupOrder puts it all on one live board instead.",
                "주문 하나 정하는 데 메시지 40개, 누군가의 알레르기는 묻히고, 끝까지 답 없는 두 사람. GroupOrder는 이걸 실시간 보드 하나로 정리해요.")}
            </p>
          </div>
          <ul aria-label={t("A typical lunch chat", "흔한 점심 단톡방")} className="space-y-3">
            {[
              [t("Who wanted what again??", "누가 뭐 시킨다고 했지??"), "self-start"],
              [t("Was it no pork for Dana?", "다나 돼지고기 못 먹는 거 맞지?"), "self-end"],
              [t("Still waiting on 2 people…", "아직 2명 답 없음…"), "self-start"],
              [t("Can I add a coffee from somewhere else?", "다른 데서 커피도 추가해도 돼?"), "self-end"],
            ].map(([text, side], i) => (
              <li key={text} className={`rise flex ${side === "self-end" ? "justify-end" : ""}`} style={{ "--i": i * 2 } as React.CSSProperties}>
                <span className={`max-w-[80%] rounded-3xl px-5 py-3 text-base font-medium shadow-sm ${side === "self-end" ? "rounded-br-md bg-[#fee500] text-[#191600]" : "rounded-bl-md bg-surface"}`}>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works: three steps. */}
        <section id="how" className="bg-accent-soft/60 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">{t("How it works", "이렇게 써요")}</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                ["/emoji/link.png", t("Make a group, share the link", "그룹을 만들고 링크 공유"), t("Takes a minute. Drop the link or QR in your team chat; it always opens today's lunch.", "1분이면 돼요. 링크나 QR을 단톡방에 올리면 항상 오늘 점심이 열려요.")],
                ["/emoji/plate.png", t("Everyone picks their own", "각자 메뉴 고르기"), t("Any restaurant nearby, more than one dish, even from two places. Dishes you can eat come first.", "근처 어느 식당이든, 여러 개도, 다른 두 곳에서도. 먹을 수 있는 메뉴가 먼저 보여요.")],
                ["/emoji/bell.png", t("The leader orders once", "리더가 한 번에 주문"), t("One clean list per restaurant with totals, ready to copy. Everyone gets a pop-up when it's ordered.", "식당별로 합계까지 정리된 목록을 복사하면 끝. 주문하면 모두에게 알림이 가요.")],
              ].map(([icon, title, text], i) => (
                <li key={title} className="relative rounded-[28px] bg-surface p-7 shadow-lift">
                  <span aria-hidden className="absolute top-6 right-7 font-display text-5xl font-extrabold text-soft">{i + 1}</span>
                  <Image src={icon} alt="" width={72} height={72} />
                  <h3 className="mt-5 font-display text-2xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features, each tied to what it saves you. */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">{t("Small things that make lunch easy", "점심을 편하게 만드는 작은 기능들")}</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["/emoji/takeout.png", t("Two restaurants? Fine.", "식당 두 곳? 괜찮아요."), t("Chicken from one place, coffee from another. The app asks whether to add it or replace your pick.", "치킨은 이 집, 커피는 저 집. 추가할지 바꿀지 물어봐요.")],
              ["/emoji/peanuts.png", t("Allergies checked, honestly", "알레르기 확인, 정직하게"), t("Tell it once what you avoid. Allergen data comes from the brands, and it never says “safe” when it doesn't know.", "피하는 음식을 한 번만 알려 주세요. 알레르기 정보는 브랜드 자료이고, 모르면 절대 “안전”이라고 하지 않아요.")],
              ["/emoji/clipboard.png", t("A board that updates itself", "저절로 바뀌는 보드"), t("See who's in, who's out and who hasn't answered, with every price, without refreshing.", "누가 참여하고, 불참하고, 아직 답이 없는지 가격까지 새로고침 없이 보여요.")],
              ["/emoji/thumbs.png", t("Suggest a place", "식당 추천하기"), t("Loved that tteokbokki spot? Suggest it and it jumps to the top of everyone's list with your face on it.", "그 떡볶이집 좋았죠? 추천하면 내 얼굴과 함께 모두의 목록 맨 위에 올라가요.")],
              ["/emoji/heart.png", t("Favourites and dish search", "즐겨찾기와 메뉴 검색"), t("Heart what you always get. Search “bulgogi” and see it from every restaurant at once.", "늘 먹는 메뉴엔 하트. “불고기”를 검색하면 모든 식당에서 한 번에 보여요.")],
              ["/emoji/speech.png", t("한국어 and English", "한국어와 English"), t("Every screen, every dish name. Each person picks their own language.", "모든 화면, 모든 메뉴 이름. 각자 원하는 언어로 써요.")],
            ].map(([icon, title, text]) => (
              <li key={title} className="group rounded-[24px] border border-line bg-surface p-6 transition duration-200 hover:-translate-y-1 hover:border-ink hover:shadow-lift">
                <Image src={icon} alt="" width={56} height={56} className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                <h3 className="mt-4 font-display text-xl font-bold tracking-tight">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Trust: where the menus come from. */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-8 rounded-[32px] bg-ink p-8 text-page md:grid-cols-[minmax(0,1fr)_auto] md:p-12">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{t("Real menus. No guessed prices.", "진짜 메뉴. 추측한 가격은 없어요.")}</h2>
              <p className="mt-3 max-w-2xl leading-relaxed opacity-80">
                {t("Chain menus and allergens come from each brand's own site. Local places come from the owner's Daangn profile or from Polle, and say so. When a price isn't published, we show “price not listed” instead of making one up.",
                  "프랜차이즈 메뉴와 알레르기 정보는 각 브랜드 공식 사이트에서, 동네 식당은 사장님의 당근 프로필이나 뽈레에서 가져오고 출처를 밝혀요. 가격이 공개되지 않으면 지어내지 않고 “가격 미공개”로 보여 줘요.")}
              </p>
            </div>
            <div aria-hidden className="flex -space-x-4">
              {examples.map(({ dish }) => <DishPhoto key={dish!.id} src={dish!.photo} sizes="96px" className="size-20 rounded-full border-4 border-ink md:size-24" />)}
            </div>
          </div>
        </section>

        {/* FAQ: the objections people actually have. */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-center font-display text-4xl font-extrabold tracking-tight md:text-5xl">{t("Questions", "자주 묻는 질문")}</h2>
          <div className="mt-10 divide-y divide-line rounded-[24px] border border-line bg-surface">
            {[
              [t("Is it free?", "무료인가요?"), t("Yes. Creating a group, inviting people and picking lunch are all free.", "네. 그룹 만들기, 초대, 메뉴 고르기 모두 무료예요.")],
              [t("Do we need to install an app?", "앱을 설치해야 하나요?"), t("No. It works in any phone or computer browser. Open the link and pick.", "아니요. 휴대폰이나 컴퓨터 브라우저에서 바로 돼요. 링크를 열고 고르면 끝.")],
              [t("Does GroupOrder pay for or deliver the food?", "결제나 배달도 해 주나요?"), t("Not yet. It collects everyone's picks and gives the leader a clean list per restaurant to order by phone, in person or in a delivery app.", "아직은 아니에요. 모두의 메뉴를 모아 식당별로 정리해 드리면, 리더가 전화나 방문, 배달앱으로 주문해요.")],
              [t("How reliable is the allergy check?", "알레르기 확인은 얼마나 믿을 수 있나요?"), t("It uses each brand's published allergen list. Missing data is shown as “no data”, never as safe, so always ask the store if it matters.", "각 브랜드가 공개한 알레르기 표를 사용해요. 정보가 없으면 안전이 아니라 “정보 없음”으로 보여 주니, 중요하다면 꼭 매장에 확인하세요.")],
              [t("Which area does it cover?", "어느 지역에서 쓸 수 있나요?"), t("For now, restaurants within about 2 km of Inha University in Incheon. Chains work anywhere.", "지금은 인천 인하대 주변 약 2km 식당이에요. 프랜차이즈는 어디서든 쓸 수 있어요.")],
              [t("Who can see what I can't eat?", "내가 못 먹는 음식은 누가 볼 수 있나요?"), t("Only you. Your food needs are private; your group just sees your dishes.", "나만 볼 수 있어요. 식단 정보는 비공개이고, 그룹에는 고른 메뉴만 보여요.")],
            ].map(([q, a]) => (
              <details key={q} className="group px-6">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-lg font-bold tracking-tight [&::-webkit-details-marker]:hidden">
                  {q}<CaretDown aria-hidden size={20} weight="bold" className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="-mt-1 pb-5 leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final call to action. */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-[36px] bg-accent px-6 py-14 text-center text-on-accent md:py-20">
            <Image src="/emoji/party.png" alt="" width={96} height={96} className="mx-auto" />
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight md:text-6xl">{t("Tomorrow's lunch, sorted today.", "내일 점심, 오늘 정해 두세요.")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg opacity-90">{t("Make a group in a minute and send the link to your team.", "1분 만에 그룹을 만들고 팀에 링크를 보내세요.")}</p>
            <Link href={SIGN_UP} className="mt-8 inline-flex min-h-13 items-center gap-2 rounded-full bg-surface px-8 text-base font-bold text-ink transition duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.97]">
              {t("Start a free group", "무료로 그룹 만들기")} <ArrowRight aria-hidden size={18} weight="bold" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p><span className="font-display font-extrabold text-ink">Group<span className="text-accent">Order</span></span> · {t("Lunch, picked together.", "점심, 함께 고르기.")}</p>
          <p className="text-xs">{t("Map © OpenStreetMap contributors · Illustrations: Microsoft Fluent Emoji (MIT)", "지도 © OpenStreetMap 기여자 · 일러스트: Microsoft Fluent Emoji (MIT)")}</p>
        </div>
      </footer>
    </div>
  );
}

type Example = { restaurant: Awaited<ReturnType<typeof getRestaurants>>[number]; dish?: Awaited<ReturnType<typeof getRestaurants>>[number]["menu_items"][number] };

/** A picture of the live board, built from real dishes so it matches the app. */
function ExampleBoard({ t, lang, examples }: { t: T; lang: "en" | "ko"; examples: Example[] }) {
  const people = ["Minji", "Jisoo", "Hyun"];
  const total = examples.reduce((sum, x) => sum + (x.dish?.price ?? 0), 0);
  return (
    <div className="relative rounded-[28px] border border-line bg-surface p-5 shadow-lift">
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-extrabold tracking-tight">{t("Who's eating what", "누가 뭘 먹나요")}</p>
        <span className="flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-bold text-on-ok-soft">
          <span className="size-2 animate-pulse rounded-full bg-current" /> {t("Live", "실시간")}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {examples.map(({ restaurant, dish }, i) => (
          <li key={dish!.id} className="flex items-center gap-3 py-2.5">
            <DishPhoto src={dish!.photo} sizes="64px" className="size-14 shrink-0 sm:size-16" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-muted">{people[i]}</span>
              <span className="block truncate text-sm font-bold">{dishName(dish!, lang)}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><BrandLogo restaurant={restaurant} size={20} />{restaurantName(restaurant, lang)}</span>
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums">{formatKrw(dish!.price, lang)}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 py-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-soft text-sm font-bold text-muted grayscale">D</span>
          <span className="text-xs font-semibold text-muted">Dana</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-danger-soft px-2 py-1 text-xs font-bold text-on-danger-soft"><Prohibit aria-hidden size={14} weight="bold" />{t("Not joining", "불참")}</span>
        </li>
        <li className="flex items-center gap-3 py-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-soft text-sm font-bold text-muted">S</span>
          <span className="text-xs font-semibold text-muted">Seo-yeon</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-warn-soft px-2 py-1 text-xs font-bold text-on-warn-soft"><HourglassMedium aria-hidden size={14} weight="bold" />{t("No answer yet", "응답 없음")}</span>
        </li>
      </ul>
      <p className="mt-1 flex items-baseline justify-between border-t-2 border-ink pt-3 font-display">
        <span className="font-bold">{t("Total so far", "지금까지 합계")}</span>
        <span className="text-xl font-extrabold tabular-nums">{formatKrw(total, lang)}</span>
      </p>
    </div>
  );
}
