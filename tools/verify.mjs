/* Interaction test + screenshot harness for ferno.fun
   Uses the system Chrome via puppeteer-core.
   Run: node tools/verify.mjs
*/
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:4180";
const OUT = path.resolve("captures");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1440,900"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await page.goto(`${BASE}/?static=1&pdb=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));

/* ── 1. landing renders ─────────────────────────────────────────── */
const landing = await page.evaluate(() => {
  const wm = document.querySelector(".wordmark");
  const letters = [...document.querySelectorAll(".wordmark span")];
  return {
    wordmarkVisible: !!wm && wm.getBoundingClientRect().width > 0,
    letters: letters.map((s) => ({
      t: s.textContent,
      op: +getComputedStyle(s).opacity,
      x: Math.round(s.getBoundingClientRect().x),
      w: Math.round(s.getBoundingClientRect().width)
    })),
    enterVisible: !!document.querySelector("#enter")?.offsetParent,
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth
  };
});
check("landing wordmark visible", landing.wordmarkVisible);
check(
  "all 6 wordmark glyphs rendered",
  landing.letters.length === 6 && landing.letters.every((l) => l.op > 0.9 && l.w > 0),
  JSON.stringify(landing.letters.map((l) => l.t))
);
check("ENTER button visible", landing.enterVisible);
check("no horizontal overflow on landing", landing.docScrollW <= landing.innerW + 1, `${landing.docScrollW} vs ${landing.innerW}`);

await page.screenshot({ path: path.join(OUT, "v-landing.png") });

/* ── 2. fire canvas is actually painting ────────────────────────── */
const fireStats = await page.evaluate(async () => {
  const c = document.getElementById("fire");
  const gl = c.getContext("webgl2");
  const w = c.width, h = c.height;
  const px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let warm = 0, blue = 0, bright = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r > 150 && g > 60 && r > b + 40) warm++;
    if (b > 60 && b > r + 30) blue++;
    if (r + g + b > 300) bright++;
  }
  const n = w * h;
  return { w, h, warmPct: +(warm / n * 100).toFixed(2), bluePct: +(blue / n * 100).toFixed(2), brightPct: +(bright / n * 100).toFixed(2) };
});
check("fire canvas has warm pixels", fireStats.warmPct > 0.5, JSON.stringify(fireStats));
check("fire canvas has blue void pixels", fireStats.bluePct > 5, JSON.stringify(fireStats));

/* ── 3. mouse interaction stirs the fire ────────────────────────── */
const before = await page.evaluate(() => {
  const c = document.getElementById("fire");
  const gl = c.getContext("webgl2");
  const px = new Uint8Array(c.width * c.height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = 0;
  for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2];
  return s;
});
await page.mouse.move(200, 700);
for (let i = 0; i < 24; i++) {
  await page.mouse.move(200 + i * 45, 700 - i * 12);
  await new Promise((r) => setTimeout(r, 22));
}
await new Promise((r) => setTimeout(r, 400));
const after = await page.evaluate(() => {
  const c = document.getElementById("fire");
  const gl = c.getContext("webgl2");
  const px = new Uint8Array(c.width * c.height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = 0;
  for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2];
  return s;
});
check("mouse movement changes the fire", Math.abs(after - before) > 1000, `delta=${after - before}`);

/* ── 4. ENTER -> hub ────────────────────────────────────────────── */
await page.click("#enter");
await new Promise((r) => setTimeout(r, 900));
const hub = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".card")];
  const vis = cards.map((c) => {
    const r = c.getBoundingClientRect();
    return { name: c.querySelector(".card__name")?.textContent, x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), visible: r.width > 0 && r.height > 0 };
  });
  return {
    hubActive: document.querySelector("#hub").classList.contains("is-active"),
    landingHidden: !document.querySelector("#landing").classList.contains("is-active"),
    cards: vis,
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    title: document.querySelector(".hub__title")?.textContent
  };
});
check("hub becomes active", hub.hubActive);
check("landing hides", hub.landingHidden);
check("all 5 cards visible", hub.cards.length === 5 && hub.cards.every((c) => c.visible), JSON.stringify(hub.cards.map((c) => c.name)));
check(
  "no card overflows the viewport",
  hub.cards.every((c) => c.x >= 0 && c.right <= hub.innerW + 1),
  JSON.stringify(hub.cards.map((c) => `${c.name}:${c.x}-${c.right}`))
);
check("no horizontal overflow on hub", hub.docScrollW <= hub.innerW + 1, `${hub.docScrollW} vs ${hub.innerW}`);
check("hub title complete", hub.title?.replace(/\s+/g, " ").trim() === "SELECT DESTINATION", hub.title);

