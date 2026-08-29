#!/usr/bin/env node
/**
 * migrate-project-order.mjs — one-time move from a numeric "order" field
 * on each project to a single ordered list at content/project-order.json,
 * edited via drag-and-drop in the CMS (the "Project Order" collection).
 *
 *   node tools/migrate-project-order.mjs
 *
 * Preserves today's live order exactly (sorts by the current `order`
 * values first, same as the code it's replacing), then removes the now
 * -unused `order` key from every project file — from then on,
 * content/project-order.json is the only source of truth for sequence.
 *
 * Run once. Not part of the ongoing pipeline — kept for reference like
 * migrate-content.mjs and backfill-images.mjs.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECTS_DIR = "content/projects";
const OUT = "content/project-order.json";

async function main() {
  const files = (await readdir(PROJECTS_DIR)).filter(f => f.endsWith(".json"));
  const projects = [];
  for (const f of files) projects.push(JSON.parse(await readFile(join(PROJECTS_DIR, f), "utf8")));

  projects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const order = projects.map(p => ({ project: p.id }));
  await writeFile(OUT, JSON.stringify({ order }, null, 2) + "\n");
  console.log(`Wrote ${OUT} — ${order.length} project(s), preserving today's order exactly.`);

  for (const f of files) {
    const path = join(PROJECTS_DIR, f);
    const { order: _drop, ...rest } = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify(rest, null, 2) + "\n");
  }
  console.log(`Removed the old numeric order field from ${files.length} project file(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
