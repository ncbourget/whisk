"""Public pages generated from the same menu maintained by the editor."""
from html import escape as e
import json
import re
from pathlib import Path
from concept import render_concept

ROOT=Path(__file__).resolve().parents[1]
def render_storefront(data, legacy):
    site=data['site']; base=site['basePath'].rstrip('/')
    items=sorted((i for i in data['menu'] if i['available']),key=lambda i:i['position'])
    home=render_concept(data)
    # Public cart contains no administrative data, credentials, or payment information.
    catalog=[{k:i[k] for k in ['id','name','price','soldOut','image','imageAlt']} for i in items]
    runtime=json.dumps({'items':catalog,'currency':site['currency'],'base':base,'demo':site['demo']}).replace('<','\\u003c')
    scripts=f'<script id="cart-data" type="application/json">{runtime}</script><script defer src="{e(base)}/assets/js/cart.js"></script>'
    home=home.replace('</head>',f'<link rel="stylesheet" href="{e(base)}/assets/css/storefront.css"></head>')
    home=home.replace('</body>',scripts+'</body>')
    home=home.replace('</div></nav></header>',f'<a class="cart-link" href="{e(base)}/cart/">Cart <span data-cart-count>0</span></a></div></nav></header>')
    if not site['demo'] and site['domain']:
        home=home.replace('<meta name="robots" content="noindex,nofollow">','')
        home=home.replace('</head>','<script type="application/ld+json">'+json.dumps({'@context':'https://schema.org','@type':'Bakery','name':site['name']}).replace('<','\\u003c')+'</script></head>')
    def page(title,body,route):
        html=re.sub(r'<main id="main">.*?</main>', '<main id="main" class="store-page">'+body+'</main>',home,flags=re.S)
        html=html.replace('<body>','<body class="storefront-inner">').replace('<title>Whisk — Baked by Cindy</title>',f'<title>{e(title)} | Whisk</title>')
        if site['domain']:
            html=html.replace('</head>',f'<link rel="canonical" href="{e(site["domain"].rstrip("/")+base+route)}"></head>')
        return html
    def photo(i):
        return f'<img class="food-photo" src="{e(base+"/"+i["image"])}" width="800" height="600" alt="{e(i["imageAlt"])}" loading="lazy">' if i['image'] else '<div class="food-space" aria-hidden="true"></div>'
    def card(i):
        link=f'{base}/menu/{i["id"]}/'
        return f'<article class="bake"><a href="{e(link)}" aria-label="{e(i["name"])}">{photo(i)}</a><div class="bake-copy"><h3><a href="{e(link)}">{e(i["name"].rstrip("."))}</a></h3><p>{e(i["description"])}</p><span class="sample-price">${i["price"]:.2f}'+(' · Sold out' if i['soldOut'] else '')+'</span></div></article>'
    menu='<p class="mono">From Cindy’s recipe book</p><h1>The menu.</h1><div class="bakes">'+''.join(map(card,items))+'</div>'
    if not items: menu+='<h2>A fresh menu is on its way.</h2>'
    if items and all(i['soldOut'] for i in items):menu+='<p>Everything on this menu is sold out.</p>'
    menu+=f'<section class="store-note"><h2>Made to enjoy.</h2><p>{e(site["allergens"])}</p><p>{e(site["pickup"])}</p></section>'
    outputs={'index.html':home,'menu/index.html':page('Menu',menu,'/menu/')}
    for route,title in [('about','About Cindy'),('find-us','Find Whisk'),('faq','Good to know'),('contact','Contact Cindy')]:
        body=re.search(r'<main[^>]*>(.*?)</main>',legacy[route+'/index.html'],re.S).group(1)
        if route=='about':
            body=f'<p class="mono">Cindy’s bakery on wheels</p><h1>{e(site["aboutHeading"])}</h1><section class="about-layout"><img src="{e(base)}/assets/splashscreen/about.webp" width="5712" height="4284" alt="Cindy serving visitors from the open window of the silver Whisk bakery trailer"><div><p>{e(site["aboutText"])}</p><p>{e(site["aboutNote"])}</p><a href="{e(base)}/find-us/">Find the trailer →</a></div></section>'
        if route=='find-us':
            visit=f'<aside class="paper-note"><h2>Before you stop by</h2><p><a href="{e(base)}/faq/">Frequently asked questions →</a></p><p><a href="mailto:{e(site["email"])}">Contact Cindy →</a></p></aside>'
            body=re.sub(r'<aside class="paper-note">.*?</aside>',lambda match:visit,body,flags=re.S)
            body=body.replace('<p class="small muted">Social links coming soon.</p>','')
        outputs[route+'/index.html']=page(title,body,'/'+route+'/')
    for i in items:
        disabled=' disabled' if i['soldOut'] else ''
        body=f'''<a href="{e(base)}/menu/">← Back to the menu</a><div class="item-detail"><div>{photo(i)}</div><section><p class="mono">{e(i['category'])}</p><h1>{e(i['name'].rstrip('.'))}</h1><p>{e(i['description'])}</p><p>${i['price']:.2f}</p><label for="quantity">Quantity</label><input id="quantity" type="number" min="1" max="20" value="1" step="1"><button type="button" data-add-item="{e(i['id'])}"{disabled}>{'Sold out' if i['soldOut'] else 'Add to cart'}</button><p role="status" id="cart-message"></p><a href="{e(base)}/cart/">View cart →</a><details class="ingredients"><summary>View Ingredients &amp; allergens</summary><p>{e(i['allergens'] or site['allergens'])}</p></details><p>{e(i['notes'])}</p><p>{e(i['storage'])}</p></section></div>'''
        outputs[f'menu/{i["id"]}/index.html']=page(i['name'],body,f'/menu/{i["id"]}/')
    outputs['cart/index.html']=page('Your cart',f'''<p class="mono">A little something for later</p><h1>Your cart.</h1><div id="cart-items"></div><p id="cart-total"></p><p role="status" id="cart-message"></p><div class="store-note"><h2>Pickup &amp; payment</h2><p>This is a cart preview. No order has been placed, and nothing has been charged.</p><p>Square checkout will be available after Cindy’s products, pickup location, preparation time and ordering hours are connected.</p><button disabled>Checkout not open yet</button></div><a href="{e(base)}/menu/">Continue browsing →</a><noscript>Enable JavaScript to use your cart.</noscript>''','/cart/')
    outputs['order/index.html']=page('Order',f'<h1>Order from Whisk.</h1><p>Ordering is not open yet.</p><a href="{e(base)}/cart/">View your cart →</a>','/order/')
    for snapshot in (ROOT/'snapshots').glob('*-concept.html'):
        content=snapshot.read_text()
        if base:content=content.replace('href="/','href="'+e(base)+'/').replace('src="/','src="'+e(base)+'/')
        outputs[snapshot.stem+'/index.html']=content
    outputs['concept/index.html']=home.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>')
    return outputs
