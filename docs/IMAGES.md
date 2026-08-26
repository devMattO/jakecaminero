# Populating Jake's images

## Step 1 — Get the files out of Pixieset

Pixieset is a client-delivery gallery, not an asset host. Don't point the site at
those URLs: the CDN paths aren't guaranteed stable, hotlinking is against their
terms, and the gallery serves one display size with no control over format. It's
also a flat set of images with no mapping to projects.

Jake owns the collection, so from his Pixieset admin:
**Collection -> Download -> Original size**, which gives a ZIP.
Better still, if he has the graded exports in Lightroom, take them from there —
Pixieset re-encodes on upload and the originals will be cleaner.

## Step 2 — Where to put them

**One folder per project. That's the whole system.**

    assets-src/
      whitney/                  <- folder name matched to the project id
        main.jpg                <- optional: which frame leads
        og.jpg                  <- optional: social card
        DSC_4402.jpg            <- everything else is the gallery,
        DSC_4417.jpg               in filename order
        DSC_4488.jpg

Filenames are a convention, not a requirement. Only `main.*` and `og.*` mean
anything; every other image becomes a gallery frame in sorted order. Drop in
whatever came off the card. If there's no `main.*`, the first image leads and the
script tells you which one it picked so you can rename if you disagree.

Then:

    npm i sharp
    node prepare-images.mjs match ./assets-src      # folder -> project, once
    node prepare-images.mjs build ./assets-src ./assets

The build walks every folder, processes what it finds, and writes
`assets/images.js`. The page loads that file and wires each project to its own
images automatically. **Nothing is ever pasted into the site by hand.** Add more
folders later and re-run — projects not in the manifest keep their placeholders.

### Why the loop happens at build time

A browser cannot list a directory. There's no HTTP request that returns "what
files are in this folder", so client-side JavaScript can't discover images by
scanning. Enumerating once at build and shipping the result is the standard fix,
and it's faster anyway — one small script instead of a request per folder.

## Step 3 — The repository is your Git repo

Commit `assets/` alongside the HTML. GitHub gives you versioning, an upload UI
for anyone who doesn't want a terminal, and free hosting through Cloudflare Pages
or Netlify, which redeploy on push. Roughly 1,600 processed files is nothing for
Git as long as you commit the output rather than the raw camera originals — keep
`assets-src/` out with a `.gitignore` and archive the originals separately.

If you'd rather Jake never see a repo, the Airtable route from the CMS notes
still applies: attachment fields on each project row, and the build fetches them
instead of reading folders. Same manifest, same result. Airtable attachment URLs
expire after a few hours, so the build must download them — the site can never
link to Airtable directly.

**Check Pixieset for sub-collections first.** If Jake grouped that gallery by
project, download each as its own ZIP and the folder structure comes free — the
`match` step handles imperfect names, so it becomes a drag-and-drop job. If it's
one flat set of 182 images, someone has to sort them by eye, and no tooling
avoids that.

## Step 4 — Two things to fix while you're in there

**Alt text.** Every image currently gets `"{title} for {client}"`, which is fine
for the main image and useless for gallery frames. Add an `alt` array alongside
`gallery` if Jake will write them — it matters for search as much as for screen
readers.

**Ratios.** The layout slots assume particular shapes: the wide homepage band
wants something cinematic, the sticky preview on Work is 4:5. Real photographs
get `object-fit: cover`, so a portrait dropped into the wide slot will crop hard
through the middle. Check the homepage and the project galleries once the first
few are in, and if the crops fight the pictures, the fix is a per-project crop
hint rather than changing the grid.

---

## Folder checklist

| # | folder (project id) | project | tier | gallery |
|---|---|---|---|---|
| 1 | `swi-endo` | SWI + ENDO — Test Shoot | Select | 5 |
| 2 | `fullest-25-26` | The Fullest 25/26 — The Fullest | Select | 4 |
| 3 | `fullest-ecology-center` | The Fullest + Ecology Center — The Fullest | Select | 5 |
| 4 | `agronomy-ss-launch` | Agronomy S/S Launch — Agronomy Workshop | Select | 4 |
| 5 | `buckhorn-foraging` | Foraging for Cocktails — Cuyama Buckhorn | Select | 6 |
| 6 | `rally-tristan-detwiller` | Tristan Detwiller — The Rally Project | Select | 5 |
| 7 | `batch-farm-visit` | Farm Visit — Batch | Select | 6 |
| 8 | `rally-luke-davis` | Luke Davis — The Rally Project | Select | 5 |
| 9 | `toyota-tundra-rathkamp` | Toyota Tundra + Spencer Rathkamp — Spec Shoot | Select | 5 |
| 10 | `velotric-nomad-2` | Velotric — Velotric | Archive | 4 |
| 11 | `buckhorn-summer-cocktail` | Summer Cocktail Menu — Cuyama Buckhorn | Select | 5 |
| 12 | `batch-lifestyle-campaign` | Batch Lifestyle Campaign — Batch | Select | 6 |
| 13 | `haus-of-wellness` | Haus of Wellness — Haus of Wellness | Archive | 4 |
| 14 | `pryml-hog-hunt` | Hog Hunt — PRYML | Select | 6 |
| 15 | `son-of-cobra-bristol` | The Bristol Car — Son of Cobra | Select | 5 |
| 16 | `rally-dylan-riin` | Dylan + RiiN — The Rally Project | Select | 5 |
| 17 | `oak-morning-ride` | Morning Ride — Oak Cycling | Archive | 4 |
| 18 | `whitney` | Whitney — Personal Project | Select | 6 |
| 19 | `joy-air` | Joy Air — Joy Air | Archive | 4 |
| 20 | `weekend-with-rivian` | Weekend with Rivian — Test | Select | 5 |
| 21 | `tumbleweeds` | Tumbleweeds — Max Griffin | Select | 5 |
| 22 | `dino-motorsport` | Dino Motorsport — Dino Motorsport | Archive | 5 |
| 23 | `rally-matt-allen` | Matt Allen — The Rally Project | Select | 4 |
| 24 | `lucid-air-sapphire` | Lucid Air Sapphire — Road & Track | Select | 6 |
| 25 | `honda-crv` | Honda CR-V — Test | Select | 5 |
| 26 | `rt-the-spot` | The Spot — Road & Track | Archive | 3 |
| 27 | `rt-everatti` | Everatti — Road & Track | Archive | 4 |
| 28 | `rt-breakdance` | Breakdance — Road & Track | Select | 6 |
| 29 | `rt-rimac-nevera` | Rimac Nevera — Road & Track | Archive | 5 |
| 30 | `rt-cyan-p1800` | Cyan P1800 — Road & Track | Archive | 5 |
| 31 | `uniqlo-vans` | Uniqlo + Vans — Test | Archive | 4 |
