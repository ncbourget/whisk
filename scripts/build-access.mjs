// Bundle the private editor into Cloudflare's server module, NOT static assets.
import {build} from 'esbuild';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = file => readFile(resolve(root, file), 'utf8');
const content = Object.fromEntries(await Promise.all(['site','menu','events'].map(async key => [key, JSON.parse(await read(`data/${key}.json`))])));
if (content.site.basePath) throw new Error('Cloudflare Access deployment requires an empty basePath.');
for (const file of ['editor/index.html','assets/js/editor.js','assets/css/editor.css','data/site.json','data/menu.json','data/events.json']) {
  if (await stat(resolve(root, '_site', file)).then(()=>true,()=>false)) throw new Error(`Unsafe static administrative file: ${file}`);
}
const editorHtml = await read('editor/index.html');
const editorScript = await read('assets/js/editor.js');
const editorStyle = await read('assets/css/editor.css');
await build({
  stdin: {contents: `import {createHandler} from './server/handler.mjs';\nexport default {fetch: createHandler(${JSON.stringify({editorHtml, editorScript, editorStyle, content})})};`, resolveDir: root, sourcefile: 'private-worker-entry.mjs'},
  outfile: resolve(root, '_site/_worker.js'), bundle: true, format: 'esm', platform: 'browser',
  target: 'es2022', sourcemap: false, minify: true, legalComments: 'inline',
});
await writeFile(resolve(root,'_site/_routes.json'), JSON.stringify({version:1,include:['/editor*','/api*','/data*','/assets/js/editor*','/assets/css/editor*'],exclude:[]},null,2)+'\n');
console.log('Built server-only Access boundary; no static administrative content.');
