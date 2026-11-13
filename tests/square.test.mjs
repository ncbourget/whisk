import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {squareClient,mergeSquare,autoSyncSquare,checkout,pickupSlots,verifySquareWebhook,orderStatus} from '../server/square.mjs';
import {squareImage} from '../server/square-images.mjs';
import {validateContent} from '../server/content.mjs';
import {createHandler} from '../server/handler.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/content.json',import.meta.url)));
const now=Date.parse('2026-11-11T12:00:00Z'),at='2026-11-15T12:00:00Z';
const env={SQUARE_ENVIRONMENT:'sandbox',SQUARE_ACCESS_TOKEN:'server-token',SQUARE_LOCATION_ID:'location',SQUARE_CHECKOUT_ENABLED:'true',ADMIN_HOSTNAME:'bakery.example',SQUARE_CHECKOUT_SESSION_SECRET:'test-only-not-a-real-secret-123456789',SQUARE_PICKUP_SLOTS:JSON.stringify([{at,label:'Sunday noon'}])};
const image='https://items-images-production.s3.us-west-2.amazonaws.com/photo.jpg';
const product={variationId:'V1',itemId:'I1',name:'Apple pie',price:32,category:'Pies',photos:[{image,alt:'Pie'},{image:image+'?second',alt:'Slice'}],soldOut:false,trackInventory:false};
function content(){const d=structuredClone(fixture);d.site.orderingEnabled=true;d.site.demo=false;d.site.domain='https://bakery.example';d.site.email='cindy@bakery.example';d.site.pickupDates=[{id:'p1',pickupAt:at,closesAt:'2026-11-14T12:00:00Z',window:'10am–2pm'}];d.preorders=[{...d.menu[0],id:'pie',available:true,soldOut:false,orderOpens:'',orderCloses:'',squareVariationId:'V1'}];return d;}
function request(input={}){return new Request('https://bakery.example/commerce/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'12345678-1234-1234-1234-123456789abc',items:[{id:'pie',quantity:2,unitPrice:3200}],pickupAt:at,recipient:{name:'Test Buyer',email:'test@example.com',phone:'+15555550123'},...input})});}
test('Catalog pagination maps variation prices and ordered photos, omitting unsupported products',async()=>{
 let calls=0;
 const client=squareClient(env,async(url,opts)=>{
  assert.ok(url.startsWith('https://connect.squareupsandbox.com/v2/catalog/list'));assert.equal(opts.headers.Authorization,'Bearer server-token');assert.equal(opts.redirect,'manual');calls++;
  return Response.json(calls===1?{objects:[{id:'I1',type:'ITEM',item_data:{name:'Pie',image_ids:['P1','P2'],variations:[{id:'V1',item_variation_data:{pricing_type:'FIXED_PRICING',price_money:{amount:3000,currency:'USD'},location_overrides:[{location_id:'location',price_money:{amount:3200,currency:'USD'},sold_out:true}]}},{id:'V2',item_variation_data:{pricing_type:'VARIABLE_PRICING'}}]}}],cursor:'next'}:{objects:['P1','P2'].map((id,i)=>({id,type:'IMAGE',image_data:{url:image+'?'+i,caption:id}}))});
 });
 const items=await client.catalog();assert.equal(calls,2);assert.equal(items.length,1);assert.equal(items[0].price,32);assert.equal(items[0].soldOut,true);assert.deepEqual(items[0].photos.map(p=>p.alt),['P1','P2']);
});
test('Sync preserves editor fields and photo order; new imports hidden; removed products hidden',()=>{
 const d=content();d.preorders[0].allergens='Wheat, milk';d.preorders[0].soldOut=true;
 const merged=mergeSquare(d,[product]);assert.equal(merged.preorders[0].allergens,'Wheat, milk');assert.equal(merged.preorders[0].soldOut,true);assert.equal(merged.preorders[0].price,32);assert.equal(merged.preorders[0].image,image);assert.equal(merged.preorders[0].photos[0].alt,'Slice');
 validateContent(merged,new Set(d.menu.map(i=>i.image)));
 assert.equal(mergeSquare(d,[]).preorders[0].available,false);
 const empty=content();empty.preorders=[];assert.equal(mergeSquare(empty,[product],[{id:'',variationId:'V1'}]).preorders[0].available,false);
 assert.throws(()=>mergeSquare(d,[product],[{id:'pie',variationId:'V1'},{id:'pie',variationId:'V1'}]));
 assert.throws(()=>mergeSquare(d,[{...product,photos:Array(9).fill(product.photos[0])}]));
 assert.equal(squareImage('https://evil.example/photo.jpg'),false);assert.equal(squareImage('https://square-cdn.com.evil.example/photo.jpg'),false);
});
test('Checkout uses catalog variation IDs and server pickup details with stable retry keys',async()=>{
 const calls=[];const client={catalog:async()=>[product],api:async(path,body)=>{calls.push({path,body});return {payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}};}};
 const result=await checkout(request(),env,content(),client,now);await checkout(request(),env,content(),client,now);
 assert.equal(result.url,'https://square.link/u/test');assert.ok(result.cookie.includes('HttpOnly'));
 assert.deepEqual(calls[0].body.order.line_items,[{catalog_object_id:'V1',quantity:'2',note:'Pickup: Sunday, November 15, 10am–2pm'}]);assert.equal(calls[0].body.pre_populated_data,undefined);assert.equal(calls[0].body.order.fulfillments[0].pickup_details.recipient.email_address,'test@example.com');assert.equal(calls[0].body.order.fulfillments[0].pickup_details.pickup_at,at);assert.equal(calls[0].body.idempotency_key,calls[1].body.idempotency_key);
});
test('Checkout fails closed for stale prices, invalid slots, hidden/deleted/sold-out products and scarce stock',async()=>{
 let sent=0;const client={catalog:async()=>[product],api:async()=>{sent++;}};
 await assert.rejects(checkout(request({items:[{id:'pie',quantity:2,unitPrice:1}]}),env,content(),client,now),e=>e.status===409);
 await assert.rejects(checkout(request({pickupAt:'2026-11-12T12:00:00Z'}),env,content(),client,now),e=>e.status===400);
 for(const change of [d=>d.preorders=[],d=>d.preorders[0].available=false,d=>d.preorders[0].soldOut=true,d=>d.site.orderingEnabled=false]){const d=content();change(d);await assert.rejects(checkout(request(),env,d,client,now));}
 const tracked=left=>({...client,catalog:async()=>[{...product,trackInventory:true}],stock:async()=>new Map([['V1',left]])});
 await assert.rejects(checkout(request(),env,content(),tracked(0),now),/sold out/);
 await assert.rejects(checkout(request(),env,content(),tracked(1),now),/Only 1 /);assert.equal(sent,0);
 assert.deepEqual(pickupSlots(content().site,now+8*86400000),[]);
 const demo=content();demo.site.demo=true;await assert.rejects(checkout(request(),env,demo,client,now),/not open/);
});
test('Payment confirmation requires a signed session and COMPLETED Square payment',async()=>{
 const client={catalog:async()=>[product],api:async()=>({payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}})};
 const {cookie}=await checkout(request(),env,content(),client,now);
 const req=new Request('https://bakery.example/commerce/order-status',{headers:{Cookie:cookie.split(';')[0]}});
 let status='PENDING';const verify={api:async path=>path.startsWith('/orders/')?{order:{id:'ORDER1',location_id:'location',total_money:{amount:6400,currency:'USD'},tenders:[{payment_id:'PAY1'}]}}:{payment:{status,order_id:'ORDER1',location_id:'location',total_money:{amount:6400,currency:'USD'}}}};
 assert.equal((await orderStatus(req,env,verify)).paid,false);status='COMPLETED';assert.equal((await orderStatus(req,env,verify)).paid,true);
 await assert.rejects(orderStatus(new Request(req.url),env,verify),e=>e.status===401);
});
test('Webhook rejects unsigned requests and verifies exact URL, body and merchant',async()=>{
 const cfg={SQUARE_WEBHOOK_URL:'https://bakery.example/commerce/square-webhook',SQUARE_WEBHOOK_SIGNATURE_KEY:'test-key',SQUARE_MERCHANT_ID:'M1'};
 const body=JSON.stringify({merchant_id:'M1',type:'catalog.version.updated'});
 await assert.rejects(verifySquareWebhook(new Request(cfg.SQUARE_WEBHOOK_URL,{method:'POST',body}),cfg),e=>e.status===403);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(cfg.SQUARE_WEBHOOK_SIGNATURE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(cfg.SQUARE_WEBHOOK_URL+body))).toString('base64');
 const req=()=>new Request(cfg.SQUARE_WEBHOOK_URL,{method:'POST',body,headers:{'x-square-hmacsha256-signature':sig}});
 assert.equal((await verifySquareWebhook(req(),cfg)).merchant_id,'M1');await assert.rejects(verifySquareWebhook(req(),{...cfg,SQUARE_MERCHANT_ID:'wrong'}));
});
test('Public commerce does not bypass editor authorization; unconfigured checkout remains closed',async()=>{
 const handle=createHandler({content:content(),editorHtml:'private',editorScript:'',editorStyle:''});
 const closed=await handle(new Request('https://bakery.example/commerce/catalog'),{ADMIN_HOSTNAME:'bakery.example'});assert.deepEqual(await closed.json(),{enabled:false,items:[],slots:[]});
 const forbidden=await handle(new Request('https://bakery.example/api/square/catalog'),env);assert.notEqual(forbidden.status,200);
 const cross=await handle(new Request('https://bakery.example/commerce/checkout',{method:'POST',headers:{Origin:'https://evil.example'}}),env);assert.equal(cross.status,403);
});

