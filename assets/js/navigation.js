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
