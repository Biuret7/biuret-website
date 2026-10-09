export const normalize=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const tokens=value=>normalize(value).match(/[\p{L}\p{N}]+/gu)||[];
const stem=value=>/^[\u0600-\u06ff]+$/.test(value)?value.replace(/^(?:وال|بال|فال|لل|ال)(?=.{3})/,''):value;
const ignored=new Set(['the','a','an','i','how','do','to','my','is','can','what','where','want','for','and','كيف','هل','ما','ماذا','اين','اريد','في','عن','من','انا','ان']);
const pathOf=value=>String(value||'index.html').split(/[?#]/)[0].split('/').pop()||'index.html';
export function contextCards(cards,site,path){return cards.filter(c=>c.site===site&&!c.targetSite&&pathOf(c.path)===pathOf(path)).slice(0,3);}
export function retrieve(question,cards,site,path){
  const query=normalize(question),words=tokens(question).map(stem).filter(w=>!ignored.has(w));if(!words.length)return [];
  return cards.filter(c=>c.site===site).map(card=>{let score=0;for(const key of card.keywords||[]){const parts=tokens(key).map(stem);score+=parts.length>1?(query.includes(normalize(key))?5:0):(words.includes(parts[0])?3:0);}const titles=tokens(card.title.en+' '+card.title.ar).map(stem);score+=words.filter(w=>titles.includes(w)).length;if(score&&pathOf(card.path)===pathOf(path)&&!card.targetSite)score++;return {card,score};}).filter(x=>x.score>1).sort((a,b)=>b.score-a.score).slice(0,2).map(x=>x.card);
}
export function sourceURL(card,currentSite=card.site,currentLocation=globalThis.location){
  const bases={portfolio:'https://biuret.dev/',academy:'https://academy.biuret.dev/',playground:'https://demos.biuret.dev/'},target=card.targetSite||card.site;
  if(!Object.hasOwn(bases,target)||typeof card.path!=='string'||!/^[a-z0-9/#?=&_.-]+$/i.test(card.path)||card.path.includes('..')||card.path.startsWith('//'))throw Error('Invalid guide source');
  const local=currentLocation&&(currentLocation.hostname==='localhost'||currentLocation.hostname==='127.0.0.1');
  return new URL(card.path,local&&target===currentSite?currentLocation.origin+'/':bases[target]).href;
}
