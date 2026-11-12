"""Public pages generated from the same menu maintained by the editor."""
from html import escape as e
import json
import re
from urllib.parse import urlencode
from pathlib import Path
from concept import render_concept, more_tile
from product_photos import render_photo

ROOT=Path(__file__).resolve().parents[1]
def render_storefront(data, legacy):
    site=data['site']; base=site['basePath'].rstrip('/')
    items=sorted((i for i in data['menu'] if i['available']),key=lambda i:i['position'])
    preorders=sorted((i for i in data.get('preorders', []) if i['available']),key=lambda i:i['position'])
    home=render_concept(data)
    if not site.get('showStandMenu',True):
        home=re.sub(r'<section class="recipe" aria-labelledby="possibilities">.*?</section>', '', home, count=1, flags=re.S)
    home=home.replace(f'href="{e(base)}/about/"',f'href="{e(base)}/#about"')
    home=home.replace(f'href="{e(base)}/find-us/"',f'href="{e(base)}/#find-whisk"')
    # Public cart contains no administrative data, credentials, or payment information.
    catalog=[{k:i[k] for k in ['id','name','price','soldOut','image','imageAlt']} for i in preorders] if site.get('showPreorderMenu',True) else []
    for item,source in zip(catalog,preorders): item['linked']=bool(source.get('squareVariationId'))
    runtime=json.dumps({'items':catalog,'currency':site['currency'],'base':base,'demo':site['demo']}).replace('<','\\u003c')
    scripts=f'<script id="cart-data" type="application/json">{runtime}</script><script defer src="{e(base)}/assets/js/cart.js"></script>'
    home=home.replace('</head>',f'<link rel="stylesheet" href="{e(base)}/assets/css/storefront.css"><link rel="stylesheet" href="{e(base)}/assets/css/identity.css"></head>')
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
        return render_photo(i,base)
    def card(i, collection="menu"):
        link=f'{base}/{collection}/{i["id"]}/'
        return f'<article class="bake" data-category="{e(i["category"])}"><a href="{e(link)}" aria-label="{e(i["name"])}">{photo(i)}</a><div class="bake-copy"><h3><a href="{e(link)}">{e(i["name"].rstrip("."))}</a></h3><p>{e(i["description"])}</p><span class="sample-price">${i["price"]:.2f}'+(' · Sold out' if i['soldOut'] else '')+'</span></div></article>'
    categories=sorted({i['category'] for i in data['menu'] + data.get('preorders', [])} | {'Pastries','Cookies','Cakes','Pies'})
    filters='<div class="menu-filter" hidden><label for="menu-category">Filter by</label><span class="filter-control"><select id="menu-category" aria-controls="menu-items"><option value="">All baked goods</option>'+''.join(f'<option value="{e(category)}">{e(category)}</option>' for category in categories)+'</select><span class="filter-arrow" aria-hidden="true">↓</span></span></div>'
    menu='<h1>The menu.</h1>'+filters+'<div class="bakes" id="menu-items">'+''.join(map(card,items))+'</div><p class="sr-only" id="menu-filter-status" role="status"></p>'
    if not items: menu+='<h2>A fresh menu is on its way.</h2>'
    if items and all(i['soldOut'] for i in items):menu+='<p>Everything on this menu is sold out.</p>'
    stand_note=f'<section class="store-note catalog-note"><p>These items are available at the stand. For advance orders, visit the <a href="{e(base)}/preorder/">pre-order menu →</a></p></section>'
    preorder_note=f'<section class="store-note catalog-note"><p>These items are available to pre-order. For what’s available at the stand, visit the <a href="{e(base)}/menu/">stand menu →</a></p></section>'
    menu=menu.replace('<h1>The menu.</h1>','<h1>The menu.</h1>'+stand_note,1)
    allergen_notice='<section class="menu-allergens" aria-labelledby="allergen-heading"><div class="allergen-copy"><h2 id="allergen-heading">Allergen notice</h2>'+paragraphs(site['allergens'])+'</div></section>'
    menu+=allergen_notice
    preorder_cards=''.join(card(i,'preorder') for i in preorders)
    preorder_preview=''.join(card(i,'preorder') for i in preorders[:4])+more_tile(preorders,base,'preorder')
    notice=paragraphs(site['cutoff'])  # Cindy's own "Pre-order notice" text from the editor
    preorder_intro='<p>Whole bakes, planned ahead.</p>'+notice
    preorder_empty='<p>Pre-orders are not open yet.</p>' if not preorders else ''
    preorder_section=f'<section class="recipe preorder-section" id="preorders" aria-labelledby="preorder-heading"><div class="menu-heading-line"><h2 id="preorder-heading">Pre-order from Whisk.</h2><div class="menu-rule"><a href="{e(base)}/preorder/">View pre-order menu →</a></div></div>{preorder_intro}<div class="bakes homepage-menu-grid">{preorder_preview}</div>{preorder_empty}</section>'
    home=home.replace('<section class="find find-plain"',(preorder_section if site.get('showPreorderMenu',True) else '')+'<section class="find find-plain"',1)
    outputs={'preorder/index.html':page('Pre-order', '<h1>Pre-order from Whisk.</h1>'+preorder_note+preorder_intro+'<p>Some of these bakes may also be available at the stand on any given day, but availability isn’t guaranteed.</p>'+filters+'<div class="bakes" id="menu-items">'+preorder_cards+'</div>'+preorder_empty+'<p class="sr-only" id="menu-filter-status" role="status"></p>'+allergen_notice, '/preorder/'),'index.html':home,'menu/index.html':page('Menu',menu,'/menu/')}
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
        controls=f'''{notice}<label for="quantity">Quantity</label><input id="quantity" type="number" min="1" max="20" value="1" step="1"><button type="button" data-add-item="{e(i['id'])}"{disabled}>{'Sold out' if i['soldOut'] else 'Add to cart'}</button><p role="status" id="cart-message"></p><a href="{e(base)}/cart/">View cart →</a>''' if is_preorder else ('<p>Sold out</p>' if i['soldOut'] else '<p>Available at the stand.</p>')
        body=f'''<a href="{e(base)}/{collection}/">← Back to the menu</a><div class="item-detail"><div>{render_photo(i,base,detail=True)}</div><section><p class="mono">{e(i['category'])}</p><h1>{e(i['name'].rstrip('.'))}</h1><p>{e(i['description'])}</p><p>${i['price']:.2f}</p>{controls}<section class="ingredients"><h2>Ingredients &amp; allergens</h2><p>{e(i['allergens'] or site['allergens'])}</p></section><p>{e(i['notes'])}</p><p>{e(i['storage'])}</p></section></div>'''
        outputs[f'{collection}/{i["id"]}/index.html']=page(i['name'],body,f'/{collection}/{i["id"]}/')
    outputs['cart/index.html']=page('Your cart',f'''<p class="mono">A little something for later</p><h1>Your cart.</h1><div id="cart-items"></div><p id="cart-total"></p><p role="status" id="cart-message"></p><div class="store-note"><h2>Pickup &amp; payment</h2>{notice}<p>Payment is completed securely on Square.</p><p id="checkout-status" role="status">Checkout is not open yet.</p><form id="square-checkout" hidden><label>Pickup date<select name="pickup" required></select></label><label>Your name<input name="name" autocomplete="name" maxlength="100" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Phone<input name="phone" type="tel" autocomplete="tel" required></label><label class="notes-field">Special instructions (optional)<textarea name="notes" maxlength="400" rows="3"></textarea></label><button type="submit" disabled>Continue to Square ↗</button></form></div><a href="{e(base)}/preorder/">Continue browsing →</a><noscript>Enable JavaScript to use your cart.</noscript>''','/cart/')
    outputs['order/index.html']=page('Order',f'<h1>Pre-order from Whisk.</h1>{notice}'+('' if site['orderingEnabled'] and not site['demo'] else '<p>Ordering is not open yet.</p>')+f'<a href="{e(base)}/preorder/">Browse pre-orders →</a><a href="{e(base)}/cart/">View your cart →</a>','/order/')
    # Not-found page in the current design (the server also reuses it for "unavailable" item and menu pages).
    missing=page('Page not found',f'<p class="mono">404</p><h1>Page not found.</h1><p>The page may have moved, or the link may be incorrect.</p><div class="page-actions"><a href="{e(base)}/">Back to Whisk →</a><a href="{e(base)}/menu/">See the menu →</a><a href="{e(base)}/contact/">Contact Cindy →</a></div>','/404.html')
    missing=re.sub(r'<link rel="canonical"[^>]*>','',missing).replace('<meta name="robots" content="noindex,nofollow">','')
    outputs['404.html']=missing.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>',1)
    # Disabled menus retain editor data, but never publish their selection or item details.
    for collection, flag, label in [('menu','showStandMenu','Stand menu'),('preorder','showPreorderMenu','Pre-order menu')]:
        if site.get(flag,True): continue
        unavailable=page(label+' unavailable',f'<p class="mono">Unavailable</p><h1>This menu is currently unavailable.</h1><p>Please check back later, or contact Cindy with any questions.</p><div class="page-actions"><a href="{e(base)}/contact/">Contact Cindy →</a><a href="{e(base)}/#find-whisk">Find Whisk →</a></div>',f'/{collection}/')
        for path in list(outputs):
            if path.startswith(collection+'/') or (collection=='preorder' and path in ('cart/index.html','order/index.html')):
                outputs[path]=unavailable
        for path in outputs:
            outputs[path]=re.sub(r'<a\b[^>]*href="'+re.escape(base+'/'+collection)+r'/[^"#]*"[^>]*>.*?</a>', '', outputs[path], flags=re.S)
            if collection=='preorder':
                outputs[path]=re.sub(r'<a\b[^>]*href="'+re.escape(base)+r'/cart/"[^>]*>.*?</a>', '', outputs[path], flags=re.S)
    # Consistent action treatment for text links; leave product cards and navigation alone.
    def action_link(match):
        attrs, label = match.groups()
        if not any(arrow in label for arrow in ('→', '↗', '←')):
            return match.group(0)
        label = label.replace('← ', '').replace('→', '↗')
        if '↗' not in label: label += ' ↗'
        if 'class="' in attrs:
            attrs = attrs.replace('class="', 'class="action-link ', 1)
        else:
            attrs += ' class="action-link"'
        label = label.replace('↗', '').strip().lower()
        return '<a' + attrs + '><span class="action-label">' + label + '</span><span class="action-arrow" aria-hidden="true">↗</span></a>'
    for path in outputs:
        outputs[path] = re.sub(r'<a(\s[^>]*?)>([^<]+)</a>', action_link, outputs[path])
        outputs[path] = outputs[path].replace('Explore the menu <span>↗</span>', '<span class="action-label">explore the menu</span><span class="action-arrow" aria-hidden="true">↗</span>')
    for snapshot in (ROOT/'snapshots').glob('*-concept.html'):
        content=snapshot.read_text()
        if base:content=content.replace('href="/','href="'+e(base)+'/').replace('src="/','src="'+e(base)+'/')
        outputs[snapshot.stem+'/index.html']=content
    outputs['concept/index.html']=outputs['index.html'].replace('</head>','<meta name="robots" content="noindex,nofollow"></head>')
    return outputs
