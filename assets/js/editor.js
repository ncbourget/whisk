/* Privileged editor. Every data request requires server-side authorization. No credentials live here. */
'use strict';
let data, current = 'site', local = false, dirty = false, revision = '', removeAction;
const fields = document.getElementById('editor-fields');
const message = document.getElementById('editor-message');
const form = document.getElementById('content-form');
const statuses = {coming_soon:'Coming soon',open_today:'Open today',preorders_open:'Preorders open',preorders_closed:'Preorders closed',sold_out:'Sold out',closed:'Closed for the day',next_popup:'Next pop-up'};
const siteGroups = [
 ['At the window', [['status','Business status','select',statuses],['statusNote','Status note','textarea'],['hours','Opening hours','textarea'],['serviceArea','Town or service area','text']]],
 ['Ordering & pickup', [['orderingEnabled','Enable ordering','checkbox'],['squareUrl','Square shop / general ordering link','url'],['orderOpens','Ordering opens (optional)','datetime'],['orderCloses','Ordering closes (optional)','datetime'],['pickup','Pickup instructions','textarea'],['cutoff','Order deadline note','textarea'],['refunds','Cancellation & refund policy','textarea'],['allergens','Allergen note','textarea']]],
 ['Contact & social', [['email','Contact email','email'],['phone','Phone','text'],['instagram','Instagram profile link','url'],['facebook','Facebook profile link','url']]],
 ['Your story', [['name','Bakery name','text'],['tagline','Tagline','text'],['heroHeading','Homepage headline','textarea'],['heroText','Homepage introduction','textarea'],['aboutHeading','Story headline','textarea'],['aboutText','About Cindy & Whisk','textarea'],['aboutNote','A little more of your story','textarea'],['footerNote','Footer note','text']]],
 ['Launch settings · ask Nate if unsure', [['demo','Sample / demo mode (blocks all payments)','checkbox'],['domain','Production domain','url','Leave empty until confirmed, e.g. https://example.com'],['basePath','Website subfolder','text','Usually blank. Use /whisk only for a repository-subfolder preview.'],['currency','Currency','select',{USD:'US dollars',CAD:'Canadian dollars',GBP:'British pounds',AUD:'Australian dollars',EUR:'Euros'}],['timezone','Business time zone','text','For example America/New_York. Confirm your actual location.'],['socialImage','Social sharing image path','text','Upload a 1200 × 630 image under assets/brand; use its path here.'],['socialImageAlt','Describe the sharing image','text']]]
];
const menuFields = [['name','Item name','text'],['category','Category','text'],['description','Description','textarea'],['price','Price','number'],['available','Show on the menu','checkbox'],['soldOut','Sold out','checkbox'],['featured','Feature on the homepage','checkbox'],['seasonal','Seasonal item','checkbox'],['dietary','Dietary tags, separated by commas','tags'],['allergens','Ingredients & allergens','textarea'],['notes','Extra notes / limited quantity message','textarea'],['storage','Storage or reheating advice','textarea'],['image','Photo file path','photo'],['imageAlt','Describe the photo','text'],['imageShape','Photo shape','select',{square:'Square',portrait:'Portrait',landscape:'Landscape'}],['squareUrl','This item’s Square link','url'],['orderOpens','Ordering opens (optional)','datetime'],['orderCloses','Ordering closes (optional)','datetime']];
const eventFields = [['name','Location / venue name','text'],['address','Street address or venue details','text'],['start','Starts','datetime'],['end','Ends','datetime'],['status','Status','select',{confirmed:'Confirmed',tentative:'Tentative',cancelled:'Cancelled'}],['mapUrl','Directions link','url'],['description','A note about this stop','textarea'],['menuNote','Special menu note','textarea']];
function say(text,error=false){message.textContent=text;message.className=error?'error':'';}
function el(tag, text, cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function markDirty(){dirty=true;say('Unsaved changes. Save & preview when you’re ready.');}
function localDate(value){
 if(!value)return '';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:data.site.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function zonedDate(value){
 if(!value)return '';
 const wall=Date.parse(value+'Z');
 const offsets=new Set([-86400000,0,86400000].map(delta=>{const sample=wall+delta;return Date.parse(localDate(new Date(sample).toISOString())+'Z')-sample;}));
 const candidates=[...offsets].map(offset=>new Date(wall-offset).toISOString()).filter(candidate=>localDate(candidate)===value);
 if(candidates.length!==1)throw Error('That time falls in a daylight-saving clock change. Choose a time outside the repeated or skipped hour.');
 return candidates[0];
}
function field(def, object, prefix){
 const [key,label,type,options]=def;
 const wrapper=el('div',undefined,'field'+(type==='textarea'?' wide':''));
 const id=`${prefix}-${key}`;
 const title=el('label',label);title.htmlFor=id;wrapper.append(title);
 let input;
 if(type==='textarea')input=el('textarea');
 else if(type==='select'){input=el('select');Object.entries(options).forEach(([value,text])=>{const o=el('option',text);o.value=value;input.append(o);});}
 else{input=el('input');input.type= type==='datetime'?'datetime-local':['tags','photo'].includes(type)?'text':type;}
 input.id=id;input.name=id;
 if(type==='checkbox')input.checked=object[key];
 else input.value=type==='datetime'?localDate(object[key]):type==='tags'?object[key].join(', '):object[key]??'';
 if(type==='number'){input.min='0';input.step='0.01';input.required=true;}
 if(['name','category','start','end','timezone'].includes(key))input.required=true;
 input.addEventListener('input',()=>{try{input.setCustomValidity('');object[key]=type==='datetime'?zonedDate(input.value):type==='checkbox'?input.checked:type==='number'?Number(input.value):type==='tags'?input.value.split(',').map(t=>t.trim()).filter(Boolean):input.value;markDirty();}catch(error){input.setCustomValidity(error.message);say(error.message,true);}});
 wrapper.append(input);
 if(type==='datetime')wrapper.append(el('small',`Time zone: ${data.site.timezone}. Optional ordering limits may be left empty. Configure the same limits in Square.`));
 if(typeof options==='string'){const help=el('small',options);help.id=id+'-help';input.setAttribute('aria-describedby',help.id);wrapper.append(help);}
 if(type==='photo'){
  if(object.image){const img=el('img',undefined,'photo-preview');img.src='../'+object.image;img.alt=object.imageAlt||'Current photo';wrapper.append(img);}
  if(local){const upload=el('input',undefined,'upload-button');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';upload.setAttribute('aria-label',`Upload photo for ${object.name}`);upload.addEventListener('change',async()=>{
   const file=upload.files[0];if(!file)return;
   if(file.size>5*1024*1024){say('Choose a JPG, PNG, or WebP smaller than 5 MB.',true);return;}
   try{const res=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});const result=await res.json();if(!res.ok)throw Error(result.error);object.image=result.path;markDirty();render();say('Photo uploaded. Add a description of the photo, then save.');}catch(error){say(error.message,true);}
  });wrapper.append(upload);}
  else wrapper.append(el('small','Upload the photo to assets/food in GitHub, then enter its path here.'));
 }
 return wrapper;
}
function addFields(defs,object,prefix){const grid=el('div',undefined,'field-grid');defs.forEach(def=>grid.append(field(def,object,prefix)));return grid;}
function render(){
 fields.replaceChildren();
 if(current==='site')siteGroups.forEach(([heading,defs])=>{const section=el('section',undefined,'editor-section');section.append(el('h2',heading),addFields(defs,data.site,'site'));fields.append(section);});
 else{
  data[current].forEach((object,index)=>{
   const section=el('section',undefined,'editor-entry');const head=el('div',undefined,'entry-header');head.append(el('h2',object.name||'New entry'));const controls=el('div',undefined,'entry-controls');
   [['Move up',-1],['Move down',1]].forEach(([text,step])=>{const b=el('button',text);b.type='button';b.disabled=index+step<0||index+step>=data[current].length;b.addEventListener('click',()=>{[data[current][index],data[current][index+step]]=[data[current][index+step],data[current][index]];if(current==='menu')data.menu.forEach((v,i)=>v.position=i+1);markDirty();render();});controls.append(b);});
   const remove=el('button','Remove');remove.type='button';remove.addEventListener('click',()=>{removeAction=()=>{data[current].splice(index,1);markDirty();render();};document.getElementById('remove-dialog').showModal();});controls.append(remove);head.append(controls);section.append(head,addFields(current==='menu'?menuFields:eventFields,object,object.id));fields.append(section);
  });
  if(!data[current].length)fields.append(el('p',current==='menu'?'No menu items yet. Add your first bake below.':'No stops planned yet. The website will show a friendly coming-soon note.'));
  const add=el('button',current==='menu'?'Add a baked good':'Add a stop','secondary');add.type='button';add.addEventListener('click',()=>{
   const id=(current==='menu'?'bake-':'stop-')+crypto.randomUUID().slice(0,8);
   data[current].push(current==='menu'?{id,name:'New bake',description:'',price:0,category:'Pastries',available:true,soldOut:false,featured:false,seasonal:false,dietary:[],allergens:'',image:'',imageAlt:'',imageShape:'square',squareUrl:'',notes:'',storage:'',orderOpens:'',orderCloses:'',position:data.menu.length+1}:{id,name:'New stop',address:'',start:'',end:'',mapUrl:'',description:'',status:'tentative',menuNote:''});markDirty();render();const cards=fields.querySelectorAll('.editor-entry');cards[cards.length-1].querySelector('input').focus();});fields.append(add);
 }
}
document.querySelector('.editor-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(!button||!data)return;current=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();});
document.getElementById('confirm-remove').addEventListener('click',()=>{removeAction?.();document.getElementById('remove-dialog').close();});
document.getElementById('cancel-remove').addEventListener('click',()=>document.getElementById('remove-dialog').close());
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!local||!data)return;
 const save=document.getElementById('save');save.disabled=true;say('Saving and checking your content…');
 try{const res=await fetch('/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision})});const result=await res.json();if(!res.ok)throw Error(result.error);revision=result.revision;dirty=false;say('Saved! Your local preview is ready. Open View website above to check it. Publish with GitHub Desktop when you’re happy.');}
 catch(error){say(error.message,true);}finally{save.disabled=false;}
});
document.getElementById('download').addEventListener('click',()=>{if(!form.reportValidity())return;const blob=new Blob([JSON.stringify(data[current],null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=current+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say(`Downloaded ${current}.json. This is a draft, not a published change. If you edited other tabs, download each of those too.`);});
document.getElementById('import').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{if(file.name!==current+'.json')throw Error(`Choose ${current}.json for this tab.`);const parsed=JSON.parse(await file.text());const valid=current==='site'?parsed&&typeof parsed==='object'&&!Array.isArray(parsed):Array.isArray(parsed);if(!valid)throw Error('That file has the wrong format.');if(current==='site'&&Object.keys(data.site).some(k=>!(k in parsed)))throw Error('That bakery file is missing fields.');if(current!=='site'&&parsed.some(item=>!item||typeof item!=='object'||typeof item.id!=='string'||typeof item.name!=='string'||(current==='menu'&&!Array.isArray(item.dietary))))throw Error('That file has incomplete entries.');data[current]=parsed;markDirty();render();say('Imported into your draft. Review the fields before saving.');}catch(error){say('Could not import: '+error.message,true);}event.target.value='';
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
(async()=>{
 try{
  // Authorization is enforced by the server, never inferred from the hostname.
  // No public JSON fallback: an expired/absent session must fail closed.
  const res=await fetch('/api/content',{credentials:'same-origin',cache:'no-store'});
  if(!res.ok||!res.headers.get('Content-Type')?.includes('application/json'))throw Error('Sign in again through Cloudflare Access, or reopen Start Whisk.command for local editing.');
  const result=await res.json();data=result.data;revision=result.revision||'';local=result.capabilities?.write===true;
  document.getElementById('editor-mode').textContent=local?'Local notebook · Save & preview updates this computer only. Your live site changes after you publish through GitHub Desktop.':'Authenticated download mode · Changes stay in this browser until downloaded. Publish through GitHub Desktop, or use Start Whisk.command for local saving. Hosted saves and uploads are disabled.';
  document.getElementById('save').disabled=!local;document.getElementById('download').disabled=false;render();
 }catch(error){say('The notebook could not load. '+error.message+' Ask Nate for help.',true);}
})();
