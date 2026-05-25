import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import matter from 'gray-matter';

const ROOT = path.resolve('.');
const POSTS_DIR = path.join(ROOT, 'posts');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_POSTS_DIR = path.join(DIST_DIR, 'posts');
const DIST_IMAGES_DIR = path.join(DIST_DIR, 'images');
const IMAGES_DIR = path.join(ROOT, 'images');

const SITE_TITLE = 'Aiml355';
// First 'core' / last 'tail' chars for the italic accent on the masthead.
// Aiml355 → "Aiml" + "355"
const SITE_NAME_TAIL_LEN = 3;
const ESTABLISHED = 'May 2026';

const POST_NAME_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;
const WORDS_PER_MIN = 220;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateDisplay(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split('-');
  return `${y.slice(2)}.${m}.${d}`;
}

function readingTime(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MIN));
  return { minutes, words };
}

function pad(n, w = 2) { return String(n).padStart(w, '0'); }

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : ''
  );
}

function buildImageRenderer() {
  const renderer = new marked.Renderer();
  renderer.image = (href, title, text) => {
    let src = href;
    if (typeof href === 'object' && href !== null) {
      src = href.href;
      title = href.title ?? title;
      text = href.text ?? text;
    }
    const alt = escapeHtml(text || '');
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const ext = path.extname(src).toLowerCase();
    const base = src.slice(0, src.length - ext.length);
    const isLocalImage = /\.(jpe?g|png|webp)$/i.test(ext) && !/^https?:/i.test(src);
    if (!isLocalImage) {
      return `<img src="${escapeHtml(src)}" alt="${alt}"${titleAttr} loading="lazy">`;
    }
    const webp = escapeHtml(`${base}.webp`);
    const jpeg = escapeHtml(`${base}.jpg`);
    return (
      `<picture>` +
      `<source type="image/webp" srcset="${webp}">` +
      `<source type="image/jpeg" srcset="${jpeg}">` +
      `<img src="${jpeg}" alt="${alt}"${titleAttr} loading="lazy">` +
      `</picture>`
    );
  };
  return renderer;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(src, dest) {
  let entries;
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  await ensureDir(dest);
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else await fs.copyFile(from, to);
  }
}

async function loadTemplate(name) {
  return fs.readFile(path.join(TEMPLATES_DIR, name), 'utf8');
}

function mastheadParts(name) {
  if (name.length <= SITE_NAME_TAIL_LEN) {
    return { main: '', tail: escapeHtml(name) };
  }
  const main = name.slice(0, name.length - SITE_NAME_TAIL_LEN);
  const tail = name.slice(-SITE_NAME_TAIL_LEN);
  return { main: escapeHtml(main), tail: escapeHtml(tail) };
}

