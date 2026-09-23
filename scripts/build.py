#!/usr/bin/env python3
"""Render plain HTML from the owner's content. Python standard library only."""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import argparse
import json
import os
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
STATUSES = {'coming_soon':'Coming soon', 'open_today':'Open today', 'preorders_open':'Preorders open', 'preorders_closed':'Preorders closed', 'sold_out':'Sold out', 'closed':'Closed for the day', 'next_popup':'Next pop-up'}
OPEN_STATUSES = {'open_today', 'preorders_open', 'next_popup'}
ROUTES = {'':'Home','menu/':'Menu & order','about/':'Our story','find-us/':'Find Whisk','faq/':'Good to know','contact/':'Say hello','order/':'Order','404.html':'Page not found'}
DESCRIPTIONS = {'':'Meet Whisk, Baked by Cindy: a small bakery in a polished silver trailer. Explore the menu and find our next stop.','menu/':'See the Whisk menu, availability, ingredient information, and pickup ordering options.','about/':'Meet Cindy and the little silver trailer behind Whisk.','find-us/':'Find upcoming Whisk pop-ups, locations, and opening hours.','faq/':'Pickup, ordering, allergens, and other things to know before visiting Whisk.','contact/':'Get in touch with Cindy at Whisk for questions about the bakery and your order.','order/':'Order from Whisk through Square-hosted checkout.','404.html':'This page has wandered off. Find your way back to Whisk.'}

def e(value):
    return escape(str(value), quote=True)

def https_url(value, square=False):
    if not value:
        return False
    try:
        u = urlsplit(value)
        host = (u.hostname or '').lower()
        valid = u.scheme == 'https' and bool(host) and u.port in (None,443) and not u.username and not u.password and not re.search(r'[\s<>"\\]', value)
        if square:
            valid = valid and (host in {'square.link','squareup.com','checkout.square.site'} or host.endswith('.square.site'))
        return valid
    except ValueError:
        return False

def stamp(value):
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise ValueError('Dates must include a time-zone offset, for example 2026-12-01T10:00:00-05:00.')
    return dt

