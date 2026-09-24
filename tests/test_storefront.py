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
        data=build.read_data();item=copy.deepcopy(data['menu'][0]);item.update(id='new-test-bake',name='New test bake');data['menu'].append(item)
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
        pages=build.render(build.read_data());cart=pages['cart/index.html']
        self.assertIn('<button disabled>Checkout not open yet</button>',cart)
        runtime=cart.split('<script id="cart-data" type="application/json">')[1].split('</script>')[0]
        data=json.loads(runtime)
        for item in data['items']:
            self.assertEqual(set(item),{'id','name','price','soldOut','image','imageAlt'})
        self.assertNotIn('data-add-item="lemon-loaf">',pages['menu/lemon-loaf/index.html'])
