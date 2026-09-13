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
  const validPriceId = (priceId) => /^pri_[a-z\d]{26}$/i.test(priceId);

  function checkoutErrorCopy(error) {
    const message = String(error?.message || '').trim();
    const lower = message.toLowerCase();
    const code = Number(error?.code || error?.status || 0);

    if (lower.includes('sign in is required') || lower.includes('not authenticated')) {
      return [
        'Sign in to your Biuret account before checkout.',
        'سجّل الدخول إلى حساب Biuret قبل إتمام الشراء.'
      ];
    }
    if (lower.includes('verify your email')) {
      return [
        'Verify your email from your Biuret account, then try checkout again.',
        'أكّد بريدك الإلكتروني من حساب Biuret ثم حاول الشراء مرة أخرى.'
      ];
    }
    if (lower.includes('unknown product') || lower.includes('invalid price')) {
      return [
        'This plan is not configured in the licensing service yet.',
        'هذه الخطة غير مهيأة في خدمة التراخيص بعد.'
      ];
    }
    if (lower.includes('appwrite') && lower.includes('not configured')) {
      return [
        'The account service is not configured on this site yet.',
        'خدمة الحساب غير مهيأة في الموقع بعد.'
      ];
    }
    if (lower.includes('domain') && (lower.includes('approv') || lower.includes('allow') || lower.includes('whitelist'))) {
      return [
        'Approve biuret.dev in Paddle Checkout settings before opening Sandbox checkout.',
        'يجب اعتماد biuret.dev في إعدادات Paddle Checkout قبل فتح الدفع التجريبي.'
      ];
    }
    if (lower.includes('not configured') || lower.includes('licensing function') || lower.includes('licensing service')) {
      return [
        'The licensing function is not deployed or configured in Appwrite yet.',
        'لم يتم نشر أو إعداد Function التراخيص في Appwrite بعد.'
      ];
    }
    if (code === 401 || code === 403) {
      return [
        'Your Biuret session is not authorized. Sign in again and retry.',
        'جلسة Biuret غير مصرح بها. سجّل الدخول مجددًا ثم حاول.'
      ];
    }
    if (code === 429) {
      return [
        'The checkout service is temporarily rate-limited. Try again shortly.',
        'خدمة الشراء محدودة مؤقتًا. حاول بعد قليل.'
      ];
    }
    if (code >= 500) {
      return [
        'The licensing function returned a server error. Check its Appwrite deployment and variables.',
        'أعادت Function التراخيص خطأً من الخادم. تحقّق من نشرها ومتغيراتها في Appwrite.'
      ];
    }
    return [
      'Checkout is not ready. Deploy and configure the Biuret Licensing function, then try again.',
      'الشراء غير جاهز. انشر واضبط Function ‏Biuret Licensing ثم حاول مجددًا.'
    ];
  }

  function initializePaddle() {
    if (paddleInitialized) return;
    if (!window.Paddle || !config.clientToken) throw new Error('Paddle.js is unavailable.');
    if (config.environment === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: config.clientToken,
      eventCallback(event) {
        if (event?.name === 'checkout.completed') {
          setStatus(
            'Payment completed. Your license will appear in your account after secure server verification.',
            'اكتمل الدفع. سيظهر الترخيص في حسابك بعد تحقّق الخادم الآمن.',
            'success'
          );
        }
        if (event?.name === 'checkout.error') {
          const [english, arabic] = checkoutErrorCopy(event?.data?.error || event?.data || new Error('Paddle checkout error.'));
          setStatus(english, arabic, 'error');
        }
      }
    });
    paddleInitialized = true;
  }

  async function openCheckout(button) {
    const product = button.dataset.product;
    const plan = button.dataset.plan;

    if (!window.BiuretAppwrite?.configured) {
      const [english, arabic] = checkoutErrorCopy(new Error('Appwrite is not configured.'));
      setStatus(english, arabic, 'error');
      return;
    }

    try {
      await window.BiuretAppwrite.getCurrentUser();
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('not configured')) {
        const [english, arabic] = checkoutErrorCopy(error);
        setStatus(english, arabic, 'error');
        return;
      }
      const redirect = `licenses.html?product=${encodeURIComponent(product)}&plan=${encodeURIComponent(plan)}`;
      window.location.assign(`auth.html?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    try {
      initializePaddle();
      button.disabled = true;
      setStatus('Preparing your secure checkout…', 'جارٍ تجهيز عملية الشراء الآمنة…', 'neutral');
      const intent = await window.BiuretAppwrite.createCheckoutIntent({
        productSlug: product,
        plan
      });
      if (!validPriceId(intent.priceId)) throw new Error('The licensing service returned an invalid price.');
      setStatus('Opening secure Paddle checkout…', 'جارٍ فتح صفحة الدفع الآمنة…', 'neutral');
      window.Paddle.Checkout.open({
        items: [{ priceId: intent.priceId, quantity: 1 }],
        customData: intent.customData
      });
    } catch (error) {
      console.error('Unable to open Paddle checkout.', error);
      const [english, arabic] = checkoutErrorCopy(error);
      setStatus(
        english,
        arabic,
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
