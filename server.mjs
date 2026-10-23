/* Minimal static server for local development + a debug capture endpoint.
   POST /__shot  with { dataUrl }  -> writes capture.png into ./captures/
   GET  /__shots  -> lists captures
*/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES = path.join(ROOT, "captures");
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

fs.mkdirSync(CAPTURES, { recursive: true });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/__shot") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { dataUrl, name } = JSON.parse(body);
        const b64 = String(dataUrl).split(",")[1];
        const file = path.join(CAPTURES, `${name || "capture"}.png`);
        fs.writeFileSync(file, Buffer.from(b64, "base64"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, file }));
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }

  if (url.pathname === "/__shots") {
    const files = fs.readdirSync(CAPTURES).filter((f) => f.endsWith(".png"));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(files));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(ROOT, path.normalize(pathname).replace(/^([/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`ferno.fun dev server on http://localhost:${PORT}`);
});
