import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, exportJWK, SignJWT} from 'jose';
import {createHandler} from '../server/handler.mjs';

const {privateKey, publicKey} = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const jwk = {...await exportJWK(publicKey), kid:'test-key', alg:'RS256', use:'sig'};
const env = {
  ACCESS_TEAM_DOMAIN:'https://whisk-test.cloudflareaccess.com', ACCESS_AUD:'a'.repeat(64),
  ADMIN_HOSTNAME:'bakery.example', ADMIN_EMAILS:JSON.stringify(['cindy@example.com','nate@example.com']),
  ASSETS:{fetch:async()=>new Response('public asset')},
};
const handler = createHandler({editorHtml:'private editor',editorScript:'private script',editorStyle:'private styles',content:{privateDraft:'not public'}});
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.equal(String(url), env.ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs');
  return Response.json({keys:[jwk]});
};
async function token(overrides={}, key=privateKey, algorithm='RS256') {
  const now = Math.floor(Date.now()/1000);
  const claims = {iss:env.ACCESS_TEAM_DOMAIN, aud:env.ACCESS_AUD, sub:'owner', email:'cindy@example.com', iat:now, exp:now+600,...overrides};
  for(const name of Object.keys(claims)) if(claims[name]===undefined) delete claims[name];
  return new SignJWT(claims).setProtectedHeader({alg:algorithm,kid:'test-key'}).sign(key);
}
async function request(path='/api/content', {jwt,method='GET',host='bakery.example',headers={},config=env}={}) {
  return handler(new Request(`https://${host}${path}`,{method,headers:{...(jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}),...headers}}), config);
}
test('Access boundary rejects anonymous access to every administrative route and method',async()=>{
  for(const path of ['/editor','/editor/','/editor/index.html','/editor/other','/assets/js/editor.js','/assets/css/editor.css','/api','/api/content','/api/photo','/api/future-write','/data/site.json']) {
    for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']) {
      const res=await request(path,{method}); assert.equal(res.status,401,`${method} ${path}`);
      assert.match(res.headers.get('cache-control'),/no-store/);
      assert.equal(res.headers.get('access-control-allow-origin'),null);
    }
  }
});
test('Access checks signatures, issuer, audience, expiry, not-before, issued-at, required claims and exact email',async()=>{
  const badClaims=[{iss:'https://attacker.cloudflareaccess.com'},{aud:'b'.repeat(64)},{exp:1},{nbf:Math.floor(Date.now()/1000)+1000},{iat:Math.floor(Date.now()/1000)+1000},{email:'other@example.com'},{email:'cindy@example.com.attacker.test'},{email:undefined},{sub:undefined},{exp:undefined},{iat:undefined}];
  for(const claim of badClaims) assert.ok([401,403].includes((await request('/api/content',{jwt:await token(claim)})).status),JSON.stringify(claim));
  assert.equal((await request('/api/content',{jwt:await token({},other.privateKey)})).status,401);
  assert.equal((await request('/api/content',{jwt:await token({},new Uint8Array(32),'HS256')})).status,401);
  const unsigned=Buffer.from('{"alg":"none"}').toString('base64url')+'.'+Buffer.from('{"email":"cindy@example.com"}').toString('base64url')+'.';
  assert.equal((await request('/api/content',{jwt:unsigned})).status,401);
  assert.equal((await request('/api/content',{headers:{'Cf-Access-Authenticated-User-Email':'cindy@example.com','Cookie':'CF_Authorization=forged'}})).status,401);
});
test('Both explicitly allowed users can read; hosted writes remain disabled after authentication',async()=>{
  for(const email of ['cindy@example.com','nate@example.com']) {
    const jwt=await token({email});
    const res=await request('/api/content',{jwt}); assert.equal(res.status,200);
    assert.deepEqual(await res.json(),{data:{privateDraft:'not public'},capabilities:{write:false}});
    assert.equal(await (await request('/editor/',{jwt})).text(),'private editor');
    assert.equal(await (await request('/assets/js/editor.js',{jwt})).text(),'private script');
    assert.equal(await (await request('/assets/css/editor.css',{jwt})).text(),'private styles');
    for(const path of ['/api/content','/api/photo','/api/future-write','/editor/'])
      for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) assert.equal((await request(path,{jwt,method})).status,405);
    assert.equal((await request('/data/site.json',{jwt})).status,404);
    assert.equal(await (await request('/api/content',{jwt,method:'HEAD'})).text(),'');
  }
});
test('Missing configuration and alternate hostnames fail closed even with valid tokens',async()=>{
  const jwt=await token();
  for(const key of ['ACCESS_TEAM_DOMAIN','ACCESS_AUD','ADMIN_HOSTNAME','ADMIN_EMAILS']) {
    const config={...env}; delete config[key]; assert.equal((await request('/api/content',{jwt,config})).status,503);
  }
  for(const emails of ['[]','["*@example.com","nate@example.com"]','["cindy@example.com","CINDY@example.com"]'])
    assert.equal((await request('/api/content',{jwt,config:{...env,ADMIN_EMAILS:emails}})).status,503);
  for(const host of ['whisk.pages.dev','preview.whisk.pages.dev','other.example']) assert.equal((await request('/api/content',{jwt,host})).status,403);
});
test('Enabled publishing still requires signed authorization and exact same-origin writes',async()=>{
  const config={...env,EDITOR_PUBLISH_ENABLED:'true',GITHUB_CONTENT_TOKEN:'not-a-real-token-for-testing'};
  for(const path of ['/api/content','/api/photo']){
    assert.equal((await request(path,{method:'POST',config})).status,401);
    const jwt=await token();
    for(const headers of [{},{Origin:'https://attacker.example'},{Origin:'https://bakery.example','Sec-Fetch-Site':'cross-site'}])
      assert.equal((await request(path,{jwt,method:'POST',config,headers})).status,403);
    assert.equal((await request(path,{jwt,method:'DELETE',config,headers:{Origin:'https://bakery.example'}})).status,405);
  }
});
test('JWKS outage fails closed and public assets do not need authentication',async()=>{
  globalThis.fetch=async()=>{throw new Error('network unavailable');};
  try {assert.equal((await request('/api/content',{jwt:await token(),config:{...env,ACCESS_TEAM_DOMAIN:'https://offline.cloudflareaccess.com'}})).status,401);}
  finally {globalThis.fetch=originalFetch;}
  assert.equal(await (await request('/')).text(),'public asset');
  assert.equal((await request('/',{method:'POST'})).status,405);
});
