# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Aiml355 — a deliberately web 1.0 static blog. Markdown in, plain HTML
out. Deploys to Cloudflare Pages at https://aiml355.blogga.workers.dev/.

## Hard constraints — do not break

- **No JavaScript on the rendered site.** No `<script>` tags in
  templates, no client-side bundles, no analytics snippets. This is the
  single biggest filter on feature choices. Build-time JS is fine; only
  the shipped output must be JS-free.
- **No template engine, no bundler, no framework.** Templates are plain
  `{{var}}` string substitution in `build.js`. Dependencies stay limited
  to `marked`, `gray-matter`, `sharp`. Don't add Eleventy, Astro, etc.
- **Visual style is fixed:** Georgia body, Verdana headings, 38em
  centered column, `#0033cc` unvisited / `#551a8b` visited links. Don't
  redesign without being asked.
- **`raw-images/` is gitignored; `images/` is committed.** Originals
  stay out of git; only the optimized JPEG + WebP pair ships.

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

There is no test suite, linter, or formatter. Don't add one unasked.

## Post format

```
---
title: Post title
date: 2026-05-16
description: Optional, used for <meta name="description">.
---
```

Filename must match `YYYY-MM-DD-slug.md`. `gray-matter` also parses
`author` and `tags` but templates don't render them yet — leaving them
in is fine.

Reference images with normal markdown: `![alt](../images/photo.jpg)`.
The build rewrites local `.jpg/.jpeg/.png/.webp` paths into a
`<picture>` element (WebP source, JPEG fallback, `loading="lazy"`).
External URLs render as a plain `<img>`.

## Build internals

- `build.js` clears `dist/`, copies `style.css` and `images/` into it,
  renders each post via `templates/post.html` + `templates/base.html`,
  writes the homepage from `templates/index.html`, and writes
  `dist/404.html` (Cloudflare Pages serves it automatically for
  missing paths).
- Posts are sorted newest-first by frontmatter `date`, falling back to
  the filename date.
- `SITE_TITLE` is hardcoded near the top of `build.js`.

## Deploying

Cloudflare Pages is wired to `main`. Every push rebuilds.

- Build command: `npm run build`
- Output directory: `dist`
- Node version: pinned via `.nvmrc` (currently 22)

Don't push to `main` without being asked — the user usually wants to
review locally first.

## Conventions

- ESM only (`"type": "module"`), `node:` prefix for stdlib imports.
- Plain `{{var}}` substitution; don't reach for Handlebars/Nunjucks/etc.
- Keep `build.js` and `resize-images.js` readable top-to-bottom; no
  module-splitting unless the file genuinely outgrows itself.
- Markdown-first content; HTML in posts is allowed but unusual.

## Reference docs in this repo

- `README.md` — user-facing overview and workflow.
- `session-notes-2026-05-17.md` — running log of decisions, rationale, and
  known rough edges. Check this before suggesting changes that touch
  the build pipeline or deploy setup.
