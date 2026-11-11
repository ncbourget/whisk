export function squareImage(url){
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(/^(items-images-(production|staging)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com)$/.test(u.hostname)||u.hostname==='square-cdn.com'||u.hostname.endsWith('.square-cdn.com'));}catch{return false;}
}