def validate(data):
    if not isinstance(data,dict) or set(data) != {'site','menu','events'}:
        raise ValueError('Content must contain only site, menu, and events.')
    site, menu, events = data['site'], data['menu'], data['events']
    if not isinstance(site, dict) or not isinstance(menu, list) or not isinstance(events, list):
        raise ValueError('Site must be an object; menu and events must be lists.')
    required = ['name','tagline','status','statusNote','heroHeading','heroText','aboutHeading','aboutText','aboutNote','hours','pickup','cutoff','refunds','allergens','footerNote','domain','basePath','currency','timezone','email','phone','instagram','facebook','squareUrl','serviceArea','socialImage','socialImageAlt','orderOpens','orderCloses']
    if set(site) != set(required) | {'demo','orderingEnabled'}:
        raise ValueError('Unknown or missing site fields. Never store credentials in content.')
    for key in required:
        if not isinstance(site.get(key), str):
            raise ValueError(f'Site: {key} must be text.')
    for key in ['demo','orderingEnabled']:
        if not isinstance(site.get(key), bool):
            raise ValueError(f'Site: {key} must be true or false.')
    if site['status'] not in STATUSES:
        raise ValueError('Choose a valid business status.')
    if site['currency'] not in {'USD','CAD','GBP','AUD','EUR'}:
        raise ValueError('Currency must be USD, CAD, GBP, AUD, or EUR.')
    try:
        ZoneInfo(site['timezone'])
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError('Choose a valid business time zone, such as America/New_York.')
    if site['basePath'] and not re.fullmatch(r'/[A-Za-z0-9_/-]+', site['basePath']):
        raise ValueError('Base path must look like /whisk, or be blank.')
    if site['domain'] and (not https_url(site['domain']) or urlsplit(site['domain']).path not in ('','/') or urlsplit(site['domain']).query or urlsplit(site['domain']).fragment):
        raise ValueError('Domain must be an HTTPS origin, such as https://example.com (no path).')
    if site['email'] and not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+',site['email']):
        raise ValueError('Please enter a valid email address or leave it blank.')
    for key in ['instagram','facebook','squareUrl']:
        if site[key] and not https_url(site[key], key == 'squareUrl'):
            raise ValueError(f'Invalid {key} link. Square links must use square.link, squareup.com, or a square.site subdomain.')
    def asset(path):
        if path and (not path.startswith('assets/') or '..' in path or not re.fullmatch(r'[A-Za-z0-9_./-]+',path) or not (ROOT/path).is_file() or not (ROOT/path).resolve().is_relative_to(ROOT.resolve()) or Path(path).suffix.lower() not in {'.svg','.jpg','.jpeg','.png','.webp'}):
            raise ValueError(f'Image not found in assets: {path}')
    asset(site['socialImage'])
    if site['socialImage'] and not site['socialImageAlt'].strip():
        raise ValueError('A social image needs descriptive alt text.')
    def window(obj):
        start, end = stamp(obj.get('orderOpens','')), stamp(obj.get('orderCloses',''))
        if start and end and start >= end:
            raise ValueError('Ordering must close after it opens.')
    window(site)
    ids = set()
    for item in menu:
        if not isinstance(item, dict):
            raise ValueError('Each menu item must be an object.')
        allowed = {'id','name','description','category','allergens','image','imageAlt','imageShape','squareUrl','notes','storage','orderOpens','orderCloses','price','position','available','soldOut','featured','seasonal','dietary'}
        if set(item) != allowed:
            raise ValueError('Unknown or missing menu fields. Never store credentials in content.')
        for key in ['id','name','description','category','allergens','image','imageAlt','imageShape','squareUrl','notes','storage','orderOpens','orderCloses']:
            if not isinstance(item.get(key),str):
                raise ValueError(f'Menu item: {key} must be text.')
        if not re.fullmatch(r'[a-z0-9-]+',item['id']) or item['id'] in ids or not item['name'].strip() or not item['category'].strip():
            raise ValueError('Each item needs a unique lowercase ID, a name, and a category.')
        ids.add(item['id'])
        if isinstance(item.get('price'),bool) or not isinstance(item.get('price'),(float,int)) or not 0 <= item['price'] <= 100000:
            raise ValueError(f'{item["name"]}: enter a price of zero or more.')
        if not isinstance(item.get('position'),int):
            raise ValueError('Item position must be a whole number.')
        for key in ['available','soldOut','featured','seasonal']:
            if not isinstance(item.get(key),bool):
                raise ValueError(f'{key} must be true or false.')
        if not isinstance(item.get('dietary'),list) or not all(isinstance(t,str) for t in item['dietary']):
            raise ValueError('Dietary tags must be a list of text.')
        if item['imageShape'] not in {'square','portrait','landscape'}:
            raise ValueError('Photo shape must be square, portrait, or landscape.')
        asset(item['image'])
        if item['image'] and not item['imageAlt'].strip():
            raise ValueError(f'{item["name"]}: describe the photo for visitors who cannot see it.')
        if item['squareUrl'] and not https_url(item['squareUrl'], True):
            raise ValueError(f'{item["name"]}: use a Square-hosted HTTPS link.')
        window(item)
    ids = set()
    for event in events:
        if not isinstance(event,dict) or set(event) != {'id','name','address','start','end','mapUrl','description','status','menuNote'}:
            raise ValueError('Unknown or missing event fields.')
        for key in ['id','name','address','start','end','mapUrl','description','status','menuNote']:
            if not isinstance(event.get(key),str):
                raise ValueError(f'Event: {key} must be text.')
        if not re.fullmatch(r'[a-z0-9-]+',event['id']) or event['id'] in ids or not event['name'].strip():
            raise ValueError('Each event needs a unique lowercase ID and venue name.')
        ids.add(event['id'])
        start, end = stamp(event['start']),stamp(event['end'])
        if not start or not end or start >= end:
            raise ValueError('Event end must be after its start, with time-zone offsets.')
        if event['status'] not in {'confirmed','cancelled','tentative'}:
            raise ValueError('Event status must be confirmed, cancelled, or tentative.')
        if event['mapUrl'] and not https_url(event['mapUrl']):
            raise ValueError('Map links must begin with https://.')
    if not site['demo']:
        if not site['domain']:
            raise ValueError('Set the production domain before removing demo mode.')
        if site['orderingEnabled'] and (not site['email'] or not (site['squareUrl'] or any(i['squareUrl'] for i in menu))):
            raise ValueError('Live ordering needs a contact email and at least one Square link.')
    return data

