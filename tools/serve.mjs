#!/usr/bin/env node
/* Zero-dependency static server for local work.  npm run dev  ->  :4321 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const ROOT = process.cwd(), PORT = Number(process.env.PORT) || 4321;
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
  ".png":"image/png", ".webp":"image/webp", ".avif":"image/avif",
  ".svg":"image/svg+xml", ".woff2":"font/woff2", ".ico":"image/x-icon" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const s = await stat(file);
    const body = await readFile(s.isDirectory() ? join(file, "index.html") : file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404");
  }
}).listen(PORT, () => console.log(`\n  http://localhost:${PORT}\n`));