test('Square default transport preserves the fetch receiver', async t => {
  t.mock.method(globalThis, 'fetch', function () {
    assert.equal(this, globalThis);
    return Promise.resolve(Response.json({objects: []}));
  });
  assert.deepEqual(await squareClient(env).catalog(), []);
});

test('Square errors carry a safe step, HTTP status and Square code, never the token',async()=>{
 const client=squareClient(env,async()=>Response.json({errors:[{code:'UNAUTHORIZED'}]},{status:401}));
 await assert.rejects(client.catalog(),e=>e.step==='square-response'&&e.httpStatus===401&&e.squareCode==='UNAUTHORIZED'&&!e.message.includes('server-token'));
 const broken=squareClient(env,async()=>{throw new TypeError('boom');});
 await assert.rejects(broken.catalog(),e=>e.step==='square-request'&&e.message.includes('TypeError: boom'));
});

test('Catalog tags each product with its website menu from MAINMENU / PREORDER categories',async()=>{
 const objects=[
  {id:'CP',type:'CATEGORY',category_data:{name:'PREORDER'}},{id:'CM',type:'CATEGORY',category_data:{name:'MAINMENU'}},{id:'CPIE',type:'CATEGORY',category_data:{name:'Pies'}},
  ...[['A',['CP','CPIE']],['B',['CM']],['C',[]],['D',['CP','CM']]].map(([n,cats])=>({id:'I'+n,type:'ITEM',item_data:{name:n,categories:cats.map(id=>({id})),variations:[{id:'V'+n,item_variation_data:{pricing_type:'FIXED_PRICING',price_money:{amount:500,currency:'USD'}}}]}}))];
 const items=await squareClient(env,async()=>Response.json({objects})).catalog();
 assert.deepEqual(items.map(i=>[i.name,i.menu,i.category]),[['A','preorder','Pies'],['B','main','Pastries'],['C',null,'Pastries'],['D','both','Pastries']]);
});
test('Auto sync: name match ignores caps/spaces, adds unmatched hidden, skips untagged, never deletes',()=>{
 const d=content();
 const base=d.preorders[0];
 d.preorders=[{...base,id:'apple',name:'Apple Pie',squareVariationId:undefined,allergens:'Wheat'},{...base,id:'keep',name:'Handmade only',squareVariationId:undefined}];
 delete d.preorders[0].squareVariationId;delete d.preorders[1].squareVariationId;
 d.menu=[{...d.menu[0],id:'bun',name:'Morning bun'}];
 const p=(id,name,menu,extra={})=>({...product,variationId:id,name,menu,description:'From Square',...extra});
 const {data,report}=autoSyncSquare(d,[p('V1','  apple   PIE ','preorder'),p('V2','Morning Bun','main'),p('V3','Brand new cake','preorder'),p('V4','Gift card',null),p('V5','Confused','both')]);
 const apple=data.preorders.find(i=>i.id==='apple');
 assert.equal(apple.squareVariationId,'V1');assert.equal(apple.price,32);assert.equal(apple.allergens,'Wheat');assert.equal(apple.description,'From Square');
 assert.equal(data.menu[0].squareVariationId,'V2');
 const added=data.preorders.find(i=>i.squareVariationId==='V3');assert.equal(added.available,false);assert.equal(added.name,'Brand new cake');
 assert.ok(data.preorders.find(i=>i.id==='keep'&&!i.squareVariationId),'unmatched website item untouched');
 assert.equal(data.preorders.length,3);assert.equal(data.menu.length,1);
 assert.deepEqual(report.skipped.map(r=>r.name),['Gift card','Confused']);
 assert.equal(report.updated.length,2);assert.equal(report.added.length,1);
 validateContent(data,new Set(d.menu.map(i=>i.image)));
 assert.equal(d.preorders[0].squareVariationId,undefined,'input not modified');
});

