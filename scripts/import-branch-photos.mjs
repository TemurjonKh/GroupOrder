// npm run menus:photos -- <folder> <slug>: turns the photos that came with a branch menu
// (data/restaurants/<slug>/menu.json, each dish's image_file) into small files in
// public/restaurants/<slug>/, so the app serves them itself instead of linking to where they were found.
// <folder> holds the original images/ folder; the originals are large and are not kept in the repo.
// Uses sharp, which comes with Next.js for image resizing.
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";
import { leftOut } from "./menu-helpers.mjs";

const [source, slug = "burger-king-inha"] = process.argv.slice(2);
if (!source) throw new Error("Usage: npm run menus:photos -- <folder with images/> <slug>");

const { menu } = JSON.parse(readFileSync(`data/restaurants/${slug}/menu.json`, "utf8"));
const out = `public/restaurants/${slug}`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The largest dish tile is 260 px wide, so 480 px stays sharp on 2x screens.
const SIZE = 480;
const dishes = menu.filter((d) => d.image_file && !leftOut(d));
for (const dish of dishes) {
  const file = join(source, dish.image_file);
  const name = join(out, basename(dish.image_file, extname(dish.image_file)));
  if ((await sharp(file).stats()).isOpaque) {
    // A photo with its own background: a centred square that fills the tile (the app shows .jpg edge to edge).
    await sharp(file).resize(SIZE, SIZE, { fit: "cover" }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${name}.jpg`);
  } else {
    // A cut-out on a wide transparent canvas: trim it, then centre the food in a square.
    await sharp(file).trim().resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 }).toFile(`${name}.webp`);
  }
}
console.log(`${out}: ${dishes.length} photos`);
