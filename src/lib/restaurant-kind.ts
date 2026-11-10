// Food types for the restaurant filter, Coupang Eats style. A restaurant's cuisine comes from its
// brand ("Chicken") or from Daangn and Polle in Korean ("일반 분식", "중식당"), so each type
// matches both. A restaurant can fall under more than one ("디저트카페" is coffee and desserts).
export const RESTAURANT_KINDS = [
  { key: "korean", label: "Korean", korean: "한식", match: /한식|국밥|해장국|곰탕|칼국수|두부|고기|고깃집|갈비|곱창|찜닭|오리|샤브|만두|수산물|해산물|횟집|보쌈|족발|죽/ },
  { key: "chicken", label: "Chicken", korean: "치킨", match: /chicken|치킨|닭강정/i },
  { key: "burger", label: "Burgers", korean: "버거", match: /burger|버거|패스트푸드|fast ?food/i },
  { key: "pizza", label: "Pizza", korean: "피자", match: /pizza|피자/i },
  { key: "snack", label: "Snacks", korean: "분식", match: /분식|떡볶이|김밥|toast|토스트/i },
  { key: "asian", label: "Asian", korean: "아시안", match: /중식|짬뽕|마라|훠궈|양꼬치|초밥|스시|일식|돈까스|우동|소바|라멘|베트남|쌀국수|태국|인도|유부|포케|asian|chinese|japanese|sushi|ramen|pho|curry/i },
  { key: "western", label: "Western", korean: "양식", match: /파스타|브런치|스테이크|경양식|pasta|steak|brunch|western/i },
  { key: "mexican", label: "Mexican", korean: "멕시칸", match: /mexic(?!ana)|멕시(?!카나)|타코|부리또|kebab|케밥|taco|burrito/i },
  { key: "sandwich", label: "Sandwiches", korean: "샌드위치", match: /sandwich|샌드위치|샐러드|salad/i },
  { key: "cafe", label: "Coffee", korean: "카페", match: /coffee|커피|카페|bubble tea|cafe/i },
  { key: "dessert", label: "Desserts", korean: "디저트", match: /ice ?cream|아이스크림|dessert|디저트|빙수|bakery|베이커리|빵/i },
] as const;

export type RestaurantKind = (typeof RESTAURANT_KINDS)[number]["key"];

export function restaurantKinds(restaurant: { name: string; cuisine: string }): RestaurantKind[] {
  const text = `${restaurant.cuisine} ${restaurant.name}`;
  return RESTAURANT_KINDS.filter((kind) => kind.match.test(text)).map((kind) => kind.key);
}

// The round picture on each food-type sticker: a dish from a brand's own menu where one fits, or
// a freely licensed Wikimedia Commons photo, credited in the README.
export const KIND_PHOTOS: Record<RestaurantKind, string> = {
  korean: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/330px-Dolsot-bibimbap.jpg",
  chicken: "https://www.kyochon.com/uploadFiles/TB_ITEM/%EA%B5%90%EC%B4%8C-%ED%97%88%EB%8B%88-%EC%BD%A4%EB%B3%B4(1).png",
  burger: "https://mob-prd.burgerking.co.kr/images/menu/web/thumb/2025/01/06/a31e5bd5-ceab-4548-976f-5fc168965779.png",
  pizza: "https://static.bbqorder.co.kr/menu/af7515b0eb710c87c2d743a2b_2227ea05-27e5-4ca1-922e-e503b7bf15de.jpg",
  snack: "https://static.bbqorder.co.kr/menu/da8b6ddc061d3dea20aef4832_fd489397-4ac3-420c-ac93-ba09a41173a4.png",
  asian: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Samseon_jjamppong.jpg/330px-Samseon_jjamppong.jpg",
  western: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Spaghetti_Bolognese_mit_Parmesan_oder_Grana_Padano.jpg/330px-Spaghetti_Bolognese_mit_Parmesan_oder_Grana_Padano.jpg",
  mexican: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Tacos_de_carnitas.jpg/330px-Tacos_de_carnitas.jpg",
  sandwich: "https://www.subway.co.kr/upload/menu/Italian_B.M.T_20211231094910899.png",
  cafe: "https://mob-prd.burgerking.co.kr/images/menu/web/thumb/2025/01/06/bdf3b729-be05-4fe3-ab89-9943a48ae2a9.png",
  dessert: "https://www.baskinrobbins.co.kr/upload/product/main/be99fe13158f3bd7bcc0b9cfc867a3d5.png",
};

const HANGUL = /[가-힣]/;
/** The cuisine in the chosen language: brands give it in English, Daangn and Polle in Korean. */
export function cuisineLabel(restaurant: { name: string; cuisine: string }, lang: "en" | "ko"): string {
  const korean = HANGUL.test(restaurant.cuisine);
  if ((lang === "ko") === korean) return restaurant.cuisine;
  const kinds = restaurantKinds(restaurant).map((key) => RESTAURANT_KINDS.find((k) => k.key === key)!);
  if (kinds.length === 0) return restaurant.cuisine;
  return kinds.map((k) => (lang === "ko" ? k.korean : k.label)).join(", ");
}
