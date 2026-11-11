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
   input.addEventListener('change',()=>{const value=Number(input.value);if(Number.isInteger(value)&&value>=1&&value<=20){cart[id]=value;save();}else{input.value=q;say('Choose a quantity from 1 to 20.');}});label.append(input);row.append(label,node('span',money.format(p.price*q)));
   const remove=node('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+p.name);remove.onclick=()=>{delete cart[id];save();};row.append(remove);
   if(p.soldOut)row.append(node('p','Currently sold out. Remove this item before ordering.'));
   list.append(row);total+=Math.round(p.price*100)*q;
  }
  if(!Object.keys(cart).length)list.append(node('p','Your cart is empty. Find something sweet on the pre-order menu.'));
  updateCheckout();
  document.getElementById('cart-total').textContent='Subtotal: '+money.format(total/100)+' · taxes calculated at Square checkout';
 }
 document.querySelectorAll('[data-add-item]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.addItem,p=products.get(id),q=Number(document.getElementById('quantity').value);
  if(!p||p.soldOut)return;
  if(!Number.isInteger(q)||q<1||q>20||(cart[id]||0)+q>20){say('Choose up to 20 of each item.');return;}
  cart[id]=(cart[id]||0)+q;save();say(p.name+' added to your cart.');
 }));

 const form=document.getElementById('square-checkout'),status=document.getElementById('checkout-status');
 function updateCheckout(){
  if(!form)return;
  const entries=Object.entries(cart);
  form.querySelector('button').disabled=submitting||!commerce?.enabled||!commerce.slots.length||!entries.length||entries.some(([id])=>!products.get(id)?.linked||products.get(id)?.soldOut);
 }
 async function loadCommerce(){
  if(!form)return;
  try{
   const response=await fetch(data.base+'/commerce/catalog',{cache:'no-store'});if(!response.ok)throw Error();
   commerce=await response.json();
   if(!commerce.enabled){status.textContent='Checkout is not open yet. Your cart is saved for browsing.';return;}
   for(const p of products.values()){
    const live=commerce.items.find(i=>i.id===p.id);p.soldOut=!live||live.soldOut;
    if(live)p.price=live.price;
   }
   const select=form.elements.pickup;select.replaceChildren();
   const prompt=node('option','Choose a pickup date');prompt.value='';select.append(prompt);
   commerce.slots.forEach(slot=>{const option=node('option',slot.label);option.value=slot.at;select.append(option);});
   form.hidden=false;status.textContent=commerce.slots.length?'Review your cart, then choose a pickup date. Nothing is charged until you pay on Square.':'No pickup dates are currently available. Please check back.';render();
  }catch{status.textContent='Checkout is unavailable right now. Please try again later. Your cart is saved.';commerce=null;updateCheckout();}
 }
 if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();if(submitting||form.querySelector('button').disabled)return;
  submitting=true;updateCheckout();status.textContent='Checking prices and preparing Square checkout…';
  try{
   const payload={items:Object.entries(cart).map(([id,quantity])=>({id,quantity,unitPrice:Math.round(products.get(id).price*100)})),pickupAt:form.elements.pickup.value,recipient:{name:form.elements.name.value,email:form.elements.email.value,phone:form.elements.phone.value}};
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
 async function confirmReturn(){
  if(!status||new URLSearchParams(location.search).get('checkout')!=='returned')return;
  status.textContent='Checking your payment with Square…';
  try{
   const response=await fetch(data.base+'/commerce/order-status',{cache:'no-store'}),result=await response.json();
   if(!response.ok||!result.paid){status.textContent='Payment has not been confirmed here. Check your Square receipt before trying to pay again.';return;}
   const purchased=JSON.parse(sessionStorage.getItem('whisk-checkout-cart')||'null');
   if(purchased&&JSON.stringify(cart)===JSON.stringify(purchased)){cart={};save();sessionStorage.removeItem('whisk-checkout-cart');}
   status.textContent='Payment confirmed. Thank you! See your Square receipt for order details.';
  }catch{status.textContent='Unable to check payment here. Check your Square receipt before trying again.';}
 }
 loadCommerce().then(confirmReturn);
 window.addEventListener('storage',event=>{if(event.key===key)location.reload();});render();
})();
