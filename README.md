# Jake Caminero — portfolio

Static site. No framework, no build step for the site itself.

## Run it

    npm run dev          # http://localhost:4321

`index.html` also opens directly from the filesystem if you'd rather not run a
server. Everything works either way.

## Add images

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

Push to GitHub, connect Cloudflare Pages or Netlify. No build command, publish
directory is the repo root. `_headers` sets long cache lifetimes on `/assets/*`
and none on `index.html`.

## Working on it

Read `CLAUDE.md` first — it covers the data/design boundary, the visual grammar,
which data is real versus placeholder, and what's next.
