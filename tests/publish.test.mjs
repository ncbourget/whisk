import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publisher} from '../server/publish.mjs';
import {validateContent,readLimited,imageExtension} from '../server/content.mjs';
const content=JSON.parse(await readFile(new URL('./fixtures/content.json',import.meta.url)));
function mock({conflict=false}={}){
 const calls=[];let committed;
 const transport=async(url,options)=>{
  assert.ok(url.startsWith('https://api.github.com/repos/ncbourget/whisk/'));
  const path=url.split('/whisk')[1];const body=options.body?JSON.parse(options.body):null;calls.push({path,method:options.method,body});
  if(path==='/git/ref/heads/main')return Response.json({object:{sha:'head'}});
  if(path==='/git/commits/head')return Response.json({tree:{sha:'tree'}});
  if(path==='/git/trees/tree?recursive=1')return Response.json({truncated:false,tree:[...['site','menu','events'].map(key=>({path:'data/'+key+'.json',sha:key,type:'blob',mode:'100644'})),...content.menu.filter(i=>i.image).map(i=>({path:i.image,sha:'image',type:'blob',mode:'100644'}))]});
  if(path.startsWith('/git/blobs/')&&options.method==='GET'){const value=JSON.stringify(content[path.split('/').at(-1)]);return Response.json({size:value.length,encoding:'base64',content:Buffer.from(value).toString('base64')});}
  if(path==='/git/trees'){assert.equal(body.base_tree,'tree');return Response.json({sha:'newtree'});}
  if(path==='/git/commits'){assert.deepEqual(body.parents,['head']);return Response.json({sha:'newcommit'});}
  if(path==='/git/refs/heads/main'){assert.equal(body.force,false);committed=body.sha;return conflict?new Response('',{status:422}):Response.json({object:{sha:committed}});}
  if(path==='/git/blobs'&&options.method==='POST')return Response.json({sha:'newblob'});
  throw Error('Unexpected API call '+path);
 };
 return {service:publisher({GITHUB_CONTENT_TOKEN:'test'},transport),calls};
}
const request=body=>new Request('https://bakery.example/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('Publishing validates content, writes only fixed files and advances without force',async()=>{
 const {service,calls}=mock();const initial=await service.snapshot();const data=structuredClone(content);data.menu[0].name='Updated bun';
 const result=await service.save(request({data,revision:initial.revision}));assert.equal(result.commit,'newcommit');assert.notEqual(result.revision,initial.revision);
 const tree=calls.find(c=>c.method==='POST'&&c.path==='/git/trees');assert.deepEqual(tree.body.tree.map(v=>v.path),['data/site.json','data/menu.json','data/events.json']);
});
test('Stale editor content, invalid schema and concurrent branch updates fail closed',async()=>{
 const {service,calls}=mock();await assert.rejects(service.save(request({data:content,revision:'stale'})),e=>e.status===409);assert.ok(!calls.some(c=>c.method==='POST'));
 const snap=await service.snapshot(),bad=structuredClone(content);bad.site.password='secret';await assert.rejects(service.save(request({data:bad,revision:snap.revision})),e=>e.status===400);assert.ok(!calls.some(c=>c.method==='POST'));
 const raced=mock({conflict:true}).service;const data=structuredClone(content);data.menu[0].name='Another bun';await assert.rejects(raced.save(request({data,revision:snap.revision})),e=>e.status===409);
});
test('Validation rejects scripts as links, traversal, unknown assets and invalid events',()=>{
 const files=new Set(content.menu.map(i=>i.image));
 for(const change of [d=>d.menu[0].squareUrl='https://evil.example',d=>d.menu[0].image='assets/../secret.png',d=>d.menu[0].image='assets/food/missing.jpg',d=>d.menu[0].price=-1,d=>d.menu[0].price=Infinity,d=>d.menu[0].id=d.menu[1].id,d=>d.site.instagram='javascript:alert(1)',d=>d.events=[{id:'bad'}]]){
  const data=structuredClone(content);change(data);assert.throws(()=>validateContent(data,files));
 }
});
test('Uploads are size limited, disallow SVG, and use content-derived paths',async()=>{
 await assert.rejects(readLimited(new Request('https://example.com',{method:'POST',body:'12345'}),4),e=>e.status===413);
 assert.throws(()=>imageExtension(new TextEncoder().encode('<svg/>'),'image/svg+xml'));
 assert.throws(()=>imageExtension(new TextEncoder().encode('<html>'),'image/png'));
 const {service,calls}=mock();const result=await service.photo(new Request('https://example.com/api/photo',{method:'POST',headers:{'Content-Type':'image/png','X-File-Name':'../../injected.js'},body:new Uint8Array([137,80,78,71,13,10,26,10,0])}));
 assert.match(result.path,/^assets\/food\/upload-[a-f0-9]{64}\.png$/);
 assert.equal(calls.find(c=>c.path==='/git/trees'&&c.method==='POST').body.tree[0].path,result.path);
});
