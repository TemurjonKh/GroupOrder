// Sorts a dish into a meal, a drink, or a dessert or side, so a meal search is not buried in lattes.
// Brands name their categories differently, so this reads the category first and the dish name second.

export type DishKind = "meal" | "drink" | "snack";

export const DISH_KINDS: { key: DishKind; label: string }[] = [
  { key: "meal", label: "Meals" },
  { key: "drink", label: "Drinks" },
  { key: "snack", label: "Desserts and sides" },
];

const DRINK_CATEGORY = /음료|커피|브루|에스프레소|프라푸치노|블렌디드|리프레셔|피지오|^티$|^티·|올가니카|빽스치노|디카페인|에이드|주스|버블티|베버리지|RTD|^\d+oz$|논커피|프라페|^기타$/i;
const SNACK_CATEGORY = /디저트|케이크|초콜릿|요거트|아이스크림|설빙|베이커리|사이드|소스|시즈닝|단품/;
/** Categories that hold more than one kind, where the dish name decides. */
const MIXED_CATEGORY = /신메뉴|추천|베스트|^메뉴$|푸드|음료&디저트/;
const MEAL_FALLBACK = /베스트|^메뉴$|푸드/;

const DRINK_NAME = /라떼|커피|아메리카노|에이드|주스|스무디|프라페|쉐이크|셰이크|(?<!쇼)콜라|사이다|스프라이트|닥터페퍼|환타|펩시|제로\s*\(|킹플로트|밀크티|에스프레소|모카|카푸치노|블렌디드|아이스티|(^|\s)티(\s|$)|티\s*\(|[가-힣]티$|[가-힣]차$|차\s*\(|생수|탄산수|\bICED\b|\bHOT\b|\bTEA\b|coffee|latte|cola|juice|soda/i;
const SNACK_NAME = /케이크|케익|쿠키|머핀|마카롱|아이스크림|소프트|(?<!스)파이(?!시)|도넛|와플|젤리|캔디|타르트|츄러스|선데|소스|시즈닝|피클|치즈가루|할라피뇨|올리브|토핑|크러스트|바이트|감자튀김|프라이|해쉬|너겟|치즈스틱|치즈볼|콘샐러드|코울슬로|비스킷|빙수|팥|떡(?!볶이|갈비)|[가-힣]빵$|크로슈|티라미수|크레이프|크로플|베이글|스콘|약과|페스츄리|크루아상|크로와상|카스텔라|브라우니|슈$|마들렌|휘낭시에|푸딩|젤라또|쥐포|추가(\s|$)/;
const MEAL_NAME = /떡볶이|밥|샌드위치|버거|와퍼|토스트|파스타|스파게티|피자(?!설기)|랩|샐러드|치킨(?!\s*(텐더|너겟|스틱|볼))|덮밥|라면|우동|국수|그라탕|퀘사디아|핫도그|도시락|세트/;

function byName(name: string, fallback: DishKind): DishKind {
  if (DRINK_NAME.test(name) && !MEAL_NAME.test(name) && !SNACK_NAME.test(name)) return "drink";
  if (SNACK_NAME.test(name) && !MEAL_NAME.test(name)) return "snack";
  if (MEAL_NAME.test(name)) return "meal";
  return fallback;
}

/** The kind of dish, from its brand's category and its name. */
export function dishKind(dish: { category: string; name: string }): DishKind {
  const { category, name } = dish;
  if (MIXED_CATEGORY.test(category)) return byName(name, MEAL_FALLBACK.test(category) ? "meal" : "snack");
  if (DRINK_CATEGORY.test(category)) return "drink";
  // A side counts as a meal when it is one, like a bowl of tteokbokki.
  if (SNACK_CATEGORY.test(category)) return MEAL_NAME.test(name) && !SNACK_NAME.test(name) ? "meal" : "snack";
  return SNACK_NAME.test(name) && !MEAL_NAME.test(name) ? "snack" : "meal";
}
