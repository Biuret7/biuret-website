(() => {
  const script = document.currentScript;
  const asset = new URL('./', script.src);
  const site = script.dataset.site || 'portfolio';
  const endpoint = script.dataset.api || '';
  const root = document.createElement('div'); root.className = 'biuret-guide'; root.setAttribute('translate','no');
  document.body.append(root);
  const launcher = document.createElement('button'); launcher.className = 'bg-launch'; launcher.type = 'button'; launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-expanded','false');
  const dialog = document.createElement('dialog'); dialog.className = 'bg-panel'; dialog.setAttribute('aria-labelledby','bg-title');
  const header = document.createElement('header'); header.className = 'bg-header';
  const title = document.createElement('h2'); title.id = 'bg-title'; title.textContent = 'Biuret Guide';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'bg-close'; close.textContent = '×';
  header.append(title, close);
  const intro = document.createElement('p'); intro.className = 'bg-intro';
  const suggestions = document.createElement('div'); suggestions.className = 'bg-suggestions';
  const conversation = document.createElement('div'); conversation.className = 'bg-conversation'; conversation.setAttribute('role','log'); conversation.setAttribute('aria-live','polite');
  const consentLabel = document.createElement('label'); consentLabel.className = 'bg-consent'; consentLabel.hidden = true;
  const consent = document.createElement('input'); consent.type='checkbox'; const consentCopy=document.createElement('span'); consentLabel.append(consent,consentCopy);
  const form = document.createElement('form'); form.className='bg-form';
  const label=document.createElement('label'); label.htmlFor='bg-question';
  const input=document.createElement('input'); input.id='bg-question'; input.maxLength=500; input.required=true; input.minLength=2; input.autocomplete='off';
  const send=document.createElement('button'); send.type='submit';
  const status=document.createElement('p'); status.className='bg-status'; status.setAttribute('role','status');
  const privacy=document.createElement('p'); privacy.className='bg-privacy';
  form.append(label,input,send); dialog.append(header,intro,suggestions,conversation,consentLabel,form,status,privacy); root.append(launcher,dialog);
  let cards=[], core, configured=false, busy=false, opened=false;
  const exchanges=[];
  const en=()=>document.documentElement.lang!=='ar';
  const tr=(english,arabic)=>en()?english:arabic;
  const starter={portfolio:['projects','credentials','playground-link'],academy:['start','assessments','credentials-academy'],playground:['availability','planning','data']};
  function appendAnswer(parent, matches, remote) {
    if(remote){const p=document.createElement('p');p.textContent=remote.answer;parent.append(p);}
    for(const card of matches){
      if(!remote){const h=document.createElement('h3');h.textContent=card.title[en()?'en':'ar'];const p=document.createElement('p');p.textContent=card.body[en()?'en':'ar'];parent.append(h,p);}
      const link=document.createElement('a');link.href=core.sourceURL(card);link.textContent=card.title[en()?'en':'ar']+' ↗';parent.append(link);
    }
    if(!matches.length){const p=document.createElement('p');p.textContent=site==='playground'?tr('I could not match that to a tool topic. Ask about study plans, the focus timer, JSON or file fingerprints, or choose a suggestion above. General programming answers are not available yet.','لم أجد موضوعاً مطابقاً في معلومات الأدوات. اسأل عن خطط التعلم أو مؤقّت التركيز أو JSON أو بصمة الملفات، أو اختر اقتراحاً أعلاه. إجابات البرمجة العامة غير متاحة بعد.'):tr('I could not match that to a site topic. Ask about learning, certificates, projects or your account, or use one of the suggestions above. This guide does not answer general programming questions yet.','لم أجد موضوعاً مطابقاً في معلومات الموقع. اسأل عن التعلم أو الشهادات أو المشاريع أو الحساب، أو اختر اقتراحاً أعلاه. الدليل لا يجيب حالياً عن أسئلة البرمجة العامة.');parent.append(p);}
  }
  function render(){
    root.dir=en()?'ltr':'rtl';launcher.textContent='✦ Biuret Guide';launcher.setAttribute('aria-label',tr('Open Biuret Guide','افتح دليل Biuret'));close.setAttribute('aria-label',tr('Close guide','إغلاق الدليل'));
    intro.textContent=tr('Find your next step. Answers come from curated site information; an AI model is not connected yet.','اعرف خطوتك القادمة. الإجابات من معلومات الموقع المعدّة مسبقاً؛ لم يُربط نموذج ذكاء اصطناعي بعد.');
    if(configured) intro.textContent=tr('Use the site guide, or optionally enable the connected model below.','استخدم دليل الموقع، أو فعّل النموذج المتصل اختيارياً أدناه.');
    label.textContent=tr('What would you like to find?','عن ماذا تبحث؟');input.placeholder=tr('How do I start learning?','كيف أبدأ التعلم؟');send.textContent=tr('Ask','اسأل');send.disabled=busy||!core;
    privacy.textContent=tr('Guide history stays in memory until you reload. Do not enter passwords, payment details or private reports. It cannot change your account or complete assessments.','يبقى سجل الدليل مؤقتاً حتى تحديث الصفحة. لا تدخل كلمات مرور أو معلومات دفع أو تقارير خاصة. لا يمكنه تغيير حسابك أو إكمال التقييمات.');
    consentCopy.textContent=tr('Send my question to the configured AI service for this reply.','أرسل سؤالي لخدمة الذكاء الاصطناعي المتصلة لهذه الإجابة.');
    suggestions.replaceChildren();
    for(const id of starter[site]||[]){const card=cards.find(c=>c.id===id);if(!card)continue;const button=document.createElement('button');button.type='button';button.textContent=card.title[en()?'en':'ar'];button.disabled=busy;button.addEventListener('click',()=>ask(button.textContent,[card]));suggestions.append(button);}
    conversation.replaceChildren();
    if(!exchanges.length){const welcome=document.createElement('p');welcome.className='bg-welcome';welcome.textContent=tr('Choose a topic above, or ask a question about this site below.','اختر موضوعاً أعلاه، أو اكتب سؤالك عن الموقع أدناه.');conversation.append(welcome);}
    for(const exchange of exchanges){const block=document.createElement('article');block.className='bg-exchange';const q=document.createElement('p');q.className='bg-question';q.textContent=exchange.question;block.append(q);appendAnswer(block,exchange.matches,exchange.locale===(en()?'en':'ar')?exchange.remote:null);conversation.append(block);}
  }
  async function ask(question, matches){
    if(busy||!core||question.trim().length<2)return;
    busy=true;status.textContent=tr('Finding site information…','جارٍ البحث في معلومات الموقع…');render();
    const locale=en()?'en':'ar';let remote=null;
    matches=matches||core.retrieve(question,cards,site);
    if(configured&&consent.checked){
      try { const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,locale,site}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('unavailable');const value=await response.json();const sources=cards.filter(c=>c.site===site&&value.sourceIds?.includes(c.id));if(typeof value.answer!=='string'||value.answer.length>4000||!sources.length)throw new Error('invalid');remote=value;matches=sources; }
      catch {status.textContent=tr('AI is unavailable. Showing the site guide instead.','النموذج غير متاح. نعرض معلومات دليل الموقع.');}
    }else status.textContent=tr('Answered from the site guide.','إجابة من دليل الموقع.');
    if(remote)status.textContent=tr('AI reply. Check the linked site sources.','إجابة النموذج. راجع مصادر الموقع المرفقة.');
    exchanges.push({question,matches,remote,locale});if(exchanges.length>10)exchanges.shift();input.value='';busy=false;render();conversation.scrollTop=conversation.scrollHeight;input.focus();
  }
  launcher.addEventListener('click',()=>{dialog.showModal();opened=true;launcher.setAttribute('aria-expanded','true');input.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{opened=false;launcher.setAttribute('aria-expanded','false');launcher.focus();});
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value.trim());});
  new MutationObserver(()=>{render();status.textContent='';}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();
  Promise.all([import(new URL('core.mjs?v=20261009-pg3',asset)),fetch(new URL('knowledge.json?v=20261009-pg3',asset)).then(r=>{if(!r.ok)throw new Error();return r.json();})]).then(([module,data])=>{core=module;cards=data;render();}).catch(()=>{status.textContent=tr('Guide information could not load. Reload to retry.','تعذّر تحميل معلومات الدليل. حدّث الصفحة للمحاولة.');});
  // Only an explicitly configured endpoint can be queried. No provider key belongs here.
  if(endpoint)fetch(endpoint+'/status',{signal:AbortSignal.timeout(4000)}).then(r=>r.ok?r.json():null).then(value=>{configured=value?.configured===true;consentLabel.hidden=!configured;render();}).catch(()=>{});
})();
