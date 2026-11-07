'use strict';
(()=>{
 const menu=document.getElementById('mobile-menu'),open=document.querySelector('.menu-toggle'),close=menu.querySelector('.menu-close');
 let openedAt=0;
 function restore(){open.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');open.focus({preventScroll:true});}
 open.addEventListener('click',()=>{if(menu.open)return;openedAt=performance.now();menu.showModal();open.setAttribute('aria-expanded','true');document.body.classList.add('menu-open');});
 close.addEventListener('click',()=>{if(performance.now()-openedAt<350)return;menu.close();});
 menu.addEventListener('close',restore);
 menu.addEventListener('click',event=>{if(event.target.closest('a'))menu.close();});
 window.matchMedia('(min-width: 701px)').addEventListener('change',event=>{if(event.matches&&menu.open)menu.close();});
})();

// Native select supports touch, keyboard, and screen-reader category filtering.
(()=>{
 const select=document.getElementById('menu-category');
 if(!select)return;
 const cards=[...document.querySelectorAll('#menu-items [data-category]')];
 function filter(){
  let count=0;
  cards.forEach(card=>{card.hidden=Boolean(select.value&&card.dataset.category!==select.value);if(!card.hidden)count++;});
  document.getElementById('menu-filter-status').textContent=`${count} ${count===1?'item':'items'} shown`;
 }
 select.closest('.menu-filter').hidden=false;
 select.addEventListener('change',filter);
 filter();
})();

// Facebook's plugin needs an explicit pixel width, including on narrow screens.
(()=>{
 const frame=document.querySelector('.social-feed iframe[src^="https://www.facebook.com/plugins/page.php"]');
 if(!frame)return;
 let previous=0;
 const observer=new ResizeObserver(()=>{
  const width=Math.min(500,Math.floor(frame.getBoundingClientRect().width));
  if(width<180||width===previous)return;
  previous=width;
  const url=new URL(frame.src);url.searchParams.set('width',String(width));url.searchParams.set('height',String(Math.round(frame.getBoundingClientRect().height)));frame.src=url.href;
 });
 observer.observe(frame);
})();

// The photo remains a normal image link if JavaScript is unavailable.
(()=>{
 const link=document.querySelector('.about-photo-zoom');
 if(!link)return;
 const dialog=document.createElement('dialog');dialog.className='photo-lightbox';dialog.setAttribute('aria-label','Photo of Cindy');
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close enlarged photo');
 const img=document.createElement('img');img.alt=link.querySelector('img').alt;
 dialog.append(close,img);document.body.append(dialog);
 let previousOverflow='';
 link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();img.src=link.href;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();});
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;link.focus({preventScroll:true});});
})();

// Decorative previews never change the link or product information.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.querySelectorAll('[data-more-tile]').forEach(tile=>{
  const images=[...tile.querySelectorAll('img')];if(images.length<2)return;
  let index=0,visible=false;
  tile.classList.add('more-ready');
  images.forEach((image,n)=>{image.hidden=false;image.classList.toggle('is-active',n===0);});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(tile);
  setInterval(()=>{
   if(reduced.matches||document.hidden||!visible||tile.matches(':hover,:focus-within'))return;
   const next=(index+1)%images.length;
   images[next].loading='eager';
   if(!images[next].complete||!images[next].naturalWidth)return;
   images[index].classList.remove('is-active');images[next].classList.add('is-active');index=next;
  },5000);
 });
})();

// Optional product photos share a three-second crossfade on cards and detail pages.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.querySelectorAll('[data-card-slideshow],[data-product-gallery]').forEach(gallery=>{
  const images=[...gallery.querySelectorAll('.product-frames>img')];
  const buttons=[...gallery.querySelectorAll('[data-photo-index]')];
  if(images.length<2)return;
  let index=0,visible=false,lastChange=0;
  gallery.classList.add('gallery-ready');
  const show=next=>{
   images.forEach((image,n)=>{image.classList.toggle('is-active',n===next);image.setAttribute('aria-hidden',String(n!==next));});
   buttons.forEach((button,n)=>button.setAttribute('aria-pressed',String(n===next)));
   index=next;lastChange=performance.now();
  };
  images.forEach(image=>{image.hidden=false;});show(0);
  buttons.forEach((button,n)=>button.addEventListener('click',()=>show(n)));
  new IntersectionObserver(entries=>{
   visible=entries[0].isIntersecting;
   if(visible){images.forEach(image=>{image.loading='eager';});lastChange=performance.now();}
  }).observe(gallery);
  setInterval(()=>{
   if(reduced.matches||document.hidden||!visible||gallery.closest('[hidden]')||performance.now()-lastChange<3000)return;
   const next=(index+1)%images.length;
   if(images[next].complete&&images[next].naturalWidth)show(next);
  },100);
 });
})();
