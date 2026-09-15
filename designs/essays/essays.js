/* Renders the essays variant from content/manifest.json. No build step, no third-party JS.
 * Every page is a tiny inline module that calls renderIndex() or renderKind() from here. */

const MANIFEST_URL = new URL('../../content/manifest.json', import.meta.url);
const REPO_ROOT = new URL('../../', import.meta.url);

export const KINDS = [
  { id: 'writing', label: 'Writing', page: 'writing.html' },
  { id: 'video', label: 'Video', page: 'video.html' },
  { id: 'podcast', label: 'Podcast', page: 'podcast.html' },
  { id: 'note', label: 'Notes', page: 'notes.html' }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.filter(Boolean));
  return node;
}

/* Drafts need both a staging host and an explicit ?drafts=1; a real domain never shows them. */
function draftsVisible() {
  const host = location.hostname;
  const staged = host === '' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.github.io');
  return staged && new URLSearchParams(location.search).get('drafts') === '1';
}

function humanDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!parts) return String(value || '');
  return `${Number(parts[3])} ${MONTHS[Number(parts[2]) - 1]} ${parts[1]}`;
}

/* http(s) and mailto links pass through; a bare path is relative to the repository root.
 * Any other scheme is dropped, so a bad manifest row cannot turn into a javascript: link. */
function resolve(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (scheme) return /^(https?|mailto)$/i.test(scheme[1]) ? value : '';
  if (value.startsWith('//')) return `https:${value}`;
  return new URL(value, REPO_ROOT).href;
}

function youtubeId(url) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return null; }
  let id = null;
  if (parsed.hostname === 'youtu.be') id = parsed.pathname.slice(1);
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(parsed.hostname)) {
    const path = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(parsed.pathname);
    id = parsed.searchParams.get('v') || (path && path[1]);
  }
  return id && /^[\w-]{6,24}$/.test(id) ? id : null;
}

async function load() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`manifest returned ${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : [];
  const taxonomy = Array.isArray(data.taxonomy) ? data.taxonomy : [];
  const drafts = draftsVisible();
  const entries = rows
    .filter(entry => entry && entry.kind && (drafts || !entry.draft))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return { entries, taxonomy, drafts };
}

function categoryLabel(taxonomy, id) {
  const match = taxonomy.find(item => item.id === id);
  return match ? match.label : id;
}

function categoryLine(taxonomy, entry) {
  const ids = Array.isArray(entry.categories) ? entry.categories.filter(Boolean) : [];
  if (!ids.length) return el('p', { class: 'entry-cats entry-cats-empty', text: 'Uncategorised' });
  return el('p', { class: 'entry-cats', text: ids.map(id => categoryLabel(taxonomy, id)).join(' · ') });
}

function draftFlag(entry) {
  return entry.draft ? el('span', { class: 'draft-flag', text: 'Draft' }) : null;
}

function failure(root, error) {
  root.replaceChildren(el('p', { class: 'essays-empty', text: `The content list could not be loaded (${error.message}). content/manifest.json is the source; open this page over http rather than as a local file.` }));
}

/* Index: one dated line per entry, grouped by kind. */
export async function renderIndex(root) {
  let data;
  try { data = await load(); } catch (error) { return failure(root, error); }
  const groups = KINDS.map(kind => {
    const rows = data.entries.filter(entry => entry.kind === kind.id);
    const list = rows.length
      ? el('ul', { class: 'essays-list' }, ...rows.map(entry => el('li', {},
          el('a', { class: 'row', href: resolve(entry.url) || kind.page },
            el('time', { class: 'row-date', datetime: entry.date || null, text: humanDate(entry.date) }),
            el('span', { class: 'row-title', text: entry.title || '(untitled)' }, draftFlag(entry)))
        )))
      : el('p', { class: 'essays-empty', text: 'Nothing here yet.' });
    return el('section', { class: 'kind-group', 'aria-labelledby': `group-${kind.id}` },
      el('h2', { class: 'group-head', id: `group-${kind.id}` }, el('a', { href: kind.page, text: kind.label })),
      list);
  });
  root.replaceChildren(...groups);
}

function mediaFor(entry) {
  const nodes = [];
  if (entry.kind === 'video') {
    const id = youtubeId(entry.url);
    if (id) {
      nodes.push(el('iframe', {
        class: 'entry-player',
        src: `https://www.youtube-nocookie.com/embed/${id}`,
        title: `Watch: ${entry.title || 'video'}`,
        loading: 'lazy',
        allow: 'encrypted-media; picture-in-picture; fullscreen',
        referrerpolicy: 'strict-origin-when-cross-origin',
        allowfullscreen: true
      }));
    }
  }
  if (entry.audio) {
    nodes.push(el('audio', { class: 'entry-audio', controls: true, preload: 'none', src: resolve(entry.audio) }));
  }
  return nodes;
}

