# Aiml355 — a deliberately web 1.0 blog

A minimal static blog. Markdown in, plain HTML out. No JavaScript on the
site, Georgia body, Verdana headings, blue/purple links.

## Layout

    posts/          YYYY-MM-DD-slug.md with frontmatter (title, date, description?)
    templates/      base.html, index.html, post.html, style.css
    raw-images/     drop full-size originals here (gitignored)
    images/         resized JPEG + WebP outputs (committed)
    build.js        renders posts/ + templates/ → dist/
    resize-images.js  sharp pipeline: raw-images/ → images/
    dist/           build output (gitignored)

## Workflow

    npm install
    # add a post:
    #   posts/2026-05-16-my-slug.md
    # add an image:
    #   cp photo.jpg raw-images/photo.jpg
    npm run resize     # produces images/photo.jpg + images/photo.webp
    npm run build      # writes dist/

Reference images from a post with normal markdown syntax — the build
rewrites them into a `<picture>` element that prefers WebP, falls back
to JPEG, and uses `loading="lazy"`:

    ![Alt text](../images/photo.jpg)

`resize-images.js` reads `raw-images/`, auto-rotates via EXIF, resizes
to max-width 1600px, writes JPEG (quality 82, mozjpeg) and WebP
(quality 78) into `images/`, and skips files that already have both
outputs.

## Frontmatter

```
---
title: Post title
date: 2026-05-16
description: Optional one-liner for <meta name="description">.
---
```

The homepage lists posts newest-first by `date`. Each post is rendered
to `dist/posts/<slug>.html`.

## Deploying to Cloudflare Pages

Connect the repo in the Cloudflare Pages dashboard and set:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** pinned via `.nvmrc` (currently 22)

`raw-images/` is gitignored — only the resized outputs in `images/`
are committed and shipped. There is no runtime JavaScript, so the
deployment is just static files.
