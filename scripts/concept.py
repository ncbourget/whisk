"""Isolated composition; ordering remains on the existing menu."""
from html import escape as e
from pathlib import Path

def render_concept(data):
    site=data['site']; base=site['basePath'].rstrip('/')
    def url(path): return e(base+'/'+path)
    items=sorted((i for i in data['menu'] if i['available']),key=lambda i:i['position'])[:4]
    photos={
        'morning-bun':('morning_bun.jpg',1200,1200,'Sugar-coated morning buns on white plates'),
        'chocolate-cookie':('choc_cookie.jpg',500,500,'Chocolate chip cookies on baking paper'),
        'lemon-loaf':('Lemon_loaf.jpg',1200,1800,'Slices of glazed lemon loaf'),
        'weekend-scone':('scone.jpg',1200,1799,'Glazed scones on baking paper'),
    }
    products=''
    for n,item in enumerate(items,1):
        photo=photos.get(item['id'])
        visual=(f'<img class="food-photo" src="{url("assets/food/"+photo[0])}" width="{photo[1]}" height="{photo[2]}" alt="{e(photo[3])}" loading="lazy" decoding="async">' if photo else '<div class="food-space" aria-hidden="true"></div>')
        products+=f'''<article class="bake bake-{n}">{visual}<div class="bake-copy"><h3><a href="{url('menu/#'+item['id'])}">{e(item['name'].rstrip('.'))}</a></h3><p>{e(item['description'])}</p><span class="sample-price" aria-label="Sample price: {item['price']:.2f} {e(site['currency'])}">${item['price']:.2f}</span></div></article>'''
    nav=''.join(f'<a href="{url(p)}">{t}</a>' for p,t in [('menu/','Menu'),('about/','About'),('find-us/','Find us'),('faq/','FAQ'),('contact/','Contact')])
    icons={
        'instagram':'<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>',
        'facebook':'<path fill="currentColor" d="M24 12A12 12 0 1 0 10 23.8v-8.3H7v-3.5h3V9.3C10 6.3 11.8 4.7 14.4 4.7c1.3 0 2.6.2 2.6.2V8h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.3A12 12 0 0 0 24 12Z"/>',
    }
    socials=''
    for name,shapes in icons.items():
        icon=f'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">{shapes}</svg>'
        if site[name]:
            socials+=f'<a class="social-icon" href="{e(site[name])}" aria-label="Whisk on {name.title()}">{icon}</a>'
        else:
            socials+=f'<span class="social-icon" role="img" aria-label="{name.title()} — profile link pending" title="Profile link pending">{icon}</span>'
    nav_left=''.join(f'<a href="{url(path)}">{label}</a>' for path,label in [('menu/','Menu'),('about/','About'),('find-us/','Find us')])
    nav_right=''.join(f'<a href="{url(path)}">{label}</a>' for path,label in [('faq/','FAQ'),('contact/','Contact')])+socials
    template=(Path(__file__).resolve().parents[1]/'templates/concept.html').read_text()
    for key,value in {'base':e(base),'nav':nav,'nav_left':nav_left,'nav_right':nav_right,'products':products,'status':e(site['statusNote']),'sample':'A taste of the sample menu. Ordering is not open yet.' if site['demo'] else 'See the menu for current availability and ordering.'}.items():
        template=template.replace('{{'+key+'}}',value)
    return template
