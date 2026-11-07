export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  logo: string | null;
  logo_bg: string | null;
  address: string | null;
  /** Null for a chain with no single location: available anywhere. */
  lat: number | null;
  lng: number | null;
  phone: string | null;
  delivery_link: string | null;
  /** Set for one independent restaurant's menu; null for a chain's menu, shared by its branches. */
  place_id: string | null;
  /** The page the menu was imported from. */
  menu_source: string | null;
  /** "Daangn" or "Polle" for a local menu; null for a chain's own site. */
  menu_source_name: string | null;
  menu_note: string | null;
  /** When the source last changed the menu, if it says. */
  menu_updated: string | null;
  menu_checked: string | null;
};

export type MenuOption = { name: string; choices: string[] };

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  photo: string | null;
  /** Null when the brand does not publish a price. */
  price: number | null;
  category: string;
  description: string | null;
  sort_order: number;
  options: MenuOption[];
  /** Null when the brand publishes no allergen data for this dish. That means unknown, never "free from". */
  contains: string[] | null;
  may_contain: string[] | null;
  ingredients: string[];
  allergen_source: string | null;
  allergen_note: string | null;
  /** Parts of a set with no published data, so the set can never read as clear. */
  allergen_gaps: string[];
};

/** What a person avoids. Only they can read it. */
export type FoodNeeds = { avoid: string[]; note: string | null };

export type Place = {
  id: string;
  source: "openstreetmap" | "brand" | "daangn" | "polle";
  name: string;
  name_en: string | null;
  kind: string;
  cuisine: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  website: string | null;
  /** Tags added by OpenStreetMap volunteers, such as "vegan". */
  diet_tags: string[];
  /** The chain whose menu this branch serves, when it is in the database. */
  restaurant_id: string | null;
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
  deadline: string | null;
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
  price_at_pick: number | null;
  status: PickStatus;
  menu_item: (MenuItem & { restaurant: Restaurant }) | null;
};
