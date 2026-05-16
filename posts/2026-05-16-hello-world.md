---
title: Hello, world
date: 2026-05-16
description: First post on the new blog.
---

Welcome. This blog is intentionally plain: Georgia for the body, Verdana
for headings, classic blue links, and no JavaScript.

## How posts work

Drop a markdown file into `posts/` named `YYYY-MM-DD-slug.md` with a
title in the frontmatter, then run `npm run build`.

## Images

Put originals into `raw-images/`, run `node resize-images.js`, then
reference them in markdown the normal way:

    ![A caption](../images/example.jpg)

The build rewrites that into a `<picture>` element preferring WebP with
a JPEG fallback and `loading="lazy"`.
