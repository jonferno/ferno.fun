/* Capture the fire canvas directly via WebGL readback while the pointer is
   held and dragged, so each frame is guaranteed fresh. */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:4180";
const OUT = path.resolve("captures");
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 700, deviceScaleFactor: 1 });
await page.goto(`${BASE}/?static=1&pdb=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));

// grab the canvas as a PNG straight from the drawing buffer
async function snap(name) {
  const dataUrl = await page.evaluate(() => {
    const c = document.getElementById("fire");
    // force a fresh render so the preserved buffer matches this instant
    window.__renderNow && window.__renderNow();
    return c.toDataURL("image/png");
  });
  const b64 = dataUrl.split(",")[1];
  fs.writeFileSync(path.join(OUT, `d-${name}.png`), Buffer.from(b64, "base64"));
  // measure the horizontal centroid of the warm pixels in the flame band
  const stats = await page.evaluate(() => {
    const c = document.getElementById("fire");
    const gl = c.getContext("webgl2");
    const px = new Uint8Array(c.width * c.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // GL row 0 is the BOTTOM of the canvas. Find the tallest flame by
    // scanning upward from the bottom for the topmost strongly-warm row.
    const isWarm = (o) => px[o] > 170 && px[o] > px[o + 2] + 70 && px[o + 1] > 60;
    let top = -1;
    for (let y = c.height - 1; y >= 0; y--) {
      let warm = 0;
      for (let x = 0; x < c.width; x++) {
        if (isWarm((y * c.width + x) * 4)) warm++;
      }
      if (warm > c.width * 0.015) { top = y; break; }
    }
    // centroid of warm pixels in the band just below the flame tip
    let tot = 0, sx = 0;
    const band = Math.max(2, Math.floor(c.height / 12));
    for (let y = top; y > top - band && y >= 0; y--) {
      for (let x = 0; x < c.width; x++) {
        const o = (y * c.width + x) * 4;
        if (isWarm(o)) { tot++; sx += x; }
      }
    }
    // also the centroid of ALL warm pixels, for a whole-flame view
    let atot = 0, asx = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const o = (y * c.width + x) * 4;
        if (isWarm(o)) { atot++; asx += x; }
      }
    }
    return {
      top,
      tipCentroid: tot ? sx / tot : -1,
      allCentroid: atot ? asx / atot : -1,
      width: c.width,
      hot: tot,
      allHot: atot
    };
  });
  console.log(
    `${name.padEnd(16)} flame_top_row=${String(stats.top).padStart(3)}  tip_x=${stats.tipCentroid.toFixed(1)} (${(stats.tipCentroid / stats.width * 100).toFixed(1)}%)  all_x=${stats.allCentroid.toFixed(1)} (${(stats.allCentroid / stats.width * 100).toFixed(1)}%)  hot=${stats.hot}`
  );
  return stats;
}

await snap("0-rest");

await page.mouse.move(300, 640);
await page.mouse.down();
await new Promise((r) => setTimeout(r, 150));
await snap("1-pressed-left");

for (let i = 0; i < 14; i++) {
  await page.mouse.move(300 + i * 45, 640 - i * 6);
  await new Promise((r) => setTimeout(r, 30));
}
await snap("2-swept-right");

for (let i = 0; i < 14; i++) {
  await page.mouse.move(930 - i * 45, 556 + i * 6);
  await new Promise((r) => setTimeout(r, 30));
}
await snap("3-swept-left");

await page.mouse.up();
await new Promise((r) => setTimeout(r, 500));
await snap("4-released");

await browser.close();
