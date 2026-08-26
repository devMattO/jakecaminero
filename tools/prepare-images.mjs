#!/usr/bin/env node
/**
 * prepare-images.mjs — get Jake's photographs onto the site.
 *
 *   npm i sharp
 *
 *   node prepare-images.mjs match ./assets-src          # 1. propose folder -> project mapping
 *   node prepare-images.mjs build ./assets-src ./assets # 2. process a local folder drop
 *   node prepare-images.mjs cms ./assets                # or: process CMS-uploaded images
 *
 * `match`/`build` are for you, doing a manual bulk import from a folder of
 * originals (see docs/IMAGES.md) — unchanged from before the CMS existed.
 * `cms` is what Netlify's build runs on every deploy: it reads the `images`
 * block Decap CMS writes into content/projects/<id>.json (repo-relative
 * paths under content/media/<id>/ — Decap commits uploads straight into
 * git, see admin/config.yml), processes anything new or changed, and
 * leaves everything else alone. Both commands merge into the existing
 * assets/images.json rather than regenerating it — a project untouched by
 * either command keeps whatever images it already has.
 *
 * The `match` step exists so folder names don't have to be perfect. It reads
 * the project list from content/projects/*.json, fuzzy-matches whatever came
 * out of Pixieset against it, and writes mapping.json for you to check.
 * Nothing is processed until you're happy with that file.
 *
 * EXPECTED INPUT for `build` — one folder per project, any name:
 *   assets-src/Cuyama Buckhorn - Foraging/
 *     main.jpg        the frame that represents the project
 *     og.jpg          optional social card; falls back to main
 *     01.jpg 02.jpg   gallery, in display order (zero-pad past 9)
 */

import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createHash } from "node:crypto";

const WIDTHS      = [800, 1600, 2400];
const FORMATS     = [["avif",{quality:58,effort:4}],["webp",{quality:80}],["jpeg",{quality:84,mozjpeg:true}]];
const OK          = new Set([".jpg",".jpeg",".png",".tif",".tiff",".webp"]);
const MAPFILE     = "mapping.json";
const PROJECTS_DIR = "content/projects";
const INFO_FILE    = "content/info.json";

/* ── read the project list from content/, so it can never drift ──────── */
async function readContentProjects() {
  const files = (await readdir(PROJECTS_DIR)).filter(f => f.endsWith(".json"));
  const out = [];
  for (const f of files) out.push(JSON.parse(await readFile(join(PROJECTS_DIR, f), "utf8")));
  if (!out.length) throw new Error(`No projects found in ${PROJECTS_DIR}/`);
  return out;
}

/* ── fuzzy match (local bulk import) ──────────────────────────────────── */
const norm  = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const toks  = s => new Set(norm(s).split(" ").filter(t => t.length > 2));
function score(folder, p) {
  const f = toks(folder), t = toks(p.t + " " + p.client + " " + p.id.replace(/-/g," "));
  if (!f.size || !t.size) return 0;
  let hit = 0; for (const x of f) if (t.has(x)) hit++;
  const jaccard = hit / new Set([...f, ...t]).size;
  const sub = norm(p.t).includes(norm(folder)) || norm(folder).includes(norm(p.t)) ? .35 : 0;
  return jaccard + sub;
}

async function match(src) {
  const projects = await readContentProjects();
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
    unmatched.forEach(p => console.log(`    ${p.id.padEnd(28)} ${p.t} — ${p.client}`));
  }
}

/* ── shared manifest read/write ───────────────────────────────────────── */
async function loadManifest(out) {
  const file = join(out, "images.json");
  if (!existsSync(file)) return {};
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return {}; }
}
async function writeManifest(out, images) {
  await mkdir(out, { recursive: true });
  const json = JSON.stringify(images, null, 2);
  await writeFile(join(out, "images.json"), json);
  await writeFile(join(out, "images.js"),
    `/* Generated by prepare-images.mjs — do not edit. */\nwindow.JC_IMAGES = ${json};\n`);
}

/* ── processing ──────────────────────────────────────────────────────── */
/* Filenames are a convention for `build`, not a requirement. Sorted order
   is display order; `main.*` and `og.*` are the only two reserved names,
   and if there's no main.* the first file leads. */
const kindOf = n => {
  const b = basename(n, extname(n)).toLowerCase();
  return b === "main" ? "main" : b === "og" ? "og" : "gallery";
};

/* sharp is a native dependency and only processing needs it, so it's
   imported lazily — `match` runs on a clean checkout with no npm install. */
let sharp;
async function loadSharp() {
  if (sharp) return sharp;
  try { ({ default: sharp } = await import("sharp")); }
  catch { console.error("sharp isn't installed. Run:  npm i\n"); process.exit(1); }
  return sharp;
}

/* `/assets/*` is served with a year-long immutable Cache-Control (see
   _headers) — great for performance, but it means a browser that already
   loaded, say, whitney/main-800.jpg will never re-fetch that exact URL even
   after the source photo changes underneath it. Content-hashing the
   filename gives a replaced photo a genuinely new URL, so the old cached
   one is simply never requested again instead of silently going stale. */
async function variants(input, destDir, stem) {
  await mkdir(destDir, { recursive: true });
  await loadSharp();
  const buf = typeof input === "string" ? await readFile(input) : input;
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);
  const meta = await sharp(buf).metadata();
  const widths = WIDTHS.filter(w => w <= meta.width);
  if (!widths.length) widths.push(meta.width);
  for (const w of widths)
    for (const [fmt, opts] of FORMATS)
      await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true })
        .toFormat(fmt, opts).toFile(join(destDir, `${stem}-${hash}-${w}.${fmt === "jpeg" ? "jpg" : fmt}`));
  return { widest: Math.max(...widths), w: meta.width, h: meta.height, hash };
}

