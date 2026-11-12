import {SignJWT,jwtVerify} from 'jose';
import {squareImage} from './square-images.mjs';
// Server-only Square client. Customer requests never supply prices, API URLs or credentials.
import {PublishError, readLimited, digest} from './content.mjs';
// Optional extra fields (step, httpStatus, squareCode) are safe diagnostics: never tokens or request bodies.
const fail=(status,message,extra={})=>{throw Object.assign(new PublishError(status,message),extra);};
export const squareReady=env=>['sandbox','production'].includes(env.SQUARE_ENVIRONMENT)&&!!env.SQUARE_ACCESS_TOKEN&&!!env.SQUARE_LOCATION_ID;
export function squareClient(env,transport=(url,options)=>globalThis.fetch(url,options)){
 if(!squareReady(env))fail(503,'Square is not connected yet.');
 const origin=env.SQUARE_ENVIRONMENT==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
 async function api(path,body){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  let r;
  try{
   // Cloudflare Workers reject redirect:'error' (TypeError before any request is sent). Use 'manual' and check status below.
   r=await transport(origin+'/v2'+path,{method:body?'POST':'GET',redirect:'manual',signal:controller.signal,headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Square-Version':'2026-01-22','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }catch(error){
   fail(503,controller.signal.aborted?'Square request timed out. Please try again.':'Could not reach Square ('+String(error?.name||'Error')+': '+String(error?.message||'').slice(0,200)+').',{step:'square-request'});
  }finally{clearTimeout(timer);}
  if(r.status>=300&&r.status<400)fail(503,'Square answered with an unexpected redirect.',{step:'square-response',httpStatus:r.status});
  if(!r.ok){
   let squareCode='';try{squareCode=String((await r.json())?.errors?.[0]?.code||'').slice(0,80);}catch{}
   const info={step:'square-response',httpStatus:r.status,squareCode};
   if(r.status===401)fail(503,'Square rejected the access token. Check that SQUARE_ACCESS_TOKEN is a production token (SQUARE_ENVIRONMENT is production), then redeploy.',info);
   if(r.status===403)fail(503,'Square denied catalog access. Check the Square account permissions.',info);
   if(r.status===429)fail(503,'Square is rate limiting requests. Wait a minute and try again.',info);
   fail(503,'Square returned HTTP '+r.status+'.',info);
  }
  return r.json();
 }
 let stats;
 async function catalog(){
  const objects=[];let cursor;
  for(let page=0;page<20;page++){
   const result=await api('/catalog/list?types=ITEM,IMAGE,CATEGORY'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
   objects.push(...(result.objects||[]));cursor=result.cursor;if(!cursor)break;
  }
  if(cursor)fail(503,'Square catalog is too large for this connection.');
  const byId=new Map(objects.map(o=>[o.id,o])),products=[];
  const present=o=>!o.is_deleted&&(o.present_at_all_locations!==false||o.present_at_location_ids?.includes(env.SQUARE_LOCATION_ID))&&!o.absent_at_location_ids?.includes(env.SQUARE_LOCATION_ID);
  // Square categories MAINMENU / PREORDER choose the website menu; other categories (Pies, Cookies…) are for display.
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const catNames=d=>[...new Set([d.reporting_category?.id,...(d.categories||[]).map(c=>c?.id),d.category_id].filter(Boolean))].map(id=>byId.get(id)?.category_data?.name).filter(Boolean);
  const menuOf=d=>{const n=catNames(d).map(norm),pre=n.includes('preorder'),main=n.includes('mainmenu');return pre&&main?'both':pre?'preorder':main?'main':null;};
  const display=d=>catNames(d).find(n=>!['preorder','mainmenu'].includes(norm(n)))||'Pastries';
  for(const item of objects.filter(o=>o.type==='ITEM'&&present(o))){
   const d=item.item_data;if(!d||d.is_archived)continue;
   for(const variation of d.variations||[]){
    const v=variation.item_variation_data;if(!present(variation)||!v||v.sellable===false)continue;
    const override=v.location_overrides?.find(o=>o.location_id===env.SQUARE_LOCATION_ID);
    const price=override?.price_money||v.price_money;
    if((override?.pricing_type||v.pricing_type)!=='FIXED_PRICING'||!Number.isSafeInteger(price?.amount)||price.amount<=0||price.currency!=='USD')continue;
    const ids=[...new Set([...(v.image_ids||[]),...(d.image_ids||[])])];
    const photos=ids.map(id=>byId.get(id)?.image_data).filter(Boolean).map(p=>({image:p.url,alt:p.caption||d.name}));
    if(photos.some(p=>!squareImage(p.image)))fail(503,'A Square image uses an unrecognized host. Ask Nate to check it.');
    products.push({variationId:variation.id,itemId:item.id,name:d.name+((d.variations.length>1)?' — '+v.name:''),price:price.amount/100,currency:price.currency,category:display(d),menu:menuOf(d),photos,soldOut:override?.sold_out===true,trackInventory:override?.track_inventory??v.track_inventory??false,version:variation.version,description:d.description_plaintext||''});
   }
  }
  // Safe counts so an empty list can be explained (e.g. wrong SQUARE_LOCATION_ID).
  const allItems=objects.filter(o=>o.type==='ITEM');
  stats={objects:objects.length,items:allItems.length,itemsAtLocation:allItems.filter(present).length,products:products.length};
  return products;
 }
 return {api,catalog,get stats(){return stats;}};
}
export function mergeSquare(data,products,links=[]){
 const next=structuredClone(data);next.preorders??=[];
 const targets=new Set(),sources=new Set();
 for(const link of links){
  if(!link||typeof link.variationId!=='string'||typeof link.id!=='string')fail(400,'Invalid product link.');
  const {variationId,id}=link;
  if(sources.has(variationId)||(id&&targets.has(id)))fail(400,'Choose each Square and Whisk product only once.');
  sources.add(variationId);if(id)targets.add(id);
  if(!products.some(p=>p.variationId===variationId))fail(400,'Choose an available Square product.');
  let item=next.preorders.find(i=>i.id===id);
  if(!item){
   if(id)fail(400,'The Whisk item no longer exists.');
   if(next.preorders.some(i=>i.squareVariationId===variationId))continue;
   item={id:'square-'+variationId.toLowerCase().replace(/[^a-z0-9-]/g,''),name:'',description:'',price:0,category:'Pastries',available:false,soldOut:false,featured:false,seasonal:false,dietary:[],allergens:'',image:'',imageAlt:'',imageShape:'square',squareUrl:'',notes:'',storage:'',orderOpens:'',orderCloses:'',position:next.preorders.length+1};next.preorders.push(item);
  }
  item.squareVariationId=variationId;
 }
 const seen=new Set();
 for(const item of next.preorders){
  if(!item.squareVariationId)continue;
  if(seen.has(item.squareVariationId))fail(400,'Each Square variation can only be linked once.');seen.add(item.squareVariationId);
  const p=products.find(p=>p.variationId===item.squareVariationId);
  if(!p){item.available=false;continue;}
  if(p.photos.length>7+1)fail(400,'Use at most eight Square photos for '+p.name+'. No content was changed.');
  item.name=p.name;item.price=p.price;item.image=p.photos[0]?.image||'';item.imageAlt=p.photos[0]?.alt||'';item.photos=p.photos.slice(1);
  if(!item.description)item.description=p.description;
  if(item.id.startsWith('square-'))item.category=p.category;
 }
 return next;
}
// Automatic sync: Square products tagged MAINMENU or PREORDER are matched to website items by name
// (ignoring capitals, spaces and punctuation). Matches are linked and updated; unmatched products are added hidden.
// Website items with no Square match are left untouched. Nothing is deleted. Returns the new data plus a plain report.
const nameKey=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();
export function autoSyncSquare(data,products){
 const next=structuredClone(data);next.preorders??=[];
 const report={updated:[],added:[],skipped:[],notInSquare:[]};
 const lists={main:next.menu,preorder:next.preorders},label={main:'main menu',preorder:'pre-order menu'};
 const seenNames=new Set();
 for(const p of products){
  if(!p.menu){report.skipped.push({name:p.name,reason:'Not tagged MAINMENU or PREORDER in Square'});continue;}
  if(p.menu==='both'){report.skipped.push({name:p.name,reason:'Tagged both MAINMENU and PREORDER — pick one in Square'});continue;}
  const key=nameKey(p.name);
  if(seenNames.has(p.menu+key)){report.skipped.push({name:p.name,reason:'Two Square products have this name'});continue;}
  seenNames.add(p.menu+key);
  if(p.photos.length>8){report.skipped.push({name:p.name,reason:'More than eight photos in Square'});continue;}
  const other=lists[p.menu==='main'?'preorder':'main'].find(i=>i.squareVariationId===p.variationId);
  if(other){report.skipped.push({name:p.name,reason:'Already linked on the '+label[p.menu==='main'?'preorder':'main']+'; not moved automatically'});continue;}
  const list=lists[p.menu];
  let item=list.find(i=>i.squareVariationId===p.variationId);
  if(!item){
   const matches=list.filter(i=>!i.squareVariationId&&nameKey(i.name)===key);
   if(matches.length>1){report.skipped.push({name:p.name,reason:'Several website items on the '+label[p.menu]+' have this name'});continue;}
   item=matches[0];
  }
  const isNew=!item;
  if(isNew){
   item={id:'square-'+p.variationId.toLowerCase().replace(/[^a-z0-9-]/g,''),name:'',description:'',price:0,category:p.category,available:false,soldOut:false,featured:false,seasonal:false,dietary:[],allergens:'',image:'',imageAlt:'',imageShape:'square',squareUrl:'',notes:'',storage:'',orderOpens:'',orderCloses:'',position:list.length+1};
   if(list.some(i=>i.id===item.id)){report.skipped.push({name:p.name,reason:'A website item already uses this ID'});continue;}
   list.push(item);
  }
  const before={name:item.name,price:item.price,description:item.description,category:item.category,image:item.image,photos:JSON.stringify(item.photos||[])};
  item.squareVariationId=p.variationId;item.name=p.name;item.price=p.price;item.category=p.category||item.category;
  if(p.description)item.description=p.description;
  item.image=p.photos[0]?.image||'';item.imageAlt=p.photos[0]?.alt||'';item.photos=p.photos.slice(1);
  if(isNew){report.added.push({name:p.name,menu:label[p.menu]});continue;}
  const changed=['name','price','description','category','image'].filter(k=>before[k]!==item[k]);
  if(before.photos!==JSON.stringify(item.photos))changed.push('extra photos');
  report.updated.push({name:p.name,menu:label[p.menu],changed});
 }
 const live=new Set(products.map(p=>p.variationId));
 for(const [menu,list] of Object.entries(lists))for(const i of list)if(i.squareVariationId&&!live.has(i.squareVariationId))report.notInSquare.push({name:i.name,menu:label[menu]});
 return {data:next,report};
}
export async function jsonBody(request,max=16384){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')fail(415,'Expected JSON.');
 try{return JSON.parse(new TextDecoder().decode(await readLimited(request,max)));}catch(e){if(e instanceof PublishError)throw e;fail(400,'Invalid request.');}
}
export function pickupSlots(env,now=Date.now()){
 let slots;try{slots=JSON.parse(env.SQUARE_PICKUP_SLOTS||'[]');}catch{fail(503,'Pickup dates are not configured.');}
 if(!Array.isArray(slots)||slots.length>100)fail(503,'Pickup dates are not configured.');
 return slots.filter(s=>s&&typeof s.at==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s.at)&&typeof s.label==='string'&&s.label.length<160&&Date.parse(s.at)>=now+3*86400000&&Date.parse(s.at)<=now+7*86400000).map(s=>({at:s.at,label:s.label}));
}
export async function verifySquareWebhook(request,env){
 if(!env.SQUARE_WEBHOOK_SIGNATURE_KEY||request.url!==env.SQUARE_WEBHOOK_URL)fail(403,'Webhook unavailable.');
 const bytes=await readLimited(request,128*1024),body=new TextDecoder().decode(bytes);
 let signature;try{signature=Uint8Array.from(atob(request.headers.get('x-square-hmacsha256-signature')||''),c=>c.charCodeAt(0));}catch{fail(403,'Invalid signature.');}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(env.SQUARE_WEBHOOK_URL+body)))fail(403,'Invalid signature.');
 let event;try{event=JSON.parse(body);}catch{fail(400,'Invalid event.');}
 if(!env.SQUARE_MERCHANT_ID||event.merchant_id!==env.SQUARE_MERCHANT_ID)fail(403,'Wrong merchant.');
 return event;
}
export async function checkout(request,env,data,client=squareClient(env),now=Date.now()){
 if(data.site.showPreorderMenu===false||env.SQUARE_CHECKOUT_ENABLED!=='true'||!data.site.orderingEnabled)fail(503,'Pre-order checkout is not open yet.');
 if((env.SQUARE_CHECKOUT_SESSION_SECRET||'').length<32)fail(503,'Checkout is not configured.');
 const input=await jsonBody(request);
 if(!input||!Array.isArray(input.items)||!input.items.length||input.items.length>20||!/^[a-f0-9-]{36}$/i.test(input.key||''))fail(400,'Check your cart and try again.');
 const slot=pickupSlots(env,now).find(s=>s.at===input.pickupAt);if(!slot)fail(400,'Choose an available pickup date, three to seven days ahead.');
 const recipient=input.recipient;
 if(!recipient||typeof recipient.name!=='string'||!recipient.name.trim()||recipient.name.length>100||typeof recipient.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)||recipient.email.length>254||typeof recipient.phone!=='string'||!/^\+?[0-9 ()-]{7,30}$/.test(recipient.phone))fail(400,'Enter your name, email and phone number for pickup.');
 const within=o=>(!o.orderOpens||Date.parse(o.orderOpens)<=now)&&(!o.orderCloses||Date.parse(o.orderCloses)>now);
 if(!within(data.site))fail(409,'Pre-orders are closed.');
 const products=await client.catalog(),lines=[],seen=new Set();
 for(const entry of input.items){
  const item=data.preorders?.find(i=>i.id===entry.id),p=products.find(p=>p.variationId===item?.squareVariationId);
  if(!item||!item.available||item.soldOut||!within(item)||!p||p.soldOut||seen.has(entry.id)||!Number.isInteger(entry.quantity)||entry.quantity<1||entry.quantity>20)fail(409,'An item is no longer available. Refresh your cart.');
  seen.add(entry.id);
  if(entry.unitPrice!==Math.round(p.price*100))fail(409,'A price has changed in Square. Refresh your cart to review it before checkout.');
  // Hosted links do not reserve stock. Fail closed for scarce-stock products until reservations exist.
  if(p.trackInventory)fail(409,'This item needs stock confirmation. Please contact Cindy before ordering.');
  lines.push({catalog_object_id:p.variationId,quantity:String(entry.quantity)});
 }
 const payload={location_id:env.SQUARE_LOCATION_ID,line_items:lines,pricing_options:{auto_apply_taxes:true},fulfillments:[{type:'PICKUP',state:'PROPOSED',pickup_details:{schedule_type:'SCHEDULED',pickup_at:slot.at,recipient:{display_name:recipient.name.trim(),email_address:recipient.email,phone_number:recipient.phone},note:'Whisk pre-order'}}]};
 const hash=await digest(new TextEncoder().encode(JSON.stringify({key:input.key,payload})));
 const result=await client.api('/online-checkout/payment-links',{idempotency_key:hash,order:payload,checkout_options:{redirect_url:'https://'+env.ADMIN_HOSTNAME+'/cart/?checkout=returned',allow_tipping:false},pre_populated_data:{buyer_email:recipient.email}});
 const link=result.payment_link;
 if(!link?.url||!/^https:\/\/(square\.link|checkout\.square\.site)\//.test(link.url))fail(503,'Square did not return a checkout link. Please try again.');
 if(!link.order_id)fail(503,'Square did not return an order.');
 const token=await new SignJWT({order:link.order_id}).setProtectedHeader({alg:'HS256'}).setIssuer('whisk-checkout').setAudience(env.ADMIN_HOSTNAME).setIssuedAt().setExpirationTime('24h').sign(new TextEncoder().encode(env.SQUARE_CHECKOUT_SESSION_SECRET));
 return {url:link.url,cookie:'__Host-whisk-checkout='+token+'; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400'};
}

