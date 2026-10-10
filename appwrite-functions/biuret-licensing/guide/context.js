const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const words = value => (normalize(value).match(/[\p{L}\p{N}]+/gu)||[]).map(w => w.replace(/^(?:وال|بال|لل|ال)(?=[\u0600-\u06ff]{3})/,'').replace(/^(?:وال|ال|و|ب|ل|ف)(?=[a-z0-9])/i,''));
const stop = new Set(['the','a','an','is','what','how','i','can','my','it','and','in','to','do','where','this','that','في','من','عن','ما','هل','كيف','انا','اي','شو','وين','بدي','هذا','هاي','طيب','هو','هي']);
const anchors = {portfolio:['guide-scope','site-owner','biuret-sites','projects'], academy:['academy-navigation','paths','access','site-owner'], playground:['playground-tool-choice','software','data','site-owner']};

// Rank only maintained public cards; no browser fetching, account data or vector service.
export function selectContext(cards, {question, site, locale, history=[]}) {
  const terms = [...new Set(words([question,...history.map(h=>h.question)].join(' ')).filter(w=>!stop.has(w)))];
  const questionText = normalize(question);
  const scope = site === 'all' ? ['portfolio','academy','playground'] : [site];
  const recentIds = new Set(history.flatMap(h=>h.sourceIds));
  const anchorIds = new Set(scope.flatMap(s=>anchors[s]||[]));
  const ranked = cards.map(card => {
    const title = words(`${card.title.en} ${card.title.ar}`), keys = words((card.keywords||[]).join(' '));
    const body = words(`${card.body.en} ${card.body.ar}`);
    let score = terms.reduce((n,w)=>n+(title.includes(w)?7:keys.includes(w)?5:body.includes(w)?1:0),0);
    // Explicit specialty codes outweigh generic words in long comparisons.
    if (card.id.startsWith('path-path_') && terms.includes(card.id.slice('path-path_'.length))) score += 40;
    if (Object.values(card.title).some(t=>questionText.includes(normalize(t)))) score += 30;
    if (recentIds.has(card.id)) score += 12;
    if (scope.includes(card.site) && score) score += 2;
    if (anchorIds.has(card.id)) score += 3;
    return {card,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const selected = [], seen = new Set(); let size=0;
  for (const {card} of ranked) {
    if (selected.length>=14 || seen.has(card.id)) continue;
    const value={id:card.id,site:card.site,title:card.title[locale],body:card.body[locale],steps:card.steps?.[locale]||[]};
    const length=JSON.stringify(value).length;
    if (size+length>18000) continue;
    selected.push(value);seen.add(card.id);size+=length;
  }
  return selected;
}

export function checkedHistory(value, cards) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length>3) throw SyntaxError('invalid_history');
  const known = new Set(cards.map(c=>c.id));
  return value.map(h=> {
    if (!h || typeof h!=='object' || typeof h.question!=='string' || h.question.trim().length<2 || h.question.length>500 ||
      !Array.isArray(h.sourceIds) || h.sourceIds.length>5 || h.sourceIds.some(id=>typeof id!=='string'||!known.has(id))) throw SyntaxError('invalid_history');
    // Drop all caller-supplied answers, profiles, roles and instructions.
    return {question:h.question.trim(),sourceIds:[...new Set(h.sourceIds)]};
  });
}
