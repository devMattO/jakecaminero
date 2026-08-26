# Jake Caminero — portfolio site

A static portfolio for Jake Caminero, a photographer and director in Costa Mesa,
California. Built for Two Miles as the first project in a web-services offering,
so decisions here are meant to be reusable for future clients.

Hand-written HTML/CSS/JS, no framework, no build step for the site itself. It is
hosted as flat files. The only tooling is the image pipeline in `tools/`.

## Layout

    index.html              the entire site — markup, styles, data, behaviour
    assets/images.js        generated manifest; maps project id -> image paths
    assets/<project-id>/    processed images, committed
    assets-src/             raw originals, gitignored, never committed
    tools/prepare-images.mjs image pipeline (match + build)
    tools/serve.mjs          zero-dependency local server
    mapping.json            folder name -> project id, curated, committed
    docs/IMAGES.md          how to populate images

## The one rule that matters

**Data and design are separated, and the separation is load-bearing.** Jake edits
data. He never touches layout.

- `CONTENT` at the top of the script block is data. Everything Jake controls.
- `SLOTS`, `GAL_SLOTS`, `FACET`, `ICON`, and all CSS are design. He never sees them.

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
`tools/prepare-images.mjs` walks `assets-src/<folder>/`, processes to AVIF, WebP
and JPEG at 800/1600/2400, and writes `assets/images.js` setting
`window.JC_IMAGES`. `index.html` merges that into `CONTENT.projects` on load.

Only `main.*` and `og.*` are reserved filenames; everything else becomes a
gallery frame in sorted order. Any project absent from the manifest keeps its
generated SVG placeholder, which is what makes incremental population safe.

When real photographs are in, delete `shot()` and the `tone` / `overlay` / `gal`
fields from every project — they exist only to generate placeholders.

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

1. **Populate images.** Everything else is cosmetic until real photographs land.
   Check the homepage crops first — slots assume shapes and `object-fit: cover`
   will crop a portrait hard through the middle in the wide band.
2. **Info and Contact** haven't had a proper pass since the aesthetic settled.
3. **Static pages instead of hash routing.** `#/project/{id}` is invisible to
   search. A build step should emit real `/work/{id}/index.html` files with per
   project meta tags from the same `CONTENT` object.
4. **Airtable as the CMS.** Attachment fields for images, build-time pull,
   webhook redeploy. Airtable attachment URLs expire within hours — the build
   must download them, never link.
