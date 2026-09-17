/* Enhancements only. All menus, contact details, and checkout links exist in HTML. */
'use strict';
const filters = document.querySelector('.filters');
if (filters) {
  filters.hidden = false;
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    let shown = 0;
    document.querySelectorAll('.menu-grid .product').forEach(item => {
      item.hidden = button.dataset.filter !== 'all' && item.dataset.category !== button.dataset.filter;
      if (!item.hidden) shown++;
    });
    filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    document.getElementById('filter-result').textContent = `${shown} ${shown === 1 ? 'item' : 'items'} shown`;
  });
}
// Keep the text fallback visible if a replaced photo cannot be loaded.
document.querySelectorAll('.food-photo img').forEach(img => {
  const fallback = () => { img.parentElement.querySelector('.photo-fallback').hidden = false; img.remove(); };
  img.addEventListener('error', fallback, {once:true});
  if (img.complete && img.naturalWidth === 0) fallback();
});
const share = document.getElementById('share-site');
if (share) {
  share.hidden = false;
  share.addEventListener('click', async () => {
    const home = document.querySelector('.site-header .brand').href;
    const message = document.getElementById('share-message');
    try { await navigator.clipboard.writeText(home); message.textContent = 'Website link copied.'; }
    catch { message.textContent = `Copy this link: ${home}`; }
  });
}
// A stale static page must never imply that a time-limited order is still open.
// Square MUST separately enforce stock and cutoffs: these browser checks are UX, not inventory control.
const configElement = document.getElementById('ordering-data');
if (configElement) {
  const config = JSON.parse(configElement.textContent);
  const inWindow = item => {
    const now = Date.now();
    return (!item.orderOpens || now >= Date.parse(item.orderOpens)) && (!item.orderCloses || now < Date.parse(item.orderCloses));
  };
  const closeLink = link => { const text = document.createElement('span'); text.className = 'availability'; text.textContent = 'Ordering is closed'; link.replaceWith(text); };
  function refreshAvailability() {
    const globallyOpen = !config.demo && config.orderingEnabled && ['open_today','preorders_open','next_popup'].includes(config.status) && inWindow(config);
    document.querySelectorAll('[data-item-checkout]').forEach(link => {
      const item = config.menu.find(i => i.id === link.dataset.itemCheckout);
      if (!globallyOpen || !item || !inWindow(item)) closeLink(link);
    });
    if (!globallyOpen) {
      document.querySelectorAll('[data-global-checkout]').forEach(closeLink);
      if (!config.demo && config.orderCloses && Date.now() >= Date.parse(config.orderCloses)) {
        document.querySelectorAll('[data-business-status]').forEach(el => { el.textContent = 'Ordering closed'; });
        document.querySelectorAll('[data-order-message]').forEach(el => { el.textContent = 'This ordering window has closed. Check back for the next batch.'; });
      }
    }
    document.querySelectorAll('[data-event-end]').forEach(el => {
      if (Date.now() > Date.parse(el.dataset.eventEnd) && !el.dataset.ended) {
        el.dataset.ended = 'true';
        const note = document.createElement('p'); note.className = 'small'; note.textContent = 'This stop has ended. Check back for the next one.'; el.append(note);
      }
    });
  }
  refreshAvailability();
  setInterval(refreshAvailability, 30000);
  window.addEventListener('pageshow',refreshAvailability);
  document.addEventListener('visibilitychange',refreshAvailability);
  document.addEventListener('click',event => {
    const link = event.target.closest('[data-item-checkout], [data-global-checkout]');
    if (!link) return;
    const item = config.menu.find(i => i.id === link.dataset.itemCheckout);
    if (!inWindow(config) || (item && !inWindow(item))) { event.preventDefault(); refreshAvailability(); }
  });
}
