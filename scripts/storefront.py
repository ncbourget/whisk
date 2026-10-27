"""Public pages generated from the same menu maintained by the editor."""
from html import escape as e
import json
import re
from urllib.parse import urlencode
from pathlib import Path
from concept import render_concept, more_tile

ROOT=Path(__file__).resolve().parents[1]
def render_storefront(data, legacy):
    site=data['site']; base=site['basePath'].rstrip('/')
    items=sorted((i for i in data['menu'] if i['available']),key=lambda i:i['position'])
    preorders=sorted((i for i in data.get('preorders', []) if i['available']),key=lambda i:i['position'])
    home=render_concept(data)
    home=home.replace(f'href="{e(base)}/about/"',f'href="{e(base)}/#about"')
    home=home.replace(f'href="{e(base)}/find-us/"',f'href="{e(base)}/#find-whisk"')
    # Public cart contains no administrative data, credentials, or payment information.
    catalog=[{k:i[k] for k in ['id','name','price','soldOut','image','imageAlt']} for i in preorders]
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
        if route=='/contact/':
            html=html.replace('class="store-page"','class="store-page contact-page"')
        html=html.replace('<body>','<body class="storefront-inner">').replace('<title>Whisk — Baked by Cindy</title>',f'<title>{e(title)} | Whisk</title>')
        if site['domain']:
            html=html.replace('</head>',f'<link rel="canonical" href="{e(site["domain"].rstrip("/")+base+route)}"></head>')
        return html
    def paragraphs(text):
        return ''.join('<p>'+e(part.strip()).replace('\n','<br>')+'</p>' for part in re.split(r'\n\s*\n',text) if part.strip())
    def photo(i):
        return f'<img class="food-photo" src="{e(base+"/"+i["image"])}" width="800" height="600" alt="{e(i["imageAlt"])}" loading="lazy">' if i['image'] else '<div class="food-space" aria-hidden="true"></div>'
    def card(i, collection="menu"):
        link=f'{base}/{collection}/{i["id"]}/'
        return f'<article class="bake" data-category="{e(i["category"])}"><a href="{e(link)}" aria-label="{e(i["name"])}">{photo(i)}</a><div class="bake-copy"><h3><a href="{e(link)}">{e(i["name"].rstrip("."))}</a></h3><p>{e(i["description"])}</p><span class="sample-price">${i["price"]:.2f}'+(' · Sold out' if i['soldOut'] else '')+'</span></div></article>'
    categories=sorted({i['category'] for i in items} | {'Pies'})
    filters='<div class="menu-filter" hidden><label for="menu-category">Filter by</label><select id="menu-category" aria-controls="menu-items"><option value="">All baked goods</option>'+''.join(f'<option value="{e(category)}">{e(category)}</option>' for category in categories)+'</select></div>'
    menu='<h1>The menu.</h1>'+filters+'<div class="bakes" id="menu-items">'+''.join(map(card,items))+'</div><p class="sr-only" id="menu-filter-status" role="status"></p>'
    if not items: menu+='<h2>A fresh menu is on its way.</h2>'
    if items and all(i['soldOut'] for i in items):menu+='<p>Everything on this menu is sold out.</p>'
    menu+=f'<section class="store-note"><p>These items are available at the stand. For advance orders, visit the <a href="{e(base)}/preorder/">pre-order menu →</a></p></section>'
    allergen_notice='<section class="menu-allergens" aria-labelledby="allergen-heading"><div class="allergen-copy"><h2 id="allergen-heading">Allergen notice</h2>'+paragraphs(site['allergens'])+'</div></section>'
    menu+=allergen_notice
    preorder_cards=''.join(card(i,'preorder') for i in preorders)
    preorder_preview=''.join(card(i,'preorder') for i in preorders[:4])+more_tile(preorders,base,'preorder')
    preorder_intro='<p>Whole bakes, planned ahead. Please allow at least 3 days before pickup. You may pre-order up to a week in advance.</p>'
    preorder_empty='<p>Pre-orders are not open yet.</p>' if not preorders else ''
    preorder_section=f'<section class="recipe preorder-section" id="preorders" aria-labelledby="preorder-heading"><div class="menu-heading-line"><h2 id="preorder-heading">Pre-order from Whisk.</h2><div class="menu-rule"><a href="{e(base)}/preorder/">View pre-order menu →</a></div></div>{preorder_intro}<div class="bakes homepage-menu-grid">{preorder_preview}</div>{preorder_empty}</section>'
    home=home.replace('<section class="find find-plain"',preorder_section+'<section class="find find-plain"',1)
    outputs={'preorder/index.html':page('Pre-order', '<h1>Pre-order from Whisk.</h1>'+preorder_intro+'<p>Some of these bakes may also be available at the stand on any given day, but availability isn’t guaranteed.</p><div class="bakes">'+preorder_cards+'</div>'+preorder_empty+allergen_notice, '/preorder/'),'index.html':home,'menu/index.html':page('Menu',menu,'/menu/')}
    for route,title in [('about','About Cindy'),('find-us','Find Whisk'),('faq','Good to know'),('contact','Contact Cindy')]:
        body=re.search(r'<main[^>]*>(.*?)</main>',legacy[route+'/index.html'],re.S).group(1)
        if route=='about':
            body=f'<h1>{e(site["aboutHeading"])}</h1><section class="about-layout"><a class="about-photo-zoom" href="{e(base)}/assets/splashscreen/about.webp" aria-label="Enlarge photo of Cindy"><img src="{e(base)}/assets/splashscreen/about.webp" width="5712" height="4284" alt="Cindy serving visitors from the open window of the silver Whisk bakery trailer"></a><div class="story-copy">{paragraphs(site["aboutText"])}{paragraphs(site["aboutNote"])}<a href="{e(base)}/find-us/">Find the trailer →</a></div></section>'
            homepage_about=body.replace('<h1>','<h2 id="about-heading">',1).replace('</h1>','</h2>',1).replace('<img src=','<img loading="lazy" src=',1)
            home=home.replace('</main>',f'<section id="about" class="store-page homepage-about" aria-labelledby="about-heading">{homepage_about}</section></main>')
            outputs['index.html']=home
        if route=='find-us':
            visit=f'<aside class="paper-note"><h2>Before you stop by</h2><p><a href="{e(base)}/faq/">Frequently asked questions →</a></p><p><a href="{e(base)}/contact/">Contact Cindy →</a></p></aside>'
            stops=re.search(r'<section class="find-layout"><div>(.*?)</div><aside',body,re.S).group(1)
            stops=re.sub(r'<div class="social-links">.*?</div>','',stops,flags=re.S)
            body=re.sub(r'<aside class="paper-note">.*?</aside>','',body,flags=re.S)
            body=body.replace('<p class="small muted">Social links coming soon.</p>','')
            body=re.sub(r'<div class="social-links">.*?</div>','',body,flags=re.S)
            embeds=[]
            if site['instagram']:
                instagram=site['instagram'].rstrip('/')+'/'
                embeds.append(f'<section class="social-feed" aria-label="Instagram"><iframe src="{e(instagram+"embed/")}" title="Whisk Instagram profile and recent posts" loading="lazy" width="400" height="560" referrerpolicy="strict-origin-when-cross-origin"></iframe><a href="{e(instagram)}" target="_blank" rel="noopener noreferrer">Open Instagram ↗</a></section>')
            if site['facebook']:
                facebook='https://www.facebook.com/plugins/page.php?'+urlencode({'href':site['facebook'],'tabs':'timeline','width':500,'height':560,'small_header':'true','adapt_container_width':'true','hide_cover':'false','show_facepile':'false'})
                embeds.append(f'<section class="social-feed" aria-label="Facebook"><iframe src="{e(facebook)}" title="Whisk Facebook timeline" loading="lazy" width="500" height="560" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture"></iframe><a href="{e(site["facebook"])}" target="_blank" rel="noopener noreferrer">Open Facebook ↗</a></section>')
            location_details=paragraphs(site['statusNote'])
            if site['hours'] and not site['hours'].startswith('Opening hours will be announced'):
                location_details+=paragraphs(site['hours'])
            if site['serviceArea']:location_details+=paragraphs(site['serviceArea'])
            # Preserve editor-managed events, including dates, addresses and directions.
            if 'class="event"' in stops:location_details+='<div class="homepage-stops">'+stops+'</div>'
            find=f'<section id="find-whisk" class="find find-plain homepage-find" aria-labelledby="find-heading"><div class="homepage-find-copy"><p class="mono">Next stop</p><h2 id="find-heading">Find Whisk.</h2>{location_details}{visit}</div><div class="homepage-feeds">'+''.join(embeds)+'</div></section>'
            home=re.sub(r'<section class="find find-plain".*?</section>',lambda match:find,home,count=1,flags=re.S)
            home=home.replace(f'href="{e(base)}/find-us/"',f'href="{e(base)}/#find-whisk"')
            outputs['index.html']=home
        if route not in ('about','find-us'):
            outputs[route+'/index.html']=page(title,body,'/'+route+'/')
    for i in items + preorders:
        is_preorder=i in preorders
        collection='preorder' if is_preorder else 'menu'
        disabled=' disabled' if i['soldOut'] else ''
        controls=f'''<p>Please allow at least 3 days before pickup. You may pre-order up to a week in advance.</p><label for="quantity">Quantity</label><input id="quantity" type="number" min="1" max="20" value="1" step="1"><button type="button" data-add-item="{e(i['id'])}"{disabled}>{'Sold out' if i['soldOut'] else 'Add to cart'}</button><p role="status" id="cart-message"></p><a href="{e(base)}/cart/">View cart →</a>''' if is_preorder else ('<p>Sold out</p>' if i['soldOut'] else '<p>Available at the stand.</p>')
        body=f'''<a href="{e(base)}/{collection}/">← Back to the menu</a><div class="item-detail"><div>{photo(i)}</div><section><p class="mono">{e(i['category'])}</p><h1>{e(i['name'].rstrip('.'))}</h1><p>{e(i['description'])}</p><p>${i['price']:.2f}</p>{controls}<section class="ingredients"><h2>Ingredients &amp; allergens</h2><p>{e(i['allergens'] or site['allergens'])}</p></section><p>{e(i['notes'])}</p><p>{e(i['storage'])}</p></section></div>'''
        outputs[f'{collection}/{i["id"]}/index.html']=page(i['name'],body,f'/{collection}/{i["id"]}/')
    outputs['cart/index.html']=page('Your cart',f'''<p class="mono">A little something for later</p><h1>Your cart.</h1><div id="cart-items"></div><p id="cart-total"></p><p role="status" id="cart-message"></p><div class="store-note"><h2>Pickup &amp; payment</h2><p>This is a cart preview. No order has been placed, and nothing has been charged.</p><p>Pre-orders require at least 3 days’ notice and may be placed up to a week in advance. Square checkout will open once the pre-order products, pickup schedule and three-to-seven-day ordering window are connected and tested.</p><button disabled>Checkout not open yet</button></div><a href="{e(base)}/preorder/">Continue browsing →</a><noscript>Enable JavaScript to use your cart.</noscript>''','/cart/')
    outputs['order/index.html']=page('Order',f'<h1>Pre-order from Whisk.</h1><p>Please allow at least 3 days before pickup. You may pre-order up to a week in advance. Ordering is not open yet.</p><a href="{e(base)}/preorder/">Browse pre-orders →</a><a href="{e(base)}/cart/">View your cart →</a>','/order/')
    for snapshot in (ROOT/'snapshots').glob('*-concept.html'):
        content=snapshot.read_text()
        if base:content=content.replace('href="/','href="'+e(base)+'/').replace('src="/','src="'+e(base)+'/')
        outputs[snapshot.stem+'/index.html']=content
    outputs['concept/index.html']=home.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>')
    return outputs
