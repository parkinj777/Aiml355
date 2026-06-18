# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Aiml355 — a hand-built static blog with an "editorial brutalist" magazine
design. Markdown in, plain HTML out. Deploys to Cloudflare Pages at
https://aiml355.blogga.workers.dev/.

The look is deliberate: a print-magazine masthead, issue numbers,
monospaced meta, a paper-grain texture, and an orange accent. Set in
Instrument Serif (display), JetBrains Mono (meta), and Inter (UI),
loaded from Google Fonts.

## Hard constraints — do not break

- **No template engine, no bundler, no framework.** Templates are plain
  `{{var}}` string substitution via `renderTemplate()` in `build.js`.
  Dependencies stay limited to `marked`, `gray-matter`, `sharp`. Don't
  add Eleventy, Astro, etc.
- **No JavaScript on the rendered site.** No `<script>` bundles, no
  framework runtime, no analytics, no inline event handlers. This is the
  single biggest filter on feature choices — build-time JS is fine, only
  the shipped output must be JS-free. (The `base.html` subscribe box is
  deliberately inert markup for this reason; wire a real newsletter
  endpoint or a `mailto:` link if it ever needs to work.)
- **`raw-images/` is gitignored; `images/` is committed.** Originals stay
  out of git; only the optimized JPEG + WebP pair ships.
- **Design tokens live in `:root` in `templates/style.css`.** Colours and
  fonts are CSS custom properties (`--paper`, `--ink`, `--accent`,
  `--serif`, `--mono`, `--sans`). Restyle through these; don't hardcode
  and don't redesign without being asked.

## Layout

    posts/          YYYY-MM-DD-slug.md with frontmatter
    templates/      base.html, index.html, post.html, 404.html, style.css
    raw-images/     full-size originals (gitignored)
    images/         resized JPEG + WebP (committed)
    build.js        posts/ + templates/ -> dist/
    resize-images.js  raw-images/ -> images/ via sharp
    dist/           build output (gitignored)

## Commands

    npm install
    npm run resize     # raw-images/ -> images/ (skips already-processed)
    npm run build      # writes dist/
    npx --yes serve dist -l 5173 --no-clipboard   # local preview

No test suite, linter, or formatter. Don't add one unasked.

## Post format

```
---
title: Post title
date: 2026-05-16
description: Optional — used for <meta name="description">, the index-card excerpt, and the post lede.
category: Notes        # optional, defaults to "Notes"; shown on the index card
---
```

Filename must match `YYYY-MM-DD-slug.md`. `build.js` reads `title`,
`date`, `description`, and `category`; any other frontmatter (`author`,
`tags`, …) is still parsed by gray-matter but ignored.

Reference images with normal markdown: `![alt](../images/photo.jpg)`.
The build rewrites local `.jpg/.jpeg/.png/.webp` paths into a
`<picture>` element (WebP source, JPEG fallback, `loading="lazy"`).
External URLs render as a plain `<img loading="lazy">`.

## Build internals

`build.js` is a single file, readable top-to-bottom:

- Clears `dist/`, copies `style.css` and `images/` into it.
- Parses every `posts/*.md` in two passes, sorts newest-first by
  frontmatter `date` (falling back to the filename date), and assigns
  descending **entry numbers** (oldest = `001`).
- Computes **reading time** and **word count** per post
  (`WORDS_PER_MIN = 220`).
- Renders each post via `post.html` + `base.html`, the homepage from
  `index.html` (a grid of post cards), and `dist/404.html` (Cloudflare
  serves it automatically for missing paths).
- **Masthead accent:** `mastheadParts()` splits `SITE_TITLE` into a main
  part plus the last `SITE_NAME_TAIL_LEN` (3) characters, which the
  templates render in italic — "Aiml" + "355".
- Config constants near the top: `SITE_TITLE`, `SITE_NAME_TAIL_LEN`,
  `ESTABLISHED`, `WORDS_PER_MIN`.
- `renderTemplate(tpl, vars)` does `{{var}}` substitution only — missing
  keys render as empty string, so a template can reference a var the
  build doesn't supply without crashing.

## Templates

- `base.html` — outer shell: topbar (Issue №), `{{content}}`, footer
  (subscribe CTA + link columns), colophon. Loads Google Fonts.
- `index.html` — masthead, "Now" block, filter bar, `{{post_cards}}`.
- `post.html` — article kicker (section label / entry № / read-time),
  title, lede, body, signoff.
- `404.html` — not-found body.

Restyle through `style.css` `:root` tokens and these templates; keep
merge tags exactly `{{like_this}}`.

## Deploying

Cloudflare Pages is wired to `main`. Every push rebuilds.

- Build command: `npm run build`
- Output directory: `dist`
- Node version: pinned via `.nvmrc` (currently 22)

A move toward Cloudflare Workers is being explored on the
`cloudflare/workers-autoconfig` branch — not merged to `main`.

Don't push to `main` without being asked — the user usually wants to
review locally first.

## Conventions

- ESM only (`"type": "module"`), `node:` prefix for stdlib imports.
- Plain `{{var}}` substitution; don't reach for Handlebars/Nunjucks/etc.
- Keep `build.js` and `resize-images.js` readable top-to-bottom; no
  module-splitting unless a file genuinely outgrows itself.
- Markdown-first content; HTML in posts is allowed but unusual.

## Reference docs in this repo

- `README.md` — user-facing overview and workflow (note: its design
  description still describes the pre-redesign look — stale).
- `session-notes-2026-05-17.md` — running log of decisions, rationale,
  and known rough edges. Check this before changes that touch the build
  pipeline or deploy setup.
