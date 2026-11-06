export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  logo: string | null;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  delivery_link: string | null;
};

export type MenuOption = { name: string; choices: string[] };

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  photo: string | null;
  price: number;
  options: MenuOption[];
};

export type Group = {
  id: string;
  name: string;
  icon: string;
  lat: number;
  lng: number;
  location_label: string;
  invite_code: string;
  default_restaurant_ids: string[];
  default_deadline: string;
};

export type Role = "member" | "leader";
export type Member = { user_id: string; role: Role; name: string; avatar: string | null };

export type RoundStatus = "open" | "finalized" | "ordered";
export type Round = {
  id: string;
  group_id: string;
  title: string;
  deadline: string;
  mode: "delivery" | "pickup" | "dine-in";
  status: RoundStatus;
  allowed_restaurant_ids: string[];
  created_at: string;
  finalized_at: string | null;
};

export type PickStatus = "draft" | "skipped" | "confirmed" | "removed" | "cancelled";

/** An order_items row with its dish and restaurant attached. */
export type OrderPick = {
  id: string;
  round_id: string;
  user_id: string;
  qty: number;
  options: Record<string, string>;
  note: string | null;
  price_at_pick: number;
  status: PickStatus;
  menu_item: (MenuItem & { restaurant: Restaurant }) | null;
};
