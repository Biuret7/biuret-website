import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {selectContext} from '../appwrite-functions/biuret-licensing/guide/context.js';
import {sourceURL} from '../guide/core.mjs';
const root=new URL('../',import.meta.url);
const cards=JSON.parse(readFileSync(new URL('guide/knowledge.json',root)));

test('expanded knowledge is bilingual, synchronized and cites real public pages only',()=>{
 assert.ok(cards.length>100);const ids=new Set();
 const roots={portfolio:root,academy:new URL('../../Biuret_Academy_Web/',import.meta.url),playground:new URL('../../Biuret_Playground/',import.meta.url)};
 for(const c of cards){assert.ok(!ids.has(c.id),c.id);ids.add(c.id);assert.ok(c.body.en&&c.body.ar&&c.title.en&&c.title.ar,c.id);assert.doesNotThrow(()=>sourceURL(c));assert.ok(existsSync(new URL(c.path.split(/[?#]/)[0],roots[c.targetSite||c.site])),c.path);}
 assert.deepEqual(cards,JSON.parse(readFileSync(new URL('appwrite-functions/biuret-licensing/guide/knowledge.json',root))));
 assert.equal(cards.filter(c=>c.id.startsWith('path-')).length,10);
 assert.equal(cards.filter(c=>c.id.startsWith('concept-')).length,6);
});

test('retrieval supports specialties, informal Arabic, file formats and cross-site requests',()=>{
 const cases=[['قارن SOC مع DFIR','all',['path-path_soc','path-path_dfir']],['كيف انزل شهادتي pdf؟','all',['certificate-downloads']],['ليش امتحان المسار مقفل؟','academy',['exam-locked']],['BiuLock جاهز ولا فكرة؟','all',['concept-biulock']],['workspace backup restore','playground',['workspace-backups']],['Which tool formats JSON?','portfolio',['json']]];
 for(const [question,site,ids]of cases){const selected=selectContext(cards,{question,site,locale:'ar'});for(const id of ids)assert.ok(selected.some(c=>c.id===id),`${question}: missing ${id}`);}
});

test('context remains bounded, includes referent facts and never carries arbitrary data',()=>{
 const selected=selectContext(cards,{question:'وكيف أبدأ فيه؟',site:'all',locale:'en',history:[{question:'SOC path',sourceIds:['path-path_soc']} ]});
 assert.ok(selected.some(c=>c.id==='path-path_soc'));assert.ok(selected.length<=14);assert.ok(selected.reduce((n,c)=>n+JSON.stringify(c).length,0)<=18000);
 for(const c of selected)assert.deepEqual(Object.keys(c),['id','site','title','body','steps']);
});
