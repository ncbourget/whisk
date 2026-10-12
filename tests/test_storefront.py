"""Generated product routes, public data boundaries and frozen design references."""
import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build

class StorefrontTests(unittest.TestCase):
    def test_new_product_generates_page_and_link(self):
        data=build.read_data();item=copy.deepcopy(data['menu'][0]);item.update(id='new-test-bake',name='New test bake',available=True);data['menu'].append(item)
        pages=build.render(data)
        self.assertIn('menu/new-test-bake/index.html',pages)
        self.assertIn('/menu/new-test-bake/',pages['menu/index.html'])
        item['available']=False
        self.assertNotIn('menu/new-test-bake/index.html',build.render(data))
    def test_archives_are_independent_of_editor_content(self):
        data=build.read_data();first=build.render(data)
        data['menu'][0]['name']='Completely changed';data['site']['aboutText']='Changed story'
        second=build.render(data)
        for route in ['index','menu','about','find-us']:
            key=route+'-concept/index.html'
            self.assertEqual(first[key],second[key]);self.assertIn('noindex',second[key])
            self.assertIn('/snapshots/assets/',second[key])
            self.assertNotIn('/'+route+'-concept/',second['sitemap.xml'])
    def test_checkout_is_disabled_and_private_content_not_in_cart(self):
        data=build.read_data();item=data['menu'][0];item.update(available=True,soldOut=True)
        pages=build.render(data);cart=pages['cart/index.html']
        self.assertIn('<button disabled>Checkout not open yet</button>',cart)
        runtime=cart.split('<script id="cart-data" type="application/json">')[1].split('</script>')[0]
        data=json.loads(runtime)
        for public_item in data['items']:
            self.assertEqual(set(public_item),{'id','name','price','soldOut','image','imageAlt'})
        self.assertIn('data-add-item="'+item['id']+'" disabled',pages['menu/'+item['id']+'/index.html'])

    def test_readable_story_notice_and_static_ingredients(self):
        data=build.read_data()
        data['site'].update(aboutText='First paragraph.\n\nSecond paragraph.',aboutNote='',allergens='Specific allergen notice.')
        data['menu'][0].update(available=True,category='Seasonal pies')
        pages=build.render(data)
        self.assertIn('<p>First paragraph.</p><p>Second paragraph.</p>',pages['index.html'])
        menu=pages['menu/index.html']
        self.assertLess(menu.index('Specific allergen notice.'),menu.index('id="menu-category"'))
        self.assertIn('<option value="Seasonal pies">Seasonal pies</option>',menu)
        self.assertIn('<section class="ingredients"><h2>Ingredients &amp; allergens</h2>',pages['menu/'+data['menu'][0]['id']+'/index.html'])
        self.assertNotIn('From Cindy’s recipe book',menu)
        self.assertNotIn('From Cindy’s recipe book',pages['index.html'])

    def test_homepage_sections_replace_standalone_pages(self):
        data=build.read_data();data['site']['statusNote']='Editor location note'
        pages=build.render(data)
        self.assertNotIn('about/index.html',pages)
        self.assertNotIn('find-us/index.html',pages)
        home=pages['index.html']
        self.assertIn('id="find-whisk"',home)
        self.assertIn('id="about"',home)
        self.assertIn('Editor location note',home)
        self.assertIn('Whisk Facebook timeline',home)
        self.assertLess(home.index('id="find-whisk"'),home.index('id="about"'))
        self.assertIn('href="/#find-whisk"',pages['menu/index.html'])
        self.assertIn('href="/#about"',pages['menu/index.html'])
