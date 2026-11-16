// Live Square details on public pages, with no rebuild.
// Square webhooks (and, as a fallback, a page view after 30 minutes) save a snapshot of every Square
// product to D1. Public pages are served through the Worker, which swaps in the snapshot's name,
// price, description and photos wherever the build marked a Square-linked value:
//   <!--sq:<item id>:<field>-->…<!--/sq-->   (scripts/product_photos.py live())
// Everything Cindy types in the editor (ingredients, notes, visibility…) stays as published.
import {squareClient, squareReady} from './square.mjs';
import {draftStore, draftsEnabled} from './drafts.mjs';

const KEY = 'square-live', LOCK = 'square-live-lock';
export const STALE = 30 * 60 * 1000;
const memos = new WeakMap(); // per-isolate copy so busy pages don't read D1 on every view

export function liveSquare(env, client = () => squareClient(env), now = () => Date.now()) {
  const store = draftsEnabled(env) && squareReady(env) ? draftStore(env.DRAFTS, now) : null;
  const memo = () => memos.get(env.DRAFTS), remember = snapshot => memos.set(env.DRAFTS, {snapshot, read: now()});
  async function refresh() {
    const c = client(), products = await c.catalog();
    const tracked = products.filter(p => p.trackInventory).map(p => p.variationId);
    const counts = tracked.length ? await c.stock(tracked) : new Map();
    const items = {};
    for (const p of products) items[p.variationId] = {name: p.name, price: p.price, description: p.description || '', photos: p.photos || [], soldOut: !!p.soldOut, trackInventory: !!p.trackInventory, left: p.trackInventory ? (counts.get(p.variationId) ?? 0) : null};
    const snapshot = {at: now(), items};
    await store.setValue(KEY, snapshot);
    remember(snapshot);
    return snapshot;
  }
  // Returns the snapshot (or null). A stale one is still served while one request refreshes it.
  async function snapshot(ctx) {
    if (!store) return null;
    const cached = memo();
    let current = cached && now() - cached.read < 15000 ? cached.snapshot : null;
    try {
      if (!current) { current = await store.value(KEY); remember(current); }
      if ((!current || now() - current.at > STALE) && await store.claim(LOCK, 60000)) {
        const work = refresh().catch(error => { console.log('Square live refresh failed', String(error?.message || error).slice(0, 200)); return null; });
        if (!current) return await work;
        ctx?.waitUntil?.(work);
      }
    } catch { return current; }
    return current;
  }
  return {enabled: !!store, refresh, snapshot};
}

const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const imageUrl = (path, base) => path.startsWith('https://') ? path : base + '/' + path;
// Mirror of scripts/product_photos.py render_photo (tests/live.test.mjs compares the two).
export function renderPhoto(pictures, base = '', detail = false) {
  if (!pictures.length) return '<div class="food-space" aria-hidden="true"></div>';
  const images = pictures.map((p, n) => `<img class="food-photo" src="${esc(imageUrl(p.image, base))}" alt="${esc(p.alt)}" width="800" height="600" loading="lazy"` + (n ? ' hidden' : '') + '>').join('');
  if (pictures.length === 1) return images;
  const thumbs = detail ? pictures.map((p, n) => `<button type="button" data-photo-index="${n}" aria-label="Show photo ${n + 1}: ${esc(p.alt)}" aria-pressed="${n === 0}"><img src="${esc(imageUrl(p.image, base))}" alt="" loading="lazy"></button>`).join('') : '';
  return '<div class="product-gallery" ' + (detail ? 'data-product-gallery' : 'data-card-slideshow') + '><div class="product-frames">' + images + '</div>' + (detail ? '<div class="photo-deck">' + thumbs + '</div>' : '') + '</div>';
}

// Which website items are linked to which Square product (from the published content).
export function linkedItems(content) {
  return new Map([...(content.menu || []), ...(content.preorders || [])].filter(i => i.squareVariationId).map(i => [i.id, i]));
}

export function applyLive(html, content, snapshot, path = '') {
  const linked = linkedItems(content), base = (content.site?.basePath || '').replace(/\/$/, '');
  const live = id => { const item = linked.get(id); const p = item && snapshot?.items?.[item.squareVariationId]; return p ? {item, p} : null; };
  const render = {
    name: ({p}) => esc(p.name.replace(/\.+$/, '')),
    desc: ({p, item}) => esc(p.description || item.description),
    price: ({p}) => '$' + Number(p.price).toFixed(2),
    photo: ({p}) => renderPhoto(p.photos, base),
    'photo-detail': ({p}) => renderPhoto(p.photos, base, true),
  };
  let out = html.replace(/<!--sq:([a-z0-9-]+):(name|desc|price|photo|photo-detail)-->[\s\S]*?<!--\/sq-->/g, (match, id, field) => {
    const found = live(id);
    return found ? `<!--sq:${id}:${field}-->${render[field](found)}<!--/sq-->` : match;
  });
  out = out.replace(/data-sq-label="([a-z0-9-]+)" aria-label="[^"]*"/g, (match, id) => { const found = live(id); return found ? `data-sq-label="${id}" aria-label="${esc(found.p.name)}"` : match; });
  // Item page tab title.
  const page = path.match(/^\/(?:menu|preorder)\/([a-z0-9-]+)\/?(?:index\.html)?$/);
  const own = page && live(page[1]);
  if (own) out = out.replace(/<title>[^<]*\| Whisk<\/title>/, `<title>${esc(own.p.name)} | Whisk</title>`);
  // The cart reads names, prices and photos from this JSON on every page.
  out = out.replace(/(<script id="cart-data" type="application\/json">)([\s\S]*?)(<\/script>)/, (match, open, json, close) => {
    try {
      const data = JSON.parse(json);
      for (const entry of data.items || []) {
        const found = live(entry.id); if (!found) continue;
        Object.assign(entry, {name: found.p.name, price: found.p.price, image: found.p.photos[0]?.image || '', imageAlt: found.p.photos[0]?.alt || '', soldOut: !!(found.item.soldOut || found.p.soldOut)});
      }
      return open + JSON.stringify(data).replace(/</g, '\\u003c') + close;
    } catch { return match; }
  });
  return out;
}

// Paths whose HTML can show Square details.
export const livePath = path => path === '/' || path === '/index.html' || /^\/(menu|preorder|cart)(\/|$)/.test(path);