test('Stock-tracked items can be bought up to Square\'s live count',async()=>{
 const calls=[];const client={catalog:async()=>[{...product,trackInventory:true}],stock:async ids=>{assert.deepEqual(ids,['V1']);return new Map([['V1',5]]);},api:async(path,body)=>{calls.push(body);return {payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}};}};
 await checkout(request(),env,content(),client,now);
 assert.deepEqual(calls[0].order.line_items,[{catalog_object_id:'V1',quantity:'2',note:'Pickup: Sunday, November 15, 10am–2pm'}]);
});
test('Stock lookup reads IN_STOCK counts for this location; missing counts are 0',async()=>{
 const client=squareClient(env,async(url,opts)=>{assert.ok(url.endsWith('/v2/inventory/counts/batch-retrieve'));const b=JSON.parse(opts.body);assert.deepEqual(b.location_ids,['location']);assert.deepEqual(b.states,['IN_STOCK']);
  return Response.json({counts:[{catalog_object_id:'V1',location_id:'location',state:'IN_STOCK',quantity:'10'},{catalog_object_id:'V1',location_id:'other',state:'IN_STOCK',quantity:'99'}]});});
 const counts=await client.stock(['V1','V2']);assert.equal(counts.get('V1'),10);assert.equal(counts.get('V2'),0);
 assert.equal((await client.stock([])).size,0);
});

