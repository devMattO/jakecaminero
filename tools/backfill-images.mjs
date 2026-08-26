#!/usr/bin/env node
/**
 * backfill-images.mjs — one-time fix for a real bug: projects bulk-imported
 * before the CMS existed have real images (in assets/images.json) but no
 * `images` block in content/projects/<id>.json, so Decap CMS shows their
 * Images section as completely empty. That's not just a cosmetic gap — it
 * silently destroys the project's existing images the moment someone
 * uploads a single new one (see the commit message for the incident).
 *
 * Writes an `images` block onto every project already in assets/images.json
 * that doesn't have one, referencing the existing processed files directly
 * (assets/<id>/...) rather than raw sources — prepare-images.mjs recognizes
 * an assets/-prefixed path and passes it through unprocessed. This makes
 * every project's current images visible and editable in the CMS, and safe
 * to partially edit (e.g. replace just the main image) without wiping the
 * rest.
 *
 *   node tools/backfill-images.mjs
 *
 * Run once. Safe to re-run — merges per field (main/og/gallery), so a
 * project that already has a genuine CMS-driven main image (but no gallery
 * yet, because it didn't exist to edit) still gets its old gallery back
 * without touching the new main.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECTS_DIR = "content/projects";
const MANIFEST = "assets/images.json";

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  let backfilled = 0, skipped = 0;

  for (const [id, rec] of Object.entries(manifest)) {
    const file = join(PROJECTS_DIR, `${id}.json`);
    const p = JSON.parse(await readFile(file, "utf8"));
    const images = p.images || {};
    const before = JSON.stringify(images);

    if (!images.main) images.main = `/assets/${rec.main}`;
    if (!images.og && rec.og) images.og = `/assets/${rec.og}`;
    if ((!images.gallery || !images.gallery.length) && rec.gallery && rec.gallery.length) {
      images.gallery = rec.gallery.map(g => ({ src: `/assets/${g}` }));
    }

    if (JSON.stringify(images) === before) { skipped++; continue; }

    p.images = images;
    await writeFile(file, JSON.stringify(p, null, 2) + "\n");
    console.log(`  ${id}: backfilled (${Object.keys(images).join(", ")})`);
    backfilled++;
  }

  console.log(`\n${backfilled} project(s) backfilled, ${skipped} already had everything.`);
}

main().catch(e => { console.error(e); process.exit(1); });
