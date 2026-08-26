#!/usr/bin/env node
/**
 * prepare-images.mjs — get Jake's photographs onto the site.
 *
 *   npm i sharp
 *
 *   node prepare-images.mjs match ./originals          # 1. propose folder -> project mapping
 *   node prepare-images.mjs build ./originals ./assets # 2. process + emit images.json
 *
 * The `match` step exists so folder names don't have to be perfect. It reads
 * the project ids straight out of jake-caminero.html, fuzzy-matches whatever
 * came out of Pixieset against them, and writes mapping.json for you to check.
 * Nothing is processed until you're happy with that file.
 *
 * EXPECTED INPUT — one folder per project, any name:
 *   originals/Cuyama Buckhorn - Foraging/
 *     main.jpg        the frame that represents the project
 *     og.jpg          optional social card; falls back to main
 *     01.jpg 02.jpg   gallery, in display order (zero-pad past 9)
 */

import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const WIDTHS  = [800, 1600, 2400];
const FORMATS = [["avif",{quality:58,effort:4}],["webp",{quality:80}],["jpeg",{quality:84,mozjpeg:true}]];
const OK      = new Set([".jpg",".jpeg",".png",".tif",".tiff",".webp"]);
const MAPFILE = "mapping.json";
const SITE    = "index.html";

