// Fixed repository and branch: never accept Git paths or API URLs from a client.
import {PublishError,validateContent,readLimited,digest,imageExtension} from './content.mjs';
const root='https://api.github.com/repos/ncbourget/whisk';
const encoder=new TextEncoder();
export const publishingEnabled=env=>env.EDITOR_PUBLISH_ENABLED==='true'&&typeof env.GITHUB_CONTENT_TOKEN==='string'&&env.GITHUB_CONTENT_TOKEN.length>20;
export function publisher(env,transport=fetch){
 async function api(path,method='GET',body){
  let response;try{response=await transport(root+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.GITHUB_CONTENT_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Whisk-editor','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}catch{throw new PublishError(503,'Publishing service unavailable. Reload to check whether your previous publish completed before trying again.');}
  if(!response.ok)throw new PublishError([409,422].includes(response.status)?409:503,[409,422].includes(response.status)?'The website changed while you were editing. Download your draft, reload, and merge your changes.':'Publishing is unavailable. Ask Nate to check the repository credential and branch permissions.');
  return response.json();
 }
 async function snapshot(){
  const ref=await api('/git/ref/heads/main');const commit=await api('/git/commits/'+ref.object.sha);const tree=await api('/git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated)throw new PublishError(503,'Repository listing is too large. Ask Nate for help.');
  const blobs=new Map(tree.tree.filter(v=>v.type==='blob'&&v.mode==='100644').map(v=>[v.path,v.sha]));
  const data={};for(const key of ['site','menu','events']){
   const sha=blobs.get('data/'+key+'.json');if(!sha)throw new PublishError(503,'Website content is missing.');
   const blob=await api('/git/blobs/'+sha);if(blob.size>256*1024||blob.encoding!=='base64')throw new PublishError(503,'Website content cannot be loaded.');
   try{data[key]=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}catch{throw new PublishError(503,'Website content is invalid. Ask Nate for help.');}
  }
  const revision=await digest(encoder.encode(JSON.stringify(data)));
  return {data,revision,head:ref.object.sha,tree:commit.tree.sha,files:new Set(blobs.keys())};
 }
 async function commitChanges(current,entries,message){
  const tree=await api('/git/trees','POST',{base_tree:current.tree,tree:entries});
  const commit=await api('/git/commits','POST',{message,tree:tree.sha,parents:[current.head]});
  // No force: a concurrent push rejects this update instead of losing changes.
  await api('/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});
  return commit.sha;
 }
 async function save(request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new PublishError(415,'Expected JSON content.');
  let input;try{input=JSON.parse(new TextDecoder().decode(await readLimited(request,256*1024)));}catch(error){if(error instanceof PublishError)throw error;throw new PublishError(400,'Invalid JSON content.');}
  if(!input||Object.keys(input).sort().join(',')!=='data,revision'||typeof input.revision!=='string')throw new PublishError(400,'Content and revision are required.');
  const current=await snapshot();if(input.revision!==current.revision)throw new PublishError(409,'Someone published changes since you opened the editor. Download your draft, reload, and merge your changes.');
  validateContent(input.data,current.files);
  const entries=['site','menu','events'].map(key=>({path:'data/'+key+'.json',mode:'100644',type:'blob',content:JSON.stringify(input.data[key],null,2)+'\n'}));
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
 return {snapshot,save,photo};
}
