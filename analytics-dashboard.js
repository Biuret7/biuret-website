document.addEventListener('DOMContentLoaded', () => {
  const copy = {
    en: { title: 'A clearer view of your audience.', intro: 'Private traffic insights, measured from the day analytics was enabled.', refresh: 'Refresh', back: 'Back to profile', privacy: 'These figures describe browser activity, not verified people. We do not collect names, emails, precise location or IP addresses. Refreshing a page within one visit does not add another page view.', loading: 'Loading verified traffic data…', restricted: 'This page is available only to the site administrator.', unavailable: 'Traffic data is temporarily unavailable. Try refreshing.', all: 'Since measurement began', month: 'Last 30 days', visitors: 'Unique visitors', visits: 'Visits', views: 'Page views', trend: 'Daily page views', empty: 'No visits recorded yet. Data will appear as visitors browse the site.', pages: 'Visited pages', source: 'Arrival sources', device: 'Devices', browser: 'Browsers', language: 'Browser languages', updated: 'Updated', sampled: 'This period exceeds 5,000 page records. The breakdown shows the first 5,000; lifetime totals remain complete.' },
    ar: { title: 'صورة أوضح عن جمهور موقعك.', intro: 'إحصاءات زيارات خاصة تبدأ من يوم تفعيل القياس.', refresh: 'تحديث', back: 'العودة للملف الشخصي', privacy: 'هذه الأرقام تصف نشاط المتصفحات ولا تثبت عدد الأشخاص. لا نجمع الأسماء أو البريد أو الموقع الدقيق أو عناوين IP. تحديث الصفحة ضمن الزيارة نفسها لا يضيف مشاهدة جديدة.', loading: 'جارٍ تحميل بيانات الزيارات الموثقة…', restricted: 'هذه الصفحة متاحة فقط لمدير الموقع.', unavailable: 'إحصاءات الزيارات غير متاحة مؤقتاً. حاول التحديث.', all: 'منذ بدء القياس', month: 'آخر ٣٠ يوماً', visitors: 'زوار فريدون', visits: 'زيارات', views: 'مشاهدات الصفحات', trend: 'مشاهدات الصفحات يومياً', empty: 'لا توجد زيارات مسجلة بعد. ستظهر البيانات مع تصفح الزوار للموقع.', pages: 'الصفحات التي زاروها', source: 'مصادر الوصول', device: 'الأجهزة', browser: 'المتصفحات', language: 'لغة المتصفح', updated: 'آخر تحديث', sampled: 'الفترة تتجاوز ٥٬٠٠٠ سجل مشاهدة. التفاصيل تعرض أول ٥٬٠٠٠ سجل، بينما الإجمالي الكامل محفوظ.' }
  };
  const labels = { en: { direct: 'Direct / internal', academy: 'Biuret Academy', other: 'Other / unknown', desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile', ar: 'Arabic', en: 'English', '/': 'Home', '/certifications.html': 'Credentials' }, ar: { direct: 'مباشر / داخل الموقع', academy: 'أكاديمية Biuret', other: 'أخرى / غير معروف', desktop: 'كمبيوتر', tablet: 'جهاز لوحي', mobile: 'هاتف', ar: 'العربية', en: 'الإنجليزية', '/': 'الرئيسية', '/certifications.html': 'الشهادات' } };
  let data, status = 'loading', loading = false;
  const lang = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const number = (value) => new Intl.NumberFormat(lang()).format(value);
  const root = document.querySelector('[data-analytics-results]');
  const refresh = document.querySelector('[data-analytics-refresh]');
  function render() {
    const language = lang(), text = copy[language];
    document.querySelectorAll('[data-analytics-copy]').forEach((el) => { el.textContent = text[el.dataset.analyticsCopy]; });
    const notice = document.querySelector('[data-analytics-status]');
    notice.textContent = data && status === 'ready' ? `${text.updated}: ${new Date(data.loadedAt).toLocaleString(language)}` : text[status] || text.loading;
    root.hidden = !data;
    refresh.disabled = loading;
    if (!data) return;
    const metrics = (values) => `<div class="analytics-metrics">${['visitors', 'visits', 'views'].map((key) => `<article><span>${text[key]}</span><strong>${number(values[key])}</strong></article>`).join('')}</div>`;
    const daily = Array.from({ length: 30 }, (_, i) => { const day = new Date(Date.now() - (29-i)*86400000).toISOString().slice(0,10); return [day, data.daily[day] || 0]; });
    const max = Math.max(1, ...daily.map(([,count]) => count));
    const breakdown = (key, title) => {
      const rows = Object.entries(data.groups[key]).sort((a,b) => b[1]-a[1]).slice(0, 12);
      return `<section class="analytics-panel"><h2>${title}</h2>${rows.length ? `<ol class="analytics-ranking">${rows.map(([name,count]) => `<li><span dir="auto">${esc(labels[language][name] || name)}</span><b>${number(count)}</b></li>`).join('')}</ol>` : `<p>${text.empty}</p>`}</section>`;
    };
    root.innerHTML = `<h2 class="analytics-period">${text.all}</h2>${metrics(data.totals)}<h2 class="analytics-period">${text.month}</h2>${metrics(data.period)}<section class="analytics-panel"><h2>${text.trend}</h2><ol class="analytics-chart">${daily.map(([day,count]) => `<li title="${day}: ${number(count)}" aria-label="${day}: ${number(count)}"><i style="--bar-height:${count/max*100}%"></i><span>${day.slice(8)}</span></li>`).join('')}</ol></section><div class="analytics-breakdowns">${breakdown('path',text.pages)}${breakdown('source',text.source)}${breakdown('device',text.device)}${breakdown('browser',text.browser)}${breakdown('language',text.language)}</div>${data.sampled ? `<p class="analytics-notice">${text.sampled}</p>` : ''}`;
  }
  async function load() {
    if (loading) return;
    loading = true; status = 'loading'; render();
    try {
      await window.BiuretAppwrite.getCurrentUser();
      data = { ...await window.BiuretAnalytics.call('stats'), loadedAt: Date.now() }; status = 'ready';
    } catch (failure) {
      data = null;
      status = [401,403].includes(failure.status) || failure.code === 401 ? 'restricted' : 'unavailable';
    }
    loading = false; render();
  }
  new MutationObserver(render).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
  refresh.addEventListener('click',load);
  load();
});
