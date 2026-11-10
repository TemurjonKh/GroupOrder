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
