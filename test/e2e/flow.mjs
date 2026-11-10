// Browser test of the whole platform against a running local mode. To run it:
//   LOCAL_DATA_DIR=.local-test PORT=3100 LOCAL_BACKEND_PORT=54322 npm run dev:local
//   npx playwright install chromium-headless-shell   (once)
//   E2E_BASE=http://localhost:3100 npm run test:e2e
// It expects fresh demo data, so delete .local-test before starting the app.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SHOTS ?? "test/e2e/screenshots";
const CODE = "demoteam01";
mkdirSync(SHOTS, { recursive: true });

const BLANK_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const tileRequests = [];
const browser = await chromium.launch();
const problems = [];
let passed = 0, failed = 0;

async function person({ viewport = { width: 1280, height: 860 }, colorScheme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  ctx.setDefaultTimeout(9000);
  // OpenStreetMap's tile policy rules out headless browsers, so the test map gets a blank tile.
  await ctx.route("https://tile.openstreetmap.org/**", (route) => {
    tileRequests.push(route.request().url());
    return route.fulfill({ contentType: "image/png", body: BLANK_PNG });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror ${page.url()}: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  return page;
}
async function step(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${String(e.message).split("\n").slice(0, 4).join("\n     ")}`); }
}
const see = (page, text, timeout = 9000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });
async function login(page, email, next = "") {
  await page.goto(`${BASE}${next}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo1234");
  await page.getByRole("button", { name: "Log in" }).click();
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const settled = (page) => page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
async function brokenImages(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
    window.scrollTo(0, 0);
  });
  await settled(page);
  // Photos are resized on first request, which takes a while on a fresh start.
  // Photos hidden at this screen width (shown only on wider screens) are never loaded, by design.
  await page.waitForFunction(() => [...document.images].filter((i) => i.checkVisibility()).every((i) => i.complete), null, { timeout: 90000 }).catch(() => {});
  // An image still waiting to load counts as a failure too, not just one that errored.
  return page.evaluate(() => {
    const images = [...document.images].filter((i) => i.checkVisibility());
    return { total: images.length, broken: images.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src) };
  });
}

const temur = await person();
const minji = await person({ viewport: { width: 390, height: 800 } });
const dana = await person();

await step("login page shows real dishes; wrong password keeps the email", async () => {
  await temur.goto(BASE);
  await temur.getByLabel("Email").fill("temur@demo.test");
  await temur.getByLabel("Password").fill("nope");
  await temur.getByRole("button", { name: "Log in" }).click();
  await see(temur, "Wrong email or password");
  if ((await temur.getByLabel("Email").inputValue()) !== "temur@demo.test") throw new Error("email was cleared");
  await settled(temur);
  const { broken, total } = await brokenImages(temur);
  if (total === 0 || broken.length) throw new Error(`images ${total}, broken ${broken}`);
  await shot(temur, "01-login");
});
await step("My groups is a vertical list; create and join live top right", async () => {
  await temur.getByLabel("Password").fill("demo1234");
  await temur.getByRole("button", { name: "Log in" }).click();
  await see(temur, "My groups");
  const rows = temur.locator("main ul > li");
  const [a, b] = [await rows.nth(0).boundingBox(), await rows.nth(1).boundingBox()];
  if (!(b.y > a.y + a.height - 1) || Math.abs(a.x - b.x) > 1) throw new Error("groups are not stacked");
  for (const name of ["Create group", "Join group"]) {
    const box = await temur.getByRole("link", { name, exact: true }).boundingBox();
    if (box.y > 70 || box.x < 640) throw new Error(`${name} is not top right`);
  }
  await see(temur, "Lunch open: 2 of 4 picked");
  await settled(temur);
  await temur.waitForTimeout(1200); // let the entry animation finish
  await shot(temur, "02-home");
});
await step("create group page makes a group with picks already open", async () => {
  await temur.getByRole("link", { name: "Create group", exact: true }).click();
  await temur.getByLabel("Group name").fill("Gym friends");
  await shot(temur, "03-new-group");
  await temur.getByRole("button", { name: "Create group" }).click();
  await see(temur, "Where to order from");
  await see(temur, "Picks open");
});
await step("group page shows the three brands and live members", async () => {
  await temur.goto(`${BASE}/g/${CODE}`);
  for (const name of ["BBQ", "Burger King", "Subway"]) await temur.getByRole("link", { name: new RegExp(name) }).waitFor();
  await see(temur, "황금올리브치킨");
  await see(temur, "No answer yet");
  if (await temur.getByText("Picks are closed").count()) throw new Error("picks closed");
  const { broken, total } = await brokenImages(temur);
  if (total < 15 || broken.length) throw new Error(`images ${total}, broken ${broken.slice(0, 3)}`);
  await temur.waitForTimeout(800);
  await shot(temur, "04-group");
});
await step("every brand's full menu loads with its photos", async () => {
  for (const [name, min] of [["BBQ", 90], ["Burger King", 190], ["Subway", 90]]) {
    await temur.goto(`${BASE}/g/${CODE}`);
    await temur.getByRole("link", { name: new RegExp(name) }).click();
    await temur.locator("main section h3").first().waitFor();
    const { broken, total } = await brokenImages(temur);
    if (total < min) throw new Error(`${name}: only ${total} images`);
    if (broken.length) throw new Error(`${name}: ${broken.length} of ${total} broken, e.g. ${broken[0]}`);
    console.log(`     ${name}: ${total} photos loaded`);
    await shot(temur, `05-menu-${name.replace(" ", "")}`);
  }
});
await step("my food needs: tick pork and peanut, and it stays saved", async () => {
  await temur.goto(BASE);
  await temur.getByRole("link", { name: /Tell us what you can't eat/ }).click();
  await temur.getByRole("checkbox", { name: /^Pork/ }).check();
  await temur.getByRole("checkbox", { name: /^Peanut and peanut butter/ }).check();
  await temur.getByLabel("Anything else?").fill("kiwi");
  await settled(temur);
  await shot(temur, "20-food-needs");
  await temur.getByRole("button", { name: "Save my food needs" }).click();
  await see(temur, "Saved.");
  await temur.reload();
  if (!(await temur.getByRole("checkbox", { name: /^Pork/ }).isChecked())) throw new Error("pork was not saved");
  if ((await temur.getByLabel("Anything else?").inputValue()) !== "kiwi") throw new Error("note was not saved");
});
await step("menus warn about what a person avoids, and say when there is no data", async () => {
  await temur.goto(`${BASE}/g/${CODE}`);
  await temur.getByRole("link", { name: /Burger King/ }).click();
  await see(temur, "Dishes are checked against your food needs");
  const bacon = temur.locator("a[href*='dish=']", { hasText: "베이컨치즈와퍼" }).first();
  await bacon.getByText(/Contains: .*Pork/).waitFor();
  await temur.locator("a[href*='dish=']", { hasText: "프렌치프라이(R)" }).first().getByText("No data").waitFor();
  await temur.locator("a[href*='dish=']", { hasText: /^.*와퍼.*₩/ }).first().waitFor();
  if (await temur.getByText(/\bsafe\b/i).count()) throw new Error('a page says "safe"');
  await shot(temur, "21-menu-badges");
  await temur.locator("a[href*='dish=']", { hasText: /^와퍼 세트/ }).first().click();
  const sheet = temur.locator("dialog[open]");
  await sheet.getByText("What's inside").waitFor();
  await sheet.getByText("No data for:", { exact: true }).waitFor();
  await sheet.getByText("프렌치프라이(R)").first().waitFor();
  await temur.waitForTimeout(500);
  await temur.screenshot({ path: `${SHOTS}/22-sheet-facts.png` });
});
await step("food map: everything within 2 km is listed and drawn", async () => {
  await temur.goto(`${BASE}/map`);
  await see(temur, "Find a meal near Inha");
  await temur.locator(".leaflet-interactive").first().waitFor();
  const dots = await temur.locator("path.leaflet-interactive").count();
  if (dots < 220) throw new Error(`only ${dots} places drawn`);
  await temur.getByRole("link", { name: "OpenStreetMap" }).waitFor();
  await temur.getByRole("tab", { name: /Places \(\d+\)/ }).click();
  await temur.getByRole("button", { name: /버거킹 인하대역점/ }).click();
  await temur.locator(".leaflet-popup-content").getByText("독배로 309").waitFor();
  await temur.waitForTimeout(600);
  if (!tileRequests.length || !tileRequests.every((u) => /\/\d+\/\d+\/\d+\.png$/.test(u))) throw new Error(`tiles: ${tileRequests.slice(0, 2)}`);
  console.log(`     ${dots} places drawn, ${tileRequests.length} tile requests`);
  await shot(temur, "23-map-places");
});
await step("food map: search starts from my needs and hides what I avoid", async () => {
  await temur.getByRole("tab", { name: /Meals \(\d+\)/ }).click();
  if ((await temur.getByRole("button", { name: "No pork", exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error("my pork need was not applied");
  const text = await temur.locator("main").innerText();
  for (const dish of ["베이컨치즈와퍼", "잠봉 플러스 Jambon Plus", "비엘티 B.L.T."]) if (text.includes(dish)) throw new Error(`${dish} shown to someone avoiding pork`);
  if (text.includes("No data") || text.includes("May contain")) throw new Error("strict search showed unknown dishes");
  await temur.getByLabel("Also show").check();
  await see(temur, "No data");
  await temur.getByLabel("Only meals with nothing").check();
  await temur.getByRole("button", { name: "Clear filters" }).click();
  const all = Number((await temur.getByRole("tab", { name: /Meals/ }).innerText()).match(/\d+/)[0]);
  if (all < 390) throw new Error(`clearing filters left ${all} meals`);
});
await step("food map: vegan search is honest about what it can show", async () => {
  await temur.getByRole("button", { name: "Vegan", exact: true }).click();
  const vegan = Number((await temur.getByRole("tab", { name: /Meals/ }).innerText()).match(/\d+/)[0]);
  // Only the dishes: a branch called BBQ치킨 is still a fine place to walk past.
  const text = (await temur.locator("main details summary").allInnerTexts()).join(" | ");
  for (const word of ["치킨", "베이컨", "참치", "쉬림프", "치즈", "에그"]) if (text.includes(word)) throw new Error(`vegan search shows ${word}: ${text.slice(0, 200)}`);
  console.log(`     vegan: ${vegan} meals with nothing listed: ${text.replaceAll("\n", " ")}`);
  await shot(temur, "24-map-vegan");
  // Every Whopper has beef in it, so a vegan search rightly finds none.
  await temur.getByLabel("Search meals and places").fill("와퍼");
  await see(temur, "Meals (0)");
  await see(temur, "No meal has everything ruled out");
  await temur.getByLabel("Search meals and places").fill("샐러드");
  await temur.getByRole("button", { name: "Vegan", exact: true }).click();
  await temur.getByRole("button", { name: "No pork", exact: true }).click();
  await temur.locator("details summary", { hasText: "샐러드" }).first().click();
  await temur.locator("details[open]").getByText(/Source:|no allergen list/).first().waitFor();
  await shot(temur, "25-map-search");
});
await step("food map: meals by default, a price limit, and the new quick filters", async () => {
  await temur.goto(`${BASE}/map`);
  await temur.getByRole("button", { name: "Clear filters" }).click();
  if ((await temur.getByRole("button", { name: "Meals", exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error("meals are not the default");
  const meals = Number((await temur.getByRole("tab", { name: /Meals \(/ }).innerText()).match(/\d+/)[0]);
  await temur.getByRole("button", { name: "Drinks", exact: true }).click();
  const withDrinks = Number((await temur.getByRole("tab", { name: /Meals \(/ }).innerText()).match(/\d+/)[0]);
  if (!(withDrinks > meals + 500)) throw new Error(`drinks did not add many dishes: ${meals} -> ${withDrinks}`);
  await temur.getByRole("button", { name: "Drinks", exact: true }).click();
  await temur.getByLabel("Price").selectOption("5000");
  const prices = (await temur.locator("main details summary").allInnerTexts()).map((t) => t.match(/₩([\d,]+)/)?.[1]).filter(Boolean).map((p) => Number(p.replaceAll(",", "")));
  if (prices.length === 0 || prices.some((p) => p > 5000)) throw new Error(`price limit shows ${prices.slice(0, 5)}`);
  if ((await temur.locator("main details summary").allInnerTexts()).some((t) => t.includes("Price not listed"))) throw new Error("unpriced dishes shown under a price limit");
  await see(temur, "Dishes with no listed price are hidden");
  await temur.getByLabel("Price").selectOption("");
  await temur.getByRole("button", { name: "No chicken" }).click();
  const text = (await temur.locator("main details summary").allInnerTexts()).join(" | ");
  for (const word of ["치킨", "닭"]) if (text.includes(word)) throw new Error(`no-chicken search shows ${word}`);
  await temur.getByRole("button", { name: "No chicken" }).click();
  // A drink search with only meals on offers to show the drinks.
  await temur.getByLabel("Search meals and places").fill("라떼");
  await temur.getByRole("button", { name: /^Show \d+ more from drinks/ }).click();
  await temur.locator("main details summary", { hasText: "라떼" }).first().waitFor();
  await temur.getByRole("button", { name: "Drinks", exact: true }).click();
  await temur.getByRole("button", { name: "Desserts and sides", exact: true }).click();
  await temur.getByRole("button", { name: "No pork or alcohol" }).click();
  await temur.getByLabel("Search meals and places").fill("베이컨");
  await see(temur, "Meals (0)");
  await temur.getByLabel("Search meals and places").fill("");
  await temur.getByRole("button", { name: "No pork or alcohol" }).click();
});
await step("independent restaurants' menus are searchable and say where they came from", async () => {
  await temur.goto(`${BASE}/map`);
  await temur.getByLabel("Search meals and places").fill("짬뽕");
  // Local menus have no allergen data, so only the "no data" setting shows them.
  await temur.getByLabel("Also show").check();
  await temur.locator("main details summary", { hasText: "짬뽕" }).first().waitFor();
  await see(temur, "menu from Polle");
  // Temur avoids pork: a dish named for pork stays hidden even with no allergen data.
  await temur.getByLabel("Search meals and places").fill("돼지국밥");
  await see(temur, "Meals (0)");
  await temur.getByRole("button", { name: "No pork", exact: true }).click();
  await temur.locator("main details summary", { hasText: "돼지국밥" }).first().waitFor();
  await temur.getByRole("button", { name: "No pork", exact: true }).click();
  await temur.getByLabel("Only meals with nothing").check();

  await temur.getByLabel("Search meals and places").fill("삼일반점");
  await temur.getByRole("tab", { name: /Places/ }).click();
  await temur.getByRole("link", { name: "Open menu" }).first().click();
  await temur.getByRole("heading", { name: "삼일반점" }).waitFor();
  await see(temur, "Typed in by Polle users");
  await temur.getByRole("link", { name: "See it on Polle" }).waitFor();
  await temur.locator("details", { hasText: "₩" }).first().waitFor();
  if (await temur.getByRole("button", { name: /Add|Save|Remove/ }).count()) throw new Error("a local menu can be edited");
  await shot(temur, "25-local-menu");

  await temur.goto(`${BASE}/map`);
  // A chain's branch keeps the brand's menu, with no way to change it.
  await temur.getByLabel("Search meals and places").fill("써브웨이");
  await temur.getByRole("tab", { name: /Places/ }).click();
  await temur.getByRole("link", { name: "Open menu" }).first().click();
  await see(temur, "own site. A branch may not sell every dish");
  if (await temur.getByRole("button", { name: /Add|Save|Remove/ }).count()) throw new Error("brand menu can be edited");
});
await step("Minji logs in on a phone", async () => {
  await login(minji, "minji@demo.test");
  await see(minji, "My groups");
  await settled(minji);
  await shot(minji, "06-phone-home");
});
await step("logged-out /now link lands on the round after login", async () => {
  await dana.goto(`${BASE}/g/${CODE}/now`);
  await dana.getByLabel("Email").fill("dana@demo.test");
  await dana.getByLabel("Password").fill("demo1234");
  await dana.getByRole("button", { name: "Log in" }).click();
  await see(dana, "Where to order from");
});
await step("Dana picks an unpriced dish through the sheet", async () => {
  await dana.getByRole("link", { name: /Subway/ }).click();
  await dana.locator("a[href*='dish=']").first().click();
  const sheet = dana.locator("dialog[open]");
  await sheet.waitFor();
  await sheet.getByText("Price not listed").waitFor();
  await sheet.getByLabel("Quantity").fill("2");
  await sheet.getByLabel("Note").fill("Extra napkins");
  await dana.screenshot({ path: `${SHOTS}/07-sheet.png` });
  await sheet.getByRole("button", { name: "Add to my pick" }).click();
  await see(dana, "Your pick");
  await see(dana, "Prices not listed");
});
await step("closing the sheet with its button goes back to the menu", async () => {
  await dana.goto(`${BASE}/g/${CODE}`);
  await dana.getByRole("link", { name: /BBQ/ }).click();
  await dana.locator("a[href*='dish=']").first().click();
  await dana.locator("dialog[open]").getByRole("button", { name: "Close" }).click();
  await dana.waitForURL((u) => !u.search.includes("dish="));
  await dana.goto(`${BASE}/g/${CODE}`);
});
await step("leader sees the pick appear without reloading", async () => {
  await temur.goto(`${BASE}/g/${CODE}`);
  await see(temur, "Extra napkins", 2000).catch(() => {});
  await temur.locator("section[aria-label=Members]").getByText("x2").waitFor();
});
await step("Dana edits the pick", async () => {
  await dana.getByRole("link", { name: "Change" }).click();
  await dana.getByLabel("Quantity").fill("1");
  await dana.getByRole("button", { name: "Save changes" }).click();
  await see(dana, "Your pick");
});
await step("a second dish from another restaurant is added, not swapped, and the leader sees it live", async () => {
  await dana.getByRole("link", { name: /BBQ/ }).click();
  await dana.locator("a[href*='dish=']").first().click();
  const sheet = dana.locator("dialog[open]");
  // She already has a Subway dish, so she is asked whether to add this one or replace it.
  await sheet.getByText("You already picked").waitFor();
  await sheet.getByRole("button", { name: "Add it too" }).click();
  await see(dana, "Your picks (2)");
  const mine = dana.locator("section[aria-label='Your answer']");
  await mine.getByText(/^Subway,/).waitFor();
  await mine.getByText(/^BBQ,/).waitFor();
  // The leader's panel updates by itself: no reload here.
  const danaRow = temur.locator("section[aria-label=Members] li", { hasText: "Dana" });
  await danaRow.getByText("BBQ", { exact: true }).waitFor({ timeout: 15000 });
  await danaRow.getByText("Subway", { exact: true }).waitFor();
  await shot(dana, "28-two-dishes");
  // Taking one off leaves the other.
  await mine.getByRole("button", { name: /^Remove BBQ/ }).click();
  await mine.getByText("Your pick", { exact: true }).waitFor();
  if (await mine.getByText(/^BBQ,/).count()) throw new Error("removed dish still shown");
});
await step("replace swaps the earlier dish for the new one", async () => {
  await dana.getByRole("link", { name: /BBQ/ }).click();
  await dana.locator("a[href*='dish=']").first().click();
  await dana.locator("dialog[open]").getByRole("button", { name: "Replace my pick" }).click();
  const mine = dana.locator("section[aria-label='Your answer']");
  await mine.getByText(/^BBQ,/).waitFor();
  if (await mine.getByText(/^Subway,/).count()) throw new Error("replaced dish still shown");
  await mine.getByText("Your pick", { exact: true }).waitFor();
  // And back to the unpriced Subway dish the later summary checks rely on.
  await dana.getByRole("link", { name: /Subway/ }).click();
  await dana.locator("a[href*='dish=']").first().click();
  await dana.locator("dialog[open]").getByRole("button", { name: "Replace my pick" }).click();
  await mine.getByText(/^Subway,/).waitFor();
  if (await mine.getByText(/^BBQ,/).count()) throw new Error("replaced dish still shown");
});
await step("a suggested restaurant shows the suggester at the top of everyone's list", async () => {
  await minji.goto(`${BASE}/g/${CODE}`);
  await minji.getByRole("link", { name: /Burger King/ }).click();
  await minji.getByRole("button", { name: "Suggest to the group" }).click();
  await see(minji, "You suggest this to the group");
  // The leader's list updates by itself; Burger King moves to the top with Minji's name.
  await temur.goto(`${BASE}/g/${CODE}`);
  const first = temur.locator("section[aria-label=Restaurants] > ul > li").first();
  await first.getByText("Minji suggests this").waitFor({ timeout: 15000 });
  await first.getByText("Burger King").waitFor();
  await settled(temur);
  await shot(temur, "30-suggested");
  await first.getByRole("link").click();
  await temur.getByRole("heading", { name: "Burger King" }).first().waitFor();
  await see(temur, "Minji suggests this to the group");
  // Only Minji can take it back: the leader is only offered to suggest it himself.
  if (await temur.getByRole("button", { name: "Take back my suggestion" }).count()) throw new Error("someone else can remove the suggestion");
  await minji.getByRole("button", { name: "Take back my suggestion" }).click();
  await minji.getByRole("button", { name: "Suggest to the group" }).waitFor();
  await temur.goto(`${BASE}/g/${CODE}`);
  if (await temur.getByText("Minji suggests this").count()) throw new Error("suggestion still shown after it was taken back");
  await minji.goto(BASE);
});
await step("Not joining shows live, and a member can come back", async () => {
  await minji.getByRole("link", { name: /Krafton work team/ }).click();
  await minji.getByRole("link", { name: "Change" }).click();
  await minji.getByRole("button", { name: "Not joining today" }).click();
  await minji.goto(`${BASE}/g/${CODE}`);
  await see(minji, "You are not joining today");
  await settled(minji);
  await shot(minji, "08-phone-group");
  await temur.locator("section[aria-label=Members]").getByText("Not joining today").waitFor();
});
await step("Same as last time repeats the leader's dish", async () => {
  await temur.getByRole("button", { name: /Same as last time/ }).click();
  await see(temur, "Your pick");
  await see(temur, "₩23,000");
});
await step("non-leader cannot use the finalize page", async () => {
  await dana.goto(`${BASE}/g/${CODE}/finalize`);
  await see(dana, "Only a group leader can finalize");
  if (await dana.getByRole("link", { name: "Finalize" }).count()) throw new Error("tab visible");
});
await step("summary per restaurant never counts unknown prices as zero", async () => {
  await temur.goto(`${BASE}/g/${CODE}/finalize`);
  await see(temur, "All restaurants:");
  await see(temur, "items not priced");
  await settled(temur);
  await temur.getByRole("button", { name: "Copy summary" }).first().click();
  const text = await temur.evaluate(() => navigator.clipboard.readText());
  if (!text.includes("Total ")) throw new Error(`clipboard: ${text}`);
  console.log(`     clipboard: ${text.replaceAll("\n", " | ")}`);
  await shot(temur, "09-finalize");
});
await step("leader changes a member's pick and the member is told", async () => {
  await temur.locator("details", { hasText: "Jisoo" }).locator("summary").click();
  await temur.locator("li", { hasText: "Jisoo" }).getByRole("link", { name: "Edit" }).click();
  await temur.getByRole("link", { name: /Burger King/ }).click();
  await temur.locator("a[href*='dish=']").first().click();
  await temur.locator("dialog[open]").getByRole("button", { name: "Save pick" }).click();
  await see(temur, "All restaurants:");
  const jisoo = await person();
  await login(jisoo, "jisoo@demo.test");
  await see(jisoo, "had your picks changed by the leader");
  await jisoo.context().close();
});
await step("leader removes a pick; the member is told and repicks", async () => {
  await temur.locator("details", { hasText: "Dana" }).locator("summary").click();
  await temur.locator("li", { hasText: "Dana" }).getByRole("button", { name: "Remove" }).click();
  await see(temur, "No answer (");
  await dana.goto(`${BASE}/g/${CODE}`);
  await see(dana, "Your leader removed your dish");
  await dana.goto(BASE);
  await see(dana, "needs a new pick");
  await settled(dana);
  await shot(dana, "10-notice");
  await dana.getByRole("button", { name: "Dismiss" }).first().click();
  await dana.getByText("needs a new pick").waitFor({ state: "hidden" });
});
await step("leader reminds people with no answer", async () => {
  await temur.getByRole("button", { name: /Remind \d+ with no answer/ }).click();
  await see(temur, /Reminded \d+ (person|people)/);
  await dana.goto(BASE);
  await see(dana, "The leader sent a reminder");
});
await step("leader finalizes; members are locked", async () => {
  // Dana, whose dish was removed, picks again so she is in the order.
  await dana.goto(`${BASE}/g/${CODE}`);
  await dana.getByRole("link", { name: /Subway/ }).click();
  await dana.locator("a[href*='dish=']").first().click();
  await dana.locator("dialog[open]").getByRole("button", { name: "Add to my picks" }).click();
  await dana.locator("section[aria-label='Your answer']").getByText("Your pick", { exact: true }).waitFor();
  await temur.reload();
  await temur.getByRole("button", { name: /^Finalize/ }).click();
  await temur.getByRole("button", { name: "Mark as ordered" }).waitFor();
  await dana.goto(`${BASE}/g/${CODE}`);
  await see(dana, "This round is finalized");
  if (await dana.getByText("Where to order from").count()) throw new Error("restaurants still offered");
});
await step("mark as ordered: History gets the round and the next one opens by itself", async () => {
  await temur.getByRole("button", { name: "Mark as ordered" }).click();
  await temur.waitForURL(/history/);
  await see(temur, "Last Friday lunch");
  await temur.locator("summary", { hasText: "Lunch" }).first().click();
  await see(temur, "Who ordered what");
  await settled(temur);
  await shot(temur, "11-history");
  await temur.getByRole("link", { name: "Lunch", exact: true }).click();
  await see(temur, "Where to order from");
  await see(temur, "Picks open");
});
await step("members with the app open get a pop-up that lunch was ordered", async () => {
  // Dana had a dish in that round and has the group page open; no reload.
  const popup = dana.locator("[role=status]", { hasText: "Lunch is ordered" });
  await popup.waitFor({ timeout: 25000 });
  await popup.getByText("has been ordered. Food is on the way.").waitFor();
  await shot(dana, "29-ordered-popup");
  await popup.getByRole("button", { name: "Dismiss" }).click();
});
await step("settings: QR, invite link, location, pinned restaurants next round", async () => {
  await temur.goto(`${BASE}/g/${CODE}/settings`);
  await see(temur, `/g/${CODE}/now`);
  await temur.getByRole("checkbox", { name: "Subway" }).check();
  await temur.getByRole("button", { name: "Save" }).click();
  await see(temur, "Saved.");
  await settled(temur);
  await shot(temur, "12-settings");
});
await step("new person signs up from an invite link, joins and leaves", async () => {
  const sam = await person();
  await sam.goto(`${BASE}/g/${CODE}`);
  await sam.getByRole("link", { name: "Create an account" }).click();
  await sam.getByLabel("Your name").fill("Sam");
  await sam.getByLabel("Email").fill(`sam${Date.now()}@demo.test`);
  await sam.getByLabel("Password").fill("demo1234");
  await sam.getByRole("button", { name: "Create account" }).click();
  await see(sam, "What can't you eat?");
  await sam.getByRole("checkbox", { name: /^Vegan/ }).check();
  await sam.getByRole("button", { name: "Save my food needs" }).click();
  await see(sam, "Join this group");
  await settled(sam);
  await shot(sam, "13-invite");
  await sam.getByRole("button", { name: "Join this group" }).click();
  await see(sam, "Where to order from");
  await sam.getByRole("link", { name: "Settings" }).click();
  await sam.getByRole("button", { name: "Leave this group" }).click();
  await see(sam, "No groups yet");
  await shot(sam, "14-empty");
  await sam.goto(`${BASE}/g/${CODE}/history`);
  await see(sam, "Join this group");
});
await step("join page accepts a pasted invite link", async () => {
  const sam = await person();
  await login(sam, "dana@demo.test");
  await see(sam, "My groups");
  await sam.getByRole("link", { name: "Join group", exact: true }).click();
  await sam.getByLabel("Invite code or link").fill(`${BASE}/g/demotkd001/now`);
  await sam.getByRole("button", { name: "Continue" }).click();
  await see(sam, "Join this group");
  await sam.context().close();
});
await step("sole leader cannot leave; bad invite is a friendly 404", async () => {
  await temur.goto(BASE);
  await temur.getByRole("link", { name: /Gym friends/ }).click();
  await temur.getByRole("link", { name: "Settings" }).click();
  await temur.getByRole("button", { name: "Leave this group" }).click();
  await see(temur, "Promote another leader");
  const r = await temur.goto(`${BASE}/g/doesnotexist`);
  if (r.status() !== 404) throw new Error(`status ${r.status()}`);
  await see(temur, "Nothing on this plate");
});
await step("no page scrolls sideways on a phone", async () => {
  const phone = await person({ viewport: { width: 360, height: 740 } });
  await login(phone, "temur@demo.test");
  await see(phone, "My groups");
  const paths = ["", "/map", "/account/food", "/groups/new", "/groups/join", `/g/${CODE}`, `/g/${CODE}/finalize`, `/g/${CODE}/history`, `/g/${CODE}/settings`, `/g/${CODE}/finalize/pick/00000000-0000-0000-0000-000000000004`];
  for (const p of paths) {
    await phone.goto(BASE + p);
    await settled(phone);
    const over = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) throw new Error(`${p || "/"} overflows by ${over}px`);
  }
  await phone.goto(`${BASE}/g/${CODE}`);
  await phone.getByRole("link", { name: /Burger King/ }).click();
  await phone.locator("a[href*='dish=']").first().waitFor();
  const over = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) throw new Error(`menu overflows by ${over}px`);
  await phone.locator("a[href*='dish=']").first().click();
  await phone.locator("dialog[open]").waitFor();
  await settled(phone);
  await phone.screenshot({ path: `${SHOTS}/15-phone-sheet.png` });
  await phone.goto(`${BASE}/map`);
  await phone.locator(".leaflet-interactive").first().waitFor();
  await settled(phone);
  await phone.screenshot({ path: `${SHOTS}/26-phone-map.png` });
});
await step("dark mode", async () => {
  const night = await person({ colorScheme: "dark" });
  await login(night, "temur@demo.test");
  await see(night, "My groups");
  await settled(night);
  await shot(night, "16-dark-home");
  await night.goto(`${BASE}/g/${CODE}`);
  await settled(night);
  await shot(night, "17-dark-group");
  await night.goto(`${BASE}/map`);
  await night.locator(".leaflet-interactive").first().waitFor();
  await settled(night);
  await night.screenshot({ path: `${SHOTS}/27-dark-map.png` });
});
await step("anyone can change the name their group sees", async () => {
  await temur.goto(`${BASE}/account`);
  await temur.getByLabel("Your name").fill("Temur K");
  await temur.getByRole("button", { name: "Save name" }).click();
  await see(temur, "Saved. Your groups now see this name.");
  await temur.goto(BASE);
  await see(temur, "Hi Temur K");
  await temur.goto(`${BASE}/g/${CODE}`);
  await temur.locator("section[aria-label=Members]").getByText("Temur K").waitFor();
});
await step("log out returns to login and blocks pages", async () => {
  await temur.goto(BASE);
  await temur.getByRole("button", { name: "Log out" }).click();
  await see(temur, "Log in to GroupOrder");
  await temur.goto(`${BASE}/g/${CODE}`);
  await see(temur, "Log in to GroupOrder");
});

await browser.close();
const unique = [...new Set(problems)];
console.log(`\n${passed} passed, ${failed} failed; ${unique.length} browser/server problems`);
unique.slice(0, 20).forEach((p) => console.log(" -", p));
process.exit(failed || unique.length ? 1 : 0);
