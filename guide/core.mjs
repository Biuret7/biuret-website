export const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
export function retrieve(question, cards, site) {
  const query = normalize(question);
  const words = query.match(/[\p{L}\p{N}]+/gu) || [];
  return cards.filter(card => card.site === site).map(card => ({ card, score: card.keywords.reduce((total, key) => {
    const term = normalize(key);
    return total + (term.includes(' ') ? (query.includes(term) ? 4 : 0) : (words.includes(term) ? 2 : 0));
  }, 0) })).filter(item => item.score > 0).sort((a,b) => b.score-a.score).slice(0,2).map(item => item.card);
}
export function sourceURL(card) {
  const bases = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? {portfolio:'http://127.0.0.1:8766/', academy:'http://127.0.0.1:8768/', playground:'http://127.0.0.1:8767/'}
    : {portfolio:'https://biuret.dev/', academy:'https://academy.biuret.dev/', playground:'https://demos.biuret.dev/'};
  const target = card.targetSite || card.site;
  if (!Object.hasOwn(bases,target) || !/^[a-z0-9/#?=&_.-]+$/i.test(card.path) || card.path.includes('..') || card.path.startsWith('//')) throw new Error('Invalid guide source');
  return new URL(card.path, bases[target]).href;
}
