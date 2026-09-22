#!/usr/bin/env python3
"""Local-only content editing and preview; never deploy this server publicly."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from datetime import datetime
from functools import partial
from http.cookies import SimpleCookie
import secrets
import time
import argparse
import hashlib
import json
import os
import re
import threading
import webbrowser
import build

ROOT = build.ROOT
LOCK = threading.Lock()

def revision():
    return hashlib.sha256(b''.join((ROOT/'data'/f'{n}.json').read_bytes() for n in ['site','menu','events'])).hexdigest()

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('X-Frame-Options','DENY')
        super().end_headers()

    def answer(self,status,data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def log_message(self, format, *args):
        # Launch URL contains a one-use credential. Never log request URLs/cookies.
        pass

    def authorized(self):
        try:
            cookies = SimpleCookie(self.headers.get('Cookie',''))
            supplied = cookies.get('whisk_local_session')
            return bool(supplied and time.monotonic() < self.server.session_expires
                        and secrets.compare_digest(supplied.value,self.server.session_token))
        except Exception:
            return False

    def allowed_host(self):
        return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.allowed_host():
            return self.answer(403,{'error':'Local preview only.'})
        path = unquote(urlsplit(self.path).path)
        if path.startswith('/local-login/'):
            # Possession of the OS-issued launch link, not the editor URL, grants a session.
            # The short-lived launch code is consumed once; it never enters client-side JS.
            with LOCK:
                code = path.removeprefix('/local-login/')
                if (self.command != 'GET' or not self.server.launch_token
                        or time.monotonic() >= self.server.launch_expires
                        or not secrets.compare_digest(code,self.server.launch_token)):
                    return self.answer(403,{'error':'Launch link expired. Restart Start Whisk.command.'})
                self.server.launch_token = ''
                self.send_response(303)
                self.send_header('Location','/editor/')
                self.send_header('Set-Cookie',f'whisk_local_session={self.server.session_token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')
                self.send_header('Content-Length','0')
                self.end_headers()
                return
        if path == '/api/content':
            if not self.authorized():
                return self.answer(401,{'error':'Reopen Start Whisk.command to authenticate.'})
            with LOCK:
                return self.answer(200,{'data':build.read_data(),'revision':revision(),'capabilities':{'write':True}})
        data = build.read_data()
        base = data['site']['basePath'].rstrip('/')
        if base and path.startswith(base+'/'):
            path = path[len(base):]
        relative = path.lstrip('/')
        if not relative or relative.endswith('/'):
            relative += 'index.html'
        if relative == 'editor':
            relative = 'editor/index.html'
        admin = relative in {'editor/index.html','assets/js/editor.js','assets/css/editor.css'}
        # Allowlisting applies equally to GET and HEAD; no directory listings,
        # raw JSON, source files, backups, symlink escapes, or encoded traversal.
        public = set(build.ROUTES)
        public = {r+'index.html' if not r or r.endswith('/') else r for r in public}
        public |= {'robots.txt','sitemap.xml','concept/index.html'} | build.public_assets(data)
        if admin and not self.authorized():
            return self.answer(401,{'error':'Open Start Whisk.command to authenticate the local editor.'})
        if self.authorized():
            public |= {i['image'] for i in data['menu'] if i['image']}
        if self.authorized() and relative.startswith('assets/food/') and Path(relative).suffix.lower() in {'.jpg','.jpeg','.png','.webp','.svg'} and '..' not in relative:
            public.add(relative)
        if relative not in public and not admin:
            return self.answer(404,{'error':'Not found.'})
        target = (ROOT/relative).resolve()
        if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
            return self.answer(404,{'error':'Not found.'})
        content = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type',self.guess_type(str(target)))
        self.send_header('Content-Length',str(len(content)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(content)

    def do_POST(self):
        origin = self.headers.get('Origin','')
        if not self.allowed_host() or origin != 'http://'+self.headers.get('Host',''):
            return self.answer(403,{'error':'Save from the local notebook on this computer.'})
        if not self.authorized():
            return self.answer(401,{'error':'Reopen Start Whisk.command to authenticate.'})
        if self.path not in {'/api/content','/api/photo'}:
            return self.answer(404,{'error':'Not found.'})
        try:
            length = int(self.headers.get('Content-Length',0))
            if not 0 < length <= 5*1024*1024:
                raise ValueError('File too large or empty (maximum 5 MB).')
            body=self.rfile.read(length)
            if self.path == '/api/content':
                if self.headers.get('Content-Type') != 'application/json':
                    return self.answer(415,{'error':'Content must be JSON.'})
                incoming = json.loads(body)
                with LOCK:
                    if incoming.get('revision') != revision():
                        return self.answer(409,{'error':'The content changed in another window. Download your draft for safekeeping, then reload before saving.'})
                    data=build.validate(incoming['data'])
                    build.render(data) # Check rendering before modifying source content.
                    backup=ROOT/'.backups'/datetime.now().strftime('%Y%m%d-%H%M%S-%f')
                    backup.mkdir(parents=True)
                    old = {name:(ROOT/'data'/f'{name}.json').read_bytes() for name in ['site','menu','events']}
                    for name,content in old.items():
                        (backup/f'{name}.json').write_bytes(content)
                    try:
                        for name in old:
                            path=ROOT/'data'/f'{name}.json'
                            temp=path.with_suffix('.tmp')
                            temp.write_text(json.dumps(data[name],indent=2,ensure_ascii=False)+'\n')
                            os.replace(temp,path)
                        build.build(data)
                    except Exception:
                        for name,content in old.items():
                            (ROOT/'data'/f'{name}.json').write_bytes(content)
                        build.build()
                        raise
                    return self.answer(200,{'ok':True,'revision':revision()})
            if self.path == '/api/photo':
                types={'image/jpeg':('.jpg',body.startswith(b'\xff\xd8\xff')),'image/png':('.png',body.startswith(b'\x89PNG\r\n\x1a\n')),'image/webp':('.webp',body.startswith(b'RIFF') and body[8:12]==b'WEBP')}
                kind=types.get(self.headers.get('Content-Type'))
                if not kind or not kind[1]:
                    raise ValueError('Upload a real JPG, PNG, or WebP image.')
                stem=re.sub(r'[^a-z0-9-]','-',Path(unquote(self.headers.get('X-File-Name','photo'))).stem.lower()).strip('-')[:50] or 'photo'
                name=stem+'-'+hashlib.sha256(body).hexdigest()[:10]+kind[0]
                path=ROOT/'assets'/'food'/name
                if not path.resolve().is_relative_to((ROOT/'assets'/'food').resolve()):
                    raise ValueError('Invalid photo path.')
                with LOCK:
                    path.write_bytes(body)
                return self.answer(200,{'path':'assets/food/'+name})
            self.answer(404,{'error':'Not found.'})
        except (ValueError,KeyError,TypeError) as error:
            self.answer(400,{'error':str(error)})
        except Exception as error:
            print('Save error:',error)
            self.answer(500,{'error':'Could not save. Your previous content has been restored. Ask Nate for help.'})

def create_server(port=8000):
    server=ThreadingHTTPServer(('127.0.0.1',port),partial(Handler,directory=str(ROOT)))
    server.launch_token=secrets.token_urlsafe(32)
    server.launch_expires=time.monotonic()+300
    server.session_token=secrets.token_urlsafe(32)
    server.session_expires=time.monotonic()+28800
    return server

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--open',action='store_true')
    args=parser.parse_args()
    build.build()
    server=create_server(args.port)
    launch=f'http://127.0.0.1:{server.server_port}/local-login/{server.launch_token}'
    print(f'Website: http://127.0.0.1:{args.port}/\nPrivate one-use notebook launch (expires in 5 minutes): {launch}',flush=True)
    if args.open:
        webbrowser.open(launch)
    try:server.serve_forever()
    except KeyboardInterrupt:server.server_close()