async function build() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await ensureDir(DIST_DIR);
  await ensureDir(DIST_POSTS_DIR);

  const baseTpl = await loadTemplate('base.html');
  const indexTpl = await loadTemplate('index.html');
  const postTpl = await loadTemplate('post.html');
  const cssSrc = path.join(TEMPLATES_DIR, 'style.css');
  await fs.copyFile(cssSrc, path.join(DIST_DIR, 'style.css'));

  await copyDir(IMAGES_DIR, DIST_IMAGES_DIR);

  const renderer = buildImageRenderer();
  marked.setOptions({ renderer });

  const entries = await fs.readdir(POSTS_DIR).catch(() => []);
  const posts = [];

  // ── First pass: parse + compute meta for every post ────────
  for (const filename of entries) {
    const match = filename.match(POST_NAME_RE);
    if (!match) continue;
    const [, fileDate, slug] = match;
    const raw = await fs.readFile(path.join(POSTS_DIR, filename), 'utf8');
    const { data, content } = matter(raw);
    const title = data.title || slug;
    const date = data.date ? new Date(data.date).toISOString().slice(0, 10) : fileDate;
    const description = data.description || '';
    const category = data.category || 'Notes';
    const html = marked.parse(content);
    const { minutes, words } = readingTime(content);
    posts.push({
      filename, slug, title, date, description, category,
      content, html, minutes, words,
    });
  }

  // Sort newest first; assign descending entry numbers (oldest = 001).
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  posts.forEach((p, i) => { p.entryNum = pad(posts.length - i, 3); });

  const siteTitleEsc = escapeHtml(SITE_TITLE);
  const mastParts = mastheadParts(SITE_TITLE);
  const year = new Date().getFullYear();
  const issuePadded = pad(posts.length, 3);

  // ── Second pass: render each post page ─────────────────────
  for (const p of posts) {
    const ledeBlock = p.description
      ? `<p class="lede">${escapeHtml(p.description)}</p>`
      : '';
    const postBody = renderTemplate(postTpl, {
      title: escapeHtml(p.title),
      date: p.date,
      date_display: formatDateDisplay(p.date),
      date_short: formatDateShort(p.date),
      entry_num: p.entryNum,
      read_time: `${p.minutes} min`,
      word_count: String(p.words),
      lede_block: ledeBlock,
      content: p.html,
      root_path: '../',
    });

    const descMeta = p.description
      ? `<meta name="description" content="${escapeHtml(p.description)}">`
      : '';

    const page = renderTemplate(baseTpl, {
      title: `${escapeHtml(p.title)} — ${siteTitleEsc}`,
      description_meta: descMeta,
      css_path: '../',
      root_path: '../',
      site_title: siteTitleEsc,
      mast_name_main: mastParts.main,
      mast_name_tail: mastParts.tail,
      issue: issuePadded,
      year: String(year),
      content: postBody,
    });

    await fs.writeFile(path.join(DIST_POSTS_DIR, `${p.slug}.html`), page);
  }

  // ── Render index: rich post cards ──────────────────────────
  const postCards = posts.map((p) => {
    const excerpt = p.description || '';
    return (
      `<a class="post-card" href="posts/${escapeHtml(p.slug)}.html">` +
        `<span class="post-num">№ ${p.entryNum}</span>` +
        `<div class="post-idx">` +
          `<span class="date">${escapeHtml(formatDateShort(p.date))}</span>` +
          `<span class="cat">${escapeHtml(p.category)}</span>` +
        `</div>` +
        `<div>` +
          `<h3 class="post-title">${escapeHtml(p.title)}<em>.</em></h3>` +
          (excerpt ? `<p class="post-excerpt">${escapeHtml(excerpt)}</p>` : '') +
        `</div>` +
        `<div class="post-meta">` +
          `<div class="stat">${p.minutes} min read</div>` +
          `<div class="stat">${p.words} words</div>` +
        `</div>` +
      `</a>`
    );
  }).join('\n');

  const updated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const indexBody = renderTemplate(indexTpl, {
    post_cards: postCards || '<p style="font-family:var(--serif);font-style:italic;color:var(--muted);padding:40px 0">No posts yet.</p>',
    post_count_padded: pad(posts.length, 2),
    mast_name_main: mastParts.main,
    mast_name_tail: mastParts.tail,
    established: escapeHtml(ESTABLISHED),
    updated_display: escapeHtml(updated),
  });

  const indexPage = renderTemplate(baseTpl, {
    title: siteTitleEsc,
    description_meta: '',
    css_path: '',
    root_path: '',
    site_title: siteTitleEsc,
    mast_name_main: mastParts.main,
    mast_name_tail: mastParts.tail,
    issue: issuePadded,
    year: String(year),
    content: indexBody,
  });
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), indexPage);

  // ── 404 ────────────────────────────────────────────────────
  const notFoundBody = renderTemplate(await loadTemplate('404.html'), {
    root_path: '',
  });
  const notFoundPage = renderTemplate(baseTpl, {
    title: `Page not found — ${siteTitleEsc}`,
    description_meta: '',
    css_path: '',
    root_path: '',
    site_title: siteTitleEsc,
    mast_name_main: mastParts.main,
    mast_name_tail: mastParts.tail,
    issue: issuePadded,
    year: String(year),
    content: notFoundBody,
  });
  await fs.writeFile(path.join(DIST_DIR, '404.html'), notFoundPage);

  console.log(`Built ${posts.length} post(s) → ${path.relative(ROOT, DIST_DIR)}/`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
