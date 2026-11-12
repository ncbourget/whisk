/* Privileged editor. Every data request requires server-side authorization. No credentials live here. */
'use strict';
let data, current = 'site', local = false, hosted = false, dirty = false, revision = '', removeAction;
const fields = document.getElementById('editor-fields');
const message = document.getElementById('editor-message');
const form = document.getElementById('content-form');
let uploading = 0;
const photoPreviews=new Map();
function photoSource(path){return photoPreviews.get(path)||(path.startsWith('https://')?path:'../'+path);}
function rememberPhoto(path,file){
 const previous=photoPreviews.get(path);if(previous)URL.revokeObjectURL(previous);
 photoPreviews.set(path,URL.createObjectURL(file));
}
function missingPhotoDescription(){
 for(const collection of ['menu','preorders']){
  for(const item of data[collection]||[]){
   if(item.image&&!item.imageAlt.trim())return {collection,item,id:item.id+'-imageAlt'};
   const index=(item.photos||[]).findIndex(photo=>!photo.alt.trim());
   if(index>=0)return {collection,item,id:item.id+'-extra-'+index};
  }
 }
 return null;
}
function uploadBusy(delta){uploading+=delta;document.getElementById('save').disabled=uploading>0;}
async function responseData(res){
 if(!res.headers.get('content-type')?.includes('application/json'))throw Error('Your sign-in may have expired. Download your draft before reloading, then sign in again through Cloudflare Access.');
 return res.json();
}
const statuses = {coming_soon:'Coming soon',open_today:'Open today',preorders_open:'Preorders open',preorders_closed:'Preorders closed',sold_out:'Sold out',closed:'Closed for the day',next_popup:'Next pop-up'};
const siteGroups = [
 ['Menu visibility', [['showStandMenu','Show main menu (homepage, navigation and item pages)','checkbox'],['showPreorderMenu','Show pre-order menu (homepage, navigation and item pages)','checkbox']]],
 ['Homepage · Find Whisk', [['status','Business status','select',statuses],['statusNote','Status note','textarea'],['hours','Opening hours','textarea'],['serviceArea','Town or service area','text']]],
 ['Ordering & pickup', [['orderingEnabled','Enable ordering','checkbox'],['squareUrl','Square shop / general ordering link','url'],['orderOpens','Ordering opens (optional)','datetime'],['orderCloses','Ordering closes (optional)','datetime'],['pickup','Pickup instructions','textarea'],['cutoff','Pre-order notice (shown on the pre-order page, item pages, cart and FAQ)','textarea','Write it how you want customers to read it, e.g. “Please order at least 3 days before pickup.”'],['refunds','Cancellation & refund policy','textarea'],['allergens','Allergen notice (shown below the menu)','textarea']]],
 ['Contact & social', [['email','Contact email','email'],['phone','Phone','text'],['instagram','Instagram profile link','url'],['facebook','Facebook profile link','url']]],
 ['Homepage · About Cindy', [['name','Bakery name','text'],['tagline','Tagline','text'],['heroHeading','Homepage headline','textarea'],['heroText','Homepage introduction','textarea'],['aboutHeading','Story headline','textarea'],['aboutText','About Cindy & Whisk','textarea'],['aboutNote','Additional story paragraph (optional)','textarea'],['footerNote','Footer note','text']]],
 ['Launch settings · ask Nate if unsure', [['demo','Sample / demo mode (blocks all payments)','checkbox'],['domain','Production domain','url','Leave empty until confirmed, e.g. https://example.com'],['basePath','Website subfolder','text','Usually blank. Use /whisk only for a repository-subfolder preview.'],['currency','Currency','select',{USD:'US dollars',CAD:'Canadian dollars',GBP:'British pounds',AUD:'Australian dollars',EUR:'Euros'}],['timezone','Business time zone','text','For example America/New_York. Confirm your actual location.'],['socialImage','Social sharing image path','text','Upload a 1200 × 630 image under assets/brand; use its path here.'],['socialImageAlt','Describe the sharing image','text']]]
];
const menuFields = [['name','Item name','text'],['category','Category','select',{Pastries:'Pastries',Cookies:'Cookies',Cakes:'Cakes',Pies:'Pies'}],['description','Description','textarea'],['price','Price','number'],['available','Show on the menu','checkbox'],['soldOut','Sold out','checkbox'],['featured','Feature on the homepage','checkbox'],['seasonal','Seasonal item','checkbox'],['dietary','Dietary tags, separated by commas','tags'],['allergens','Ingredients & allergens','textarea'],['notes','Extra notes / limited quantity message','textarea'],['storage','Storage or reheating advice','textarea'],['image','Photo file path','photo'],['imageAlt','Describe the photo','text'],['squareUrl','This item’s Square link','url'],['orderOpens','Ordering opens (optional)','datetime'],['orderCloses','Ordering closes (optional)','datetime']];
const eventFields = [['name','Location / venue name','text'],['address','Street address or venue details','text'],['start','Starts','datetime'],['end','Ends','datetime'],['status','Status','select',{confirmed:'Confirmed',tentative:'Tentative',cancelled:'Cancelled'}],['mapUrl','Directions link','url'],['description','A note about this stop','textarea'],['menuNote','Special menu note','textarea']];
function say(text,error=false){message.textContent=text;message.className=error?'error':'';}
function el(tag, text, cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function markDirty(){dirty=true;say(hosted?'Unsaved changes. Publish when you’re ready.':'Unsaved changes. Save & preview when you’re ready.');}
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
const extraCategories=new Set();
function field(def, object, prefix){
 const [key,label,type,options]=def;
 const wrapper=el('div',undefined,'field'+(type==='textarea'?' wide':''));
 const id=`${prefix}-${key}`;
 const title=el('label',label);title.htmlFor=id;wrapper.append(title);
 let input;
 if(type==='textarea')input=el('textarea');
 else if(type==='select'){input=el('select');const choices=key==='category'?Object.fromEntries([...new Set([...Object.keys(options),...[...data.menu,...(data.preorders||[])].map(item=>item.category),...extraCategories])].filter(Boolean).sort().map(value=>[value,value])):options;Object.entries(choices).forEach(([value,text])=>{const o=el('option',text);o.value=value;input.append(o);});}
 else{input=el('input');input.type= type==='datetime'?'datetime-local':['tags','photo'].includes(type)?'text':type;}
 input.id=id;input.name=id;
 if(type==='checkbox')input.checked=object[key];
 else input.value=type==='datetime'?localDate(object[key]):type==='tags'?object[key].join(', '):object[key]??'';
 if(type==='number'){input.min='0';input.step='0.01';input.required=true;}
 if(['name','category','start','end','timezone','pickupAt','closesAt'].includes(key))input.required=true;
 input.addEventListener('input',()=>{try{input.setCustomValidity('');object[key]=type==='datetime'?zonedDate(input.value):type==='checkbox'?input.checked:type==='number'?Number(input.value):type==='tags'?input.value.split(',').map(t=>t.trim()).filter(Boolean):input.value;markDirty();}catch(error){input.setCustomValidity(error.message);say(error.message,true);}});
 wrapper.append(input);
 if(key==='category'){
  const add=el('button','Add category','secondary');add.type='button';
  const row=el('div',undefined,'category-add');row.hidden=true;
  const name=el('input');name.type='text';name.maxLength=80;name.setAttribute('aria-label','New category name');
  const confirm=el('button','Use category','secondary');confirm.type='button';
  const cancel=el('button','Cancel','secondary');cancel.type='button';
  const apply=()=>{const value=name.value.trim().replace(/\s+/g,' ');if(!value){name.focus();return;}const existing=[...input.options].find(option=>option.value.toLowerCase()===value.toLowerCase());object.category=existing?existing.value:value;extraCategories.add(object.category);expandedItems.add(object.id);markDirty();render();document.getElementById(id)?.focus();};
  confirm.addEventListener('click',apply);name.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});
  cancel.addEventListener('click',()=>{row.hidden=true;add.hidden=false;add.focus();});
  add.addEventListener('click',()=>{row.hidden=false;add.hidden=true;name.focus();});
  row.append(name,confirm,cancel);wrapper.append(add,row,el('small','Choose an existing category or add a new one. It appears in the website filter after a visible item uses it and you publish.'));
 }

 if(type==='datetime')wrapper.append(el('small',['pickupAt','closesAt'].includes(key)?`Time zone: ${data.site.timezone}.`:`Time zone: ${data.site.timezone}. Optional ordering limits may be left empty. Configure the same limits in Square.`));
 if(typeof options==='string'){const help=el('small',options);help.id=id+'-help';input.setAttribute('aria-describedby',help.id);wrapper.append(help);}
 if(type==='photo'){
  wrapper.append(el('small','Website crop preview (4:3). Take a horizontal photo with the food centered and a little space around it. The website crops the edges to fit this same shape; your original photo is kept.'));
  if(object.image){const img=el('img',undefined,'photo-preview');img.src=photoSource(object.image);img.alt=object.imageAlt||'Current photo';wrapper.append(img);}
  if(local){const upload=el('input',undefined,'upload-button');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';upload.setAttribute('aria-label',`Upload photo for ${object.name}`);upload.addEventListener('change',async()=>{
   const file=upload.files[0];if(!file)return;
   if(file.size>5*1024*1024){say('Choose a JPG, PNG, or WebP smaller than 5 MB.',true);return;}
   uploadBusy(1);upload.disabled=true;say('Uploading photo… Please wait before publishing.');
   try{const res=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});const result=await responseData(res);if(!res.ok)throw Error(result.error);rememberPhoto(result.path,file);object.image=result.path;markDirty();render();say('Photo uploaded and previewed below. Add a description, then click Publish website to attach it to this item on the live menu.');}catch(error){say(error.message,true);}finally{uploadBusy(-1);upload.disabled=false;}
  });wrapper.append(upload);}
  else wrapper.append(el('small','Upload the photo to assets/food in GitHub, then enter its path here.'));
 }
 return wrapper;
}
function photoDeckEditor(object){
 if(object.squareVariationId)return el('p','Manage all photos for this linked item in Square. They sync in the same order, up to eight images.');
 const section=el('section',undefined,'field wide');section.append(el('h3','Additional photos'),el('small','Optional: add up to seven more photos. The main photo appears first. Menu photos rotate automatically; product pages also show thumbnails.'));
 const photos=object.photos||[];
 photos.forEach((photo,index)=>{
  const row=el('div',undefined,'extra-photo-row');const img=el('img',undefined,'photo-preview');img.src=photoSource(photo.image);img.alt=photo.alt;
  const label=el('label',`Describe photo ${index+2}`);const input=el('input');input.type='text';input.required=true;input.value=photo.alt;input.id=object.id+'-extra-'+index;label.htmlFor=input.id;
  input.addEventListener('input',()=>{input.setCustomValidity('');photo.alt=input.value;markDirty();});
  const remove=el('button','Remove photo','secondary');remove.type='button';remove.addEventListener('click',()=>{object.photos.splice(index,1);markDirty();render();});
  const up=el('button','Move earlier','secondary');up.type='button';up.disabled=index===0;up.addEventListener('click',()=>{[photos[index-1],photos[index]]=[photos[index],photos[index-1]];markDirty();render();});
  row.append(img,label,input,up,remove);section.append(row);
 });
 if(local&&photos.length<7){
  const label=el('label','Add more photos');const upload=el('input');upload.type='file';upload.multiple=true;upload.accept='image/jpeg,image/png,image/webp';upload.id=object.id+'-extra-upload';label.htmlFor=upload.id;
  upload.addEventListener('change',async()=>{
   const files=[...upload.files];if(files.length+photos.length>7){say('Choose at most seven additional photos in total.',true);return;}
   upload.disabled=true;uploadBusy(1);
   try{for(const file of files){if(file.size>5*1024*1024)throw Error('Each photo must be smaller than 5 MB.');const res=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});const result=await responseData(res);if(!res.ok)throw Error(result.error);rememberPhoto(result.path,file);object.photos??=[];object.photos.push({image:result.path,alt:''});markDirty();}say('Photos uploaded. Describe each photo, then save or publish.');}catch(error){say(error.message,true);}finally{uploadBusy(-1);render();}
  });section.append(label,upload);
 }
 return section;
}
function addFields(defs,object,prefix){const grid=el('div',undefined,'field-grid');defs.forEach(def=>grid.append(field(def,object,prefix)));if(defs.some(def=>def[2]==='photo'))grid.append(photoDeckEditor(object));return grid;}
// Pickup dates: Cindy adds each pickup day, its time window and when orders close. Customers only see dates still open.
const pickupFields=[['pickupAt','Pickup date & start time','datetime'],['window','Time window shown to customers (optional)','text','For example 10am–2pm. Leave empty to show the start time.'],['closesAt','Orders close','datetime']];
function pickupSection(){
 const section=el('section',undefined,'editor-section');section.append(el('h2','Pickup dates'),el('p','Customers choose one of these at checkout. Each date disappears from the cart once its orders close.'));
 const list=data.site.pickupDates;
 list.forEach((p,index)=>{
  const entry=el('div',undefined,'editor-entry');const past=p.closesAt&&Date.parse(p.closesAt)<=Date.now();
  entry.append(el('h3',past?'Pickup date (orders closed — hidden from customers)':'Pickup date'),addFields(pickupFields,p,p.id));
  const remove=el('button','Remove this date','secondary');remove.type='button';remove.addEventListener('click',()=>{list.splice(index,1);markDirty();render();});
  entry.append(remove);section.append(entry);
 });
 if(!list.length)section.append(el('p','No pickup dates yet. Add one so customers can check out.'));
 const add=el('button','Add a pickup date','secondary');add.type='button';add.addEventListener('click',()=>{list.push({id:'pickup-'+crypto.randomUUID().slice(0,8),pickupAt:'',closesAt:'',window:''});markDirty();render();});
 section.append(add);return section;
}
const expandedItems=new Set();
function render(){
 fields.replaceChildren();
 if(current==='preorders'){
  fields.append(el('p','Customers choose from the pickup dates you set under Bakery details → Pickup dates. Linked items get their name, price and photos from Square; edit ingredients, notes and visibility here.'));
 }
 if(hosted&&['menu','preorders'].includes(current)){const sync=el('button','Sync both menus from Square','secondary');sync.type='button';sync.addEventListener('click',()=>squarePanel(sync));fields.append(sync);}
 if(current==='site'){siteGroups.forEach(([heading,defs])=>{const section=el('section',undefined,'editor-section');section.append(el('h2',heading),addFields(defs,data.site,'site'));fields.append(section);});fields.append(pickupSection());}
 else{
  data[current].forEach((object,index)=>{
   const section=el('section',undefined,'editor-entry');
   const head=el('div',undefined,'entry-header');
   const panel=el('div',undefined,'entry-panel');panel.id=object.id+'-panel';
   const isMenu=['menu','preorders'].includes(current);
   let toggle;
   if(isMenu){
    section.classList.add('menu-entry');
    const thumb=el('img',undefined,'entry-thumbnail');thumb.alt='';thumb.src=object.image?photoSource(object.image):'';thumb.hidden=!object.image;head.append(thumb);
    const heading=el('h2');toggle=el('button',undefined,'entry-toggle');toggle.type='button';toggle.setAttribute('aria-controls',panel.id);
    const title=el('span',object.name||'New bake');const arrow=el('span','▸','entry-arrow');arrow.setAttribute('aria-hidden','true');toggle.append(title,arrow);heading.append(toggle);head.append(heading);
    const setOpen=open=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)expandedItems.add(object.id);else expandedItems.delete(object.id);};
    setOpen(expandedItems.has(object.id));toggle.addEventListener('click',()=>setOpen(panel.hidden));
    panel.addEventListener('invalid',()=>setOpen(true),true);
    panel.addEventListener('input',()=>{title.textContent=object.name||'New bake';thumb.hidden=!object.image;if(object.image)thumb.src=photoSource(object.image);});
   }else head.append(el('h2',object.name||'New entry'));
   const controls=el('div',undefined,'entry-controls');
   if(isMenu){
    const visibility=el('label',undefined,'entry-visibility');
    const check=el('input');check.type='checkbox';check.checked=object.available;check.id=object.id+'-available';check.name=check.id;
    check.setAttribute('aria-label','Show on menu — '+object.name);
    section.classList.toggle('item-hidden',!object.available);
    check.addEventListener('change',()=>{object.available=check.checked;section.classList.toggle('item-hidden',!check.checked);markDirty();});
    visibility.append(check,el('span','Show on menu'));controls.append(visibility);
   }
   [['Move up',-1],['Move down',1]].forEach(([text,step])=>{const b=el('button',isMenu?(step<0?'↑':'↓'):text);b.type='button';b.setAttribute('aria-label',text+' — '+object.name);b.title=text;b.disabled=index+step<0||index+step>=data[current].length;b.addEventListener('click',()=>{[data[current][index],data[current][index+step]]=[data[current][index+step],data[current][index]];if(['menu','preorders'].includes(current))data[current].forEach((v,i)=>v.position=i+1);markDirty();render();document.getElementById(object.id+'-panel')?.closest('.editor-entry').querySelector('.entry-toggle')?.focus();});controls.append(b);});
   const remove=el('button','Remove');remove.type='button';remove.className='secondary';remove.addEventListener('click',()=>{removeAction=()=>{data[current].splice(index,1);markDirty();render();};document.getElementById('remove-dialog').showModal();});
   if(object.squareVariationId){
    panel.append(el('p','Linked to Square. Name, price and photos update from Square. Manual sold-out and visibility controls stay here.'));
    const photos=[...(object.image?[{image:object.image,alt:object.imageAlt}]:[]),...(object.photos||[])];
    const gallery=el('div',undefined,'field wide');photos.forEach(photo=>{const img=el('img',undefined,'photo-preview');img.src=photoSource(photo.image);img.alt=photo.alt;gallery.append(img);});panel.append(gallery);
   }
   head.append(controls);panel.append(addFields(isMenu?menuFields.filter(def=>def[0]!=='available'&&(!object.squareVariationId||!['name','price','image','imageAlt','squareUrl'].includes(def[0]))&&(current==='preorders'||!['squareUrl','orderOpens','orderCloses'].includes(def[0]))):eventFields,object,object.id),remove);section.append(head,panel);fields.append(section);
  });
  if(!data[current].length)fields.append(el('p',['menu','preorders'].includes(current)?'No menu items yet. Add your first bake below.':'No stops planned yet. The website will show a friendly coming-soon note.'));
  const add=el('button',['menu','preorders'].includes(current)?'Add a baked good':'Add a stop','secondary');add.type='button';add.addEventListener('click',()=>{
   const id=(['menu','preorders'].includes(current)?'bake-':'stop-')+crypto.randomUUID().slice(0,8);
   data[current].push(['menu','preorders'].includes(current)?{id,name:'New bake',description:'',price:0,category:'Pastries',available:true,soldOut:false,featured:false,seasonal:false,dietary:[],allergens:'',image:'',imageAlt:'',imageShape:'square',squareUrl:'',notes:'',storage:'',orderOpens:'',orderCloses:'',position:data[current].length+1}:{id,name:'New stop',address:'',start:'',end:'',mapUrl:'',description:'',status:'tentative',menuNote:''});expandedItems.add(id);markDirty();render();const cards=fields.querySelectorAll('.editor-entry');cards[cards.length-1].querySelector('.entry-panel input').focus();});fields.append(add);
 }
}
document.querySelector('.editor-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(!button||!data)return;current=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();});
document.getElementById('confirm-remove').addEventListener('click',()=>{removeAction?.();document.getElementById('remove-dialog').close();});
document.getElementById('cancel-remove').addEventListener('click',()=>document.getElementById('remove-dialog').close());
form.noValidate=true;
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!local||!data)return;
 if(uploading){say('Wait for your photos to finish uploading, then publish.',true);return;}
 const missing=missingPhotoDescription();
 if(missing){
  current=missing.collection;expandedItems.add(missing.item.id);
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===current)));
  render();const input=document.getElementById(missing.id);
  input.setCustomValidity('Describe this photo before publishing.');input.focus();input.reportValidity();
  say('Not published yet: add a photo description for “'+missing.item.name+'”, then publish again.',true);return;
 }
 if(!form.reportValidity())return;
 const save=document.getElementById('save');save.disabled=true;say('Saving and checking your content…');
 try{const res=await fetch('/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision})});const result=await responseData(res);if(!res.ok)throw Error(result.error);revision=result.revision;dirty=false;say(hosted?(result.published?'Published to the repository. Cloudflare is rebuilding the website; allow a few minutes, then open View website to check. If it does not update, ask Nate to check the deployment.':'No content changes to publish.'):'Saved! Your local preview is ready. Open View website above to check it. Publish with GitHub Desktop when you’re happy.');}
 catch(error){say(error.message,true);}finally{save.disabled=false;}
});
document.getElementById('download').addEventListener('click',()=>{if(!form.reportValidity())return;const blob=new Blob([JSON.stringify(data[current],null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=current+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say(`Downloaded ${current}.json. This is a draft, not a published change. If you edited other tabs, download each of those too.`);});
document.getElementById('import').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{if(file.name!==current+'.json')throw Error(`Choose ${current}.json for this tab.`);const parsed=JSON.parse(await file.text());const valid=current==='site'?parsed&&typeof parsed==='object'&&!Array.isArray(parsed):Array.isArray(parsed);if(!valid)throw Error('That file has the wrong format.');if(current==='site'&&Object.keys(data.site).some(k=>!(k in parsed)))throw Error('That bakery file is missing fields.');if(current!=='site'&&parsed.some(item=>!item||typeof item!=='object'||typeof item.id!=='string'||typeof item.name!=='string'||(['menu','preorders'].includes(current)&&!Array.isArray(item.dietary))))throw Error('That file has incomplete entries.');data[current]=parsed;markDirty();render();say('Imported into your draft. Review the fields before saving.');}catch(error){say('Could not import: '+error.message,true);}event.target.value='';
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
(async()=>{
 try{
  // Authorization is enforced by the server, never inferred from the hostname.
  // No public JSON fallback: an expired/absent session must fail closed.
  const res=await fetch('/api/content',{credentials:'same-origin',cache:'no-store'});
  if(!res.headers.get('Content-Type')?.includes('application/json'))throw Error('The content request did not return editor data. Open /api/content in this signed-in browser to check its Access login or error page.');
  const result=await responseData(res);
  if(!res.ok)throw Error(typeof result.error==='string'?result.error:`Content request failed (${res.status}).`);
  data=result.data;data.site.showStandMenu??=true;data.site.pickupDates??=[];data.site.showPreorderMenu??=true;data.preorders??=[];revision=result.revision||'';local=result.capabilities?.write===true;hosted=result.capabilities?.mode==='publish';
  document.getElementById('save').textContent=hosted?'Publish website':'Save & preview';
  document.getElementById('publishing-help').textContent=hosted?'Publish website sends your changes to Cloudflare through the repository. The live site updates after its build succeeds. Uploaded photos are stored immediately; publish the item to show its photo on the menu.':'Save & preview updates this computer only. Publish those changes using GitHub Desktop. Downloading a file does not publish it.';
  document.getElementById('editor-mode').textContent=hosted?'Signed-in publishing · Edit products and stops, upload photos, then Publish website. Changes go live after Cloudflare finishes building.':local?'Local notebook · Save & preview updates this computer only. Your live site changes after you publish through GitHub Desktop.':'Authenticated download mode · Changes stay in this browser until downloaded. Publish through GitHub Desktop, or use Start Whisk.command for local saving. Hosted saves and uploads are disabled.';
  document.getElementById('save').disabled=!local;document.getElementById('download').disabled=false;render();
 }catch(error){document.getElementById('editor-mode').textContent='Content unavailable';say('The notebook could not load. '+error.message+' Ask Nate for help.',true);}
})();

// Show the server's step and status with every Square failure, so it is never silent or vague.
function squareFailure(result,status){const bits=[result?.step&&'step: '+result.step,result?.httpStatus&&'Square HTTP '+result.httpStatus,result?.squareCode&&'Square code '+result.squareCode,'server status '+status].filter(Boolean);return Error((typeof result?.error==='string'?result.error:'Square sync failed.')+' ['+bits.join(', ')+']');}
async function squarePanel(button){
 if(dirty||uploading){say('Publish or reload your draft before syncing Square.',true);return;}
 document.getElementById('square-preview')?.remove();
 button.disabled=true;say('Checking Square… nothing will change yet.');
 const call=async mode=>{const res=await fetch('/api/square/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,revision})});const result=await responseData(res);if(!res.ok)throw squareFailure(result,res.status);return result;};
 try{
  const {report}=await call('preview');
  const section=el('section',undefined,'editor-entry');section.id='square-preview';
  section.append(el('h3','Square sync preview'),el('p','Nothing has changed yet. Review the list, then choose Apply and publish.'));
  const group=(title,rows,line)=>{if(!rows.length)return;section.append(el('h4',title+' ('+rows.length+')'));const ul=el('ul');rows.forEach(r=>ul.append(el('li',line(r))));section.append(ul);};
  group('Will update from Square',report.updated,r=>r.name+' — '+r.menu+(r.changed.length?' (changes: '+r.changed.join(', ')+')':' (already up to date)'));
  group('Will add as new hidden items',report.added,r=>r.name+' — '+r.menu+'. Review it, then turn on “Show on the menu”.');
  group('Skipped',report.skipped,r=>r.name+' — '+r.reason);
  group('Linked on the website but no longer in Square (left unchanged)',report.notInSquare,r=>r.name+' — '+r.menu);
  if(!report.updated.length&&!report.added.length&&!report.skipped.length){const t=report.stats||{};section.append(el('p','Square connected, but sent no products to sync. Square has '+(t.items??'?')+' items, '+(t.itemsAtLocation??'?')+' at this location. If the second number is 0, SQUARE_LOCATION_ID is probably wrong. Items also need a fixed USD price.'));}
  const nothing=!report.updated.some(r=>r.changed.length)&&!report.added.length;
  if(nothing)section.append(el('p','Everything is already up to date. There is nothing to publish.'));
  else{
   const apply=el('button','Apply and publish');apply.type='button';apply.onclick=async()=>{
    if(dirty||uploading){say('Your draft changed. Publish it before syncing.',true);return;}
    const controls=[...document.querySelectorAll('input,select,textarea,button')];const states=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
    say('Publishing the Square sync…');
    try{await call('apply');location.reload();}
    catch(error){say(error.message,true);controls.forEach((c,i)=>c.disabled=states[i]);}
   };
   section.append(apply);
  }
  button.after(section);say('Square preview ready. Nothing has changed yet.');button.disabled=false;
 }catch(error){say(error.message,true);button.disabled=false;}
}
