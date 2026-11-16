const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const collections = {menu: 'Main menu', preorders: 'Pre-orders', events: 'Upcoming stops'};

function mergeObject(base = {}, ours, theirs, label, conflicts) {
  const out = {};
  for (const key of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
    const b = base[key], o = ours[key], t = theirs[key];
    if (same(o, b)) { if (t !== undefined) out[key] = t; }
    else if (same(t, b) || same(o, t)) { if (o !== undefined) out[key] = o; }
    else { if (o !== undefined) out[key] = o; conflicts.push(label + ' → ' + key); }
  }
  return out;
}

function mergeList(base = [], ours = [], theirs = [], label, conflicts) {
  const byId = list => new Map(list.map(item => [item.id, item]));
  const b = byId(base), t = byId(theirs), o = byId(ours);
  const name = item => label + ' → ' + (item.name || item.id);
  const out = [];
  for (const item of ours) {
    if (!b.has(item.id)) { out.push(item); continue; }
    if (!t.has(item.id)) {
      if (!same(item, b.get(item.id))) { out.push(item); conflicts.push(name(item) + ' (removed elsewhere; your edited copy was kept)'); }
      continue;
    }
    out.push(mergeObject(b.get(item.id), item, t.get(item.id), name(item), conflicts));
  }
  for (const item of theirs) {
    if (o.has(item.id)) continue;
    if (!b.has(item.id)) { out.push(item); continue; }
    if (!same(item, b.get(item.id))) conflicts.push(name(item) + ' (you removed it; it was also changed elsewhere)');
  }
  return out;
}

export function mergeContent(base, ours, theirs) {
  const conflicts = [];
  const data = {site: mergeObject(base.site, ours.site, theirs.site, 'Bakery details', conflicts)};
  for (const [key, label] of Object.entries(collections)) data[key] = mergeList(base[key], ours[key], theirs[key], label, conflicts);
  return {data, conflicts};
}