function renderEntry(taxonomy, entry) {
  const href = resolve(entry.url);
  const heading = href
    ? el('h3', {}, el('a', { href, text: entry.title || '(untitled)' }), draftFlag(entry))
    : el('h3', {}, document.createTextNode(entry.title || '(untitled)'), draftFlag(entry));

  const article = el('article', { class: 'entry', 'data-kind': entry.kind },
    el('p', { class: 'entry-meta' }, el('time', { datetime: entry.date || null, text: humanDate(entry.date) })),
    heading);

  if (entry.kind === 'note' && entry.text) {
    article.append(el('blockquote', { class: 'note-quote', cite: href || null }, el('p', { text: entry.text })));
  }
  if (entry.summary) article.append(el('p', { class: 'entry-summary', text: entry.summary }));
  article.append(...mediaFor(entry));
  article.append(categoryLine(taxonomy, entry));
  if (href) {
    const label = entry.source === 'x' ? 'Read the original on X' : entry.kind === 'video' ? 'Watch on YouTube' : 'Open';
    article.append(el('p', { class: 'entry-link' }, el('a', { href, text: `${label} \u2197` })));
  } else {
    article.append(el('p', { class: 'entry-link entry-cats-empty', text: 'No link attached yet.' }));
  }
  return article;
}

/* Kind page: category filter plus the entries for that kind. */
export async function renderKind(root, kindId) {
  let data;
  try { data = await load(); } catch (error) { return failure(root, error); }
  const entries = data.entries.filter(entry => entry.kind === kindId);
  const present = data.taxonomy.filter(item => entries.some(entry => (entry.categories || []).includes(item.id)));
  const query = new URLSearchParams(location.search);
  let active = query.get('cat') || 'all';
  if (active !== 'all' && !present.some(item => item.id === active)) active = 'all';

  const list = el('div', { class: 'entry-list' });
  const count = el('p', { class: 'filter-count', role: 'status', 'aria-live': 'polite' });
  const buttons = [];

  function apply(next) {
    active = next;
    const shown = active === 'all' ? entries : entries.filter(entry => (entry.categories || []).includes(active));
    list.replaceChildren(...(shown.length
      ? shown.map(entry => renderEntry(data.taxonomy, entry))
      : [el('p', { class: 'essays-empty', text: 'Nothing in this category yet.' })]));
    count.textContent = `${shown.length} of ${entries.length} shown`;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.cat === active));
    const params = new URLSearchParams(location.search);
    if (active === 'all') params.delete('cat'); else params.set('cat', active);
    const search = params.toString();
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}`);
  }

  const filters = el('div', { class: 'filters', role: 'group', 'aria-label': 'Filter by category' });
  for (const item of [{ id: 'all', label: 'All' }, ...present]) {
    const button = el('button', { type: 'button', class: 'filter', 'aria-pressed': 'false', text: item.label });
    button.dataset.cat = item.id;
    button.addEventListener('click', () => apply(item.id));
    buttons.push(button);
    filters.append(button);
  }

  root.replaceChildren(present.length ? filters : el('p', { class: 'entry-cats entry-cats-empty', text: 'No categories assigned yet.' }), count, list);
  apply(active);
}