/* ── read the project list from the site so it can never drift ───────── */
async function projectIds(sitePath = SITE) {
  const h = await readFile(sitePath, "utf8");
  const out = [];
  const re = /\{id:"([\w-]+)",\s*\n?\s*t:"([^"]+)",\s*\n?\s*client:"([^"]+)"/g;
  let m; while ((m = re.exec(h))) out.push({ id: m[1], title: m[2], client: m[3] });
  if (!out.length) throw new Error(`No projects found in ${sitePath}`);
  return out;
}

/* ── fuzzy match ─────────────────────────────────────────────────────── */
const norm  = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const toks  = s => new Set(norm(s).split(" ").filter(t => t.length > 2));
function score(folder, p) {
  const f = toks(folder), t = toks(p.title + " " + p.client + " " + p.id.replace(/-/g," "));
  if (!f.size || !t.size) return 0;
  let hit = 0; for (const x of f) if (t.has(x)) hit++;
  const jaccard = hit / new Set([...f, ...t]).size;
  const sub = norm(p.title).includes(norm(folder)) || norm(folder).includes(norm(p.title)) ? .35 : 0;
  return jaccard + sub;
}

async function match(src) {
  const projects = await projectIds();
  const folders = (await readdir(src, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name);
  const taken = new Set(), map = {}, review = [];

  const scored = folders.flatMap(f => projects.map(p => ({ f, p, s: score(f, p) })))
                        .sort((a, b) => b.s - a.s);
  for (const { f, p, s } of scored) {
    if (map[f] !== undefined || taken.has(p.id) || s < .18) continue;
    map[f] = p.id; taken.add(p.id);
    if (s < .45) review.push(`${f}  ->  ${p.id}   (weak match, ${s.toFixed(2)})`);
  }
  for (const f of folders) if (map[f] === undefined) { map[f] = null; review.push(`${f}  ->  ?   (no match — fill this in)`); }

  await writeFile(MAPFILE, JSON.stringify(map, null, 2));
  const unmatched = projects.filter(p => !taken.has(p.id));

  console.log(`Matched ${Object.values(map).filter(Boolean).length} of ${folders.length} folders.`);
  console.log(`Wrote ${MAPFILE} — check it before building.\n`);
  if (review.length) { console.log("Needs your eyes:"); review.forEach(r => console.log("  ! " + r)); console.log(); }
  if (unmatched.length) {
    console.log(`${unmatched.length} project(s) with no folder yet (they keep their placeholder):`);
    unmatched.forEach(p => console.log(`    ${p.id.padEnd(28)} ${p.title} — ${p.client}`));
  }
}

/* ── build ───────────────────────────────────────────────────────────── */
/* Filenames are a convention, not a requirement. Sorted order is display
   order; `main.*` and `og.*` are the only two reserved names, and if there's
   no main.* the first file leads. */
const kindOf = n => {
  const b = basename(n, extname(n)).toLowerCase();
  return b === "main" ? "main" : b === "og" ? "og" : "gallery";
};

/* sharp is a native dependency and only the build step needs it, so it's
   imported lazily — `match` runs on a clean checkout with no npm install. */
let sharp;
async function loadSharp() {
  if (sharp) return sharp;
  try { ({ default: sharp } = await import("sharp")); }
  catch { console.error("sharp isn't installed. Run:  npm i\n"); process.exit(1); }
  return sharp;
}

async function variants(src, destDir, stem) {
  await mkdir(destDir, { recursive: true });
  await loadSharp();
  const meta = await sharp(src).metadata();
  const widths = WIDTHS.filter(w => w <= meta.width);
  if (!widths.length) widths.push(meta.width);
  for (const w of widths)
    for (const [fmt, opts] of FORMATS)
      await sharp(src).rotate().resize({ width: w, withoutEnlargement: true })
        .toFormat(fmt, opts).toFile(join(destDir, `${stem}-${w}.${fmt === "jpeg" ? "jpg" : fmt}`));
  return { widest: Math.max(...widths), w: meta.width, h: meta.height };
}

async function build(src, out) {
  if (!existsSync(MAPFILE)) { console.error(`No ${MAPFILE}. Run the match step first.`); process.exit(1); }
  const map = JSON.parse(await readFile(MAPFILE, "utf8"));
  const images = {}, warn = []; let n = 0;

  for (const [folder, id] of Object.entries(map)) {
    if (!id) { warn.push(`${folder} — unmapped, skipped`); continue; }
    const dir = join(src, folder);
    const files = (await readdir(dir)).filter(f => OK.has(extname(f).toLowerCase())).sort();
    const rec = { gallery: [] };

    if (!files.length) { warn.push(`${folder} — no images inside, skipped`); continue; }

    let g = 0;
    for (const f of files) {
      const kind = kindOf(f);
      const stem = kind === "gallery" ? String(++g).padStart(2, "0") : kind;
      const info = await variants(join(dir, f), join(out, id), stem);
      const ref = `${id}/${stem}-${info.widest}.jpg`;
      kind === "gallery" ? rec.gallery.push(ref) : (rec[kind] = ref);
      n++; process.stdout.write(`  ${id}/${f} → ${info.w}×${info.h}\n`);
    }
    /* No main.* in the folder? The first image leads, and stays in the gallery. */
    if (!rec.main && rec.gallery.length) {
      rec.main = rec.gallery[0];
      warn.push(`${id} — no main.*, using ${basename(rec.main)}. Rename one to main.jpg to choose.`);
    }
    if (!rec.gallery.length) delete rec.gallery;
    images[id] = rec;
  }

  await mkdir(out, { recursive: true });
  const json = JSON.stringify(images, null, 2);
  await writeFile(join(out, "images.json"), json);
  await writeFile(join(out, "images.js"),
    `/* Generated by prepare-images.mjs — do not edit. */\nwindow.JC_IMAGES = ${json};\n`);
  console.log(`\n${n} sources → ${n * WIDTHS.length * FORMATS.length} variants`);
  console.log(`Wrote ${join(out, "images.json")}`);
  if (warn.length) { console.log(`\n${warn.length} thing(s) to look at:`); warn.forEach(w => console.log("  ! " + w)); }
  const named = Object.keys(images).length;
  console.log(`\nWrote ${join(out, "images.js")} — the page picks it up on load.`);
  console.log(`${named} project(s) now have real images. Nothing to paste.`);
  console.log(`Anything not in the manifest keeps its placeholder, so you can add`);
  console.log(`folders and re-run this as often as you like.`);
}

const [, , cmd, a = "./originals", b = "./assets"] = process.argv;
if (cmd === "match") await match(a);
else if (cmd === "build") await build(a, b);
else { console.log("Usage:\n  node prepare-images.mjs match ./originals\n  node prepare-images.mjs build ./originals ./assets"); process.exit(1); }
