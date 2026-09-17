"""Checks for commerce safety, content errors, static output, and deployment paths."""
import copy
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build

NOW=datetime(2026,9,17,15,tzinfo=timezone.utc)
class Links(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.h1=0;self.images=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='h1':self.h1+=1
        if tag=='img':self.images.append(attrs)
        for key in ['href','src']:
            if key in attrs:self.links.append(attrs[key])

class SiteTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((Path(__file__).parent/'fixtures'/'content.json').read_text())
    def test_owner_content_is_valid(self):
        build.read_data()
    def live(self):
        s=self.data['site'];s.update(demo=False,domain='https://example.com',email='orders@example.com',orderingEnabled=True,status='preorders_open',squareUrl='https://example.square.site')
        self.data['menu'][0]['squareUrl']='https://square.link/u/example'
        return s,self.data['menu'][0]
    def test_demo_never_emits_checkout(self):
        self.data['site']['orderingEnabled']=True
        self.data['site']['squareUrl']='https://square.link/u/example'
        for html in build.render(self.data,NOW).values():
            self.assertNotIn('data-global-checkout',html)
            self.assertNotIn('data-item-checkout',html)
    def test_commerce_gates_and_boundaries(self):
        site,item=self.live()
        self.assertEqual(build.order_state(site,item,NOW)[1],item['squareUrl'])
        item['soldOut']=True;self.assertEqual(build.order_state(site,item,NOW),('Sold out',''))
        item['soldOut']=False;item['orderCloses']='2026-09-17T15:00:00Z'
        self.assertEqual(build.order_state(site,item,NOW)[1],'')
        item['orderCloses']='';site['orderOpens']='2026-09-18T15:00:00Z'
        self.assertEqual(build.order_state(site,item,NOW)[1],'')
        site['orderOpens']=''
        for status in ['sold_out','closed','coming_soon','preorders_closed']:
            site['status']=status;self.assertEqual(build.order_state(site,item,NOW)[1],'')
    def test_individual_link_never_falls_back_to_generic_payment(self):
        site,item=self.live();item['squareUrl']=''
        self.assertEqual(build.order_state(site,item,NOW)[1],'')
    def test_empty_and_sold_out_states(self):
        self.data['menu']=[]
        html=build.render(self.data,NOW)['menu/index.html']
        self.assertIn('A fresh menu is on its way',html)
        self.setUp()
        for item in self.data['menu']:item['soldOut']=True
        self.assertIn('Everything on this menu is sold out',build.render(self.data,NOW)['menu/index.html'])
    def test_events_expired_cancelled_and_timezones(self):
        self.data['events']=[dict(id='stop',name='Future market',address='Venue details',start='2026-10-17T09:00:00-04:00',end='2026-10-17T12:00:00-04:00',status='cancelled',mapUrl='https://maps.google.com',description='',menuNote='')]
        html=build.render(self.data,NOW)['find-us/index.html']
        self.assertIn('cancelled',html);self.assertIn('9:00 AM',html);self.assertNotIn('Get directions',html)
        self.assertNotIn('Future market',build.render(self.data,datetime(2027,1,1,tzinfo=timezone.utc))['find-us/index.html'])
    def test_dangerous_urls_and_assets_rejected(self):
        for url in ['javascript:alert(1)','http://square.link/u/test','https://square.link.evil.test/u/test','https://square.link@evil.test','https://evil.test','https://square.link\\@evil.test']:
            self.assertFalse(build.https_url(url,True),url)
        self.data['menu'][0]['image']='../../secret.png'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_content_is_escaped(self):
        self.data['menu'][0]['name']='<script>alert(1)</script>'
        html=build.render(self.data,NOW)['menu/index.html']
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;',html)
        self.assertNotIn('<script>alert(1)</script>',html)
    def test_invalid_content_rejected(self):
        for mutate in [lambda d:d['menu'][0].update(price=-1),lambda d:d['menu'][0].update(image='assets/icons/favicon.svg',imageAlt=''),lambda d:d['menu'][0].update(orderOpens='2026-10-01T09:00:00'),lambda d:d['site'].update(demo=False),lambda d:d['menu'][1].update(id=d['menu'][0]['id'])]:
            data=copy.deepcopy(self.data);mutate(data)
            with self.assertRaises(ValueError):build.validate(data)
    def test_static_content_and_links_root_and_subfolder(self):
        for base in ['', '/whisk']:
            self.data['site']['basePath']=base
            outputs=build.render(self.data,NOW)
            for filename,html in outputs.items():
                if not filename.endswith('.html'):continue
                parsed=Links();parsed.feed(html);self.assertEqual(parsed.h1,1,filename)
                for image in parsed.images:self.assertIn('alt',image);self.assertIn('width',image);self.assertIn('height',image)
                for link in parsed.links:
                    if not link.startswith('/'):continue
                    self.assertTrue(link.startswith(base+'/'))
                    relative=urlsplit(link).path[len(base):].lstrip('/')
                    if not relative or relative.endswith('/'):relative+='index.html'
                    self.assertTrue(relative in outputs or (build.ROOT/relative).is_file(),f'{filename}: {link}')
            self.assertIn('The morning bun',outputs['menu/index.html'])
            self.assertIn('noindex',outputs['index.html'])
            self.assertNotIn('example.com',outputs['sitemap.xml'])
    def test_live_metadata(self):
        self.live();output=build.render(self.data,NOW)
        self.assertIn('rel="canonical" href="https://example.com/menu/"',output['menu/index.html'])
        self.assertIn('"@type": "Bakery"',output['index.html'])
        self.assertNotIn('noindex',output['index.html'])
        self.assertIn('https://example.com/menu/',output['sitemap.xml'])

if __name__=='__main__':unittest.main(verbosity=2)
