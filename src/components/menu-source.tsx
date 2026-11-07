import type { Restaurant } from "@/lib/types";
import { textLink } from "@/components/ui";

const day = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Where a menu came from and how far to trust it, with a link to the page itself. */
export function MenuSource({ restaurant }: {
  restaurant: Pick<Restaurant, "name" | "place_id" | "menu_source" | "menu_source_name" | "menu_note" | "menu_updated" | "menu_checked">;
}) {
  const { name, place_id, menu_source, menu_source_name, menu_note, menu_updated, menu_checked } = restaurant;
  const link = menu_source && /^https:\/\//.test(menu_source) && (
    <a href={menu_source} target="_blank" rel="noreferrer" className={textLink}>
      {menu_source_name ? `See it on ${menu_source_name}` : "Brand site"}
    </a>
  );
  // A chain's menu from its own site. A franchise menu from another branch's listing says so in its note.
  if (!place_id && !menu_source_name) {
    return <>From {name}&apos;s own site. A branch may not sell every dish. {link}</>;
  }
  return (
    <>
      {menu_note ?? `From ${menu_source_name}.`}
      {menu_updated && ` Last changed there ${day(menu_updated)}.`}
      {menu_checked && ` Imported ${day(menu_checked)}.`}
      {" "}No allergen data. {link}
    </>
  );
}
