#!/usr/bin/env node
/**
 * migrate-content.mjs — one-time move of CONTENT out of index.html into
 * per-file JSON that Decap CMS can edit.
 *
 *   node tools/migrate-content.mjs
 *
 * Writes:
 *   content/projects/<id>.json   one file per project, Jake-editable fields only
 *   content/info.json            the site-wide singleton, Jake-editable fields only
 *   tools/placeholder-tones.json tone/overlay/gal per project — design-only,
 *                                 NOT under content/, never touched by the CMS.
 *                                 Consumed by build-content.mjs so un-photographed
 *                                 projects keep their existing placeholder look.
 *
 * Run once. After this, index.html's hardcoded CONTENT literal gets replaced
 * with a window.JC_CONTENT reference (see tools/build-content.mjs), and from
 * then on content/ is the source of truth, edited via the CMS or by hand.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SITE = "index.html";
const OUT_PROJECTS = "content/projects";
const OUT_INFO = "content/info.json";
const OUT_TONES = "tools/placeholder-tones.json";

async function extractContent() {
  const html = await readFile(SITE, "utf8");
  const m = html.match(/const CONTENT = (\{[\s\S]*?\n\};)/);
  if (!m) throw new Error(`Couldn't find "const CONTENT = {...};" in ${SITE}`);
  return new Function("return " + m[1])();
}

function reshapeInfo(site) {
  const block = h => (site.info || []).find(b => b.h === h) || {};
  return {
    intro: site.intro || "",
    bio: site.bio || "",
    portrait: site.portrait || null,
    emails: site.emails || [],
    socials: site.socials || [],
    contact: site.contact || [],
    gear: site.gear || [],
    clients: block("Clients").list || [],
    recognition: block("Recognition").list || [],
    approach: block("Approach").body || "",
    ongoing: (site.ongoing || []).map(({ t, d }) => ({ t, d })), // tone stays code-assigned
  };
}

async function main() {
  const content = await extractContent();
  if (!content.projects || !content.site) throw new Error("Parsed CONTENT is missing projects/site");

  await mkdir(OUT_PROJECTS, { recursive: true });
  const tones = {};
  let n = 0;

  for (let order = 0; order < content.projects.length; order++) {
    const p = content.projects[order];
    const { id, t, client, date, yr, roles, selected, loc, del, tags, desc, credits, video, sub, press } = p;
    const rec = {
      id, order, t, client, date, yr,
      roles: roles || [],
      selected: !!selected,
      loc: loc || "",
      del: del || [],
      tags: tags || [],
      desc: desc || "",
      credits: credits || [],
    };
    if (video) rec.video = video;
    if (sub) rec.sub = sub;
    if (press) rec.press = press;
    await writeFile(join(OUT_PROJECTS, `${id}.json`), JSON.stringify(rec, null, 2) + "\n");

    const t2 = {};
    if (p.tone) t2.tone = p.tone;
    if (p.overlay) t2.overlay = p.overlay;
    if (p.gal) t2.gal = p.gal;
    if (Object.keys(t2).length) tones[id] = t2;

    n++;
  }

  await writeFile(OUT_TONES, JSON.stringify(tones, null, 2) + "\n");
  await writeFile(OUT_INFO, JSON.stringify(reshapeInfo(content.site), null, 2) + "\n");

  console.log(`Wrote ${n} project file(s) to ${OUT_PROJECTS}/`);
  console.log(`Wrote ${OUT_TONES}`);
  console.log(`Wrote ${OUT_INFO}`);
  console.log(`\nNext: replace the hardcoded CONTENT literal in ${SITE} with a`);
  console.log(`window.JC_CONTENT reference, then run: node tools/build-content.mjs`);
}

main().catch(e => { console.error(e); process.exit(1); });
