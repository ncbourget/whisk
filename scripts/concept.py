"""Isolated concept renderer; no ordering, editor or persistence logic."""
from html import escape as e
from pathlib import Path

def render_concept(data):
    site = data['site']
    base = site['basePath'].rstrip('/')
    def url(path): return e(base+'/'+path)
    def shot(code, title, notes, cls=''):
        return f'<div class="photo-brief {cls}"><span class="mono">PHOTO NEEDED / {code}</span><strong>{title}</strong><p>{notes}</p><span class="frame-corner" aria-hidden="true"></span></div>'
    trailer = (Path(__file__).resolve().parents[1]/'assets/trailer/trailer.svg').read_text()
    trailer = trailer.replace('<defs>', '<defs><clipPath id="environment"><path d="M117 396V183C117 92 166 52 265 52H635C725 52 772 116 772 201V402H117Z"/></clipPath>')
    marker = '<path d="M135 394'
    reflection = '''<g clip-path="url(#environment)"><path d="M100 50H800V245Q560 204 100 252Z" fill="#8dd1f5"/><path d="M100 185Q420 120 800 200L800 232Q480 188 100 244Z" fill="#fffdf3"/><path d="M100 250Q330 202 520 259T800 241V332H100Z" fill="#244c32"/><path d="M100 298Q390 347 800 283V410H100Z" fill="#a9c943"/><path d="M100 356Q380 311 800 365" stroke="#faffde" stroke-width="12"/><path d="M168 75Q126 235 172 400M709 65Q766 240 710 403" stroke="white" stroke-width="19" opacity=".65"/></g>'''
    trailer = trailer.replace(marker, reflection+marker).replace('<svg ', '<svg role="img" aria-label="Provisional schematic trailer reflecting the blue sky and green ground" ',1)
    items = sorted((i for i in data['menu'] if i['available']),key=lambda i:i['position'])[:4]
    products = ''
    for n,i in enumerate(items,1):
        label = 'Sample product' if site['demo'] else 'Menu selection'
        products += f'<article>{shot(f"M{n:02}",e(i["name"]),"4:3 · close crop<br>Daylight / plain paper / real bake")}<span class="mono item-label">{label}</span><h3>{e(i["name"])}</h3><p>{e(i["description"])}</p><a href="{url("menu/#"+i["id"])}">View menu details ↗</a></article>'
    nav = ''.join(f'<a href="{url(p)}">{t}</a>' for p,t in [('menu/','Menu'),('about/','About'),('find-us/','Find us'),('faq/','FAQ'),('contact/','Contact')])
    template = (Path(__file__).resolve().parents[1]/'templates/concept.html').read_text()
    values = {'base':e(base),'nav':nav,'trailer':trailer,'products':products,'status':e(site['statusNote']), 'heroShot':shot('H01','The trailer, in its element.','Landscape 3:2 · camera at waist height<br>Open window / blue sky / grass foreground<br>Keep the left third quiet for typography','wide-brief'), 'detailShot':shot('D01','At the service window.','Landscape 3:2 · counter height<br>One real bake / paper / reflected sky'), 'sample':'Sample menu · not for sale' if site['demo'] else 'Current selections · see menu for availability'}
    for k,v in values.items(): template=template.replace('{{'+k+'}}',v)
    return template