async function build(src, out) {
  if (!existsSync(MAPFILE)) { console.error(`No ${MAPFILE}. Run the match step first.`); process.exit(1); }
  const map = JSON.parse(await readFile(MAPFILE, "utf8"));
  const images = await loadManifest(out); // merge onto whatever's already there
  const warn = []; let n = 0;

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
      const ref = `${id}/${stem}-${info.hash}-${info.widest}.jpg`;
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

  await writeManifest(out, images);
  console.log(`\n${n} sources → ${n * WIDTHS.length * FORMATS.length} variants`);
  if (warn.length) { console.log(`\n${warn.length} thing(s) to look at:`); warn.forEach(w => console.log("  ! " + w)); }
  console.log(`\nWrote ${join(out, "images.js")} — the page picks it up on load.`);
  console.log(`Anything not in mapping.json keeps whatever images it already had.`);
}

/* ── cms: git-committed images from content/projects/<id>.json ─────────── */
/* Decap's image widget stores repo-relative paths like
   "/content/media/whitney/IMG_0231.jpg" — already sitting in the checkout
   (Netlify's clone, or a developer's pulled repo) by the time this runs,
   no network fetch needed. */
const resolveLocal = p => p.replace(/^\/+/, "");
const galleryPaths = gallery => (gallery || []).map(g => (typeof g === "string" ? g : g && g.src)).filter(Boolean);

/* A reference under assets/ is already a processed variant (backfilled from
   an earlier local `build`, or from a previous `cms` run — see
   tools/backfill-images.mjs) — pass it straight through, no reprocessing.
   Anything else is a raw upload under content/media/ that still needs
   `variants()`. This is what lets Jake replace just a project's main image
   in the CMS without silently deleting a gallery he can't even see yet
   unless it's been backfilled into content/projects/<id>.json first. */
async function resolveImage(path, destDir, stem, id) {
  const local = resolveLocal(path);
  if (local.startsWith("assets/")) return local.slice("assets/".length);
  const info = await variants(local, destDir, stem);
  return `${id}/${stem}-${info.hash}-${info.widest}.jpg`;
}

async function cms(out) {
  const images = await loadManifest(out);
  const projects = await readContentProjects();
  let processed = 0, skipped = 0, untouched = 0, removed = 0;

  for (const p of projects) {
    if (!p.images || !p.images.main) {
      /* Jake cleared this project's photos in the CMS. Drop it back to a
         placeholder — but only if we're the ones who put it there (marked
         by _src); never touch an entry the local `build` command made. */
      if (images[p.id] && images[p.id]._src) { delete images[p.id]; removed++; }
      else untouched++;
      continue;
    }
    const gallery = galleryPaths(p.images.gallery);
    const srcKey = JSON.stringify({ main: p.images.main, og: p.images.og || null, gallery });

    if (images[p.id] && images[p.id]._src === srcKey) { skipped++; continue; }

    const dir = join(out, p.id);
    const rec = { gallery: [] };

    try {
      rec.main = await resolveImage(p.images.main, dir, "main", p.id);
      if (p.images.og) rec.og = await resolveImage(p.images.og, dir, "og", p.id);

      let g = 0;
      for (const path of gallery) {
        const stem = String(++g).padStart(2, "0");
        rec.gallery.push(await resolveImage(path, dir, stem, p.id));
      }
    } catch (e) {
      console.error(`  ${p.id}: skipped — ${e.message}`);
      continue;
    }
    if (!rec.gallery.length) delete rec.gallery;
    rec._src = srcKey; // internal — lets the next run skip if nothing changed

    images[p.id] = rec;
    processed++;
    console.log(`  ${p.id}: processed (${1 + (p.images.og ? 1 : 0) + gallery.length} source file(s))`);
  }

  await processSitePortrait(out, images);

  await writeManifest(out, images);
  console.log(`\n${processed} project(s) processed, ${skipped} unchanged, ${removed} removed, ${untouched} with no CMS images yet.`);
}

/* content/info.json's `portrait` isn't a project, so it doesn't go through
   the loop above — index.html reads it from window.JC_CONTENT.site.portrait
   directly (no per-project id to key JC_IMAGES by), so it needs its own
   processed reference here, stashed under images._site and merged back into
   CONTENT.site.portrait client-side (see index.html). Same
   already-processed-vs-raw-upload and skip-if-unchanged handling as a
   project's images. */
async function processSitePortrait(out, images) {
  let info;
  try { info = JSON.parse(await readFile(INFO_FILE, "utf8")); } catch { return; }

  if (!info.portrait) {
    if (images._site) delete images._site;
    return;
  }
  const srcKey = info.portrait;
  if (images._site && images._site._src === srcKey) return;

  try {
    const ref = await resolveImage(info.portrait, join(out, "site"), "portrait", "site");
    images._site = { portrait: ref, _src: srcKey };
    console.log(`  site portrait: processed`);
  } catch (e) {
    console.error(`  site portrait: skipped — ${e.message}`);
  }
}

function usage() {
  console.log([
    "Usage:",
    "  node prepare-images.mjs match ./assets-src",
    "  node prepare-images.mjs build ./assets-src ./assets",
    "  node prepare-images.mjs cms ./assets",
  ].join("\n"));
  process.exit(1);
}

const [, , cmd, ...rest] = process.argv;
if (cmd === "match") await match(rest[0] || "./assets-src");
else if (cmd === "build") await build(rest[0] || "./assets-src", rest[1] || "./assets");
else if (cmd === "cms") await cms(rest[0] || "./assets");
else usage();
