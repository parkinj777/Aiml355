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

const POST_NAME_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

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

  for (const filename of entries) {
    const match = filename.match(POST_NAME_RE);
    if (!match) continue;
    const [, fileDate, slug] = match;
    const raw = await fs.readFile(path.join(POSTS_DIR, filename), 'utf8');
    const { data, content } = matter(raw);
    const title = data.title || slug;
    const date = data.date ? new Date(data.date).toISOString().slice(0, 10) : fileDate;
    const description = data.description || '';
    const html = marked.parse(content);

    const postBody = renderTemplate(postTpl, {
      title: escapeHtml(title),
      date,
      date_display: formatDateDisplay(date),
      content: html,
    });

    const descMeta = description
      ? `<meta name="description" content="${escapeHtml(description)}">`
      : '';

    const page = renderTemplate(baseTpl, {
      title: `${escapeHtml(title)} — ${escapeHtml(SITE_TITLE)}`,
      description_meta: descMeta,
      css_path: '../',
      root_path: '../',
      site_title: escapeHtml(SITE_TITLE),
      content: postBody,
    });

    await fs.writeFile(path.join(DIST_POSTS_DIR, `${slug}.html`), page);
    posts.push({ title, date, slug, description });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const postList = posts
    .map(p =>
      `<li><time datetime="${p.date}">${formatDateDisplay(p.date)}</time>` +
      ` <a href="posts/${escapeHtml(p.slug)}.html">${escapeHtml(p.title)}</a></li>`
    )
    .join('\n');

  const indexBody = renderTemplate(indexTpl, { post_list: postList });
  const indexPage = renderTemplate(baseTpl, {
    title: escapeHtml(SITE_TITLE),
    description_meta: '',
    css_path: '',
    root_path: '',
    site_title: escapeHtml(SITE_TITLE),
    content: indexBody,
  });
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), indexPage);

  console.log(`Built ${posts.length} post(s) → ${path.relative(ROOT, DIST_DIR)}/`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
