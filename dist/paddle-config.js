/*
 * Paddle.js browser configuration.
 *
 * Client-side tokens are intentionally public and are limited to Paddle.js
 * checkout and price-preview operations. Never add a Paddle API key, webhook
 * secret, or any other server credential to this file.
 *
 * Price IDs will be entered after the products are created in the Paddle
 * sandbox catalog. Sandbox prices and live prices are intentionally separate.
 */
window.BIURET_PADDLE_CONFIG = Object.freeze({
  environment: 'sandbox',
  clientToken: 'test_96840f2cde3208ed9e27523415b',
  prices: Object.freeze({
    academy: Object.freeze({ monthly: '', threeMonths: '', yearly: '' }),
    biulock: Object.freeze({ monthly: 'pri_01m2b6rpddtch9bvgf0g4j14wf', threeMonths: '', yearly: '' }),
    brecon: Object.freeze({ monthly: '', threeMonths: '', yearly: '' }),
    biusniff: Object.freeze({ monthly: '', threeMonths: '', yearly: '' }),
    biucrypt: Object.freeze({ monthly: '', threeMonths: '', yearly: '' }),
    reaper: Object.freeze({ monthly: '', threeMonths: '', yearly: '' })
  })
});
