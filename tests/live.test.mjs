import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {liveSquare, applyLive, renderPhoto, STALE} from '../server/live.mjs';
import {draftStore} from '../server/drafts.mjs';
import {createHandler} from '../server/handler.mjs';
import {d1} from './fakes.mjs';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
const python = code => execFileSync('python3', ['-I', '-c', 'import sys,json;sys.path.insert(0,sys.argv[1]);' + code, scripts], {encoding: 'utf8'});
const product = (overrides = {}) => ({variationId: 'V1', name: 'Apple pie', price: 32, description: 'Fresh from Square', photos: [{image: 'https://items-images.example/a.jpg', alt: 'Pie'}], soldOut: false, trackInventory: true, ...overrides});

test('The Worker draws photos exactly like the Python build', () => {
  const cases = [[], [{image: 'https://x.example/a.jpg', alt: 'A "pie" & <crust>'}], [{image: 'assets/food/a.jpg', alt: "Cindy's"}, {image: 'https://x.example/b.jpg', alt: 'Two'}, {image: 'https://x.example/c.jpg', alt: 'Three'}]];
  for (const pictures of cases) for (const detail of [false, true]) {
    const item = {image: pictures[0]?.image || '', imageAlt: pictures[0]?.alt || '', photos: pictures.slice(1)};
    const expected = python(`from product_photos import render_photo;print(render_photo(json.loads(sys.argv[2]),'',${detail ? 'True' : 'False'}),end='')`.replace('sys.argv[2]', JSON.stringify(JSON.stringify(item))));
    assert.equal(renderPhoto(pictures, '', detail), expected);
  }
});

test('Marked Square values are replaced; editor-only text and unlinked items are left alone', () => {
  const content = {site: {basePath: ''}, menu: [{id: 'plain', name: 'Plain'}], preorders: [{id: 'pie', name: 'Old pie', description: 'Old text', squareVariationId: 'V1', soldOut: false}]};
  const marked = (field, value) => `<!--sq:pie:${field}-->${value}<!--/sq-->`;
  const html = `<title>Old pie | Whisk</title><a data-sq-label="pie" aria-label="Old pie">${marked('photo', '<img old>')}</a><h1>${marked('name', 'Old pie')}</h1><p>${marked('desc', 'Old text')}</p>${marked('price', '$30.00')}<p>Ingredients: butter</p><!--sq:other:name-->Keep<!--/sq--><script id="cart-data" type="application/json">{"items": [{"id": "pie", "name": "Old pie", "price": 30, "soldOut": false, "image": "", "imageAlt": ""}]}</script>`;
  const out = applyLive(html, content, {at: 1, items: {V1: product({name: 'Apple pie.', soldOut: true})}}, '/preorder/pie/');
  assert.match(out, /<title>Apple pie\. \| Whisk<\/title>/);
  assert.match(out, /aria-label="Apple pie\."/);
  assert.match(out, /<!--sq:pie:name-->Apple pie<!--\/sq-->/);
  assert.match(out, /<!--sq:pie:desc-->Fresh from Square<!--\/sq-->/);
  assert.match(out, /<!--sq:pie:price-->\$32\.00<!--\/sq-->/);
  assert.match(out, /src="https:\/\/items-images\.example\/a\.jpg" alt="Pie"/);
  assert.match(out, /Ingredients: butter/);
  assert.match(out, /<!--sq:other:name-->Keep/);
  const cart = JSON.parse(out.match(/<script id="cart-data" type="application\/json">(.*?)<\/script>/)[1]);
  assert.deepEqual(cart.items[0], {id: 'pie', name: 'Apple pie.', price: 32, soldOut: true, image: 'https://items-images.example/a.jpg', imageAlt: 'Pie'});
  // An empty Square description keeps the website's text, as the editor sync does.
  assert.match(applyLive(html, content, {items: {V1: product({description: ''})}}), /<!--sq:pie:desc-->Old text<!--\/sq-->/);
  // A product missing from the snapshot leaves the published page as it was.
  const untouched = applyLive(html, content, {items: {}}, '/preorder/pie/');
  assert.equal(untouched.split('<script')[0], html.split('<script')[0]); assert.match(untouched, /"name":"Old pie"/);
});

function liveEnv() { return {DRAFTS: d1(), SQUARE_ENVIRONMENT: 'sandbox', SQUARE_ACCESS_TOKEN: 'x', SQUARE_LOCATION_ID: 'L'}; }
function fakeSquare(products) {
  const calls = {catalog: 0, stock: 0};
  return {calls, client: () => ({catalog: async () => { calls.catalog++; return products(); }, stock: async ids => { calls.stock++; return new Map(ids.map(id => [id, 4])); }})};
}

