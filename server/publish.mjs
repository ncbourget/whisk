import {squareClient,squareReady,autoSyncSquare} from './square.mjs';
import {PublishError,validateContent,readLimited,digest,imageExtension} from './content.mjs';
import {draftStore,draftsEnabled} from './drafts.mjs';
import {mergeContent} from './merge.mjs';
const keys=['site','menu','events','preorders'];
const ordered=data=>({site:data.site,menu:data.menu,events:data.events,preorders:data.preorders??[]});
const photoPath=/^assets\/food\/upload-[a-f0-9]{64}\.(jpg|png|webp)$/;
const root='https://api.github.com/repos/ncbourget/whisk';
const encoder=new TextEncoder();
export const publishingEnabled=env=>env.EDITOR_PUBLISH_ENABLED==='true'&&typeof env.GITHUB_CONTENT_TOKEN==='string'&&env.GITHUB_CONTENT_TOKEN.length>20;
export function publisher(env,transport=(url,options)=>globalThis.fetch(url,options),square=()=>squareClient(env),retryWait=1500){
 const store=draftsEnabled(env)?draftStore(env.DRAFTS):null;
 async function api(path,method='GET',body,raw=false){
  let response;try{response=await transport(root+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.GITHUB_CONTENT_TOKEN,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Whisk-editor','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}catch{throw new PublishError(503,'Publishing service unavailable. Reload to check whether your previous publish completed before trying again.');}
  if(!response.ok)throw new PublishError([409,422].includes(response.status)?409:503,[409,422].includes(response.status)?'The website changed while you were editing. Download your draft, reload, and merge your changes.':'Publishing is unavailable. Ask Nate to check the repository credential and branch permissions.');
  return raw?new Uint8Array(await response.arrayBuffer()):response.json();
 }
 async function snapshot(){
  const ref=await api('/git/ref/heads/main');const commit=await api('/git/commits/'+ref.object.sha);const tree=await api('/git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated)throw new PublishError(503,'Repository listing is too large. Ask Nate for help.');
  const blobs=new Map(tree.tree.filter(v=>v.type==='blob'&&v.mode==='100644').map(v=>[v.path,v.sha]));
  const data={};for(const key of ['site','menu','events','preorders']){
   const sha=blobs.get('data/'+key+'.json');if(!sha&&key==='preorders'){data[key]=[];continue;}if(!sha)throw new PublishError(503,'Website content is missing.');
   const blob=await api('/git/blobs/'+sha);if(blob.size>256*1024||blob.encoding!=='base64')throw new PublishError(503,'Website content cannot be loaded.');
   try{data[key]=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}catch{throw new PublishError(503,'Website content is invalid. Ask Nate for help.');}
  }
  const revision=await digest(encoder.encode(JSON.stringify(data)));
  return {data,revision,head:ref.object.sha,tree:commit.tree.sha,files:new Set(blobs.keys())};
 }
 async function commitChanges(current,entries,message){
  const tree=await api('/git/trees','POST',{base_tree:current.tree,tree:entries});
  const commit=await api('/git/commits','POST',{message,tree:tree.sha,parents:[current.head]});
  try{await api('/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});}
  catch(error){if(error.status===409)error.moved=true;throw error;}
  return commit.sha;
 }
 async function save(request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new PublishError(415,'Expected JSON content.');
  let input;try{input=JSON.parse(new TextDecoder().decode(await readLimited(request,256*1024)));}catch(error){if(error instanceof PublishError)throw error;throw new PublishError(400,'Invalid JSON content.');}
  if(!input||Object.keys(input).sort().join(',')!=='data,revision'||typeof input.revision!=='string')throw new PublishError(400,'Content and revision are required.');
  const current=await snapshot();if(input.revision!==current.revision)throw new PublishError(409,'Someone published changes since you opened the editor. Download your draft, reload, and merge your changes.');
  if(input.data&&input.data.preorders===undefined){
   if(current.data.preorders.length)throw new PublishError(409,'Reload the editor to include the pre-order menu before publishing.');
   input.data.preorders=[];
  }
  validateContent(input.data,current.files);
  const entries=['site','menu','events','preorders'].map(key=>({path:'data/'+key+'.json',mode:'100644',type:'blob',content:JSON.stringify(input.data[key]??[],null,2)+'\n'}));
  const revision=await digest(encoder.encode(JSON.stringify(input.data)));
  if(revision===current.revision)return {revision,commit:current.head,published:false};
  const commit=await commitChanges(current,entries,'Publish bakery content from Whisk editor');
  return {revision,commit,published:true};
 }
 async function photo(request){
  const bytes=await readLimited(request,5*1024*1024);const ext=imageExtension(bytes,request.headers.get('content-type'));
  const path='assets/food/upload-'+await digest(bytes)+'.'+ext;
  const current=await snapshot();if(!current.files.has(path)){
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   const blob=await api('/git/blobs','POST',{content:btoa(binary),encoding:'base64'});
   await commitChanges(current,[{path,mode:'100644',type:'blob',sha:blob.sha}],'Upload bakery photo from Whisk editor');
  }
  return {path};
 }
 async function syncSquare(mode='apply',revision){
  const step=async(name,work)=>{try{return await work();}catch(error){if(error&&typeof error==='object'&&!error.step)error.step=name;throw error;}};
  const current=await step('github-read',snapshot);
  if(revision!==undefined&&revision!==current.revision)throw Object.assign(new PublishError(409,'Content changed. Reload the editor before syncing.'),{step:'revision-check'});
  const client=squareClient(env);
  const products=await step('square-catalog',()=>client.catalog());
  const {data,report}=await step('merge',()=>autoSyncSquare(current.data,products));
  report.stats=client.stats;
  if(mode==='preview')return {preview:true,report};
  const saved=await step('github-save',()=>save(new Request('https://internal/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision:current.revision})})));
  return {...saved,report};
 }
 const need=()=>{if(!store)throw new PublishError(503,'Draft saving is not set up. Ask Nate to bind the DRAFTS database.');return store;};
 async function body(request,max=300*1024){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new PublishError(415,'Expected JSON content.');
  try{return JSON.parse(new TextDecoder().decode(await readLimited(request,max)));}catch(error){if(error instanceof PublishError)throw error;throw new PublishError(400,'Invalid JSON content.');}
 }
 const version=v=>{if(!Number.isInteger(v)||v<0)throw new PublishError(400,'Reload the editor and try again.');return v;};
 function draftShape(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||!data.site||typeof data.site!=='object'||Array.isArray(data.site)||['menu','events'].some(k=>!Array.isArray(data[k]))||(data.preorders!==undefined&&!Array.isArray(data.preorders))||Object.keys(data).some(k=>!keys.includes(k)))throw new PublishError(400,'The draft has the wrong format. Reload the editor.');
  return ordered(data);
 }
 async function editorState(){
  const db=need();const [current,draft,square,photos]=await Promise.all([snapshot(),db.draft(),db.squarePending(),db.photos()]);
  return {data:draft?.data??current.data,revision:current.revision,draft:draft?{version:draft.version,updatedAt:draft.updatedAt,by:draft.by,behind:draft.baseRevision!==current.revision}:null,squarePending:square!==null,pendingPhotos:[...photos.keys()]};
 }
 async function saveDraft(request,by){
  const db=need();const input=await body(request);const v=version(input?.version);const data=draftShape(input?.data);
  if(v===0){
   let current=await snapshot();
   if(input.revision!==current.revision){await new Promise(r=>setTimeout(r,retryWait));current=await snapshot();}
   if(input.revision!==current.revision)throw new PublishError(409,'The website was just published from somewhere else. Reload the editor to get the latest content, then make your change again.');
   return db.saveDraft({data,base:current.data,baseRevision:current.revision,by},0);
  }
  const existing=await db.draft();
  if(!existing)throw new PublishError(409,'This draft was already published or discarded in another tab. Reload the editor to continue.');
  return db.saveDraft({data,base:existing.base,baseRevision:existing.baseRevision,by},v);
 }
 async function discardDraft(request){
  const db=need();const v=version((await body(request,1024))?.version);
  if(v&&!await db.clearDraft(v))throw new PublishError(409,'This draft was changed in another tab. Reload the editor first.');
  return {discarded:true};
 }
 const images=data=>new Set([...data.menu,...data.preorders].flatMap(i=>[i.image,...(i.photos||[]).map(p=>p.image)]).concat(data.site.socialImage).filter(Boolean));
 async function publishDraft(request){
  const db=need();const v=version((await body(request,1024))?.version);
  const [draft,squareSince,pending]=await Promise.all([db.draft(),db.squarePending(),db.photos()]);
  if(draft&&draft.version!==v||!draft&&v!==0)throw new PublishError(409,'This draft was changed or published in another tab. Reload the editor to see the latest draft, then publish.');
  let products=null,squareNote='';
  if(squareSince!==null){
   if(!squareReady(env))squareNote='Square reported changes, but Square is not connected here, so they were not included.';
   else try{products=await square().catalog();}catch(error){squareNote='Square changes were not included this time ('+(error instanceof PublishError?error.message:'Square is unavailable')+'). They will be tried again on your next publish.';}
  }
  for(let attempt=0;;attempt++){
   const current=await snapshot();
   let data=structuredClone(current.data),conflicts=[];
   if(draft&&draft.baseRevision===current.revision)data=draft.data;
   else if(draft)({data,conflicts}=mergeContent(draft.base,draft.data,current.data));
   data=ordered(data);
   let report=null;if(products)({data,report}=autoSyncSquare(data,products));data=ordered(data);
   validateContent(data,new Set([...current.files,...pending.keys()]));
   const photos=[...images(data)].filter(path=>pending.has(path)&&!current.files.has(path));
   const entries=[...keys.map(key=>({path:'data/'+key+'.json',mode:'100644',type:'blob',content:JSON.stringify(data[key],null,2)+'\n'})),...photos.map(path=>({path,mode:'100644',type:'blob',sha:pending.get(path)}))];
   const revision=await digest(encoder.encode(JSON.stringify(data)));
   let commit=current.head,published=false;
   if(revision!==current.revision||photos.length){
    try{commit=await commitChanges(current,entries,'Publish bakery content from Whisk editor');published=true;}
    catch(error){
     if(error.moved&&attempt<2)continue;
     if(error.moved)throw new PublishError(409,'GitHub kept changing while publishing. Nothing was lost: your draft is still saved. Wait a minute, then click Publish website again.');
     if(photos.length&&error.status===409)throw new PublishError(409,'One of your uploaded photos is no longer available. Upload it again, then publish. Your draft is still saved.');
     throw error;
    }
   }
   const kept=draft?!await db.clearDraft(draft.version):false;
   if(kept)await db.rebaseDraft(data,revision);
   if(squareSince!==null&&!squareNote)await db.clearSquarePending(squareSince);
   if(photos.length)await db.removePhotos(photos);
   return {published,commit,revision,data,conflicts,draftKept:kept,square:report?{updated:report.updated.filter(r=>r.changed.length).map(r=>r.name),added:report.added.map(r=>r.name)}:null,squareNote};
  }
 }
 async function stagePhoto(request){
  const db=need();const bytes=await readLimited(request,5*1024*1024);const ext=imageExtension(bytes,request.headers.get('content-type'));
  const path='assets/food/upload-'+await digest(bytes)+'.'+ext;
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const blob=await api('/git/blobs','POST',{content:btoa(binary),encoding:'base64'});
  await db.addPhoto(path,blob.sha);
  return {path,pending:true};
 }
 async function photoPreview(path){
  if(!photoPath.test(path))return null;
  const sha=(await need().photos()).get(path);if(!sha)return null;
  return {bytes:await api('/git/blobs/'+sha,'GET',undefined,true),type:{jpg:'image/jpeg',png:'image/png',webp:'image/webp'}[path.split('.').pop()]};
 }
 async function squareDraft(mode,v){
  const db=need();const [current,draft,squareSince]=await Promise.all([snapshot(),db.draft(),db.squarePending()]);
  if(draft&&draft.version!==v||!draft&&v!==0)throw Object.assign(new PublishError(409,'Your draft changed in another tab. Reload the editor before syncing.'),{step:'revision-check'});
  let client,products;try{client=square();products=await client.catalog();}catch(error){if(error&&typeof error==='object'&&!error.step)error.step='square-catalog';throw error;}
  const {data,report}=autoSyncSquare(draft?.data??current.data,products);report.stats=client.stats;
  if(mode==='preview')return {preview:true,report};
  const saved=await db.saveDraft({data:ordered(data),base:draft?.base??current.data,baseRevision:draft?.baseRevision??current.revision,by:draft?.by??'Square sync'},v);
  if(squareSince!==null)await db.clearSquarePending(squareSince);
  return {...saved,report};
 }
 return {snapshot,save,photo,syncSquare,drafts:!!store,editorState,saveDraft,discardDraft,publishDraft,stagePhoto,photoPreview,squareDraft,markSquarePending:()=>need().markSquarePending()};
}
