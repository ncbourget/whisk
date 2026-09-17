"""Authorization regressions: real local HTTP requests and deploy-artifact isolation."""
import copy
import http.client
import json
from pathlib import Path
import secrets
import shutil
import sys
import tempfile
import threading
import time
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build
import serve

class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original=build.ROOT
        cls.tmp=tempfile.TemporaryDirectory()
        cls.root=Path(cls.tmp.name).resolve()
        for folder in ['data','assets','templates','editor']:
            shutil.copytree(cls.original/folder,cls.root/folder)
        build.ROOT=serve.ROOT=cls.root
        build.build()
        cls.server=serve.create_server(0)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()
        build.ROOT=serve.ROOT=cls.original
        cls.tmp.cleanup()
    def setUp(self):
        self.server.launch_token=secrets.token_urlsafe(32)
        self.server.launch_expires=time.monotonic()+300
        self.server.session_token=secrets.token_urlsafe(32)
        self.server.session_expires=time.monotonic()+28800
        self.origin=f'http://127.0.0.1:{self.server.server_port}'
    def request(self,method,path,body=None,headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        conn.request(method,path,body,headers or {})
        response=conn.getresponse();result=(response.status,dict(response.getheaders()),response.read());conn.close();return result
    def login(self):
        path='/local-login/'+self.server.launch_token
        status,headers,_=self.request('GET',path)
        self.assertEqual(status,303)
        self.assertIn('HttpOnly',headers['Set-Cookie']);self.assertIn('SameSite=Strict',headers['Set-Cookie'])
        self.assertEqual(headers['Location'],'/editor/')
        self.assertEqual(self.request('GET',path)[0],403)
        return headers['Set-Cookie'].split(';')[0]
    def test_anonymous_and_forged_sessions_cannot_read_or_write(self):
        for path in ['/editor/','/editor/index.html','/assets/js/editor.js','/assets/css/editor.css','/api/content']:
            for method in ['GET','HEAD']:
                self.assertEqual(self.request(method,path)[0],401,(method,path))
        for path in ['/api/content','/api/photo']:
            for cookie in ['', 'whisk_local_session=forged']:
                self.assertEqual(self.request('POST',path,b'{}',{'Origin':self.origin,'Content-Type':'application/json','Cookie':cookie})[0],401)
    def test_session_and_origin_both_required(self):
        cookie=self.login()
        self.assertEqual(self.request('GET','/api/content',headers={'Cookie':cookie})[0],200)
        for origin in ['', 'null','https://attacker.example']:
            self.assertEqual(self.request('POST','/api/content',b'{}',{'Cookie':cookie,'Origin':origin})[0],403)
        self.assertEqual(self.request('GET','/api/content',headers={'Cookie':cookie,'Host':'attacker.example'})[0],403)
        self.server.session_expires=time.monotonic()-1
        self.assertEqual(self.request('GET','/api/content',headers={'Cookie':cookie})[0],401)
    def test_expired_launch_link_denied(self):
        self.server.launch_expires=time.monotonic()-1
        self.assertEqual(self.request('GET','/local-login/'+self.server.launch_token)[0],403)
    def test_raw_source_and_traversal_denied_for_get_and_head(self):
        for path in ['/data/site.json','/data/menu.json','/data/events.json','/.git/config','/%2egit/config','/.backups/','/scripts/serve.py','/assets/../data/site.json','/assets/%2e%2e/data/site.json','/assets/','/templates/page.html']:
            for method in ['GET','HEAD']:
                self.assertEqual(self.request(method,path)[0],404,(method,path))
        self.assertEqual(self.request('GET','/')[0],200)
        self.assertEqual(self.request('HEAD','/assets/css/site.css')[0],200)
    def test_authorized_save_upload_and_conflict_validation(self):
        cookie=self.login();headers={'Cookie':cookie,'Origin':self.origin,'Content-Type':'application/json'}
        content=json.loads(self.request('GET','/api/content',headers={'Cookie':cookie})[2])
        content['data']['site']['statusNote']='Authorized test save'
        self.assertEqual(self.request('POST','/api/content',json.dumps(content),headers)[0],200)
        self.assertEqual(build.read_data()['site']['statusNote'],'Authorized test save')
        self.assertEqual(self.request('POST','/api/content',json.dumps(content),headers)[0],409)
        current=json.loads(self.request('GET','/api/content',headers={'Cookie':cookie})[2])
        current['data']['site']['squareUrl']='https://attacker.example'
        self.assertEqual(self.request('POST','/api/content',json.dumps(current),headers)[0],400)
        self.assertEqual(self.request('POST','/api/content','{}',{**headers,'Content-Type':'text/plain'})[0],415)
        photo=b'\x89PNG\r\n\x1a\n' + b'local fixture'
        status,_,body=self.request('POST','/api/photo',photo,{**headers,'Content-Type':'image/png','X-File-Name':'../../test.png'})
        self.assertEqual(status,200)
        photo_path=json.loads(body)['path'];self.assertTrue(photo_path.startswith('assets/food/'))
        self.assertEqual(self.request('GET','/'+photo_path)[0],404)
        self.assertEqual(self.request('GET','/'+photo_path,headers={'Cookie':cookie})[0],200)
        self.assertEqual(self.request('POST','/api/photo',b'<svg/>',{**headers,'Content-Type':'image/svg+xml'})[0],400)
    def test_artifact_excludes_admin_raw_data_hidden_photos_and_stale_files(self):
        data=build.read_data();data['menu'][0]['available']=False
        private_image='assets/food/private-draft.png'
        (self.root/private_image).write_bytes(b'draft')
        data['menu'][0]['image']=private_image
        out=self.root/'_site';out.mkdir(exist_ok=True)
        (out/'data').mkdir(exist_ok=True);(out/'data/site.json').write_text('stale confidential content')
        build.build(data,output=out)
        for path in ['data','editor','assets/js/editor.js','assets/css/editor.css',private_image,'scripts','templates','.git','.backups']:
            self.assertFalse((out/path).exists(),path)
        self.assertNotIn('morning-bun', (out/'index.html').read_text())
        self.assertTrue((out/'assets/js/site.js').is_file())
    def test_unknown_config_fields_and_non_image_assets_rejected(self):
        data=build.read_data();data['site']['apiKey']='not-a-real-secret'
        with self.assertRaises(ValueError):build.validate(data)
        data=build.read_data();data['menu'][0]['image']='assets/js/editor.js'
        with self.assertRaises(ValueError):build.validate(data)
        outside=Path(self.tmp.name).parent/'whisk-outside-fixture.png'
        outside.write_bytes(b'test')
        try:
            (self.root/'assets/food/escape.png').symlink_to(outside)
            data=build.read_data();data['menu'][0]['image']='assets/food/escape.png'
            with self.assertRaises(ValueError):build.validate(data)
        finally:outside.unlink()

if __name__=='__main__':unittest.main()
