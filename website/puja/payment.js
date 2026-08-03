/* ─────────────────────────────────────────────────────────────
   Payment adapter — Razorpay / PhonePe ready, simulated fallback
   -------------------------------------------------------------
   RithamPay.pay(amount, meta) -> Promise<{ id, method }>

   How to go live:
     1. Stand up an endpoint that creates a Razorpay Order
        (POST /create-order { amount }) and set RITHAM_PAY_CONFIG
        below with your key_id + orderApi URL.
     2. With a real key present, this module opens the genuine
        Razorpay Checkout. Without one, it runs a realistic
        simulated confirmation so the full flow is testable now.
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  // Leave key empty to run in simulated (test) mode.
  var CONFIG = global.RITHAM_PAY_CONFIG || {
    razorpayKeyId: '',           // e.g. 'rzp_live_xxxxxxxx'
    orderApi: '',                // your backend order-creation endpoint
    company: 'Ritham',
    themeColor: '#7B2CBF'
  };

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function payWithRazorpay(amount, meta) {
    return loadScript('https://checkout.razorpay.com/v1/checkout.js')
      .then(function () {
        return fetch(CONFIG.orderApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amount * 100, notes: meta })
        }).then(function (r) { return r.json(); });
      })
      .then(function (order) {
        return new Promise(function (resolve, reject) {
          var rzp = new global.Razorpay({
            key: CONFIG.razorpayKeyId,
            amount: amount * 100,
            currency: 'INR',
            name: CONFIG.company,
            description: meta.description || 'Sawan Somvar Puja',
            order_id: order.id,
            theme: { color: CONFIG.themeColor },
            prefill: { contact: meta.whatsapp || '' },
            handler: function (resp) {
              resolve({ id: resp.razorpay_payment_id, method: 'razorpay', orderId: order.id });
            },
            modal: { ondismiss: function () { reject(new Error('cancelled')); } }
          });
          rzp.open();
        });
      });
  }

  // Realistic simulated checkout — a light modal + short "processing".
  function paySimulated(amount, meta) {
    return new Promise(function (resolve, reject) {
      var overlay = document.createElement('div');
      overlay.className = 'pay-sim-overlay';
      overlay.innerHTML =
        '<div class="pay-sim" role="dialog" aria-modal="true" aria-label="Test payment">' +
          '<div class="pay-sim-head"><span class="pay-sim-logo">Ritham&nbsp;Pay</span>' +
          '<span class="pay-sim-badge">TEST MODE</span></div>' +
          '<div class="pay-sim-body">' +
            '<p class="pay-sim-amt">' + RithamPuja.formatINR(amount) + '</p>' +
            '<p class="pay-sim-desc">' + (meta.description || 'Sawan Somvar Puja') + '</p>' +
            '<p class="pay-sim-note">Live payments (Razorpay / PhonePe UPI, cards, netbanking) plug in here. ' +
            'This test confirmation lets you complete the flow end-to-end.</p>' +
          '</div>' +
          '<div class="pay-sim-foot">' +
            '<button class="pay-sim-cancel" type="button">Cancel</button>' +
            '<button class="pay-sim-pay btn-grad" type="button">Pay ' + RithamPuja.formatINR(amount) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      function cleanup() { overlay.remove(); document.body.style.overflow = ''; }

      overlay.querySelector('.pay-sim-cancel').addEventListener('click', function () {
        cleanup(); reject(new Error('cancelled'));
      });
      overlay.querySelector('.pay-sim-pay').addEventListener('click', function () {
        var body = overlay.querySelector('.pay-sim-body');
        var foot = overlay.querySelector('.pay-sim-foot');
        foot.style.display = 'none';
        body.innerHTML = '<div class="pay-sim-spin" aria-hidden="true"></div>' +
          '<p class="pay-sim-processing">Processing securely…</p>';
        setTimeout(function () {
          cleanup();
          resolve({ id: 'pay_sim_' + Date.now().toString(36), method: 'simulated' });
        }, 1400);
      });
    });
  }

  function pay(amount, meta) {
    meta = meta || {};
    if (CONFIG.razorpayKeyId && CONFIG.orderApi) {
      return payWithRazorpay(amount, meta);
    }
    return paySimulated(amount, meta);
  }

  global.RithamPay = { pay: pay, config: CONFIG };
})(window);
