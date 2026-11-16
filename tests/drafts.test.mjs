import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publisher} from '../server/publish.mjs';
import {mergeContent} from '../server/merge.mjs';
import {d1,github} from './fakes.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/content.json', import.meta.url)));

function setup({square} = {}) {
  const repo = github(), env = {GITHUB_CONTENT_TOKEN: 'test', DRAFTS: d1(), SQUARE_ENVIRONMENT: square ? 'sandbox' : undefined, SQUARE_ACCESS_TOKEN: square ? 'x' : undefined, SQUARE_LOCATION_ID: square ? 'L' : undefined};
  const service = publisher(env, repo.transport, () => ({catalog: async () => square(), stats: {}}), 0);
  return {repo, service};
}
const post = body => new Request('https://bakery.example/api/x', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
const writes = repo => repo.calls.filter(c => c.method !== 'GET');

test('Autosave stores drafts in D1 without any GitHub write, and stale tabs are refused', async () => {
  const {repo, service} = setup();
  const state = await service.editorState();
  assert.equal(state.draft, null);
  const data = structuredClone(state.data); data.menu[0].name = 'Draft bun';
  const first = await service.saveDraft(post({data, version: 0, revision: state.revision}), 'cindy@example.com');
  data.menu[1].name = 'Draft cookie';
  const second = await service.saveDraft(post({data, version: first.version}), 'cindy@example.com');
  assert.equal(second.version, first.version + 1);
  await assert.rejects(service.saveDraft(post({data, version: first.version}), 'cindy@example.com'), e => e.status === 409);
  assert.deepEqual(writes(repo), []);
  const restored = await service.editorState();
  assert.equal(restored.data.menu[1].name, 'Draft cookie');
  assert.equal(restored.draft.version, second.version);
});

test('Publish makes exactly one commit for many edits and clears the draft', async () => {
  const {repo, service} = setup();
  const state = await service.editorState();
  const data = structuredClone(state.data); let version = 0;
  for (const [index, name] of ['One', 'Two', 'Three', 'Four'].entries()) {
    data.menu[index].name = name;
    ({version} = await service.saveDraft(post({data, version, revision: state.revision}), 'cindy@example.com'));
  }
  const result = await service.publishDraft(post({version}));
  assert.equal(result.published, true); assert.equal(repo.refUpdates, 1);
  assert.deepEqual(repo.read('menu').slice(0, 4).map(i => i.name), ['One', 'Two', 'Three', 'Four']);
  assert.equal((await service.editorState()).draft, null);
  assert.equal((await service.editorState()).revision, result.revision);
  const again = await service.publishDraft(post({version: 0}));
  assert.equal(again.published, false); assert.equal(repo.refUpdates, 1);
});

test('Publish merges changes made elsewhere and reports real conflicts instead of losing them', async () => {
  const {repo, service} = setup();
  const state = await service.editorState();
  const data = structuredClone(state.data); data.menu[0].name = 'Mine'; data.site.tagline = 'My tagline';
  const {version} = await service.saveDraft(post({data, version: 0, revision: state.revision}), 'cindy@example.com');
  repo.push('menu', menu => { menu[1].price = 9; menu[0].name = 'Theirs'; });
  repo.push('events', events => events.push({id: 'stop-new', name: 'New stop', address: '', start: '2026-12-01T10:00:00-05:00', end: '2026-12-01T14:00:00-05:00', mapUrl: '', description: '', status: 'confirmed', menuNote: ''}));
  const result = await service.publishDraft(post({version}));
  assert.equal(result.published, true);
  const menu = repo.read('menu');
  assert.equal(menu[0].name, 'Mine'); assert.equal(menu[1].price, 9);
  assert.equal(repo.read('site').tagline, 'My tagline');
  assert.ok(repo.read('events').some(e => e.id === 'stop-new'));
  assert.equal(result.conflicts.length, 1); assert.match(result.conflicts[0], /name/);
});

test('A branch update that loses a race is retried with a fresh snapshot', async () => {
  const {repo, service} = setup();
  const state = await service.editorState();
  const data = structuredClone(state.data); data.menu[0].name = 'Raced bun';
  const {version} = await service.saveDraft(post({data, version: 0, revision: state.revision}), 'cindy@example.com');
  repo.raceOnce = true;
  const result = await service.publishDraft(post({version}));
  assert.equal(result.published, true); assert.equal(repo.read('menu')[0].name, 'Raced bun');
});

test('Invalid drafts are not published and stay saved', async () => {
  const {repo, service} = setup();
  const state = await service.editorState();
  const data = structuredClone(state.data); data.menu[0].price = -5;
  const {version} = await service.saveDraft(post({data, version: 0, revision: state.revision}), 'cindy@example.com');
  await assert.rejects(service.publishDraft(post({version})), e => e.status === 400);
  assert.deepEqual(writes(repo), []);
  assert.equal((await service.editorState()).draft.version, version);
});

test('Photo uploads store a blob without committing; publish adds the used photo', async () => {
  const {repo, service} = setup();
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const {path, pending} = await service.stagePhoto(new Request('https://x/api/photo', {method: 'POST', headers: {'Content-Type': 'image/png'}, body: png}));
  assert.equal(pending, true); assert.equal(repo.refUpdates, 0);
  assert.deepEqual(writes(repo).map(c => c.path), ['/git/blobs']);
  assert.deepEqual([...(await service.photoPreview(path)).bytes], [...png]);
  assert.equal(await service.photoPreview('assets/food/../../secret.png'), null);
  const state = await service.editorState();
  assert.deepEqual(state.pendingPhotos, [path]);
  const data = structuredClone(state.data); data.menu[0].image = path; data.menu[0].imageAlt = 'A bun';
  const {version} = await service.saveDraft(post({data, version: 0, revision: state.revision}), 'cindy@example.com');
  await service.publishDraft(post({version}));
  assert.equal(repo.refUpdates, 1);
  assert.ok(writes(repo).find(c => c.path === '/git/trees').body.tree.some(e => e.path === path));
  assert.deepEqual((await service.editorState()).pendingPhotos, []);
});

test('Square changes wait for Publish and are applied on top of the draft', async () => {
  const products = [{variationId: 'V1', name: 'The morning bun', price: 7, category: 'Pastries', menu: 'main', photos: [], description: ''}];
  const {repo, service} = setup({square: () => products});
  await service.markSquarePending(); await service.markSquarePending();
  assert.deepEqual(writes(repo), []);
  const state = await service.editorState();
  assert.equal(state.squarePending, true);
  const result = await service.publishDraft(post({version: 0}));
  assert.equal(result.published, true); assert.equal(repo.refUpdates, 1);
  assert.equal(repo.read('menu')[0].price, 7); assert.deepEqual(result.square.updated, ['The morning bun']);
  assert.equal((await service.editorState()).squarePending, false);
});

test('Merge keeps additions from both sides and drops only untouched removals', () => {
  const base = structuredClone(fixture); base.preorders = [];
  const ours = structuredClone(base), theirs = structuredClone(base);
  ours.menu.push({...base.menu[0], id: 'ours-new'}); theirs.menu.push({...base.menu[0], id: 'theirs-new'});
  theirs.menu = theirs.menu.filter(i => i.id !== 'lemon-loaf');
  const {data, conflicts} = mergeContent(base, ours, theirs);
  assert.deepEqual(data.menu.map(i => i.id), ['morning-bun', 'chocolate-cookie', 'weekend-scone', 'ours-new', 'theirs-new']);
  assert.deepEqual(conflicts, []);
});
