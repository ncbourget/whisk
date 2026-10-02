'use strict';
(()=>{
 const menu=document.getElementById('mobile-menu'),open=document.querySelector('.menu-toggle'),close=menu.querySelector('.menu-close');
 let openedAt=0;
 function restore(){open.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');open.focus();}
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
  const url=new URL(frame.src);url.searchParams.set('width',String(width));frame.src=url.href;
 });
 observer.observe(frame);
})();
