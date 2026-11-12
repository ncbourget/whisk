import {publicHost,squareReady,squareClient,jsonBody,verifySquareWebhook,checkout,pickupSlots,orderStatus} from './square.mjs';
import {authorize, AccessError} from './access.mjs';
import {publisher, publishingEnabled} from './publish.mjs';
import {PublishError} from './content.mjs';

const securityHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Cookie, Cf-Access-Jwt-Assertion',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://*.amazonaws.com https://*.square-cdn.com https://square-cdn.com; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
};
// Structured, secret-free error for the Square endpoints: {error, step, httpStatus, squareCode}.
function squareError(error){
  const known=error instanceof PublishError;
  return JSON.stringify({error:known?error.message:'Unexpected error ('+String(error?.name||'Error')+': '+String(error?.message||'').slice(0,200)+').',step:error?.step||'unknown',httpStatus:error?.httpStatus,squareCode:error?.squareCode||undefined});
}
function reply(request, body, status = 200, type = 'application/json; charset=utf-8', extra = {}) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status, headers: {...securityHeaders, 'Content-Type': type, ...extra},
  });
}
// Friendly page in the site's own design (taken from the built 404 page), with a contact link.
async function unavailable(request, env, url, kind, collection, site = {}) {
  const heading = kind === 'menu' ? 'This menu is currently unavailable.' : 'The item you are looking for is currently unavailable.';
  const menuOpen = collection === 'menu' ? site.showStandMenu !== false : collection === 'preorder' ? site.showPreorderMenu !== false : false;
  // Same markup as the current storefront pages (scripts/storefront.py), so it inherits their design.
  const action = (href,label)=>'<a class="action-link" href="'+href+'"><span class="action-label">'+label+'</span><span class="action-arrow" aria-hidden="true">↗</span></a>';
  const inner = '<p class="mono">Unavailable</p><h1>' + heading + '</h1><p>Please check back later, or contact Cindy with any questions.</p>' + '<div class="page-actions">' + action('/contact/','contact cindy') + (kind === 'item' && menuOpen ? action('/' + collection + '/','see what is available') : '') + action('/#find-whisk','find whisk') + '</div>';
  let html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unavailable | Whisk</title><body><main>' + inner + '</main></body></html>';
  try {
    const page = await (await env.ASSETS.fetch(new Request(url.origin + '/__whisk-unavailable__'))).text();
    if (/<main\b[^>]*>[\s\S]*?<\/main>/.test(page)) html = page.replace(/(<main\b[^>]*>)[\s\S]*?(<\/main>)/, (m, open, close) => open + inner + close).replace(/<title>[^<]*<\/title>/, '<title>Unavailable | Whisk</title>');
  } catch { /* fall back to the plain page */ }
  return reply(request, html, kind === 'menu' ? 410 : 404, 'text/html; charset=utf-8');
}
export function createHandler({editorHtml, editorScript, editorStyle, content}) {
  return async function fetch(request, env) {
    const url = new URL(request.url);
    // Only the canonical admin routes have responses; no static admin fallback.
    const path = url.pathname;
    const closedMenu = /^\/menu(?:\/|$)/.test(path) && content.site?.showStandMenu === false
      || /^\/preorder(?:\/|$)/.test(path) && content.site?.showPreorderMenu === false;
    // An item page is only served while its menu is on AND the item is shown. Hidden, removed and
    // stale item URLs get the same friendly message instead of an old static page.
    const itemPath = path.match(/^\/(menu|preorder)\/([a-z0-9-]+)(?:\/|\/index\.html)?$/);
    const shownItem = itemPath && (itemPath[1]==='menu' ? content.menu : content.preorders)?.some(i => i.id === itemPath[2] && i.available === true);
    if (closedMenu || (itemPath && !shownItem)) return unavailable(request, env, url, closedMenu ? 'menu' : 'item', itemPath ? itemPath[1] : null, content.site);
    // Public commerce is outside /api, which remains entirely Access-protected.
    if(path.startsWith('/commerce/')){
      try {
        if(url.protocol!=='https:'||url.hostname!==publicHost(env)||url.port)throw new PublishError(403,'Checkout is only available on '+publicHost(env)+'.');
        if(path==='/commerce/square-webhook'&&request.method==='POST'){
          const event=await verifySquareWebhook(request,env);
          if(event.type==='catalog.version.updated'){
            if(!publishingEnabled(env))throw new PublishError(503,'Sync is not configured.');
            await publisher(env).syncSquare();
          }
          return reply(request,'{"received":true}');
        }
        if(path==='/commerce/catalog'&&request.method==='GET'){
          if(content.site?.showPreorderMenu===false||content.site?.demo||!squareReady(env))return reply(request,JSON.stringify({enabled:false,items:[],slots:[]}));
          const client=squareClient(env),products=await client.catalog();
          // Only explicitly published pre-orders are exposed; no raw seller catalog.
          const linked=(content.preorders||[]).filter(i=>i.available&&i.squareVariationId);
          const tracked=linked.map(i=>products.find(p=>p.variationId===i.squareVariationId)).filter(p=>p?.trackInventory).map(p=>p.variationId);
          const counts=await client.stock(tracked);
          const items=linked.map(i=>{
            const p=products.find(p=>p.variationId===i.squareVariationId),left=p?.trackInventory?(counts.get(p.variationId)??0):null;
            return {id:i.id,price:p?.price??i.price,soldOut:i.soldOut||!p||p.soldOut||(left!==null&&left<1),left};
          });
          return reply(request,JSON.stringify({enabled:env.SQUARE_CHECKOUT_ENABLED==='true'&&content.site.orderingEnabled,items,slots:pickupSlots(content.site)}));
        }
        if(path==='/commerce/order-status'&&request.method==='GET')return reply(request,JSON.stringify(await orderStatus(request,env)));
        if(path==='/commerce/checkout'&&request.method==='POST'){
          if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')!=='same-origin')throw new PublishError(403,'Check out from the Whisk website.');
          // Latest published admin overrides, including deletions, apply before the next build.
          const latest=await publisher(env).snapshot();
          const result=await checkout(request,env,latest.data);
          return reply(request,JSON.stringify({url:result.url}),200,undefined,{'Set-Cookie':result.cookie});
        }
        return reply(request,'{"error":"Not found."}',404);
      }catch(error){return reply(request,JSON.stringify({error:error instanceof PublishError?error.message:'Square is temporarily unavailable.'}),error instanceof PublishError?error.status:503);}
    }
    const admin = /^\/(editor|api|data)(\/|$)/.test(path) || ['/assets/js/editor.js','/assets/css/editor.css'].includes(path);
    if (!admin) {
      if (!['GET','HEAD'].includes(request.method)) return reply(request, '{"error":"Method not allowed."}', 405);
      return env.ASSETS.fetch(request);
    }
    try { await authorize(request, env); }
    catch (error) {
      return reply(request, JSON.stringify({error: error instanceof AccessError ? error.message : 'Administrative access unavailable.'}), error instanceof AccessError ? error.status : 503);
    }
    // Authentication runs for EVERY method and endpoint before dispatch.
    const writable=publishingEnabled(env);
    if (!['GET','HEAD'].includes(request.method)) {
      if(!writable || request.method!=='POST' || !['/api/content','/api/photo','/api/square/sync'].includes(path))
        return reply(request, '{"error":"Hosted publishing is not enabled for this request."}', 405);
      if(request.headers.get('Origin')!==url.origin || (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site')!=='same-origin'))
        return reply(request, '{"error":"Publish from the signed-in editor on this website."}', 403);
      try {
        const service=publisher(env);
        if(path==='/api/square/sync'){
          const input=await jsonBody(request);
          if(!['preview','apply'].includes(input?.mode)||typeof input.revision!=='string')throw new PublishError(400,'Reload the editor and try the sync again.');
          try{return reply(request,JSON.stringify(await service.syncSquare(input.mode,input.revision)));}
          catch(error){return reply(request,squareError(error),error instanceof PublishError&&error.status<500?error.status:503);}
        }
        const result=await (path==='/api/content'?service.save(request):service.photo(request));
        return reply(request,JSON.stringify(result));
      } catch(error) {
        return reply(request,JSON.stringify({error:error instanceof PublishError?error.message:'Publishing unavailable. Reload to check your latest content before retrying.'}),error instanceof PublishError?error.status:503);
      }
    }
    if (path === '/editor') return reply(request, '', 308, 'text/plain', {'Location':'/editor/'});
    if (path === '/editor/' || path === '/editor/index.html') return reply(request, editorHtml, 200, 'text/html; charset=utf-8');
    if (path === '/assets/js/editor.js') return reply(request, editorScript, 200, 'text/javascript; charset=utf-8');
    if (path === '/assets/css/editor.css') return reply(request, editorStyle, 200, 'text/css; charset=utf-8');
    if(path==='/api/square/catalog'){try{const client=squareClient(env);const items=await client.catalog();return reply(request,JSON.stringify({items,stats:client.stats}));}catch(error){return reply(request,squareError(error),503);}}
    if (path === '/api/content') {
      if(!writable)return reply(request, JSON.stringify({data: content, capabilities: {write: false}}));
      try{const {data,revision}=await publisher(env).snapshot();return reply(request,JSON.stringify({data,revision,capabilities:{write:true,mode:'publish'}}));}
      catch(error){return reply(request,JSON.stringify({error:error instanceof PublishError?error.message:'Publishing content is unavailable.'}),503);}
    }
    // In particular /api/photo and all /data/*.json requests have no read handler.
    return reply(request, '{"error":"Not found."}', 404);
  };
}
