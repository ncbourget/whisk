/* A browsing cart only. Prices and availability must be revalidated by the payment server. */
'use strict';
(()=>{
 const data=JSON.parse(document.getElementById('cart-data').textContent), key='whisk-cart-v1';
 const products=new Map(data.items.map(i=>[i.id,i]));
 let cart={};
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
   const link=node('a',p.name);link.href=data.base+'/menu/'+id+'/';row.append(link);
   const label=node('label','Quantity '),input=document.createElement('input');input.type='number';input.min=1;input.max=20;input.step=1;input.value=q;input.setAttribute('aria-label','Quantity for '+p.name);
   input.addEventListener('change',()=>{const value=Number(input.value);if(Number.isInteger(value)&&value>=1&&value<=20){cart[id]=value;save();}else{input.value=q;say('Choose a quantity from 1 to 20.');}});label.append(input);row.append(label,node('span',money.format(p.price*q)));
   const remove=node('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+p.name);remove.onclick=()=>{delete cart[id];save();};row.append(remove);
   if(p.soldOut)row.append(node('p','Currently sold out. Remove this item before ordering.'));
   list.append(row);total+=Math.round(p.price*100)*q;
  }
  if(!Object.keys(cart).length)list.append(node('p','Your cart is empty. Find something sweet on the menu.'));
  document.getElementById('cart-total').textContent='Sample subtotal: '+money.format(total/100)+' · taxes calculated at checkout when ordering opens';
 }
 document.querySelectorAll('[data-add-item]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.addItem,p=products.get(id),q=Number(document.getElementById('quantity').value);
  if(!p||p.soldOut)return;
  if(!Number.isInteger(q)||q<1||q>20||(cart[id]||0)+q>20){say('Choose up to 20 of each item.');return;}
  cart[id]=(cart[id]||0)+q;save();say(p.name+' added to your cart.');
 }));
 window.addEventListener('storage',event=>{if(event.key===key)location.reload();});render();
})();
