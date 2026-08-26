# Jake Caminero — portfolio site

A static portfolio for Jake Caminero, a photographer and director in Costa Mesa,
California. Built for Two Miles as the first project in a web-services offering,
so decisions here are meant to be reusable for future clients.

Hand-written HTML/CSS/JS, no framework, no build step for the site itself. It is
hosted as flat files. The only tooling is the image pipeline in `tools/`.

## Layout

    index.html              markup, styles, behaviour — no longer holds data
    content/projects/<id>.json  one file per project, Jake-editable (via CMS)
    content/info.json       site-wide singleton (bio, contact, gear, ...), Jake-editable
    tools/placeholder-tones.json  tone/overlay/gal per project — design-only, not in the CMS
    admin/config.yml        Decap CMS schema — what Jake can and can't edit
    admin/index.html        Decap CMS admin panel entry point (served at /admin)
    tools/build-content.mjs content/*.json -> assets/content.js (window.JC_CONTENT)
    assets/content.js       generated; sets window.JC_CONTENT (projects + site)
    assets/images.js        generated manifest; maps project id -> image paths
    assets/<project-id>/    processed images, committed
    content/media/<id>/     raw CMS uploads, committed straight into git (see admin/config.yml)
    assets-src/             raw originals for local bulk imports, gitignored
    tools/prepare-images.mjs image pipeline — match/build (local) + cms (Netlify)
    tools/migrate-content.mjs one-time script that produced content/*.json — not part
                             of the ongoing pipeline, kept for reference
    tools/backfill-images.mjs one-time fix for projects bulk-imported before the CMS
                             existed (see Images section) — kept for reference
    tools/serve.mjs          zero-dependency local server
    mapping.json            folder name -> project id, curated, committed (local bulk imports only)
    netlify.toml             `npm run build` on every deploy
    docs/IMAGES.md          how to populate images (local bulk-import path)

## The one rule that matters

**Data and design are separated, and the separation is load-bearing.** Jake edits
data, through the Decap CMS at `/admin` — he never opens index.html or a repo.

- `content/projects/*.json` and `content/info.json` are data. Everything the CMS
  exposes (see `admin/config.yml`) is Jake's to control. `CONTENT` at the top of
  the script block is assembled from these at build time (`window.JC_CONTENT`,
  written by `tools/build-content.mjs`), plus `CAPABILITIES`/`SECTORS`.
- `SLOTS`, `GAL_SLOTS`, `FACET`, `ICON`, `CAPABILITIES`, `SECTORS`, and all CSS
  are design. He never sees them, and none of them are in `admin/config.yml`.
  `CAPABILITIES`/`SECTORS` stay hardcoded in index.html rather than in the CMS
  specifically because they drive `ICON`/`FACET` and the filter facets — letting
  Jake edit that vocabulary risks silently breaking the filter UI.

`SLOTS` is a repeating six-position rhythm on a twelve-column grid; homepage
projects cycle through it by index. That is why adding or removing a project can
never break the composition — nobody specifies a layout, only which projects are
selected and in what order. **Do not hand-place cards.** If a composition needs
changing, change the pattern, not an individual project.

## Design system

Warm off-white paper, near-black ink, inverted for dark mode via `data-theme` on
`<html>`. Helvetica Neue / Inter stack. Tight negative tracking on display sizes.

The visual grammar is hairline rules, sharp corners, and micro uppercase labels.
**No rounded corners anywhere** — this was an explicit client rejection, and the
theme switch and filters were both rebuilt because of it.

Discipline is encoded as three marks: triangle (creative direction), circle
(stills), square (motion), plus a diamond for Selects. Filled means yes, hollow
or low-opacity means no. The filter key uses the same marks at legend scale, so
the control that teaches the notation is also the one that operates the page.
**Keep any new control inside this grammar** rather than importing a generic UI
component.

Colour tokens: `--ink`, `--paper`, `--ghost` (readable secondary text, 4.65:1),
`--whisper` (decorative marks only, fails text contrast by design), `--hair`,
`--chip`. Use `--ghost` for anything a person reads.

## Information architecture

Jake's brief treats Selected Work and Archive as two tiers, not a highlight flag.

- **Home** — the newest `HOME_MAX` (12) selects. Two full cycles of the slot pattern.
- **Work** — the curated index, selects only. 21 projects.
- **Archive** — the complete record, scattered with parallax. All 31.
- **Project** — `#/project/{id}`, full detail.
- **Info**, **Contact**.

The Selects filter therefore only appears on Archive, which is the one view
holding both tiers. Home and Work show three discipline facets.

Filter counts are **faceted**: each shows how many projects remain if that mark
is switched on alongside whatever is already active, so a zero warns before the
click. Home counts against the twelve it displays, not all 31 — scoping matters
or the key promises more than the grid can show.

## Images

A browser cannot list a directory, so enumeration happens at build time.
`tools/prepare-images.mjs` processes to AVIF, WebP and JPEG at 800/1600/2400,
and writes `assets/images.js` setting `window.JC_IMAGES`. `index.html` merges
that into `CONTENT.projects` on load. There are two ways images get into that
manifest, both merging into the same `assets/images.json` rather than
overwriting it wholesale — a project untouched by either keeps whatever it had:

- **CMS uploads** (`node tools/prepare-images.mjs cms ./assets`) — what
  Netlify's build runs on every deploy. Reads the `images` block Decap CMS
  writes into `content/projects/<id>.json` — repo-relative paths under
  `content/media/<id>/`, since uploads commit straight into git (Decap's
  plain built-in image widget; see `admin/config.yml`). Tried Cloudinary's
  external media library first, but its Media Library/Assets product needs a
  separate sales-gated plan — not available self-serve, so this uses git
  instead. That's a deliberate tradeoff (the repo grows with every photo, no
  cleanup path later) rather than an oversight. Processes anything new or
  changed and drops a project back to its placeholder if its CMS images get
  cleared. Explicit fields (main/og/gallery, gallery drag-reordered in the
  CMS), not a filename convention — a non-coder shouldn't need to know
  `main.jpg` is special.
- **Local bulk import** (`match` then `build`, via `assets-src/<folder>/` +
  `mapping.json`) — unchanged from before the CMS existed, for you doing a
  large one-off drop of a client's Pixieset export. Filename convention
  (`main.*`/`og.*`/sorted gallery) still applies here. See `docs/IMAGES.md`.

Any project absent from the manifest keeps its generated SVG placeholder,
which is what makes incremental population safe either way.

Output filenames are content-hashed (`main-<hash>-800.jpg`, not `main-800.jpg`)
because `/assets/*` is served with a year-long immutable `Cache-Control`
(`_headers`) — without the hash, replacing a photo would reuse the exact
same URL, and any browser that had already cached the old one would just
keep serving it forever, ignoring the new content entirely.

**Incident, worth knowing about:** the 12 projects bulk-imported before the
CMS existed originally had no `images` block in `content/projects/<id>.json`
at all — their images only lived in `assets/images.json`, generated once by
the old `build` command and never touched again. That made those projects
invisible in the CMS's Images section, which silently destroyed one
project's entire gallery the first time someone uploaded a single new main
image through `/admin` — the CMS had no idea the gallery existed, so saving
just replaced the whole thing. Fixed two ways: `tools/backfill-images.mjs`
(run once) wrote each of those 12 projects' existing images into
`content/projects/<id>.json` as `/assets/<id>/...` references, so the CMS
now shows everything Jake actually has; and `cms` in `prepare-images.mjs`
recognizes an `assets/`-prefixed reference as already-processed and passes
it through untouched rather than reprocessing it, so partially editing one
of these projects (e.g. just swapping the main image) no longer wipes the
rest.

When real photographs are in for a project, its `tone`/`overlay`/`gal` entry in
`tools/placeholder-tones.json` becomes dead weight — harmless to leave (it's
just never read once `p.images.main` exists), fine to delete if tidying up.

## Real vs test data

The 31 projects are **real** — titles, clients, dates, descriptions, video links,
and credits all came from Jake.

**Invented and needing replacement:** every `loc`, every `del` (deliverables),
every `tags` array, the month on projects Jake dated by year only, the entire
`gear` array on the Info page, and the Recognition block (currently literal
"TEST DATA" strings).

**Known problems in Jake's source data:** `rally-tristan-detwiller` was dated
February 31; `batch-farm-visit` was missing its Selected Work toggle and is
assumed selected; three projects have "Test" or "Spec Shoot" as the client, which
will read as a bug on a live site.

## Constraints

- No `localStorage` — the theme choice is deliberately not persisted. One line in
  `theme()` is commented showing where to add it for production.
- Mobile accordion on Work uses the `0fr` -> `1fr` grid-rows transition. Needs
  Chrome 107 / Safari 16 / Firefox 120. Older browsers get no animation, which is
  an acceptable failure.
- The archive cursor preview is `position: absolute` inside `#scatter`, not
  fixed. Fixed positioning breaks inside the transformed page container, and it
  has to share a stacking context with the titles so the hovered one can sit in
  front of it.
- Respect `prefers-reduced-motion` — already wired globally and in the parallax.

## Next up, roughly in order

1. **Populate images**, the remaining ~20 projects — via the CMS at `/admin`.
   Check homepage crops as they land — slots assume shapes and
   `object-fit: cover` will crop a portrait hard through the middle in the
   wide band.
2. **Info and Contact** haven't had a proper pass since the aesthetic settled
   — Recognition is still literal "TEST DATA" (`content/info.json`), and Gear
   is a plausible-but-invented kit list. Both are now CMS-editable directly.
3. **Static pages instead of hash routing.** `#/project/{id}` is invisible to
   search. A build step should emit real `/work/{id}/index.html` files with per
   project meta tags from the same `CONTENT` object.
4. ~~Airtable as the CMS~~ — done, via Decap CMS instead (see `admin/`,
   `content/`, `tools/build-content.mjs`). Images ended up git-committed
   rather than pulled from an external attachment host at build time as
   originally sketched here — Cloudinary's external media library needed a
   sales-gated plan, so this uses Decap's plain built-in git-based image
   widget instead (`content/media/<id>/`, see the Images section above).
