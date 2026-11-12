"""Generated product routes, public data boundaries and frozen design references."""
import copy
import json
import sys
import unittest
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build

class StorefrontTests(unittest.TestCase):
    def test_deleted_products_are_removed_from_existing_build(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True)
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)
            build.build(data, output)
            for collection, route in [('menu','menu'),('preorders','preorder')]:
                item=next(item for item in data[collection] if item['available'])
                old_path=output/route/item['id']/'index.html'
                self.assertTrue(old_path.is_file())
                data[collection].remove(item)
                build.build(data, output)
                self.assertFalse(old_path.exists())
                self.assertNotIn('/'+route+'/'+item['id']+'/',(output/route/'index.html').read_text())
            self.assertIn('Cache-Control: no-cache, must-revalidate',(output/'_headers').read_text())

    def test_hide_homepage_stand_preserves_catalog(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True)
        data['site']['showStandMenu']=False
        build.validate(data)
        pages=build.render(data)
        self.assertNotIn('id="possibilities"',pages['index.html'])
        self.assertIn('id="preorders"',pages['index.html'])
        self.assertNotIn('id="menu-items"',pages['menu/index.html'])
        self.assertIn('unavailable',pages['menu/index.html'])
        for item in data['menu']:
            if item['available']:
                self.assertNotIn('Available at the stand.',pages['menu/'+item['id']+'/index.html'])
        data['site']['showStandMenu']=True
        self.assertIn('id="possibilities"',build.render(data)['index.html'])

    def test_closed_preorders_hide_pages_and_cart_without_deleting_items(self):
        data=build.read_data()
        data['site'].update(showStandMenu=True,showPreorderMenu=False)
        saved=copy.deepcopy(data['preorders'])
        pages=build.render(data)
        self.assertNotIn('id="preorders"',pages['index.html'])
        for route in ['preorder/index.html','cart/index.html','order/index.html']:
            self.assertIn('menu is currently unavailable',pages[route])
        for item in saved:
            if item['available']:
                self.assertIn('menu is currently unavailable',pages['preorder/'+item['id']+'/index.html'])
        self.assertEqual(saved,data['preorders'])
        data['site']['showPreorderMenu']=True
        self.assertIn('id="menu-items"',build.render(data)['preorder/index.html'])

    def test_optional_gallery_and_shared_categories(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True)
        item=data['menu'][0];item['available']=True
        item['photos']=[{'image':'assets/food/choc_cookie.jpg','alt':'Another view'}]
        item['category']='Special seasonal bakes'
        pages=build.render(data)
        detail=pages['menu/'+item['id']+'/index.html']
        self.assertIn('data-product-gallery',detail)
        self.assertIn('data-photo-index="1"',detail)
        self.assertIn('data-card-slideshow',pages['menu/index.html'])
        self.assertIn('assets/food/choc_cookie.jpg',build.public_assets(data))
        for route in ['menu/index.html','preorder/index.html']:
            self.assertIn('<option value="Special seasonal bakes">',pages[route])
            self.assertIn('id="menu-items"',pages[route])
        del item['photos']
        self.assertNotIn('data-product-gallery',build.render(data)['menu/'+item['id']+'/index.html'])

    def test_new_product_generates_page_and_link(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True);item=copy.deepcopy(data['menu'][0]);item.update(id='new-test-bake',name='New test bake',available=True);data['menu'].append(item)
        pages=build.render(data)
        self.assertIn('menu/new-test-bake/index.html',pages)
        self.assertIn('/menu/new-test-bake/',pages['menu/index.html'])
        item['available']=False
        self.assertNotIn('menu/new-test-bake/index.html',build.render(data))
    def test_archives_are_independent_of_editor_content(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True);first=build.render(data)
        data['menu'][0]['name']='Completely changed';data['site']['aboutText']='Changed story'
        second=build.render(data)
        for route in ['index','menu','about','find-us']:
            key=route+'-concept/index.html'
            self.assertEqual(first[key],second[key]);self.assertIn('noindex',second[key])
            self.assertIn('/snapshots/assets/',second[key])
            self.assertNotIn('/'+route+'-concept/',second['sitemap.xml'])
    def test_checkout_is_disabled_and_private_content_not_in_cart(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True);item=data['menu'][0];item.update(available=True,soldOut=True)
        pages=build.render(data);cart=pages['cart/index.html']
        self.assertIn('<form id="square-checkout" hidden>',cart)
        self.assertIn('<button type="submit" disabled>Checkout',cart)
        runtime=cart.split('<script id="cart-data" type="application/json">')[1].split('</script>')[0]
        data=json.loads(runtime)
        for public_item in data['items']:
            self.assertEqual(set(public_item),{'id','name','price','soldOut','image','imageAlt','linked'})
        self.assertNotIn('data-add-item=',pages['menu/'+item['id']+'/index.html'])
        self.assertNotIn(item['id'], [product['id'] for product in data['items']])

    def test_readable_story_notice_and_static_ingredients(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True)
        data['site'].update(aboutText='First paragraph.\n\nSecond paragraph.',aboutNote='',allergens='Specific allergen notice.')
        data['menu'][0].update(available=True,category='Seasonal pies')
        pages=build.render(data)
        self.assertIn('<p>First paragraph.</p><p>Second paragraph.</p>',pages['index.html'])
        menu=pages['menu/index.html']
        self.assertGreater(menu.index('Specific allergen notice.'),menu.index('id="menu-items"'))
        self.assertIn('<option value="Seasonal pies">Seasonal pies</option>',menu)
        self.assertIn('<section class="ingredients"><h2>Ingredients &amp; allergens</h2>',pages['menu/'+data['menu'][0]['id']+'/index.html'])
        self.assertNotIn('From Cindy’s recipe book',menu)
        self.assertNotIn('From Cindy’s recipe book',pages['index.html'])

    def test_homepage_sections_replace_standalone_pages(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True);data['site']['statusNote']='Editor location note'
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

    def test_preorders_are_separate_and_hidden_items_cannot_enter_cart(self):
        # Layout test: sample mode, so unlinked test items don't trip the live-ordering checks.
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True,demo=True)
        data['site']['showStandMenu']=True
        preorder=copy.deepcopy(data['menu'][0]);preorder.update(id='preorder-test-pie',name='Whole test pie',available=True,soldOut=False)
        data['preorders']=[preorder]
        pages=build.render(data)
        self.assertIn('/preorder/preorder-test-pie/',pages['preorder/index.html'])
        self.assertNotIn('Whole test pie',pages['menu/index.html'].split('<script id="cart-data"')[0])
        self.assertIn('data-add-item="preorder-test-pie"',pages['preorder/preorder-test-pie/index.html'])
        data['site']['cutoff']='Order by Sunday for Wednesday pickup.'
        self.assertIn('Order by Sunday for Wednesday pickup.',build.render(data)['preorder/preorder-test-pie/index.html'])
        home=pages['index.html']
        self.assertLess(home.index('id="possibilities"'),home.index('id="preorders"'))
        self.assertLess(home.index('id="preorders"'),home.index('id="find-whisk"'))
        runtime=json.loads(home.split('<script id="cart-data" type="application/json">')[1].split('</script>')[0])
        self.assertEqual([i['id'] for i in runtime['items']],['preorder-test-pie'])
        preorder['available']=False
        hidden=build.render(data)
        self.assertNotIn('preorder/preorder-test-pie/index.html',hidden)
        self.assertNotIn('preorder-test-pie',hidden['cart/index.html'])

    def test_homepage_uses_editor_headline_with_safe_line_breaks(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True)
        data['site']['heroHeading']='First line.\nSecond line.\nThird & <last>.'
        home=build.render(data)['index.html']
        self.assertIn('class="hero-aside mono">First line.<br>Second line.<br>Third &amp; &lt;last&gt;.</span>',home)

    def test_homepage_limits_both_menus_and_links_to_remaining_items(self):
        # Layout test: sample mode, so unlinked test items don't trip the live-ordering checks.
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True,demo=True)
        data['site']['showStandMenu']=True
        template=copy.deepcopy(data['menu'][0])
        for collection in ('menu','preorders'):
            data[collection]=[dict(template,id=collection+'-test-'+str(n),name=collection+' item '+str(n),available=True,position=n) for n in range(6)]
        pages=build.render(data)
        home=pages['index.html'].split('<script id="cart-data"')[0]
        self.assertEqual(home.count('data-more-tile'),2)
        for collection,route in [('menu','menu'),('preorders','preorder')]:
            self.assertIn('/'+route+'/'+collection+'-test-3/',home)
            self.assertNotIn('/'+route+'/'+collection+'-test-4/',home)
            self.assertIn('/'+route+'/'+collection+'-test-5/',pages[route+'/index.html'])

    def test_square_photos_render_without_local_prefix_and_validate(self):
        data=build.read_data();data['site'].update(showStandMenu=True,showPreorderMenu=True)
        item=data['preorders'][0]
        image='https://items-images-production.s3.us-west-2.amazonaws.com/pie.jpg'
        item.update(available=True,squareVariationId='VARIATION1',image=image,imageAlt='Whole pie',photos=[{'image':image+'?slice','alt':'Slice'}])
        build.validate(data)
        page=build.render(data)['preorder/'+item['id']+'/index.html']
        self.assertIn('src="'+image+'"',page)
        self.assertIn('data-product-gallery',page)
        self.assertNotIn(image,build.public_assets(data))