def read_data():
    return validate({name:json.loads((ROOT/'data'/f'{name}.json').read_text()) for name in ['site','menu','events']})

def open_window(obj, now):
    start,end = stamp(obj.get('orderOpens','')), stamp(obj.get('orderCloses',''))
    return (not start or now >= start) and (not end or now < end)

def can_order(site, now):
    return not site['demo'] and site['orderingEnabled'] and site['status'] in OPEN_STATUSES and open_window(site,now)

def order_state(site, item, now):
    if item['soldOut']:
        return 'Sold out', ''
    if not item['available']:
        return 'Not on the menu', ''
    if site['demo']:
        return 'Sample menu · not for sale', ''
    if not can_order(site,now):
        return 'Ordering is closed', ''
    if not open_window(item,now):
        return 'Outside ordering window', ''
    # An individual product never silently falls back to an unrelated payment link.
    if not item['squareUrl']:
        return 'Ask Cindy to order', ''
    return 'Order on Square', item['squareUrl']

def render(data, now=None):
    validate(data)
    site,menu,events = data['site'],data['menu'],data['events']
    now = now or datetime.now(timezone.utc)
    visible = sorted((i for i in menu if i['available']),key=lambda i:i['position'])
    origin = site['domain'].rstrip('/')
    base = site['basePath'].rstrip('/')
    def page(path):
        return f'{base}/{path}'
    def action(label,href,style='button',extra=''):
        return f'<a class="{style}" href="{e(href)}" {extra}>{e(label)}</a>'
    def order_action():
        return action('Order on Square',site['squareUrl'],extra='rel="external" data-global-checkout') if can_order(site,now) and site['squareUrl'] else action('Explore menu',page('menu/'))
    def picture(item):
        fallback = '<span class="photo-fallback"'+(' hidden' if item['image'] else '')+'><span aria-hidden="true">✳</span>Photo coming soon</span>'
        img = f'<img src="{page(item["image"])}" alt="{e(item["imageAlt"])}" width="600" height="500" loading="lazy" decoding="async">' if item['image'] else ''
        return f'<div class="food-photo {e(item["imageShape"])}">{fallback}{img}</div>'
    def product(item,detail=False):
        label, url = order_state(site,item,now)
        price = {'USD':'$','CAD':'CA$','AUD':'A$','GBP':'£','EUR':'€'}[site['currency']] + f'{item["price"]:.2f}'
        badges = ('<span class="tag">Seasonal</span>' if item['seasonal'] else '') + ''.join(f'<span class="tag">{e(t)}</span>' for t in item['dietary'])
        availability = '<span class="sold-stamp">Sold out</span>' if item['soldOut'] else ''
        checkout = action(label+' →',url,'text-link',f'rel="external" data-item-checkout="{e(item["id"])}"') if url else f'<span class="availability">{e(label)}</span>'
        details = f'<details><summary>Ingredients &amp; details</summary><p>{e(item["allergens"] or "Please ask Cindy about ingredients before ordering.")}</p>' + (f'<p>{e(item["notes"])}</p>' if item['notes'] else '') + (f'<p><strong>Keeping it fresh:</strong> {e(item["storage"])}</p>' if item['storage'] else '') + '</details>' if detail else ''
        return f'<article class="product" data-category="{e(item["category"])}" id="{e(item["id"])}"><div class="product-image">{picture(item)}{availability}</div><div class="product-copy"><div class="eyebrow">{e(item["category"])} {badges}</div><div class="product-title"><h3>{e(item["name"])}</h3><span class="price">{price}</span></div><p>{e(item["description"])}</p>{details}<div class="product-action">{checkout}</div></div></article>'
    def event_list(limit=None):
        upcoming = sorted((ev for ev in events if stamp(ev['end']) > now),key=lambda ev:stamp(ev['start']))
        if limit:
            upcoming = upcoming[:limit]
        if not upcoming:
            return '<div class="empty-stop"><div><h3>First stop to be announced.</h3><p>We’ll post the location and hours here when they’re confirmed.</p>'+socials()+'</div></div>'
        result = ''
        for ev in upcoming:
            start,end = stamp(ev['start']).astimezone(ZoneInfo(site['timezone'])),stamp(ev['end']).astimezone(ZoneInfo(site['timezone']))
            times = start.strftime('%I:%M %p').lstrip('0')+' – '+end.strftime('%I:%M %p %Z').lstrip('0')
            date_label = start.strftime('%A, %B %d, %Y')
            if start.date() != end.date():
                date_label += ' – '+end.strftime('%B %d, %Y')
            directions = action('Get directions ↗',ev['mapUrl'],'text-link','rel="external"') if ev['mapUrl'] and ev['status'] == 'confirmed' else ''
            result += f'<article class="event" data-event-end="{e(ev["end"])}"><div class="event-date">{start.strftime("%b")}<strong>{start.day}</strong></div><div><p class="eyebrow">{e(ev["status"])} · {e(date_label)}</p><h3>{e(ev["name"])}</h3><p class="event-time">{e(times)}</p><p>{e(ev["address"])}</p><p>{e(ev["description"])}</p><p>{e(ev["menuNote"])}</p>{directions}</div></article>'
        return result
    def socials():
        links = [action(name+' ↗',site[key],'text-link','rel="external"') for key,name in [('instagram','Instagram'),('facebook','Facebook')] if site[key]]
        return '<div class="social-links">'+''.join(links)+'</div>' if links else '<p class="small muted">Social links coming soon.</p>'
    def contact():
        links = []
        if site['email']:
            links.append(action(site['email'],'mailto:'+site['email'],'text-link'))
        if site['phone']:
            phone = re.sub(r'[^+0-9]','',site['phone'])
            links.append(action(site['phone'],'tel:'+phone,'text-link'))
        return '<div class="contact-links">'+''.join(links)+'</div>' if links else '<p>Cindy’s contact details will be shared here before ordering opens.</p>'
    def intro(kicker,title,text=''):
        return '<header class="page-heading">'+(f'<p class="eyebrow">{e(kicker)}</p>' if kicker else '')+f'<h1>{e(title)}</h1>'+(f'<p class="lede">{e(text)}</p>' if text else '')+'</header>'
    def note():
        return '<aside class="sample-note"><strong>Sample menu.</strong> Items, illustrations, and prices are examples. The opening menu is not yet confirmed.</aside>' if site['demo'] else ''
    # Presentation only: keep all ordering gates and data contracts above unchanged.
    trailer = f'''<div class="trailer-scene">
      <img class="trailer" src="{page("assets/splashscreen/trailer.svg")}" width="900" height="530" alt="" fetchpriority="high">
      <a class="service-window" href="{page("menu/")}" aria-label="View Whisk’s menu and ordering availability">
        <span class="eyebrow" data-business-status>{e(STATUSES[site["status"]])}</span>
        <strong>Menu<br>&amp; order</strong><span class="window-action" aria-hidden="true">View menu →</span>
      </a>
      <img class="trailer-brand" src="{page("assets/brand/whisk-wordmark.svg")}" width="240" height="84" alt="" aria-hidden="true">
    </div>'''
    next_events = sorted((ev for ev in events if ev['status'] == 'confirmed' and stamp(ev['end']) > now), key=lambda ev:stamp(ev['start']))
    current_stop = e(site['statusNote'])
    if next_events:
        first = next_events[0]
        start_local = stamp(first['start']).astimezone(ZoneInfo(site['timezone']))
        current_stop = e(first['name'])+' · '+e(start_local.strftime('%b %d · %I:%M %p %Z').replace(' 0',' '))
    home = f'''<section class="status-strip" aria-label="Bakery status">
      <strong class="eyebrow" data-business-status>{e(STATUSES[site["status"]])}</strong>
      <p>{current_stop}</p>{action("Locations & hours",page("find-us/"),"text-link")}
    </section>
    <section class="hero">
      <div class="hero-copy"><h1>{e(site["heroHeading"]).replace(chr(10),"<br>")}</h1>
      <p class="lede">{e(site["heroText"])}</p>
      <div class="actions">{order_action()}{action("Find Whisk",page("find-us/"),"text-link")}</div></div>
      {trailer}
    </section>'''
    featured = [i for i in visible if i['featured']][:3]
    home += f'''<section class="section featured-section" aria-labelledby="featured-heading">
      <div class="featured-heading"><h2 id="featured-heading">On the menu.</h2><p class="eyebrow">Baked by Cindy</p></div>
      {note()}<div class="product-grid featured-menu">'''+(''.join(product(i) for i in featured) or '<p>The menu will be posted here before opening.</p>')+f'''</div>
      <div class="menu-endnote">{action("View the full menu →",page("menu/"),"text-link")}</div>
    </section>'''
    home += f'''<section class="story-strip" aria-labelledby="story-heading">
      <div class="story-mark" aria-hidden="true"><img src="{page("assets/illustrations/whisk.svg")}" width="120" height="180" alt=""></div>
      <h2 id="story-heading">{e(site["aboutHeading"]).replace(chr(10),"<br>")}</h2>
      <div class="story-copy"><p>{e(site["aboutText"])}</p>{action("Our story",page("about/"),"text-link")}</div>
    </section>
    <section class="section stop-section">
      <div class="stop-heading"><h2>See you at <br>the next stop.</h2>{action("All locations & hours",page("find-us/"),"text-link")}</div>
      <div>{event_list(1)}<p class="hours-note">{e(site["hours"])}</p></div>
    </section>'''
    categories = list(dict.fromkeys(i['category'] for i in visible))
    filters = '<div class="filters" role="group" aria-label="Filter menu" hidden><button type="button" data-filter="all" aria-pressed="true">Everything</button>'+''.join(f'<button type="button" data-filter="{e(c)}" aria-pressed="false">{e(c)}</button>' for c in categories)+'</div>'
    menu_page = intro('','The menu.', 'Availability and ordering details for each bake.') + note()+f'<div class="menu-topline"><p class="meta" data-order-message>{"Choose an item to order through Square." if can_order(site,now) else "Online ordering is not open yet." if site["status"]=="coming_soon" else "Online ordering is currently closed."}</p>{order_action() if can_order(site,now) and site["squareUrl"] else ""}</div>'+filters+'<p class="sr-only" id="filter-result" aria-live="polite"></p><section class="product-grid menu-grid" aria-label="Bakery menu"><h2 class="sr-only">Baked goods</h2>'+(''.join(product(i,True) for i in visible) or '<div class="empty-stop"><h2>A fresh menu is on its way.</h2><p>Check back before the next opening.</p></div>')+'</section>'
    if visible and all(i['soldOut'] for i in visible):
        menu_page += '<aside class="sample-note">Everything on this menu is sold out. The next menu will be posted here.</aside>'
    menu_page += f'''<section class="info-pair"><div><h2>Pickup</h2><p>{e(site["pickup"])}</p><p>{e(site["cutoff"])}</p>{action("Pickup & ordering questions",page("faq/"),"text-link")}</div><div><h2>Ingredients & allergens</h2><p>{e(site["allergens"])}</p>{action("Ask Cindy",page("contact/"),"text-link")}</div></section>'''
    about = intro('',site['aboutHeading'].replace('\n',' '))+f'''<section class="about-layout">{trailer}<div class="prose"><p class="lede">{e(site["aboutText"])}</p><p>{e(site["aboutNote"])}</p>{action("Find the trailer",page("find-us/"))}</div></section>'''
    find = intro('Locations & hours','Find Whisk.')+f'''<section class="find-layout"><div><h2 class="sr-only">Upcoming stops</h2>{event_list()}</div><aside class="paper-note"><h2>Before you visit</h2><strong class="meta" data-business-status>{e(STATUSES[site["status"]])}</strong><p>{e(site["statusNote"])}</p><p>{e(site["hours"])}</p>'''+ (f'<p>{e(site["serviceArea"])}</p>' if site['serviceArea'] else '')+socials()+'</aside></section>'
    questions = [('How do I order?', 'When online ordering is open, follow an item’s Order on Square link, or use our Square shop if available. You’ll review the order and pay on Square. This website never asks for card details.'),('Where and when do I pick up?',site['pickup']),('How far ahead should I order?',site['cutoff']),('Can I order several things together?','If our Square shop is linked, add your items to the basket there. Individual payment links may create separate orders. Check your pickup details before paying.'),('What if I have a food allergy?',site['allergens']),('Can I cancel or change an order?',site['refunds']),('How do I know my order went through?','Look for Square’s confirmation and receipt. If checkout fails or you’re unsure whether you paid, check for a receipt and contact Cindy before trying again. A visit to this website is not proof of payment.'),('How should I store my baked goods?','Look for storage notes in each menu item’s details, or ask Cindy when you collect your order.'),('Does this website use tracking cookies?','We haven’t added advertising trackers, analytics, or tracking cookies. The hosting provider may keep standard security logs. Square and social platforms have their own privacy policies when you visit their websites.')]
    faq = intro('','Good to know.','Ordering, pickup, and ingredients.')+'<div class="faq-list">'+''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q,a in questions)+'</div>'+f'<div class="faq-contact"><p>Have another question?</p>{action("Contact Cindy",page("contact/"),"text-link")}</div>'
    contact_page = intro('','Say hello.','For questions about the menu, pickup, or an existing order.')+f'''<section class="info-pair contact-info"><div><h2>Contact Cindy</h2>{contact()}<p class="small muted">For an existing order, include your order number and pickup date. Please don’t send card details.</p></div><div><h2>Follow Whisk</h2>{socials()}<button class="text-link" type="button" id="share-site" hidden>Copy website link</button><p class="small" id="share-message" role="status"></p></div></section>'''
    order = intro('','Order from Whisk.')+f'''<section class="order-panel"><h2>{"Order through Square" if can_order(site,now) else "Ordering is closed."}</h2><p data-order-message>{"Payment and confirmation happen securely on Square." if can_order(site,now) else "You can browse the menu while ordering is closed."}</p>{order_action()}<p>{e(site["pickup"])}</p>{action("Trouble with checkout? Contact Cindy",page("contact/"),"text-link")}</section>'''
    missing = intro('404','Page not found.','The page may have moved, or the link may be incorrect.')+f'<div class="actions">{action("Back to Whisk",page(""))} {action("See the menu",page("menu/"),"text-link")}</div>'
    bodies = {'':home,'menu/':menu_page,'about/':about,'find-us/':find,'faq/':faq,'contact/':contact_page,'order/':order,'404.html':missing}
    template = (ROOT/'templates'/'page.html').read_text()
    outputs = {}
    for route,title in ROUTES.items():
        nav = ''.join(f'<a href="{page(r)}"'+(' aria-current="page"' if r==route else '')+f'>{label}</a>' for r,label in [('menu/','Menu'),('about/','Our story'),('find-us/','Find Whisk')])
        canonical = origin+page(route) if origin else ''
        meta = '<meta name="robots" content="noindex, nofollow">' if site['demo'] or route=='404.html' or not origin else ''
        if canonical and route != '404.html':
            meta += f'<link rel="canonical" href="{e(canonical)}"><meta property="og:url" content="{e(canonical)}">'
        if origin and site['socialImage']:
            meta += f'<meta property="og:image" content="{e(origin+page(site["socialImage"]))}"><meta property="og:image:alt" content="{e(site["socialImageAlt"])}">'
        schema = {'@context':'https://schema.org','@type':'Bakery','name':site['name']+' — '+site['tagline']}
        if origin:
            schema['url'] = origin+page('')
        if site['email']:
            schema['email'] = site['email']
        if site['phone']:
            schema['telephone'] = site['phone']
        if site['serviceArea']:
            schema['areaServed'] = site['serviceArea']
        schema['sameAs'] = [site[k] for k in ['instagram','facebook'] if site[k]]
        if not site['demo'] and route == '':
            meta += '<script type="application/ld+json">'+json.dumps(schema).replace('<','\\u003c')+'</script>'
        demo = '<div class="preview-ribbon">Preview <span>·</span> Sample menu · Ordering not yet open</div>' if site['demo'] else ''
        runtime = {'demo':site['demo'],'orderingEnabled':site['orderingEnabled'],'status':site['status'],'orderOpens':site['orderOpens'],'orderCloses':site['orderCloses'],'menu':[{'id':i['id'],'orderOpens':i['orderOpens'],'orderCloses':i['orderCloses']} for i in menu if i['available']]}
        values = {'title':e(title+' | '+site['name']+' — '+site['tagline']),'description':e(DESCRIPTIONS[route]),'meta':meta,'base':base,'nav':nav,'body':bodies[route],'demo':demo,'brand':e(site['name']),'tagline':e(site['tagline']),'footer':e(site['footerNote']),'socials':socials(),'contact':contact(),'order':action('Menu & order',page('menu/'),'button small-button'),'runtime':json.dumps(runtime).replace('<','\\u003c'),'pageClass':'home' if not route else 'inner-page'}
        html = template
        for k,v in values.items():
            html = html.replace('{{'+k+'}}',v)
        outputs[route+'index.html' if route.endswith('/') or not route else route] = html
    if origin and not site['demo']:
        urls = ''.join(f'<url><loc>{e(origin+page(r))}</loc></url>' for r in ROUTES if r != '404.html')
        outputs['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>'
        outputs['robots.txt'] = 'User-agent: *\nAllow: /\nDisallow: '+page('editor/')+'\nSitemap: '+origin+page('sitemap.xml')+'\n'
    else:
        outputs['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
        outputs['robots.txt'] = 'User-agent: *\nDisallow: /\n'
    from concept import render_concept
    outputs['concept/index.html'] = render_concept(data)
    return outputs

PUBLIC_ASSETS = {
    'assets/css/brand.css', 'assets/css/site.css', 'assets/css/concept.css', 'assets/splashscreen/airstream.WebP', 'assets/splashscreen/bottom.jpg', 'assets/logo/SVG/Asset 1.svg',
    'assets/food/morning_bun.jpg', 'assets/food/choc_cookie.jpg', 'assets/food/Lemon_loaf.jpg', 'assets/food/scone.jpg',
    'assets/js/site.js', 'assets/icons/favicon.svg',
    'assets/brand/whisk-wordmark.svg', 'assets/brand/whisk-wordmark-reversed.svg',
    'assets/illustrations/whisk.svg', 'assets/splashscreen/trailer.svg',
    'assets/fonts/fraunces-latin-variable.woff2', 'assets/fonts/public-sans-latin-variable.woff2',
    'assets/fonts/ibm-plex-mono-latin-regular.woff2',
    'assets/fonts/fraunces-OFL.txt', 'assets/fonts/public-sans-OFL.txt', 'assets/fonts/ibm-plex-mono-OFL.txt',
}

def public_assets(data):
    paths = PUBLIC_ASSETS | {i['image'] for i in data['menu'] if i['available'] and i['image']}
    if data['site']['socialImage']:
        paths.add(data['site']['socialImage'])
    return paths

def build(data=None, output=None):
    data = data or read_data()
    outputs = render(data)
    output = Path(output or ROOT).resolve()
    if output != ROOT:
        # A fresh allowlisted artifact prevents old data/editor files surviving a rebuild.
        # Do not recursively remove an arbitrary user-supplied directory.
        if output.exists() and any(output.iterdir()):
            if output != ROOT/'_site' and not (output/'.whisk-build').is_file():
                raise ValueError('Use an empty output directory or the project _site directory.')
            shutil.rmtree(output)
        output.mkdir(parents=True,exist_ok=True)
        (output/'.whisk-build').touch()
        for asset in public_assets(data):
            source = ROOT/asset
            if not source.resolve().is_relative_to(ROOT.resolve()):
                raise ValueError('Assets cannot point outside the project.')
            target = output/asset
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(source,target)
        # Admin HTML, JS and JSON deliberately have no static copy. Access failure,
        # missing Worker, quota fallback, and encoded alternate paths cannot expose them.
        (output/'_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n')
    for filename,content in outputs.items():
        path = output/filename
        path.parent.mkdir(parents=True,exist_ok=True)
        temp = path.with_suffix(path.suffix+'.tmp')
        temp.write_text(content)
        os.replace(temp,path)
    (output/'.nojekyll').touch()
    return len(outputs)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT)
    parser.add_argument('--check',action='store_true')
    args = parser.parse_args()
    if args.check:
        read_data()
        print('Content is valid.')
    else:
        print(f'Built {build(output=args.output.resolve())} files.')
