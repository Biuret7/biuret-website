(function () {
  const config = window.BIURET_PADDLE_CONFIG || {};
  let paddleInitialized = false;

  const getCopy = (english, arabic) => document.documentElement.lang === 'ar' ? arabic : english;
  const statusElement = () => document.querySelector('[data-license-checkout-status]');
  const setStatus = (english, arabic, kind = 'neutral') => {
    const element = statusElement();
    if (!element) return;
    element.textContent = getCopy(english, arabic);
    element.dataset.status = kind;
  };
  const getPriceId = (product, plan) => config.prices?.[product]?.[plan] || '';
  const validPriceId = (priceId) => /^pri_[a-z\d]{26}$/i.test(priceId);

  function initializePaddle() {
    if (paddleInitialized) return;
    if (!window.Paddle || !config.clientToken) throw new Error('Paddle.js is unavailable.');
    if (config.environment === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: config.clientToken,
      eventCallback(event) {
        if (event?.name === 'checkout.completed') {
          setStatus(
            'Sandbox checkout completed. License delivery is enabled only after the secure webhook is connected.',
            'اكتمل اختبار الدفع في بيئة Sandbox. تسليم الترخيص سيتفعّل بعد ربط Webhook الآمن.',
            'success'
          );
        }
      }
    });
    paddleInitialized = true;
  }

  async function openCheckout(button) {
    const product = button.dataset.product;
    const plan = button.dataset.plan;
    const priceId = getPriceId(product, plan);
    if (!validPriceId(priceId)) {
      setStatus(
        'Online checkout for this plan is being prepared. Please select an available plan or check back soon.',
        'الشراء الإلكتروني لهذه الخطة قيد التجهيز. اختر خطة متاحة أو عُد قريبًا.',
        'neutral'
      );
      return;
    }

    try {
      await window.BiuretAppwrite?.getCurrentUser();
    } catch {
      const redirect = `licenses.html?product=${encodeURIComponent(product)}&plan=${encodeURIComponent(plan)}`;
      window.location.assign(`auth.html?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    try {
      initializePaddle();
      button.disabled = true;
      setStatus('Opening secure Paddle checkout…', 'جارٍ فتح صفحة الدفع الآمنة…', 'neutral');
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { biuretProduct: product, biuretPlan: plan, environment: 'sandbox' }
      });
    } catch (error) {
      console.error('Unable to open Paddle checkout.', error);
      setStatus(
        'Checkout could not be opened. Please try again in a moment.',
        'تعذّر فتح صفحة الدفع. حاول مجددًا بعد لحظات.',
        'error'
      );
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-license-checkout]');
    if (!button || button.disabled) return;
    event.preventDefault();
    openCheckout(button);
  });
}());
