import type { MapDish } from "./types";

// The food map sends every dish to the browser, so blank fields are left out on the way and put
// back on arrival. contains and may_contain lose only null: an empty list there means the brand
// lists nothing, which is different from no data at all.
const BLANK = {
  photo: null, price: null, description: null, contains: null, may_contain: null,
  ingredients: [], allergen_source: null, allergen_note: null, allergen_gaps: [],
} satisfies Partial<MapDish>;
const EMPTY_LIST_MEANS_BLANK = new Set(["ingredients", "allergen_gaps"]);

export type CompactDish = Pick<MapDish, "id" | "name" | "category"> & Partial<MapDish>;

export function compactDish(dish: MapDish): CompactDish {
  return Object.fromEntries(Object.entries(dish).filter(([key, value]) =>
    value !== null && !(EMPTY_LIST_MEANS_BLANK.has(key) && Array.isArray(value) && value.length === 0))) as CompactDish;
}

export function fullDish(dish: CompactDish): MapDish {
  return { ...BLANK, ...dish };
}
