// Server-side validation for the only content files the editor can publish.
export class PublishError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=message=>{throw new PublishError(400,message);};
const siteStrings='name tagline status statusNote heroHeading heroText aboutHeading aboutText aboutNote hours pickup cutoff refunds allergens footerNote domain basePath currency timezone email phone instagram facebook squareUrl serviceArea socialImage socialImageAlt orderOpens orderCloses'.split(' ');
const itemStrings='id name description category allergens image imageAlt imageShape squareUrl notes storage orderOpens orderCloses'.split(' ');
const itemBools='available soldOut featured seasonal'.split(' ');
const eventStrings='id name address start end mapUrl description status menuNote'.split(' ');
function shape(obj,strings,bools=[],numbers=[],arrays=[]){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))fail('Invalid content entry.');
 const keys=[...strings,...bools,...numbers,...arrays];
 if(Object.keys(obj).length!==keys.length||Object.keys(obj).some(k=>!keys.includes(k)))fail('Unknown or missing content fields.');
 for(const k of strings)if(typeof obj[k]!=='string'||obj[k].length>12000)fail(`${k} must be text of at most 12,000 characters.`);
 for(const k of bools)if(typeof obj[k]!=='boolean')fail(`${k} must be true or false.`);
 for(const k of numbers)if(typeof obj[k]!=='number'||!Number.isFinite(obj[k]))fail(`${k} must be a number.`);
 for(const k of arrays)if(!Array.isArray(obj[k])||obj[k].length>30||obj[k].some(v=>typeof v!=='string'||v.length>100))fail(`${k} must be a short list of text.`);
}
function url(value,square=false){
 if(!value)return;
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||/[\s<>"\\]/.test(value))throw Error();if(square&&!['square.link','squareup.com','checkout.square.site'].includes(u.hostname)&&!u.hostname.endsWith('.square.site'))throw Error();}
 catch{fail('Use a valid HTTPS link'+(square?' hosted by Square.':'.'));}
}
function date(value){if(!value)return null;if(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))fail('Dates need a valid time-zone offset.');return Date.parse(value);}
function window(obj){const start=date(obj.orderOpens),end=date(obj.orderCloses);if(start!==null&&end!==null&&start>=end)fail('Ordering must close after it opens.');}
export function validateContent(data,files){
 if(!data||typeof data!=='object'||Object.keys(data).sort().join(',')!=='events,menu,site')fail('Content must contain site, menu and events only.');
 const {site,menu,events}=data;
 shape(site,siteStrings,['demo','orderingEnabled']);
 if(!Array.isArray(menu)||menu.length>200||!Array.isArray(events)||events.length>200)fail('Keep menu and events below 200 entries each.');
 if(!['coming_soon','open_today','preorders_open','preorders_closed','sold_out','closed','next_popup'].includes(site.status))fail('Invalid business status.');
 if(!['USD','CAD','GBP','AUD','EUR'].includes(site.currency))fail('Invalid currency.');
 try{new Intl.DateTimeFormat('en',{timeZone:site.timezone});}catch{fail('Invalid time zone.');}
 if(site.basePath!=='')fail('Hosted publishing requires an empty website subfolder.');
 url(site.domain);if(site.domain){const u=new URL(site.domain);if(!['','/'].includes(u.pathname)||u.search||u.hash)fail('Domain must be an HTTPS origin.');}
 if(site.email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(site.email))fail('Invalid contact email.');
 for(const k of ['instagram','facebook','squareUrl'])url(site[k],k==='squareUrl');
 const asset=path=>{if(path&&(!/^assets\/[A-Za-z0-9_./-]+\.(svg|jpg|jpeg|png|webp)$/i.test(path)||path.includes('..')||!files.has(path)))fail('Choose an existing uploaded image.');};
 asset(site.socialImage);if(site.socialImage&&!site.socialImageAlt.trim())fail('Describe the sharing image.');window(site);
 let ids=new Set();
 for(const i of menu){shape(i,itemStrings,itemBools,['price','position'],['dietary']);if(!/^[a-z0-9-]+$/.test(i.id)||ids.has(i.id)||!i.name.trim()||!i.category.trim())fail('Each item needs a unique ID, name and category.');ids.add(i.id);
 if(i.price<0||i.price>100000||!Number.isInteger(i.position))fail('Invalid price or position.');
 if(!['square','portrait','landscape'].includes(i.imageShape))fail('Invalid image shape.');asset(i.image);if(i.image&&!i.imageAlt.trim())fail('Describe each product photo.');url(i.squareUrl,true);window(i);}
 ids=new Set();for(const v of events){shape(v,eventStrings);if(!/^[a-z0-9-]+$/.test(v.id)||ids.has(v.id)||!v.name.trim())fail('Each stop needs a unique ID and name.');ids.add(v.id);const start=date(v.start),end=date(v.end);if(start===null||end===null||start>=end)fail('A stop needs a start and later end time.');if(!['confirmed','cancelled','tentative'].includes(v.status))fail('Invalid stop status.');url(v.mapUrl);}
 if(!site.demo&&(!site.domain||(site.orderingEnabled&&(!site.email||!(site.squareUrl||menu.some(i=>i.squareUrl))))))fail('Live mode requires a domain; ordering requires contact details and a Square link.');
 return data;
}
export async function readLimited(request,max){
 if(Number(request.headers.get('content-length'))>max)throw new PublishError(413,'File or content is too large.');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new PublishError(413,'File or content is too large.');}chunks.push(value);}
 const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
export async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function imageExtension(bytes,type){
 const match=(values,offset=0)=>values.every((v,n)=>bytes[n+offset]===v);
 if(type==='image/jpeg'&&match([255,216,255]))return 'jpg';
 if(type==='image/png'&&match([137,80,78,71,13,10,26,10]))return 'png';
 if(type==='image/webp'&&match([82,73,70,70])&&match([87,69,66,80],8))return 'webp';
 fail('Upload a JPG, PNG or WebP photo with matching file contents. SVG uploads are not accepted.');
}