test('Pickup dates come from the editor: closed or past dates hidden, sorted, labelled in the bakery time zone',()=>{
 const site={timezone:'America/New_York',pickupDates:[
  {id:'b',pickupAt:'2026-11-25T10:00:00-05:00',closesAt:'2026-11-22T18:00:00-05:00',window:'10am–2pm'},
  {id:'a',pickupAt:'2026-11-18T12:00:00-05:00',closesAt:'2026-11-15T18:00:00-05:00',window:''},
  {id:'closed',pickupAt:'2026-11-13T12:00:00-05:00',closesAt:'2026-11-10T18:00:00-05:00',window:''}]};
 const slots=pickupSlots(site,now);
 assert.deepEqual(slots.map(s=>s.at),['2026-11-18T12:00:00-05:00','2026-11-25T10:00:00-05:00']);
 assert.match(slots[0].label,/^Wednesday, November 18, 12:00\sPM \(order by Sun, Nov 15/);
 assert.match(slots[1].label,/10am–2pm/);
 assert.deepEqual(pickupSlots({},now),[]);
});
test('Special instructions reach the Square pickup note; overly long notes are refused',async()=>{
 const calls=[];const client={catalog:async()=>[product],api:async(path,body)=>{calls.push(body);return {payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}};}};
 await checkout(request({notes:'No nuts please,\nthank you'}),env,content(),client,now);
 assert.equal(calls[0].order.fulfillments[0].pickup_details.note,'Whisk pre-order — Special instructions: No nuts please, thank you');
 await assert.rejects(checkout(request({notes:'x'.repeat(401)}),env,content(),client,now),/400 characters/);
});
test('Content validation accepts editor pickup dates and rejects bad ones',()=>{
 const d=content();validateContent(d,new Set(d.menu.map(i=>i.image)));
 const bad=content();bad.site.pickupDates[0].closesAt='2026-11-16T12:00:00Z';assert.throws(()=>validateContent(bad,new Set(bad.menu.map(i=>i.image))),/close before/);
 const empty=content();empty.site.pickupDates[0].pickupAt='';assert.throws(()=>validateContent(empty,new Set(empty.menu.map(i=>i.image))),/pickup time/);
});

