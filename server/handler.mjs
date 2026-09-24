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
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
};
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
      if(!writable || request.method!=='POST' || !['/api/content','/api/photo'].includes(path))
        return reply(request, '{"error":"Hosted publishing is not enabled for this request."}', 405);
      if(request.headers.get('Origin')!==url.origin || (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site')!=='same-origin'))
        return reply(request, '{"error":"Publish from the signed-in editor on this website."}', 403);
      try {
        const service=publisher(env);
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
    if (path === '/api/content') {
      if(!writable)return reply(request, JSON.stringify({data: content, capabilities: {write: false}}));
      try{const {data,revision}=await publisher(env).snapshot();return reply(request,JSON.stringify({data,revision,capabilities:{write:true,mode:'publish'}}));}
      catch(error){return reply(request,JSON.stringify({error:error instanceof PublishError?error.message:'Publishing content is unavailable.'}),503);}
    }
    // In particular /api/photo and all /data/*.json requests have no read handler.
    return reply(request, '{"error":"Not found."}', 404);
  };
}
