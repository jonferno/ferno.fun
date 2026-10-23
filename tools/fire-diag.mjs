/* Diagnostic: capture the fire canvas alone at several viewport sizes. */
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

const sizes = [
  { name: "desktop", w: 1440, h: 900, dsf: 1 },
  { name: "laptop", w: 1280, h: 720, dsf: 1 },
  { name: "tablet", w: 820, h: 1180, dsf: 1 },
  { name: "mobile", w: 390, h: 844, dsf: 2 }
];

for (const s of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.dsf });
  await page.goto(`${BASE}/?static=1&pdb=1`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 4000));

  const stats = await page.evaluate(() => {
    const c = document.getElementById("fire");
    const gl = c.getContext("webgl2");
    const px = new Uint8Array(c.width * c.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const rows = [];
    for (let band = 0; band < 10; band++) {
      const y0 = Math.floor((c.height * band) / 10);
      const y1 = Math.floor((c.height * (band + 1)) / 10);
      let warm = 0, tot = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < c.width; x++) {
          const o = (y * c.width + x) * 4;
          tot++;
          if (px[o] > 140 && px[o] > px[o + 2] + 50 && px[o + 1] > 40) warm++;
        }
      }
      rows.push(+((warm / tot) * 100).toFixed(1));
    }
    return { canvasW: c.width, canvasH: c.height, cssW: c.clientWidth, cssH: c.clientHeight, warmByBandBottomToTop: rows };
  });

  console.log(s.name, JSON.stringify(stats));

  const el = await page.$("#fire");
  await el.screenshot({ path: path.join(OUT, `fire-${s.name}.png`) });
  await page.close();
}

await browser.close();
