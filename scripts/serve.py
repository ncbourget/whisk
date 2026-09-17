#!/usr/bin/env python3
"""Local-only content editing and preview; never deploy this server publicly."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from datetime import datetime
from functools import partial
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
        super().end_headers()

    def answer(self,status,data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed_host(self):
        return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}

    def do_GET(self):
        if not self.allowed_host():
            return self.answer(403,{'error':'Local preview only.'})
        path = unquote(urlsplit(self.path).path)
        if path == '/api/content':
            with LOCK:
                return self.answer(200,{'data':build.read_data(),'revision':revision()})
        if any(part.startswith('.') for part in Path(path).parts if part not in {'/'}):
            return self.answer(404,{'error':'Not found.'})
        base = build.read_data()['site']['basePath'].rstrip('/')
        if base and path.startswith(base+'/'):
            self.path = self.path[len(base):]
        # Serve a styled 404 with a genuine 404 HTTP status.
        target = Path(self.translate_path(self.path))
        if not target.exists():
            body=(ROOT/'404.html').read_bytes()
            self.send_response(404);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        super().do_GET()

    def do_POST(self):
        origin = self.headers.get('Origin','')
        if not self.allowed_host() or origin != 'http://'+self.headers.get('Host',''):
            return self.answer(403,{'error':'Save from the local notebook on this computer.'})
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
                path.write_bytes(body)
                return self.answer(200,{'path':'assets/food/'+name})
            self.answer(404,{'error':'Not found.'})
        except (ValueError,KeyError,TypeError) as error:
            self.answer(400,{'error':str(error)})
        except Exception as error:
            print('Save error:',error)
            self.answer(500,{'error':'Could not save. Your previous content has been restored. Ask Nate for help.'})

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--open',action='store_true')
    args=parser.parse_args()
    build.build()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(ROOT)))
    print(f'Website: http://127.0.0.1:{args.port}/\nNotebook: http://127.0.0.1:{args.port}/editor/',flush=True)
    if args.open:
        webbrowser.open(f'http://127.0.0.1:{args.port}/editor/')
    try:server.serve_forever()
    except KeyboardInterrupt:server.server_close()
