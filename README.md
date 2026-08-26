# Jake Caminero — portfolio

Static site. No framework, no build step for the site itself.

## Run it

    npm run dev          # http://localhost:4321

`index.html` also opens directly from the filesystem if you'd rather not run a
server. Everything works either way.

## Editing content

Jake edits project details and photos himself at `/admin` (Decap CMS) — no
terminal, no repo. What he can and can't touch is defined in
`admin/config.yml`; the underlying files are `content/projects/<id>.json` and
`content/info.json`. Uploaded photos commit straight into git, under
`content/media/<id>/` — Decap's plain built-in image widget, no external
media host. Publishing in the CMS commits directly and Netlify redeploys
automatically, running `npm run build` (see `netlify.toml`), which
regenerates `assets/content.js` and processes any new/changed photos.

`admin/config.yml`'s `backend` block needs real values from your DecapBridge
account (auth) before the CMS panel actually works — see the comments at the
top of that file.

For a large one-off bulk import instead (e.g. a full Pixieset export), the
original local pipeline below still works unchanged.

## Add images (bulk import)

Drop one folder per project into `assets-src/`, named however you like:

    assets-src/
      Mt Whitney/
        main.jpg          optional — which frame leads
        og.jpg            optional — social card
        DSC_4402.jpg      everything else becomes the gallery, in filename order

Then:

    npm i                 # once, for sharp
    npm run images        # match folders to projects, then process

The match step fuzzy-matches your folder names against the project ids in
`index.html` and writes `mapping.json` for you to check. The build step processes
everything and writes `assets/images.js`, which the page picks up on load.
Nothing is pasted by hand. Projects without images keep their placeholders, so
you can populate a few at a time and re-run.

Full detail in `docs/IMAGES.md`.

## Deploy

Push to GitHub, connect Netlify. `netlify.toml` sets the build command
(`npm run build`) and publish directory (repo root) — nothing to configure by
hand in Netlify's UI beyond connecting the repo. `_headers` sets long cache
lifetimes on `/assets/*` and none on `index.html`.

## Working on it

Read `CLAUDE.md` first — it covers the data/design boundary, the visual grammar,
which data is real versus placeholder, and what's next.