// A return URL alone never proves payment. The signed cookie identifies only this buyer's order.
export async function orderStatus(request,env,client=squareClient(env)){
 const token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-whisk-checkout='))?.split('=')[1];
 if(!token||(env.SQUARE_CHECKOUT_SESSION_SECRET||'').length<32)fail(401,'No checkout session found. Check your Square receipt.');
 let payload;try{({payload}=await jwtVerify(token,new TextEncoder().encode(env.SQUARE_CHECKOUT_SESSION_SECRET),{algorithms:['HS256'],issuer:'whisk-checkout',audience:env.ADMIN_HOSTNAME}));}catch{fail(401,'Checkout session expired. Check your Square receipt.');}
 if(typeof payload.order!=='string'||!/^[A-Za-z0-9_-]+$/.test(payload.order))fail(401,'Invalid checkout session.');
 const {order}=await client.api('/orders/'+encodeURIComponent(payload.order));
 if(!order||order.location_id!==env.SQUARE_LOCATION_ID)fail(503,'Order confirmation unavailable.');
 let paid=0;
 for(const tender of order.tenders||[]){
  if(!tender.payment_id)continue;
  const {payment}=await client.api('/payments/'+encodeURIComponent(tender.payment_id));
  if(payment?.status==='COMPLETED'&&payment.order_id===order.id&&payment.location_id===env.SQUARE_LOCATION_ID&&payment.total_money?.currency===order.total_money?.currency)paid+=payment.total_money.amount;
 }
 return {paid:Number.isSafeInteger(order.total_money?.amount)&&order.total_money.amount>0&&paid>=order.total_money.amount};
}
