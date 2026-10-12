import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(readFileSync(path.join(root,'theme-sources.json'),'utf8'));
const scope='html[data-theme="light"]';
function parts(text,delimiter) {
 const result=[];let start=0,depth=0,quote='';
 for(let i=0;i<text.length;i++) { const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(c===delimiter&&depth===0){result.push(text.slice(start,i));start=i+1;} }
 result.push(text.slice(start));return result;
}
function palette(r,g,b,a,kind) {
 const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/510,d=max-min;
 let h=0,s=0;
 if(d) {s=d/(255-Math.abs(max+min-255));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=((h*60)%360+360)%360;}
 let light,sat;
 if(kind==='background') {if(l>.45&&s>.4){light=l;sat=s;}else{light=l<.4?.96-l*.32:.90;sat=s*.18;}}
 else if(kind==='border') {light=l<.42?.58+l*.45:.36;sat=Math.min(s,.25);}
 else if(kind==='shadow') return `rgba(20,35,25,${Math.min(a,.16)})`;
 else {light=l>.42?.10+(1-l)*.26:.10+l*.24;sat=Math.min(s,.72);}
 return `hsla(${h.toFixed(1)},${(sat*100).toFixed(1)}%,${(light*100).toFixed(1)}%,${a})`;
}
function color(value,property) {
 if(/mask|filter|image-rendering/.test(property))return value;
 const kind=/shadow/.test(property)?'shadow':/(?:background|^--(?:bg|panel|surface|ui-surface|ui-raised))/.test(property)?'background':/(?:border|^--(?:line|ui-border))/.test(property)?'border':'text';
 return value.replace(/url\([^)]*\)|#[a-f0-9]{3,8}\b|rgba?\(\s*[\d.,\s%]+\)|\b(?:white|black)\b/gi,token=>{
  if(/^url/i.test(token))return token;
  let rgba;
  if(token[0]==='#') {let hex=token.slice(1);if(hex.length===3||hex.length===4)hex=[...hex].map(c=>c+c).join('');if(![6,8].includes(hex.length))return token;rgba=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));rgba.push(hex.length===8?+(parseInt(hex.slice(6),16)/255).toFixed(3):1);}
  else if(/^rgba?/i.test(token)){const v=token.match(/[\d.]+%?/g);if(v.length<3)return token;rgba=v.map((x,i)=>x.endsWith('%')?parseFloat(x)*(i<3?2.55:.01):+x);if(rgba.length===3)rgba.push(1);}
  else rgba=token.toLowerCase()==='white'?[255,255,255,1]:[0,0,0,1];
  return palette(...rgba,kind);
 });
}
function declarations(body) {
 return parts(body,';').map(entry=>{const i=entry.indexOf(':');if(i<0)return '';const property=entry.slice(0,i).trim(),value=entry.slice(i+1).trim();
  if(!/color|background|border|shadow|fill|stroke|^--/.test(property)||!/#|rgba?\(|\b(?:white|black)\b|var\(/i.test(value))return '';
  return property+':'+color(value,property)+';';}).join('');
}
function selector(value) {
 return parts(value,',').map(s=>{s=s.trim();if(s.includes(':root'))return s.replace(/:root/g,scope);if(/^html\b/.test(s))return s.replace(/^html/,scope);if(/^\[(?:dir|lang)[=\]]/.test(s))return scope+s;if(s.startsWith('.workspace-embedded'))return scope+s;return scope+' '+s;}).join(',');
}
function rules(css) {
 css=css.replace(/\/\*[\s\S]*?\*\//g,'');let out='',start=0;
 while(start<css.length) {
  const open=css.indexOf('{',start);if(open<0)break;let head=css.slice(start,open).trim();let depth=1,quote='',i=open+1;
  for(;i<css.length&&depth;i++){const c=css[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='{')depth++;if(c==='}')depth--;}
  if(depth)throw Error('Unbalanced CSS block');const body=css.slice(open+1,i-1);start=i;
  if(/^@(?:media|supports|container|layer)\b/.test(head)){const inner=rules(body);if(inner)out+=head+'{'+inner+'}\n';}
  else if(!head.startsWith('@')){head=head.slice(head.lastIndexOf(';')+1).trim();const d=declarations(body);if(d)out+=selector(head)+'{'+d+'}\n';}
 }
 return out;
}
let result='/* Generated light surfaces from the source cascade. Images and layout are unchanged. */\n';
for(const file of config.css){if(!existsSync(path.join(root,file)))throw Error('Missing theme source: '+file);result+='/* '+file+' */\n'+rules(readFileSync(path.join(root,file),'utf8'));}
result+=readFileSync(path.join(root,'theme-controls.css'),'utf8');
writeFileSync(path.join(root,'theme.css'),result);
console.log('Generated light palette for '+config.css.length+' stylesheets.');
