# Session notes — 2026-05-16/17

Initial build-out and deploy of the Aiml355 blog.

## What was built

A deliberately web 1.0 static blog:

- Markdown posts in `posts/` (frontmatter: title, date, optional description, optional author, tags)
- `build.js` renders posts via `templates/` → `dist/`
- Markdown image syntax is rewritten into `<picture>` (WebP source first, JPEG fallback, `loading="lazy"`)
- `resize-images.js` (sharp) processes `raw-images/` → `images/`: EXIF auto-rotate, max-width 1600px, JPEG q82 mozjpeg + WebP q78, skips already-processed
- CSS: Georgia body, 38em centered column, line-height 1.6, Verdana headings, `#0033cc` unvisited / `#551a8b` visited links, no JavaScript
- Cloudflare Pages deployment, auto-rebuild on push

## File structure

    .
    ├── .gitignore             # node_modules/, raw-images/, dist/, .claude/settings.local.json
    ├── .nvmrc                 # Node 20 (pins Cloudflare build container)
    ├── README.md
    ├── SESSION_NOTES.md       # this file
    ├── build.js               # markdown → dist/
    ├── resize-images.js       # raw-images/ → images/
    ├── package.json           # type: module; scripts: build, resize
    ├── package-lock.json
    ├── templates/
    │   ├── base.html          # outer layout, header/footer
    │   ├── index.html         # homepage post list
    │   ├── post.html          # single-post body
    │   └── style.css          # copied verbatim to dist/style.css
    ├── posts/
    │   ├── 2026-05-16-hello-world.md
    │   └── 2026-05-16-and-off-we-go.md
    ├── raw-images/            # gitignored, source-of-truth originals
    ├── images/                # committed, optimized .jpg + .webp pairs
    └── dist/                  # gitignored, build output

## Workflow

```bash
# add a post
$EDITOR posts/2026-05-17-my-slug.md   # YYYY-MM-DD-slug.md, with frontmatter

# add an image (optional)
cp ~/photo.jpg raw-images/photo.jpg
npm run resize                        # creates images/photo.jpg + .webp
# reference from markdown: ![alt](../images/photo.jpg)

# build + preview locally
npm run build
npx --yes serve dist -l 5173 --no-clipboard
# open http://localhost:5173

# publish
git add posts/2026-05-17-my-slug.md images/  # or whatever changed
git commit -m "…"
git push                              # Cloudflare auto-builds
```

## Deployment

- **GitHub:** https://github.com/parkinj777/Aiml355 (public)
- **Live:** https://aiml355.blogga.workers.dev/
- **Cloudflare Pages settings:**
  - Production branch: `main`
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Framework preset: None
  - Node version: read from `.nvmrc` (20)
- Every push to `main` triggers a rebuild.

## Decisions & rationale

- **Templates are plain `{{var}}` substitution, not a template engine.** Keeps the build dependency-light (sharp, marked, gray-matter only) and the rendering logic visible inline in `build.js`.
- **Markdown image rewriter only fires on local relative paths with `.jpg/.jpeg/.png/.webp` extensions.** External URLs render as a plain `<img loading="lazy">` rather than a broken `<picture>` pointing at non-existent fallbacks.
- **`images/` is committed, `raw-images/` is gitignored.** Originals can be huge and don't belong in the repo; the optimized outputs ship to Cloudflare.
- **No JavaScript on the site.** A constraint, not an accident — kept reflected in the no-`<script>` templates and is the single biggest filter on future feature choices.
- **Node 20 pin via `.nvmrc`** to avoid relying on a dashboard env var. Local machine runs Node 24 — code is plain ESM with `node:` prefix imports, runs on both.
- **The user's home directory was already a git repo (`C:\Users\mildl\.git`).** We initialized a separate repo inside `Claude-Projects/Aiml355/` rather than committing into the home-dir one. The home-dir repo was left untouched.
- **`.claude/settings.local.json` is gitignored** per Claude Code convention — it's per-machine permission state, not project config.

## Known small rough edges

- `gray-matter` parses the post's `tags: [Test]` and `author: "John"` frontmatter but the templates don't render them yet. Frontmatter is captured, just not surfaced.
- `serve` (the local preview tool) emits a 301 → clean URL for `.html` paths. Cloudflare does the same with a 307. Internal links use `.html` extensions, so there's always one redirect hop. Could be cleaned up by emitting clean URLs from the build, or by writing internal links without `.html`.
- The build copies `images/` into `dist/images/` whole. If `images/` grows large, this is wasteful — could symlink or just serve `images/` directly if a future refactor merits it.
- `build.js` does not generate a sitemap, RSS feed, or `robots.txt`.
- `dist/404.html` generated at build time; Cloudflare Pages serves it automatically for missing paths.
- `SITE_TITLE` is hardcoded near the top of `build.js`; a config file would be cleaner if more knobs accumulate.

## Useful commands

```bash
# rebuild
npm run build

# regenerate optimized images for any new raw-images/
npm run resize

# preview locally
npx --yes serve dist -l 5173 --no-clipboard

# probe the live site
curl -sIL https://aiml355.blogga.workers.dev/
```

## Future work — ordered by effort

See the in-conversation list. Headline tiers:

1. **Trivial** (~15–30 min each): site config object, ~~404 page~~, favicon, robots.txt, author byline, dark mode via `prefers-color-scheme`.
2. **Small** (~30–60 min each): RSS/Atom feed, sitemap.xml, drafts flag, reading time, OG/Twitter meta, prev/next post links, footer links.
3. **Medium** (~1–3 hours each): tag index pages, author pages, pagination, syntax highlighting (shiki, build-time), figure/caption support, custom domain.
4. **Larger / breaks the no-JS rule**: static search (Pagefind), comments, newsletter, i18n.
5. **Architectural step**: dynamic features → add a Cloudflare Worker alongside Pages.
