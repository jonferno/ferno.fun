/* Sweep FLAME_SCALE across viewports and report how much of the screen the
   fire occupies. Target: fire confined to roughly the bottom third. */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:4180";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

const sizes = [
  { name: "desktop", w: 1440, h: 900 },
  { name: "laptop", w: 1280, h: 720 },
  { name: "tablet", w: 820, h: 1180 },
  { name: "mobile", w: 390, h: 844 }
];
const scales = [0.07, 0.09, 0.11, 0.13];

for (const scale of scales) {
  const out = [];
  for (const s of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/?static=1&pdb=1&scale=${scale}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 5000));
    const st = await page.evaluate(() => {
      const c = document.getElementById("fire");
      const gl = c.getContext("webgl2");
      const px = new Uint8Array(c.width * c.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      // find the highest row (from bottom) that still has meaningful fire
      let topWarm = 0;
      for (let y = 0; y < c.height; y++) {
        let warm = 0;
        for (let x = 0; x < c.width; x++) {
          const o = (y * c.width + x) * 4;
          if (px[o] > 120 && px[o] > px[o + 2] + 40) warm++;
        }
        if (warm / c.width > 0.02) topWarm = y;
      }
      return { frac: +(topWarm / c.height).toFixed(3), canvas: `${c.width}x${c.height}` };
    });
    out.push(`${s.name}=${st.frac}`);
    await page.close();
  }
  console.log(`scale=${scale}  ${out.join("  ")}`);
}

await browser.close();
