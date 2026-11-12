import {squareReady,squareClient,jsonBody,verifySquareWebhook,checkout,pickupSlots,orderStatus} from './square.mjs';
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
export function createHandler({editorHtml, editorScript, editorStyle, content}) {
  return async function fetch(request, env) {
    const url = new URL(request.url);
    // Only the canonical admin routes have responses; no static admin fallback.
    const path = url.pathname;
    const closedMenu = /^\/menu(?:\/|$)/.test(path) && content.site?.showStandMenu === false
      || /^\/preorder(?:\/|$)/.test(path) && content.site?.showPreorderMenu === false;
    if (closedMenu) return reply(request, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Menu unavailable | Whisk</title><body><main><h1>This menu is currently unavailable.</h1><p>Please check back for the next available selection.</p><a href="/#find-whisk">Find Whisk</a></main></body></html>', 410, 'text/html; charset=utf-8');
    // Public commerce is outside /api, which remains entirely Access-protected.
    if(path.startsWith('/commerce/')){
      try {
        if(url.protocol!=='https:'||url.hostname!==env.ADMIN_HOSTNAME||url.port)throw new PublishError(403,'Commerce is unavailable on this hostname.');
        if(path==='/commerce/square-webhook'&&request.method==='POST'){
          const event=await verifySquareWebhook(request,env);
          if(event.type==='catalog.version.updated'){
            if(!publishingEnabled(env))throw new PublishError(503,'Sync is not configured.');
            await publisher(env).syncSquare();
          }
          return reply(request,'{"received":true}');
        }
        if(path==='/commerce/catalog'&&request.method==='GET'){
          if(content.site?.showPreorderMenu===false||!squareReady(env))return reply(request,JSON.stringify({enabled:false,items:[],slots:[]}));
          const products=await squareClient(env).catalog();
          // Only explicitly published pre-orders are exposed; no raw seller catalog.
          const items=(content.preorders||[]).filter(i=>i.available&&i.squareVariationId).map(i=>{
            const p=products.find(p=>p.variationId===i.squareVariationId);
            return {id:i.id,price:p?.price??i.price,soldOut:i.soldOut||!p||p.soldOut||p.trackInventory};
          });
          return reply(request,JSON.stringify({enabled:env.SQUARE_CHECKOUT_ENABLED==='true'&&content.site.orderingEnabled,items,slots:pickupSlots(env)}));
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
          if(!Array.isArray(input?.links)||input.links.length>30||typeof input.revision!=='string')throw new PublishError(400,'Choose products and reload the editor.');
          try{return reply(request,JSON.stringify(await service.syncSquare(input.links,input.revision)));}
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