test('Checkout sends phone numbers in international format; Square errors show their code',async()=>{
 const calls=[];const client={catalog:async()=>[product],api:async(path,body)=>{calls.push(body);return {payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}};}};
 await checkout(request({recipient:{name:'Test Buyer',email:'buyer@example.com',phone:'(617) 750-4639'}}),env,content(),client,now);
 assert.equal(calls[0].order.fulfillments[0].pickup_details.recipient.phone_number,'+16177504639');
 const bad=squareClient(env,async()=>Response.json({errors:[{code:'INVALID_VALUE',field:'order.fulfillments[0]',detail:'Bad value'}]},{status:400}));
 await assert.rejects(bad.api('/online-checkout/payment-links',{}),/HTTP 400 \(INVALID_VALUE on order\.fulfillments\[0\]: Bad value\)/);
});

test('Checkout can live on a separate public hostname while the editor keeps its own',async()=>{
 const split={...env,ADMIN_HOSTNAME:'admin.example',PUBLIC_HOSTNAME:'www.bakery.example'};
 const calls=[];const client={catalog:async()=>[product],api:async(path,body)=>{calls.push(body);return {payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}};}};
 const {cookie}=await checkout(request(),split,content(),client,now);
 assert.equal(calls[0].checkout_options.redirect_url,'https://www.bakery.example/cart/?checkout=returned');
 const status=new Request('https://www.bakery.example/commerce/order-status',{headers:{Cookie:cookie.split(';')[0]}});
 await assert.doesNotReject(orderStatus(status,split,{api:async()=>({order:{id:'ORDER1',location_id:'location',tenders:[],total_money:{amount:100,currency:'USD'}}})}));
 const handle=createHandler({content:content(),editorHtml:'',editorScript:'',editorStyle:''});
 const wrongHost=await handle(new Request('https://admin.example/commerce/catalog'),split);
 assert.equal(wrongHost.status,403);
});

test('Pickup details go on each Square line item and into the signed confirmation',async()=>{
 const d=content();d.site.pickupDates[0].location='Town Green';
 const calls=[];const client={catalog:async()=>[product],api:async(path,body)=>{calls.push(body);return {payment_link:{url:'https://square.link/u/test',order_id:'ORDER1'}};}};
 const {cookie}=await checkout(request(),env,d,client,now);
 assert.match(calls[0].order.line_items[0].note,/^Pickup: Sunday, November 15, 10am–2pm at Town Green$/);
 const req=new Request('https://bakery.example/commerce/order-status',{headers:{Cookie:cookie.split(';')[0]}});
 const square={api:async path=>path.startsWith('/orders/')?{order:{id:'ORDER1',location_id:'location',tenders:[{payment_id:'P1'}],total_money:{amount:6400,currency:'USD'},line_items:[{name:'Apple pie',quantity:'2'}]}}:{payment:{status:'COMPLETED',order_id:'ORDER1',location_id:'location',total_money:{amount:6400,currency:'USD'},receipt_number:'snla',receipt_url:'https://squareup.com/receipt/preview/abc'}}};
 const r=await orderStatus(req,env,square);
 assert.equal(r.paid,true);assert.equal(r.receipt.number,'snla');assert.equal(r.when,'Sunday, November 15, 10am–2pm');assert.equal(r.location,'Town Green');assert.deepEqual(r.items,[{name:'Apple pie',quantity:'2'}]);
 const unpaid={api:async path=>path.startsWith('/orders/')?{order:{id:'ORDER1',location_id:'location',tenders:[],total_money:{amount:6400,currency:'USD'}}}:{}};
 assert.deepEqual(await orderStatus(req,env,unpaid),{paid:false});
});

test('Ordering windows give a specific reason in the cart and at checkout',async()=>{
 const client={catalog:async()=>[product],api:async()=>{throw Error('should not reach Square');}};
 const early=content();early.preorders[0].orderOpens='2026-11-13T12:00:00Z';early.site.timezone='America/New_York';
 await assert.rejects(checkout(request(),env,early,client,now),/The morning bun: Ordering opens Fri, Nov 13, 7:00\sAM/);
 const site=content();site.site.orderOpens='2026-11-13T12:00:00Z';site.site.timezone='America/New_York';
 await assert.rejects(checkout(request(),env,site,client,now),/Pre-orders: Ordering opens/);
 const hidden=content();hidden.preorders[0].available=false;
 await assert.rejects(checkout(request(),env,hidden,client,now),/no longer on the pre-order menu/);
});
