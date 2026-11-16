// In-memory fakes for D1 and the GitHub git-data API (not a test file: no .test suffix).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
const fixture = JSON.parse(await readFile(new URL('./fixtures/content.json', import.meta.url)));

// Minimal D1 binding backed by real SQLite, so the SQL itself is exercised.
export function d1() {
  const db = new DatabaseSync(':memory:');
  return {prepare(sql) {
    const statement = db.prepare(sql);
    const bound = (args = []) => ({
      bind: (...values) => bound(values),
      first: async () => statement.get(...args) ?? null,
      all: async () => ({results: statement.all(...args)}),
      run: async () => ({meta: {changes: Number(statement.run(...args).changes)}}),
    });
    return bound();
  }};
}

// Stateful fake of the GitHub git-data API: blobs, trees, commits and a non-force ref.
export function github(content = fixture, extraFiles = []) {
  let id = 0; const next = p => p + (++id);
  const blobs = new Map(), trees = new Map(), commits = new Map();
  const blob = text => { const sha = next('b'); blobs.set(sha, Buffer.from(text)); return sha; };
  const files = new Map(['site', 'menu', 'events', ...(content.preorders ? ['preorders'] : [])].map(k => ['data/' + k + '.json', blob(JSON.stringify(content[k], null, 2) + '\n')]));
  for (const path of extraFiles) files.set(path, blob(''));
  trees.set('t0', files); commits.set('c0', {tree: 't0', parents: []});
  const repo = {head: 'c0', calls: [], refUpdates: 0, raceOnce: false};
  repo.read = key => JSON.parse(blobs.get(trees.get(commits.get(repo.head).tree).get('data/' + key + '.json')).toString());
  // Someone else commits to main (another tab, Nate's push).
  repo.push = (key, change) => {
    const value = repo.read(key); change(value);
    const tree = new Map(trees.get(commits.get(repo.head).tree)); tree.set('data/' + key + '.json', blob(JSON.stringify(value, null, 2) + '\n'));
    const t = next('t'); trees.set(t, tree); const c = next('c'); commits.set(c, {tree: t, parents: [repo.head]}); repo.head = c;
  };
  repo.transport = async (url, options) => {
    const path = url.split('/whisk')[1], method = options.method, body = options.body ? JSON.parse(options.body) : null;
    repo.calls.push({path, method, body});
    if (path === '/git/ref/heads/main') return Response.json({object: {sha: repo.head}});
    if (method === 'GET' && path.startsWith('/git/commits/')) return Response.json({tree: {sha: commits.get(path.split('/').pop()).tree}});
    if (method === 'GET' && path.startsWith('/git/trees/')) return Response.json({truncated: false, tree: [...trees.get(path.split('/').pop().split('?')[0])].map(([p, sha]) => ({path: p, sha, type: 'blob', mode: '100644'}))});
    if (method === 'GET' && path.startsWith('/git/blobs/')) {
      const bytes = blobs.get(path.split('/').pop());
      if (options.headers.Accept.includes('raw')) return new Response(bytes);
      return Response.json({size: bytes.length, encoding: 'base64', content: bytes.toString('base64')});
    }
    if (method === 'POST' && path === '/git/blobs') { const sha = next('b'); blobs.set(sha, Buffer.from(body.content, 'base64')); return Response.json({sha}); }
    if (method === 'POST' && path === '/git/trees') {
      const tree = new Map(trees.get(body.base_tree));
      for (const entry of body.tree) { if (entry.sha && !blobs.has(entry.sha)) return new Response('', {status: 422}); tree.set(entry.path, entry.sha ?? blob(entry.content)); }
      const sha = next('t'); trees.set(sha, tree); return Response.json({sha});
    }
    if (method === 'POST' && path === '/git/commits') { const sha = next('c'); commits.set(sha, {tree: body.tree, parents: body.parents}); return Response.json({sha}); }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      assert.equal(body.force, false);
      if (repo.raceOnce) { repo.raceOnce = false; repo.push('events', () => {}); }
      if (commits.get(body.sha).parents[0] !== repo.head) return new Response('', {status: 422});
      repo.head = body.sha; repo.refUpdates++; return Response.json({object: {sha: body.sha}});
    }
    throw Error('Unexpected API call ' + method + ' ' + path);
  };
  return repo;
}

