/* ─────────────────────────────────────────────────────────────
   Payment — Razorpay (server-authoritative) with a TEST simulator
   -------------------------------------------------------------
   RithamPay.checkout(draft) -> Promise<bookingRecord>

   LIVE (window.RITHAM_PAY.live === true):
     1. sawan-create-order  → recomputes amount server-side, creates a
        Razorpay order + a 'pending_payment' booking, returns { keyId, orderId,
        amountPaise, bookingCode }.
     2. Razorpay Checkout opens with that order.
     3. sawan-verify-payment → verifies the HMAC signature, flips the booking to
        'Payment Successful'. We then build the pass record for the given code.

   SIMULATED (live !== true): a light modal + a mock confirmation, so the flow
   is testable without keys. Creates the booking client-side (RithamPuja.createBooking).
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  var P = global.RithamPuja;

  function isLive() { return !!(global.RITHAM_PAY && global.RITHAM_PAY.live); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('script_failed')); };
      document.head.appendChild(s);
    });
  }

  function orderPayload(draft) {
    return {
      packageId: draft.packageId,
      addonIds: draft.addonIds || [],
      dakshina: draft.dakshina,
      whatsapp: draft.whatsapp,
      callingNumber: draft.sameAsWhatsapp ? null : (draft.callingNumber || null),
      devotees: draft.devotees || [],
      gotra: draft.gotra,
      gotraUnknown: !!draft.gotraUnknown,
      wish: draft.wish || '',
      address: draft.address || null,
      icEventId: draft.icEventId || null   // dedup key for the server-side InitiateCheckout
    };
  }

  // ── LIVE Razorpay ────────────────────────────────────────
  function checkoutLive(draft) {
    var ctx = {};
    return P.invokeFn('sawan-create-order', orderPayload(draft)).then(function (res) {
      if (res.error || !res.data || !res.data.orderId) throw new Error('order_failed');
      ctx = res.data;
      return loadScript('https://checkout.razorpay.com/v1/checkout.js');
    }).then(function () {
      return new Promise(function (resolve, reject) {
        var rzp = new global.Razorpay({
          key: ctx.keyId,
          amount: ctx.amountPaise,
          currency: 'INR',
          name: 'Ritham',
          description: 'Sawan Somvar Maha Rudrabhishekam & Bilva Arpan',
          order_id: ctx.orderId,
          theme: { color: '#7B2CBF' },
          prefill: { contact: (draft.whatsapp || '').replace('+91', '') },
          handler: function (resp) { resolve(resp); },
          modal: { ondismiss: function () { reject(new Error('cancelled')); } }
        });
        rzp.on('payment.failed', function () { reject(new Error('payment_failed')); });
        rzp.open();
      });
    }).then(function (resp) {
      return P.invokeFn('sawan-verify-payment', {
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature
      }).then(function (v) {
        if (v.error || !v.data || !v.data.ok) throw new Error('verify_failed');
        return P.makeRecord(draft, ctx.bookingCode, { id: resp.razorpay_payment_id, method: 'razorpay' });
      });
    });
  }

  // ── SIMULATED checkout ───────────────────────────────────
  function checkoutSimulated(draft) {
    var amount = P.computeTotal(draft);
    return new Promise(function (resolve, reject) {
      var overlay = document.createElement('div');
      overlay.className = 'pay-sim-overlay';
      overlay.innerHTML =
        '<div class="pay-sim" role="dialog" aria-modal="true" aria-label="Test payment">' +
          '<div class="pay-sim-head"><span class="pay-sim-logo">Ritham&nbsp;Pay</span>' +
          '<span class="pay-sim-badge">TEST MODE</span></div>' +
          '<div class="pay-sim-body">' +
            '<p class="pay-sim-amt">' + P.formatINR(amount) + '</p>' +
            '<p class="pay-sim-desc">Sawan Somvar Maha Rudrabhishekam</p>' +
            '<p class="pay-sim-note">Live Razorpay payments plug in here. This test confirmation lets you complete the flow end-to-end.</p>' +
          '</div>' +
          '<div class="pay-sim-foot">' +
            '<button class="pay-sim-cancel" type="button">Cancel</button>' +
            '<button class="pay-sim-pay btn-grad" type="button">Pay ' + P.formatINR(amount) + '</button>' +
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
        overlay.querySelector('.pay-sim-foot').style.display = 'none';
        body.innerHTML = '<div class="pay-sim-spin" aria-hidden="true"></div><p class="pay-sim-processing">Processing securely…</p>';
        setTimeout(function () {
          cleanup();
          P.createBooking(draft, { id: 'pay_sim_' + Date.now().toString(36), method: 'simulated' })
            .then(resolve).catch(reject);
        }, 1300);
      });
    });
  }

  function checkout(draft) {
    return isLive() ? checkoutLive(draft) : checkoutSimulated(draft);
  }

  global.RithamPay = { checkout: checkout, isLive: isLive };
})(window);
