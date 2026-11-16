// Editor drafts live in Cloudflare D1 (binding DRAFTS), never in the repository, so autosaving
// never starts a Cloudflare Pages build. Only an explicit Publish writes to GitHub.
// One key/value table keeps the schema tiny and lets the Worker create it on first use:
//   draft            the working copy, its published base and an optimistic-lock version
//   square           set when Square reports catalog changes that are not yet published
//   photo:<path>     a photo stored as a GitHub blob (no commit) waiting for the next publish
import {PublishError} from './content.mjs';

const schema = 'CREATE TABLE IF NOT EXISTS whisk_editor (key TEXT PRIMARY KEY, value TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)';
const ready = new WeakMap();

export const draftsEnabled = env => !!env?.DRAFTS && typeof env.DRAFTS.prepare === 'function';

export function draftStore(db, now = () => Date.now()) {
  async function init() {
    if (!ready.has(db)) ready.set(db, db.prepare(schema).run().catch(error => { ready.delete(db); throw error; }));
    try { await ready.get(db); } catch { throw new PublishError(503, 'Draft storage is unavailable. Your changes are still on this screen; keep this tab open and try again shortly.'); }
  }
  async function query(work) {
    await init();
    try { return await work(); } catch (error) {
      if (error instanceof PublishError) throw error;
      throw new PublishError(503, 'Draft storage is unavailable. Your changes are still on this screen; keep this tab open and try again shortly.');
    }
  }
  const row = key => query(() => db.prepare('SELECT value, version, updated_at FROM whisk_editor WHERE key = ?').bind(key).first());

  return {
    async draft() {
      const found = await row('draft');
      if (!found) return null;
      const value = JSON.parse(found.value);
      return {...value, version: found.version, updatedAt: found.updated_at};
    },
    // version 0 creates the draft; any other version must match the stored one (two tabs, two people).
    async saveDraft({data, base, baseRevision, by}, version) {
      const value = JSON.stringify({data, base, baseRevision, by});
      if (value.length > 900 * 1024) throw new PublishError(413, 'This draft is too large to save. Ask Nate for help.');
      const at = now();
      const result = await query(() => version === 0
        ? db.prepare('INSERT INTO whisk_editor (key, value, version, updated_at) VALUES (\'draft\', ?, 1, ?) ON CONFLICT(key) DO NOTHING').bind(value, at).run()
        : db.prepare('UPDATE whisk_editor SET value = ?, version = version + 1, updated_at = ? WHERE key = \'draft\' AND version = ?').bind(value, at, version).run());
      if (!result?.meta?.changes) throw new PublishError(409, 'This draft was changed in another tab or by someone else. Reload the editor to see the latest draft before making more changes.');
      return {version: version + 1, updatedAt: at};
    },
    // Removes the draft only if nobody saved after the given version; returns whether it did.
    async clearDraft(version) {
      const result = await query(() => db.prepare('DELETE FROM whisk_editor WHERE key = \'draft\' AND version = ?').bind(version).run());
      return !!result?.meta?.changes;
    },
    // After a publish raced with an autosave, keep the newer edits but rebase them on what was published.
    async rebaseDraft(base, baseRevision) {
      const current = await this.draft();
      if (!current) return;
      await this.saveDraft({data: current.data, base, baseRevision, by: current.by}, current.version).catch(() => {});
    },
    async squarePending() { return (await row('square'))?.updated_at ?? null; },
    async markSquarePending() {
      const at = now();
      await query(() => db.prepare('INSERT INTO whisk_editor (key, value, version, updated_at) VALUES (\'square\', \'{}\', 1, ?) ON CONFLICT(key) DO UPDATE SET version = version + 1, updated_at = excluded.updated_at').bind(at).run());
      return at;
    },
    // Clears the Square flag only if no newer webhook arrived since it was read.
    async clearSquarePending(seenAt) {
      await query(() => db.prepare('DELETE FROM whisk_editor WHERE key = \'square\' AND updated_at <= ?').bind(seenAt).run());
    },
    async addPhoto(path, sha) {
      await query(() => db.prepare('INSERT INTO whisk_editor (key, value, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind('photo:' + path, JSON.stringify({sha}), now()).run());
    },
    async photos() {
      const result = await query(() => db.prepare('SELECT key, value FROM whisk_editor WHERE key LIKE \'photo:%\'').all());
      return new Map((result?.results || []).map(r => [r.key.slice(6), JSON.parse(r.value).sha]));
    },
    async removePhotos(paths) {
      for (const path of paths) await query(() => db.prepare('DELETE FROM whisk_editor WHERE key = ?').bind('photo:' + path).run());
    },
  };
}