test('Snapshots refresh once, then are served from storage; stale ones refresh in the background', async () => {
  const env = liveEnv(); let clock = 1_000_000; let name = 'First';
  const square = fakeSquare(() => [product({name})]);
  const live = liveSquare(env, square.client, () => clock);
  const first = await live.snapshot();
  assert.equal(first.items.V1.name, 'First'); assert.equal(first.items.V1.left, 4);
  await live.snapshot(); assert.equal(square.calls.catalog, 1);
  clock += STALE + 1; name = 'Second';
  const pending = [];
  const stale = await live.snapshot({waitUntil: p => pending.push(p)});
  assert.equal(stale.items.V1.name, 'First');
  await liveSquare(env, square.client, () => clock).snapshot({waitUntil: p => pending.push(p)}); // second view: lease already taken
  await Promise.all(pending);
  assert.equal(square.calls.catalog, 2);
  clock += 16000;
  assert.equal((await live.snapshot()).items.V1.name, 'Second');
  assert.equal(liveSquare({}).enabled, false);
});

test('Public pages and the commerce catalog use the snapshot without calling Square', async () => {
  const env = {...liveEnv(), PUBLIC_HOSTNAME: 'bakery.example', SQUARE_CHECKOUT_ENABLED: 'true',
    ASSETS: {fetch: async () => new Response('<h3><!--sq:pie:name-->Old pie<!--/sq--></h3>', {headers: {'Content-Type': 'text/html; charset=utf-8', 'Content-Length': '44'}})}};
  await draftStore(env.DRAFTS).setValue('square-live', {at: Date.now(), items: {V1: product({left: 2})}});
  const content = {site: {basePath: '', showPreorderMenu: true, orderingEnabled: true, timezone: 'America/New_York', pickupDates: []}, menu: [], events: [], preorders: [{id: 'pie', name: 'Old pie', description: '', available: true, soldOut: false, price: 30, squareVariationId: 'V1'}]};
  const handler = createHandler({editorHtml: '', editorScript: '', editorStyle: '', content});
  const original = globalThis.fetch; globalThis.fetch = async url => { throw Error('Square must not be called: ' + url); };
  try {
    const page = await handler(new Request('https://bakery.example/'), env);
    assert.equal(await page.text(), '<h3><!--sq:pie:name-->Apple pie<!--/sq--></h3>');
    assert.equal(page.headers.get('content-length'), null);
    const catalog = await (await handler(new Request('https://bakery.example/commerce/catalog'), env)).json();
    assert.deepEqual(catalog.items.map(i => [i.id, i.price, i.left, i.soldOut]), [['pie', 32, 2, false]]);
    // Without D1 the page is served untouched.
    const plain = await handler(new Request('https://bakery.example/'), {...env, DRAFTS: undefined});
    assert.match(await plain.text(), /Old pie/);
  } finally { globalThis.fetch = original; }
});

test('The build marks only Square-linked values', () => {
  const out = JSON.parse(python(`from product_photos import live,label;print(json.dumps([live({'id':'a','squareVariationId':'V'},'name','A &amp; B'),live({'id':'b'},'name','B'),label({'id':'a','squareVariationId':'V'}),label({'id':'b'})]))`));
  assert.deepEqual(out, ['<!--sq:a:name-->A &amp; B<!--/sq-->', 'B', ' data-sq-label="a"', '']);
});

test('A signed Square stock webhook refreshes the live snapshot and never touches GitHub', async () => {
  const url = 'https://bakery.example/commerce/square-webhook';
  const env = {...liveEnv(), PUBLIC_HOSTNAME: 'bakery.example', SQUARE_WEBHOOK_URL: url, SQUARE_WEBHOOK_SIGNATURE_KEY: 'test-key', SQUARE_MERCHANT_ID: 'M1'};
  const body = JSON.stringify({merchant_id: 'M1', type: 'inventory.count.updated'});
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-key'), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(url + body))).toString('base64');
  const handler = createHandler({editorHtml: '', editorScript: '', editorStyle: '', content: {site: {}, menu: [], events: [], preorders: []}});
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async target => {
    target = String(target); seen.push(target);
    if (target.includes('/v2/catalog/list')) return Response.json({objects: [{id: 'I1', type: 'ITEM', item_data: {name: 'Pie', variations: [{id: 'V1', item_variation_data: {pricing_type: 'FIXED_PRICING', price_money: {amount: 3400, currency: 'USD'}}}]}}]});
    throw Error('Unexpected request ' + target);
  };
  try {
    const response = await handler(new Request(url, {method: 'POST', body, headers: {'x-square-hmacsha256-signature': signature}}), env);
    assert.equal(response.status, 200);
  } finally { globalThis.fetch = original; }
  assert.ok(seen.every(u => u.startsWith('https://connect.squareupsandbox.com/')));
  assert.equal((await draftStore(env.DRAFTS).value('square-live')).items.V1.price, 34);
});
