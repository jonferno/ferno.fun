/* Capture the fire before and after a click to verify the explosion reads. */
import puppeteer from "puppeteer-core";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:4180";
const OUT = path.resolve("captures");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 700, deviceScaleFactor: 1 });
await page.goto(`${BASE}/?static=1&pdb=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 5000));

const fire = await page.$("#fire");
await fire.screenshot({ path: path.join(OUT, "explode-0-before.png") });

// click in the middle of the fire band
await page.mouse.click(600, 640);
await new Promise((r) => setTimeout(r, 180));
await fire.screenshot({ path: path.join(OUT, "explode-1-blast.png") });
await new Promise((r) => setTimeout(r, 500));
await fire.screenshot({ path: path.join(OUT, "explode-2-rising.png") });

// a second click should stack another burst
await page.mouse.click(600, 640);
await new Promise((r) => setTimeout(r, 200));
await fire.screenshot({ path: path.join(OUT, "explode-3-double.png") });

console.log("captured explosion frames");
await browser.close();
