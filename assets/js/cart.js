/* A browsing cart only. Prices and availability must be revalidated by the payment server. */
'use strict';
(()=>{
 const data=JSON.parse(document.getElementById('cart-data').textContent), key='whisk-preorder-cart-v1';
 const products=new Map(data.items.map(i=>[i.id,i]));
 let cart={}, commerce=null, submitting=false;
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const [id,q] of Object.entries(saved||{}))if(products.has(id)&&Number.isInteger(q)&&q>0&&q<=20)cart[id]=q;}catch{}
 const money=new Intl.NumberFormat('en-US',{style:'currency',currency:data.currency});
 const say=t=>{const n=document.getElementById('cart-message');if(n)n.textContent=t;};
 function save(){try{localStorage.setItem(key,JSON.stringify(cart));}catch{say('Your browser cannot save this cart. Keep this page open.');}render();}
 function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
 function render(){
  document.querySelectorAll('[data-cart-count]').forEach(n=>n.textContent=Object.values(cart).reduce((a,b)=>a+b,0));
  const list=document.getElementById('cart-items');if(!list)return;list.replaceChildren();let total=0;
  for(const [id,q] of Object.entries(cart)){
   const p=products.get(id),row=node('article','');row.className='cart-row';
   const link=node('a',p.name);link.href=data.base+'/preorder/'+id+'/';row.append(link);
   const label=node('label','Quantity '),input=document.createElement('input');input.type='number';input.min=1;input.max=20;input.step=1;input.value=q;input.setAttribute('aria-label','Quantity for '+p.name);
   const max=Math.min(20,p.left??20);if(p.left!=null)input.max=Math.max(1,max);
   input.addEventListener('change',()=>{const value=Number(input.value);if(Number.isInteger(value)&&value>=1&&value<=max){cart[id]=value;save();}else{input.value=q;say(p.left!=null?'Only '+p.left+' left of '+p.name+'.':'Choose a quantity from 1 to 20.');}});label.append(input);row.append(label,node('span',money.format(p.price*q)));
   const remove=node('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+p.name);remove.onclick=()=>{delete cart[id];save();};row.append(remove);
   if(p.soldOut)row.append(node('p','Currently sold out. Remove this item before ordering.'));
   else if(p.notice)row.append(node('p',p.notice+'.'));
   else if(p.left!=null&&q>p.left)row.append(node('p','Only '+p.left+' left. Lower the quantity before ordering.'));
   list.append(row);total+=Math.round(p.price*100)*q;
  }
  if(!Object.keys(cart).length)list.append(node('p','Your cart is empty. Find something sweet on the pre-order menu.'));
  updateCheckout();
  document.getElementById('cart-total').textContent='Subtotal: '+money.format(total/100)+' · taxes calculated at Square checkout';
 }
 document.querySelectorAll('[data-add-item]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.addItem,p=products.get(id),q=Number(document.getElementById('quantity').value);
  if(!p||p.soldOut||blocked(p))return;
  if(!Number.isInteger(q)||q<1||q>20||(cart[id]||0)+q>20){say('Choose up to 20 of each item.');return;}
  cart[id]=(cart[id]||0)+q;save();say(p.name+' added to your cart.');
 }));

 const form=document.getElementById('square-checkout'),status=document.getElementById('checkout-status');
 function updateCheckout(){
  if(!form)return;
  const entries=Object.entries(cart);
  form.querySelector('button').disabled=submitting||!commerce?.enabled||!commerce.slots.length||!entries.length||!!commerce?.notice||entries.some(([id,q])=>!!products.get(id)?.notice||!products.get(id)?.linked||products.get(id)?.soldOut||(products.get(id)?.left!=null&&q>products.get(id).left));
 }
 async function loadCommerce(){
  if(!form)return;
  try{
   const response=await fetch(data.base+'/commerce/catalog',{cache:'no-store'});if(!response.ok)throw Error();
   commerce=await response.json();
   if(!commerce.enabled){status.textContent='Checkout is not open yet. Your cart is saved for browsing.';return;}
   for(const p of products.values()){
    const live=commerce.items.find(i=>i.id===p.id);p.soldOut=!live||live.soldOut;
    if(live){p.price=live.price;p.left=live.left;p.notice=live.notice||null;}
   }
   const select=form.elements.pickup;select.replaceChildren();
   const prompt=node('option','Choose a pickup date');prompt.value='';select.append(prompt);
   commerce.slots.forEach(slot=>{const option=node('option',slot.label);option.value=slot.at;select.append(option);});
   const where=document.getElementById('pickup-where');
   const showWhere=()=>{const slot=commerce.slots.find(s=>s.at===select.value);if(where){where.hidden=!slot?.location;where.textContent=slot?.location?'Pickup at '+slot.location:'';}};
   select.addEventListener('change',showWhere);showWhere();
   form.hidden=false;status.textContent=commerce.notice?'Pre-orders: '+commerce.notice+'. Your cart is saved.':commerce.slots.length?'Review your cart, then choose a pickup date. Nothing is charged until you pay on Square.':'No pickup dates are currently available. Please check back.';render();
  }catch{status.textContent='Checkout is unavailable right now. Please try again later. Your cart is saved.';commerce=null;updateCheckout();}
 }
 if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();if(submitting||form.querySelector('button').disabled)return;
  submitting=true;updateCheckout();status.textContent='Checking prices and preparing Square checkout…';
  try{
   const payload={items:Object.entries(cart).map(([id,quantity])=>({id,quantity,unitPrice:Math.round(products.get(id).price*100)})),pickupAt:form.elements.pickup.value,recipient:{name:form.elements.name.value,email:form.elements.email.value,phone:form.elements.phone.value},notes:form.elements.notes?.value||''};
   // Retry the same request with the same key, without persisting personal information.
   const fingerprint=JSON.stringify(payload);
   if(form._checkoutFingerprint!==fingerprint){form._checkoutFingerprint=fingerprint;form._checkoutKey=crypto.randomUUID();}
   payload.key=form._checkoutKey;
   const response=await fetch(data.base+'/commerce/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();
   if(!response.ok)throw Error(result.error||'Checkout is unavailable.');
   sessionStorage.setItem('whisk-checkout-cart',JSON.stringify(cart));
   location.assign(result.url);
  }catch(error){status.textContent=error.message+' Reload this page to refresh prices and availability.';submitting=false;updateCheckout();}
 });
 // After Square payment: show a clear "You're all set" screen with pickup details.
 function showConfirmation(r){
  const main=document.querySelector('main');if(!main)return;
  const section=document.createElement('section');section.className='order-confirmed';
  const first=(r.name||'').split(' ')[0];
  section.append(node('p','Order confirmed'));section.firstChild.className='mono';
  section.append(node('h1','You’re all set'+(first?', '+first:'')+'.'));
  if(r.receipt?.number)section.append(node('p','Order #'+r.receipt.number+' · keep this number for pickup.'));
  const list=document.createElement('dl');list.className='order-facts';
  const fact=(term,value)=>{if(!value)return;list.append(node('dt',term),node('dd',value));};
  fact('Pickup',r.when);fact('Where',r.location||r.pickupInstructions);
  const maps=r.location?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(r.location):'';
  const items=(r.items||[]).map(i=>(i.quantity&&i.quantity!=='1'?i.quantity+' × ':'')+i.name).join(', ');
  fact('Your order',items);
  if(Number.isSafeInteger(r.total?.amount))fact('Paid',new Intl.NumberFormat('en-US',{style:'currency',currency:r.total.currency||'USD'}).format(r.total.amount/100));
  section.append(list);
  section.append(node('p','Square has emailed your receipt. Questions or changes? Contact Cindy.'));
  const actions=document.createElement('div');actions.className='page-actions';
  const link=(href,label)=>{const a=document.createElement('a');a.className='action-link';a.href=href;const l=node('span',label);l.className='action-label';const arrow=node('span','↗');arrow.className='action-arrow';arrow.setAttribute('aria-hidden','true');a.append(l,arrow);actions.append(a);};
  if(maps)link(maps,'get directions');
  if(r.receipt?.url)link(r.receipt.url,'view receipt');
  link(data.base+'/contact/','contact cindy');link(data.base+'/','back to whisk');
  section.append(actions);
  main.replaceChildren(section);document.title='Order confirmed | Whisk';window.scrollTo(0,0);
 }
 async function confirmReturn(){
  if(!status||new URLSearchParams(location.search).get('checkout')!=='returned')return;
  status.textContent='Checking your payment with Square…';
  // Square can take a moment to record the payment, so check a few times before giving up.
  for(let attempt=0;attempt<4;attempt++){
   try{
    const response=await fetch(data.base+'/commerce/order-status',{cache:'no-store'}),result=await response.json();
    if(response.ok&&result.paid){
     const purchased=JSON.parse(sessionStorage.getItem('whisk-checkout-cart')||'null');
     if(purchased&&JSON.stringify(cart)===JSON.stringify(purchased)){cart={};save();sessionStorage.removeItem('whisk-checkout-cart');}
     showConfirmation(result);return;
    }
    if(response.status===401){status.textContent=result.error||'Payment has not been confirmed here. Check your Square receipt before trying to pay again.';return;}
   }catch{}
   await new Promise(r=>setTimeout(r,2000));
  }
  status.textContent='Payment has not been confirmed here yet. Check your Square receipt email before trying to pay again.';
 }
 // ---- Live item status: sold out, "only N left", countdown until ordering opens, ordering closed ----
 const time=v=>{const t=v?Date.parse(v):NaN;return Number.isFinite(t)?t:null;};
 const opensAt=p=>Math.max(time(data.siteOpens)||0,time(p.orderOpens)||0)||null;
 const closesAt=p=>{const t=[time(data.siteCloses),time(p.orderCloses)].filter(Boolean);return t.length?Math.min(...t):null;};
 function itemStatus(p,now=Date.now()){
  if(!p)return null;
  if(p.soldOut||p.left===0)return {kind:'soldout'};
  const opens=opensAt(p),closes=closesAt(p);
  if(opens&&opens>now)return {kind:'soon',at:opens};
  if(closes&&closes<=now)return {kind:'closed'};
  if(p.left!=null&&p.left<=3)return {kind:'low',left:p.left};
  return null;
 }
 function blocked(p){const s=itemStatus(p);return !!s&&s.kind!=='low';}
 let zone=data.timezone||'America/New_York';try{new Intl.DateTimeFormat('en-US',{timeZone:zone});}catch{zone='America/New_York';}
 const when=t=>new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(t));
 const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),pad=n=>String(n).padStart(2,'0');return (d?d+'d ':'')+pad(Math.floor(s%86400/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60);};
 function paint(holder,p,now){
  const photo=holder.matches('.item-photo')?holder:holder.querySelector('.bake-photo');if(!photo)return;
  const s=itemStatus(p,now);
  let overlay=photo.querySelector('.status-overlay'),badge=photo.querySelector('.status-badge');
  if(s&&s.kind==='low'){overlay?.remove();if(!badge){badge=node('span','');badge.className='status-badge';photo.append(badge);}badge.textContent='Only '+s.left+' left';}
  else badge?.remove();
  if(!s||s.kind==='low')overlay?.remove();
  else{
   if(!overlay){overlay=document.createElement('span');overlay.className='status-overlay';overlay.setAttribute('aria-hidden','true');photo.append(overlay);}
   overlay.dataset.kind=s.kind;
   const parts=s.kind==='soldout'?[['strong','Sold out']]:s.kind==='closed'?[['strong','Ordering closed']]:[['span','Opens in'],['strong',clock(s.at-now)],['span',when(s.at)]];
   overlay.replaceChildren(...parts.map(([tag,text])=>node(tag,text)));
  }
  const button=document.querySelector('[data-add-item="'+CSS.escape(p.id)+'"]');
  if(button&&holder.matches('.item-photo')){
   button.disabled=!!s&&s.kind!=='low';
   button.textContent=!s||s.kind==='low'?'Add to cart':s.kind==='soldout'?'Sold out':s.kind==='closed'?'Ordering closed':'Opens '+when(s.at);
  }
 }
 const holders=[...document.querySelectorAll('[data-item]')],strip=document.querySelector('[data-launch-strip]');
 function paintStrip(now){
  if(!strip)return;
  // The banner follows only the site-wide "Ordering opens / closes" times from the editor.
  const opens=time(data.siteOpens),closes=time(data.siteCloses);
  let label,target;
  if(opens&&opens>now){label='Pre-orders open in';target=opens;}
  else if(closes&&closes>now){label='Pre-orders close in';target=closes;}
  if(!target){strip.hidden=true;return;}
  strip.replaceChildren(node('span',label),node('strong',clock(target-now)),node('span',when(target)));strip.hidden=false;
 }
 function paintAll(){const now=Date.now();holders.forEach(h=>paint(h,products.get(h.dataset.item),now));paintStrip(now);}
 if(holders.length||strip){
  paintAll();setInterval(paintAll,1000);
  // Live sold-out and stock counts from Square (the cart page loads these through loadCommerce instead).
  if(!form)fetch(data.base+'/commerce/catalog',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(live=>{
   for(const l of live?.items||[]){const p=products.get(l.id);if(p){p.soldOut=!!l.soldOut;p.left=l.left??null;}}paintAll();
  }).catch(()=>{});
 }
 loadCommerce().then(confirmReturn);
 // An item or menu page left open in a tab (or restored with Back) re-checks itself with the server.
 // If the item was hidden or its menu turned off, the page is replaced by the current "unavailable" message.
 if(/^\/(menu|preorder)\//.test(location.pathname.slice(data.base.length))){
  let last=0;
  const recheck=async()=>{
   if(Date.now()-last<30000)return;last=Date.now();
   try{
    const response=await fetch(location.pathname,{cache:'no-store'});
    if(response.status===404||response.status===410){const page=new DOMParser().parseFromString(await response.text(),'text/html'),fresh=page.querySelector('main'),main=document.querySelector('main');if(fresh&&main){main.replaceWith(document.adoptNode(fresh));document.title=page.title||document.title;}}
   }catch{}
  };
  window.addEventListener('pageshow',event=>{if(event.persisted){last=0;recheck();}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')recheck();});
 }
 window.addEventListener('storage',event=>{if(event.key===key)location.reload();});render();
})();
