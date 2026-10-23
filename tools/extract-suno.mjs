/* Extract the full Suno track list with playable audio + cover URLs. */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
let feedBody = null;
page.on("response", async (r) => {
  if (r.url().includes("/a/api/unified/feed")) {
    try {
      feedBody = await r.text();
    } catch {}
  }
});
await page.goto("https://suno.com/@jonferno?page=songs", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));

const j = JSON.parse(feedBody);
const items = j.feed.items;

const tracks = items.map((it) => {
  const s = it.content_item;
  const media = (s.media_urls || []).find((m) => m.content_type === "m4a-opus") || (s.media_urls || [])[0];
  return {
    id: s.id,
    title: s.title,
    duration: s.metadata?.duration ?? null,
    style: (s.metadata?.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    prompt: s.metadata?.prompt || "",
    instrumental: !!s.metadata?.make_instrumental,
    playCount: s.play_count ?? 0,
    audio: media?.url || null,
    audioType: media?.content_type || null,
    cover: s.image_large_url || s.image_url || null,
    coverSmall: s.image_url || null,
    video: s.video_url || null,
    songUrl: `https://suno.com/song/${s.id}`,
    created: s.created_at || null
  };
});

fs.writeFileSync("captures/suno-tracks.json", JSON.stringify(tracks, null, 2));

console.log("=== TRACKS ===");
tracks.forEach((t, i) => {
  const m = Math.floor(t.duration / 60);
  const sec = Math.round(t.duration % 60);
  console.log(`${i + 1}. "${t.title}"  ${m}:${String(sec).padStart(2, "0")}  [${t.style.join(" | ")}]`);
  console.log(`   audio: ${t.audio}`);
  console.log(`   cover: ${t.cover}`);
});

// verify each audio URL actually serves audio
console.log("\n=== AUDIO HEAD CHECKS ===");
for (const t of tracks) {
  if (!t.audio) {
    console.log(`MISSING  ${t.title}`);
    continue;
  }
  try {
    const r = await fetch(t.audio, { method: "GET", headers: { Range: "bytes=0-1023" } });
    const buf = Buffer.from(await r.arrayBuffer());
    const isAudio = buf.length > 0 && (buf[4] === 0x66 || buf[4] === 0x4d || buf.slice(4, 8).toString() === "ftyp");
    console.log(`${r.status} ${String(buf.length).padStart(5)}B  ftyp=${buf.slice(4, 8).toString()}  ${isAudio ? "OK " : "?? "} ${t.title}`);
  } catch (e) {
    console.log(`ERR  ${t.title}: ${e.message}`);
  }
}

await page.close();
await browser.close();
