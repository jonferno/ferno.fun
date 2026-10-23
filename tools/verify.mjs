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
const failedRequests = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => {
  const err = r.failure()?.errorText || "";
  // the browser aborts superseded media fetches routinely; not a real failure
  if (err === "net::ERR_ABORTED") return;
  failedRequests.push(`${r.url()} :: ${err}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});

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

/* ── 3. the fire is click-driven only ───────────────────────────── */
// The sim counts splats caused by the pointer. Moving the cursor must add
// zero; clicking must add several.
const splatCount = () => page.evaluate(() => window.__pointerSplats());

const beforeMove = await splatCount();
await page.mouse.move(200, 700);
for (let i = 0; i < 24; i++) {
  await page.mouse.move(200 + i * 45, 700 - i * 12);
  await new Promise((r) => setTimeout(r, 22));
}
await new Promise((r) => setTimeout(r, 400));
const afterMove = await splatCount();
check("cursor movement does not drive the fire", afterMove === beforeMove, `splats ${beforeMove} -> ${afterMove}`);

const beforeClick = await splatCount();
await page.mouse.click(720, 820);
await new Promise((r) => setTimeout(r, 250));
const afterClick = await splatCount();
check("clicking detonates the fire", afterClick > beforeClick, `splats ${beforeClick} -> ${afterClick}`);

// holding the button and dragging must keep feeding the simulation and
// move the flame with the pointer
const beforeDrag = await splatCount();
await page.mouse.move(400, 820);
await page.mouse.down();
for (let i = 0; i < 20; i++) {
  await page.mouse.move(400 + i * 45, 820 - i * 10);
  await new Promise((r) => setTimeout(r, 25));
}
const duringDrag = await splatCount();
await page.mouse.up();
check("holding and dragging keeps the fire alive", duringDrag > beforeDrag + 20, `splats ${beforeDrag} -> ${duringDrag}`);

// after release the pointer must stop driving the simulation
await new Promise((r) => setTimeout(r, 200));
const afterRelease = await splatCount();
await page.mouse.move(900, 300);
await new Promise((r) => setTimeout(r, 300));
const afterReleaseMove = await splatCount();
check("releasing stops the pointer driving the fire", afterReleaseMove === afterRelease, `splats ${afterRelease} -> ${afterReleaseMove}`);

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
check("all 6 cards visible", hub.cards.length === 6 && hub.cards.every((c) => c.visible), JSON.stringify(hub.cards.map((c) => c.name)));
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
const ytLink = links.find((l) => l.name === "YOUTUBE");
const musicCard = links.find((l) => l.name === "MUSIC GENERATION");
check("X link -> x.com/Jonferno", xLink?.href === "https://x.com/Jonferno", xLink?.href);
check("X link opens safely", xLink?.target === "_blank" && (xLink?.rel || "").includes("noopener"), `${xLink?.target} ${xLink?.rel}`);
check("GitHub link -> github.com/Jonferno", ghLink?.href === "https://github.com/Jonferno", ghLink?.href);
check("Discord card copies handle Jonferno", dcCard?.copy === "Jonferno", dcCard?.copy);
check("YouTube link -> @Jonferno_0", ytLink?.href === "https://www.youtube.com/@Jonferno_0", ytLink?.href);
check("YouTube link opens safely", ytLink?.target === "_blank" && (ytLink?.rel || "").includes("noopener"), `${ytLink?.target} ${ytLink?.rel}`);
check("Music card -> music.html", musicCard?.href === "music.html", musicCard?.href);
check("Game Modding still marked planned", !!links.find((l) => l.name === "GAME MODDING"));

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
check("no failed requests", failedRequests.length === 0, failedRequests.join(" | "));

/* ── 11. music page ─────────────────────────────────────────────── */
await page.goto(`${BASE}/music.html?static=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));

const music = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".track")];
  return {
    count: rows.length,
    titles: rows.map((r) => r.querySelector(".track__title")?.textContent),
    times: rows.map((r) => r.querySelector(".track__time")?.textContent),
    hasAudio: !!document.querySelector("audio"),
    artCount: rows.filter((r) => (r.querySelector(".track__art")?.style.backgroundImage || "").includes("suno.ai")).length,
    sunoLinks: rows.filter((r) => (r.querySelector(".track__suno")?.href || "").includes("suno.com/song/")).length,
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth
  };
});
check("music page renders 10 tracks", music.count === 10, `count=${music.count}`);
check("every track has cover art", music.artCount === 10, `${music.artCount}/10`);
check("every track links to its Suno page", music.sunoLinks === 10, `${music.sunoLinks}/10`);
check("music page has an audio element", music.hasAudio);
check("music page no horizontal overflow", music.docScrollW <= music.innerW + 1, `${music.docScrollW} vs ${music.innerW}`);

// clicking a track should start playback and mark it active
await page.click(".track:nth-child(3) .track__play");
await new Promise((r) => setTimeout(r, 3000));
const playState = await page.evaluate(() => {
  const a = document.querySelector("audio");
  const active = document.querySelector(".track.is-playing");
  return {
    paused: a.paused,
    currentTime: a.currentTime,
    readyState: a.readyState,
    duration: a.duration,
    error: a.error ? a.error.code : null,
    src: a.currentSrc || a.src,
    activeTitle: active?.querySelector(".track__title")?.textContent || null,
    npTitle: document.querySelector("#np-title")?.textContent,
    progress: document.querySelector("#np-progress")?.style.width
  };
});
check("clicking a track starts playback", !playState.paused && playState.currentTime > 0, JSON.stringify(playState));
check("playing track is marked active", !!playState.activeTitle, playState.activeTitle);
check("now-playing panel shows the track", playState.npTitle === playState.activeTitle, `${playState.npTitle} vs ${playState.activeTitle}`);
check("audio src points at the Suno CDN", /cdn1\.suno\.ai\/.*\.mp4/.test(playState.src), playState.src);

await page.screenshot({ path: path.join(OUT, "v-music.png") });

// mobile music page
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${BASE}/music.html?static=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
const musicMobile = await page.evaluate(() => ({
  docScrollW: document.documentElement.scrollWidth,
  innerW: window.innerWidth,
  rowRight: Math.max(...[...document.querySelectorAll(".track")].map((r) => Math.round(r.getBoundingClientRect().right)))
}));
check("music mobile: no horizontal overflow", musicMobile.docScrollW <= musicMobile.innerW + 1, `${musicMobile.docScrollW} vs ${musicMobile.innerW}`);
check("music mobile: rows fit", musicMobile.rowRight <= musicMobile.innerW + 1, `maxRight=${musicMobile.rowRight}`);
await page.screenshot({ path: path.join(OUT, "v-music-mobile.png") });

check("no console errors after music page", consoleErrors.length === 0, consoleErrors.join(" | "));
check("no failed requests after music page", failedRequests.length === 0, failedRequests.join(" | "));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
