// Public metadata only. Never import Academy server libraries or assessment banks.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { academyPaths } from '../../Biuret_Academy_Web/path-catalog-data.js';
const root = new URL('../', import.meta.url);
const baseFile = new URL('guide/knowledge-base.json', root);
const cards = JSON.parse(readFileSync(baseFile, 'utf8'));
const faq = JSON.parse(readFileSync(new URL('guide/faq.json', root), 'utf8'));
cards.push(...faq);
const add = (id, path, title, body, keywords, site = 'academy') => cards.push({id, site, path, title, body, keywords});
add('all-learning-paths','paths.html',{en:'All available learning paths',ar:'جميع المسارات التعليمية'},Object.fromEntries(['en','ar'].map(lang=>[lang,academyPaths.map(p=>`${p.title[lang]}: ${p.summary[lang]}`).join('\n')+'\n'+(lang==='ar'?'الأساسيات مجانية. أكملها قبل التخصص، ثم افتح المسار لمراجعة دوراته وتطبيقاته ومتطلباته. الشراء مغلق حالياً.':'Foundations are free. Complete them before specializing, then open a path for its courses, practice and requirements. Purchasing is currently closed.')])),['all paths','available paths','specialties','specializations','مسارات','تخصصات','متاحة','جميع المسارات','كل المسارات']);
const uniqueCourses=[...new Map(academyPaths.flatMap(p=>p.courses).map(c=>[c.id,c])).values()];
add('all-learning-courses','courses.html',{en:'Browse the course catalog',ar:'تصفح فهرس الدورات'},Object.fromEntries(['en','ar'].map(lang=>[lang,uniqueCourses.map(c=>c.title[lang]).join(' · ')+'\n'+(lang==='ar'?'افتح الدورة من مسارها وراجع ترتيب الدروس ووصول حسابك. الدورات الظاهرة في الفهرس ليست كلها مفتوحة لكل حساب.':'Open a course from its path to review ordered lessons and account access. A catalog entry does not mean every account can access it.')])),['all courses','course catalog','دورات','كورسات','كل الدورات','جميع الكورسات']);
for (const p of academyPaths) {
  const body = Object.fromEntries(['en','ar'].map(lang => [lang, [p.summary[lang],
    `${lang === 'ar' ? 'النتائج التعليمية' : 'Learning outcomes'}: ${p.outcomes[lang].join(' · ')}`,
    `${lang === 'ar' ? 'الدورات' : 'Courses'}: ${p.courses.map(c => c.title[lang]).join(' · ')}`,
    ...['quizzes','labs','challenges','operations'].map(kind => `${lang==='ar'?{quizzes:'كويزات التدريب',labs:'المختبرات',challenges:'التحديات',operations:'غرف العمليات'}[kind]:kind}: ${(p[kind] || []).map(c => c.title[lang]).join(' · ')}`),
    lang === 'ar' ? 'راجع صفحة المسار لمتطلبات الدروس وامتحانات الدورات والتقييم العملي والامتحان النهائي والشهادة. الشراء مغلق؛ وجود المورد في الفهرس لا يعني أنه مفتوح لحسابك.' : 'The path page shows lesson, course exam, practical assessment, final exam and credential requirements. Purchases are closed; catalog listing does not imply account access.'
  ].join('\n')]));
  add(`path-${p.id}`, `path.html?id=${p.id}`, p.title, body, [p.id,...Object.values(p.title),...Object.values(p.outcomes).flat()]);
  for (const c of p.courses) if (!cards.some(x => x.id === `course-${c.id}`)) {
    add(`course-${c.id}`, c.href, c.title, {
      en: `${c.summary.en} Contains ${c.lessonIds.length} lessons. Related path: ${p.title.en}. Open the course for its ordered lessons and current access; complete verified requirements before its exam.`,
      ar: `${c.summary.ar} تضم ${c.lessonIds.length} دروس. المسار المرتبط: ${p.title.ar}. افتح الدورة لترتيب الدروس والوصول الحالي، وأكمل المتطلبات الموثّقة قبل الامتحان.`
    }, [c.id,...Object.values(c.title),'course','دورة','كورس']);
  }
  for (const kind of ['labs','challenges','operations','quizzes']) for (const r of p[kind] || []) {
    const id = `resource-${kind}-${r.id}`;
    const existing = cards.find(x => x.id === id);
    if (existing) { for (const lang of ['ar','en']) existing.body[lang] += ` · ${p.title[lang]}`; continue; }
    add(id, r.href, r.title, {
      en: `An educational ${kind} resource linked to ${p.title.en}. Open it from the path page and read its instructions and account access requirements. It is distinct from the path final exam. Related paths: ${p.title.en}`,
      ar: `مورد تطبيقي تعليمي مرتبط بمسار ${p.title.ar}. افتحه من صفحة المسار واقرأ التعليمات ومتطلبات الوصول لحسابك. هذا المورد يختلف عن الامتحان النهائي للمسار. المسارات المرتبطة: ${p.title.ar}`
    }, [r.id,...Object.values(r.title),kind,{labs:'مختبر',challenges:'تحدي',operations:'غرفة عمليات',quizzes:'كويز'}[kind]]);
  }
}
const projects = [
 ['biulock','BiuLock','خزنة شخصية محلية','a local-first personal vault'],
 ['b-recon','B-Recon','مساحة بحث OSINT مصرح به','an authorized OSINT research workspace'],
 ['biucrypt','BiuCrypt','أداة مكتبية لحماية الملفات','a desktop file protection utility'],
 ['biusniff','BiuSniff','أداة لتحليل حركة الشبكة','a network traffic analysis tool'],
 ['biuret-reaper','Biuret Reaper','أداة لاكتشاف الشبكات المصرح بها','an authorized network discovery tool'],
 ['biuret-academy','Biuret Academy','منصة متكاملة لتعلم الأمن السيبراني','a complete cybersecurity learning platform']
];
for (const [slug,name,ar,en] of projects) add(`concept-${slug}`,`sites/${slug}.html`,{en:name,ar:name},
 {en:`${name} is a future concept for ${en}. Its existing code is experimental, not a completed release. The detail page explains its intended audience, proposed features and roadmap.${slug==='biuret-academy'?' A separate, smaller Academy web pilot is live.':''}`,
 ar:`${name} فكرة مستقبلية لـ${ar}. الشيفرة الحالية تجريبية وليست إصداراً مكتملاً. تشرح صفحة المشروع المستفيد والميزات المقترحة وخارطة التنفيذ.${slug==='biuret-academy'?' تعمل نسخة ويب مصغّرة مستقلة من الأكاديمية حالياً.':''}`},[name,slug,en,ar,'project','مشروع'],'portfolio');
const ids = new Set();
for (const c of cards) { if (ids.has(c.id) || !c.title.en || !c.title.ar || !c.body.en || !c.body.ar) throw Error(`Invalid card ${c.id}`); ids.add(c.id); }
const json = JSON.stringify(cards,null,2)+'\n';
for (const target of ['guide/knowledge.json','appwrite-functions/biuret-licensing/guide/knowledge.json']) writeFileSync(new URL(target,root),json);
console.log(JSON.stringify({cards:cards.length,sites:Object.fromEntries(['portfolio','academy','playground'].map(s=>[s,cards.filter(c=>c.site===s).length])),source:fileURLToPath(root)}));