await page.screenshot({ path: path.join(OUT, "v-hub.png") });

/* ── 5. links point at the right places ─────────────────────────── */
const links = await page.evaluate(() =>
  [...document.querySelectorAll(".card")].map((c) => ({
    name: c.querySelector(".card__name")?.textContent,
    href: c.getAttribute("href"),
    copy: c.dataset.copy || null,
    target: c.getAttribute("target"),
    rel: c.getAttribute("rel")
  }))
);
const xLink = links.find((l) => l.name === "X / TWITTER");
const ghLink = links.find((l) => l.name === "GITHUB");
const dcCard = links.find((l) => l.name === "DISCORD");
check("X link -> x.com/Jonferno", xLink?.href === "https://x.com/Jonferno", xLink?.href);
check("X link opens safely", xLink?.target === "_blank" && (xLink?.rel || "").includes("noopener"), `${xLink?.target} ${xLink?.rel}`);
check("GitHub link -> github.com/Jonferno", ghLink?.href === "https://github.com/Jonferno", ghLink?.href);
check("Discord card copies handle Jonferno", dcCard?.copy === "Jonferno", dcCard?.copy);

/* ── 6. Discord copy shows a toast ──────────────────────────────── */
await page.click(".card--discord");
await new Promise((r) => setTimeout(r, 500));
const toast = await page.evaluate(() => {
  const t = document.querySelector("#toast");
  return { on: t.classList.contains("is-on"), text: t.textContent.trim() };
});
check("Discord click shows toast", toast.on, toast.text);
check("toast mentions the handle", /Jonferno/.test(toast.text), toast.text);

/* ── 7. planned section feedback ────────────────────────────────── */
await page.click(".card--planned");
await new Promise((r) => setTimeout(r, 400));
const toast2 = await page.evaluate(() => document.querySelector("#toast").textContent.trim());
check("planned card gives feedback", /IN THE WORKS|bench|catches fire/i.test(toast2), toast2);

/* ── 8. BACK returns to landing ─────────────────────────────────── */
await page.click("#back");
await new Promise((r) => setTimeout(r, 900));
const backOk = await page.evaluate(() => ({
  landing: document.querySelector("#landing").classList.contains("is-active"),
  hub: document.querySelector("#hub").classList.contains("is-active")
}));
check("BACK returns to landing", backOk.landing && !backOk.hub, JSON.stringify(backOk));

/* ── 9. mobile viewport ─────────────────────────────────────────── */
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${BASE}/?static=1&hub=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
const mobile = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".card")];
  return {
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    cardRight: Math.max(...cards.map((c) => Math.round(c.getBoundingClientRect().right))),
    cardW: cards.map((c) => Math.round(c.getBoundingClientRect().width))
  };
});
check("mobile: no horizontal overflow", mobile.docScrollW <= mobile.innerW + 1, `${mobile.docScrollW} vs ${mobile.innerW}`);
check("mobile: cards fit", mobile.cardRight <= mobile.innerW + 1, `maxRight=${mobile.cardRight}`);
await page.screenshot({ path: path.join(OUT, "v-mobile-hub.png"), fullPage: false });

await page.goto(`${BASE}/?static=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, "v-mobile-landing.png") });

/* ── 10. console cleanliness ────────────────────────────────────── */
check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
