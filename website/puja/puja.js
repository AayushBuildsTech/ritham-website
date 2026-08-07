/* ─────────────────────────────────────────────────────────────
   Sawan Somvar Puja — Booking flow controller (vanilla JS)
   Views: packages → (Sankalp modal) → review/add-ons → confirmation
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var P = window.RithamPuja;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = P.formatINR;

  // Working draft (in-memory until payment succeeds).
  var draft = {
    packageId: null,
    whatsapp: '', callingNumber: '', sameAsWhatsapp: true,
    devotees: [], gotra: '', gotraUnknown: false, wish: '',
    addonIds: [], dakshina: P.DAKSHINA_DEFAULT, address: ''
  };

  // ── Helpers ──────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function showView(id) {
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ── Meta Pixel conversion events ─────────────────────────
  // These browser beacons are unreliable for real buyers (mobile / in-app
  // browsers / ad-blockers drop the request around the Razorpay hand-off), so the
  // edge functions ALSO fire the same events server-side (Conversions API). The
  // eventId ties the browser + server copy together so Meta dedupes them —
  // whichever arrives is counted exactly once.
  function fbqTrack(event, params, eventId) {
    if (typeof window.fbq !== 'function') return;
    try {
      if (eventId) window.fbq('track', event, params, { eventID: eventId });
      else window.fbq('track', event, params);
    } catch (e) { /* ignore */ }
  }
  function icEventId() {
    return 'ic-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  // Purchase must fire once per successful transaction — never again on reload /
  // deep-link. We remember the booking codes we've already counted (localStorage).
  // event_id = booking code, matching the server-side (CAPI) Purchase for dedup.
  function trackPurchaseOnce(record) {
    if (!record || !record.id) return;
    var KEY = 'ritham_fbq_purchased';
    var done = [];
    try { done = JSON.parse(window.localStorage.getItem(KEY) || '[]'); } catch (e) { done = []; }
    if (done.indexOf(record.id) !== -1) return;   // already counted this booking
    done.push(record.id);
    try { window.localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { /* disabled */ }
    fbqTrack('Purchase', { value: record.total, currency: 'INR' }, record.id);
  }
  function renderStepbars() {
    $$('.stepbar').forEach(function (bar) {
      var cur = parseInt(bar.getAttribute('data-step'), 10);
      var steps = ['Package', 'Sankalp', 'Offerings', 'Confirmed'];
      var html = '';
      steps.forEach(function (label, i) {
        var n = i + 1;
        var cls = n < cur ? 'done' : (n === cur ? 'active' : '');
        html += '<div class="step ' + cls + '"><span class="n">' + (n < cur ? '✓' : n) + '</span>' + label + '</div>';
        if (i < steps.length - 1) html += '<span class="sep"></span>';
      });
      bar.innerHTML = html;
    });
  }

  // ── VIEW 1 · Packages ────────────────────────────────────
  function renderPackages() {
    var grid = $('#pkg-grid');
    grid.innerHTML = P.PACKAGES.map(function (pkg) {
      return '' +
        '<div class="pkg-card' + (pkg.featured ? ' featured' : '') + '" data-id="' + pkg.id + '" role="button" tabindex="0" aria-pressed="false">' +
          '<span class="pkg-radio" aria-hidden="true"></span>' +
          '<div class="pkg-sub">' + esc(pkg.subtitle) + '</div>' +
          '<div class="pkg-name">' + esc(pkg.name) + '</div>' +
          '<div class="pkg-price">' + fmt(pkg.price) + '</div>' +
          '<div class="pkg-blurb">' + esc(pkg.blurb) + '</div>' +
          '<ul class="pkg-perks">' + pkg.perks.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
        '</div>';
    }).join('');

    $$('.pkg-card', grid).forEach(function (card) {
      var pick = function () { selectPackage(card.getAttribute('data-id')); };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
    });
  }

  function selectPackage(id) {
    draft.packageId = id;
    var pkg = P.getPackage(id);
    $$('.pkg-card').forEach(function (c) {
      var on = c.getAttribute('data-id') === id;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // sticky bar
    var bar = $('#sticky-bar');
    $('#sticky-name').innerHTML = esc(pkg.name) + ' • <b>' + fmt(pkg.price) + '</b>';
    bar.classList.add('show');
  }

  // ── Sankalp modal ────────────────────────────────────────
  function openSankalp() {
    if (!draft.packageId) { toast('Please select a package first.'); return; }
    renderStepFor(2);
    buildDevoteeRows();
    $('#sankalp-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSankalp() {
    $('#sankalp-modal').classList.remove('show');
    document.body.style.overflow = '';
    // if we're still on the package view, restore its step indicator to 1
    var bar = $('#view-packages .stepbar');
    if ($('#view-packages').classList.contains('active') && bar) {
      bar.setAttribute('data-step', '1');
      renderStepbars();
    }
  }
  function renderStepFor(step) {
    // temporarily reflect current step on the visible stepbar (view 1's bar)
    var bar = $('.view.active .stepbar');
    if (bar) { bar.setAttribute('data-step', step); renderStepbars(); }
  }

  function buildDevoteeRows() {
    var pkg = P.getPackage(draft.packageId);
    var cap = pkg.capacity;
    var rows = $('#devotee-rows');
    var current = draft.devotees.length || 1;
    var count = Math.min(Math.max(current, 1), cap);
    rows.innerHTML = '';
    for (var i = 0; i < count; i++) addDevoteeRow(i);
    updateDevoteeHint();
  }
  function addDevoteeRow(i) {
    var rows = $('#devotee-rows');
    var pkg = P.getPackage(draft.packageId);
    var wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.style.margin = '0';
    var canRemove = rows.children.length > 0;
    wrap.innerHTML =
      '<div style="display:flex; gap:8px; align-items:center;">' +
        '<input class="input devotee-name" type="text" placeholder="Devotee ' + (i + 1) + ' full name"' +
        ' value="' + esc(draft.devotees[i] || '') + '" />' +
        (canRemove ? '<button type="button" class="btn btn-ghost btn-sm rm-dev" aria-label="Remove">Remove</button>' : '') +
      '</div>';
    if (canRemove) {
      wrap.querySelector('.rm-dev').addEventListener('click', function () {
        wrap.remove(); reindexDevotees(); updateDevoteeHint();
      });
    }
    rows.appendChild(wrap);
    // "add another" control (only while under capacity)
    refreshAddDevoteeBtn();
  }
  function refreshAddDevoteeBtn() {
    var rows = $('#devotee-rows');
    var pkg = P.getPackage(draft.packageId);
    var existing = $('#add-dev-btn');
    if (existing) existing.remove();
    if (rows.children.length < pkg.capacity) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'add-dev-btn'; btn.className = 'btn btn-ghost btn-sm';
      btn.style.marginTop = '4px';
      btn.textContent = '+ Add another devotee';
      btn.addEventListener('click', function () {
        addDevoteeRow(rows.children.length); updateDevoteeHint();
      });
      rows.parentNode.insertBefore(btn, $('#devotee-hint'));
    }
  }
  function reindexDevotees() {
    $$('#devotee-rows .devotee-name').forEach(function (inp, i) {
      inp.placeholder = 'Devotee ' + (i + 1) + ' full name';
    });
    refreshAddDevoteeBtn();
  }
  function updateDevoteeHint() {
    var pkg = P.getPackage(draft.packageId);
    var n = $$('#devotee-rows .devotee-name').length;
    $('#devotee-hint').textContent = pkg.name + ' covers up to ' + pkg.capacity +
      ' member' + (pkg.capacity > 1 ? 's' : '') + '. ' + n + ' added.';
  }

  // Gotra "unknown" logic
  function applyUnknownGotra() {
    var chk = $('#f-unknown-gotra');
    var gotra = $('#f-gotra');
    var callout = $('#gotra-callout');
    if (chk.checked) {
      gotra.value = 'Kashyap';
      gotra.disabled = true;
      gotra.closest('.field').classList.remove('invalid');
      callout.style.display = 'flex';
    } else {
      gotra.disabled = false;
      if (gotra.value === 'Kashyap') gotra.value = '';
      callout.style.display = 'none';
    }
  }

  function validPhone(v) { return /^[6-9]\d{9}$/.test(v); }

  function validateSankalp() {
    var ok = true;
    // whatsapp
    var wa = $('#f-whatsapp');
    var waField = wa.closest('.field');
    if (!validPhone(wa.value.trim())) { waField.classList.add('invalid'); ok = false; }
    else waField.classList.remove('invalid');
    // calling number (if shown)
    if ($('#f-diff-calling').checked) {
      var cn = $('#f-calling'); var cnField = cn.closest('.field');
      if (!validPhone(cn.value.trim())) { cnField.classList.add('invalid'); ok = false; }
      else cnField.classList.remove('invalid');
    }
    // devotees — at least the first name required
    var names = $$('#devotee-rows .devotee-name');
    var firstField = names[0].closest('.field');
    if (!names[0].value.trim()) { firstField.classList.add('invalid'); firstField.querySelector('.err-text') || addErr(firstField, 'Please enter at least one devotee name.'); ok = false; }
    else firstField.classList.remove('invalid');
    // gotra — must be chosen from the list (unless "unknown" is ticked)
    var g = $('#f-gotra'); var gField = g.closest('.field');
    if ($('#f-unknown-gotra').checked || canonicalGotra(g.value)) { gField.classList.remove('invalid'); }
    else { gField.classList.add('invalid'); ok = false; }
    return ok;
  }
  // Return the canonically-cased gotra if the typed value matches the list, else null.
  function canonicalGotra(v) {
    v = (v || '').trim().toLowerCase();
    if (!v) return null;
    for (var i = 0; i < P.GOTRAS.length; i++) {
      if (P.GOTRAS[i].toLowerCase() === v) return P.GOTRAS[i];
    }
    return null;
  }
  function populateGotras() {
    var dl = $('#gotra-list');
    if (!dl) return;
    dl.innerHTML = P.GOTRAS.map(function (g) { return '<option value="' + esc(g) + '"></option>'; }).join('');
  }
  function addErr(field, msg) {
    if (field.querySelector('.err-text')) { field.querySelector('.err-text').textContent = msg; return; }
    var p = document.createElement('p'); p.className = 'err-text'; p.textContent = msg;
    field.appendChild(p);
  }

  function collectSankalp() {
    draft.whatsapp = '+91' + $('#f-whatsapp').value.trim();
    draft.sameAsWhatsapp = !$('#f-diff-calling').checked;
    draft.callingNumber = draft.sameAsWhatsapp ? '' : ('+91' + $('#f-calling').value.trim());
    draft.devotees = $$('#devotee-rows .devotee-name')
      .map(function (i) { return i.value.trim(); })
      .filter(Boolean);
    draft.gotraUnknown = $('#f-unknown-gotra').checked;
    draft.gotra = draft.gotraUnknown ? 'Kashyap' : (canonicalGotra($('#f-gotra').value) || $('#f-gotra').value.trim());
    draft.wish = $('#f-wish').value.trim();
  }

  // ── VIEW 2 · Review & add-ons ────────────────────────────
  function renderAddons() {
    var list = $('#addon-list');
    list.innerHTML = P.ADDONS.map(function (a) {
      var on = draft.addonIds.indexOf(a.id) !== -1;
      var thumb = '<div class="addon-thumb">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + (a.icon || '') + '"/></svg>' +
        (a.img ? '<img src="' + a.img + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
        '</div>';
      return '' +
        '<div class="addon' + (on ? ' on' : '') + '" data-id="' + a.id + '">' +
          thumb +
          '<div class="addon-main">' +
            '<div class="addon-top"><span class="addon-name">' + esc(a.name) + '</span>' +
              '<span class="addon-tag' + (a.homeDelivery ? ' deliver' : '') + '">' + esc(a.tag) + '</span></div>' +
            '<div class="addon-desc">' + esc(a.desc) + '</div>' +
          '</div>' +
          '<div class="addon-right">' +
            '<span class="addon-price">+ ' + fmt(a.price) + '</span>' +
            '<label class="toggle"><input type="checkbox" ' + (on ? 'checked' : '') + ' aria-label="Add ' + esc(a.name) + '"><span class="track"></span></label>' +
          '</div>' +
        '</div>';
    }).join('');
    $$('.addon', list).forEach(function (row) {
      var id = row.getAttribute('data-id');
      var input = row.querySelector('input');
      input.addEventListener('change', function () {
        var idx = draft.addonIds.indexOf(id);
        if (input.checked && idx === -1) draft.addonIds.push(id);
        if (!input.checked && idx !== -1) draft.addonIds.splice(idx, 1);
        row.classList.toggle('on', input.checked);
        renderBill(); syncAddressPanel();
      });
    });
  }

  function renderDakshina() {
    var box = $('#dakshina-pills');
    var html = P.DAKSHINA_OPTIONS.map(function (amt) {
      var on = draft.dakshina === amt;
      var isDefault = amt === P.DAKSHINA_DEFAULT;
      return '<button type="button" class="pill' + (on ? ' on' : '') + '" data-amt="' + amt + '">' +
        fmt(amt) + (isDefault ? ' · Suggested' : '') + '</button>';
    }).join('');
    // optional — devotee may choose to leave the Dakshina
    html += '<button type="button" class="pill pill-skip' + (draft.dakshina === 0 ? ' on' : '') + '" data-amt="0">Skip / offer later</button>';
    box.innerHTML = html;
    $$('.pill', box).forEach(function (p) {
      p.addEventListener('click', function () {
        draft.dakshina = parseInt(p.getAttribute('data-amt'), 10);
        $$('.pill', box).forEach(function (x) { x.classList.remove('on'); });
        p.classList.add('on');
        renderBill();
      });
    });
  }
  function dakshinaLabel() {
    return draft.dakshina > 0 ? fmt(draft.dakshina) : '<span class="lbl" style="color:var(--dim);">Not added</span>';
  }

  function syncAddressPanel() {
    var need = P.needsAddress(draft);
    $('#address-panel').style.display = need ? 'block' : 'none';
    if (!need) $('#f-address').closest('.field').classList.remove('invalid');
  }

  function renderBill() {
    var pkg = P.getPackage(draft.packageId);
    var addons = draft.addonIds.map(P.getAddon).filter(Boolean);
    var addonsTotal = addons.reduce(function (s, a) { return s + a.price; }, 0);
    var total = P.computeTotal(draft);

    var lines = '';
    lines += billLine('Base Package — ' + pkg.name, fmt(pkg.price));
    addons.forEach(function (a) { lines += billLine('&nbsp;&nbsp;+ ' + a.name, fmt(a.price), 'sub'); });
    lines += billLine('Added Offerings', fmt(addonsTotal));
    lines += billLine('Pandit Dakshina', dakshinaLabel());
    lines += billLine('Platform Fee', '<span class="strike">' + fmt(P.FEES.platform) + '</span><span class="free">FREE</span>');
    lines += billLine('Video Recording &amp; WhatsApp Delivery', '<span class="strike">' + fmt(P.FEES.video) + '</span><span class="free">FREE</span>');
    $('#bill-lines').innerHTML = lines;

    $('#bill-total').textContent = fmt(total);
    $('#pay-btn').textContent = 'Pay ' + fmt(total);
  }
  function billLine(lbl, val, cls) {
    return '<div class="bill-line ' + (cls || '') + '"><span class="lbl">' + lbl + '</span><span>' + val + '</span></div>';
  }

  function goToReview() {
    renderAddons(); renderDakshina(); syncAddressPanel(); renderBill();
    showView('view-review');
    renderStepbars();
    $('#sticky-bar').classList.remove('show');
  }

  // ── Payment ──────────────────────────────────────────────
  function handlePay() {
    // address validation if needed
    if (P.needsAddress(draft)) {
      var addr = $('#f-address');
      if (!addr.value.trim()) {
        addr.closest('.field').classList.add('invalid');
        addr.focus();
        toast('Please add a delivery address.');
        return;
      }
      addr.closest('.field').classList.remove('invalid');
      draft.address = addr.value.trim();
    }
    var btn = $('#pay-btn'); btn.disabled = true;
    draft.icEventId = icEventId();   // shared with the server-side InitiateCheckout (dedup)
    fbqTrack('InitiateCheckout', { value: P.computeTotal(draft), currency: 'INR' }, draft.icEventId);
    // checkout(draft) recomputes the amount server-side, runs Razorpay, verifies
    // the signature, and returns the confirmed booking record.
    window.RithamPay.checkout(draft).then(function (record) {
      trackPurchaseOnce(record);
      history.replaceState(null, '', '?booking=' + record.id); // deep-linkable
      renderConfirmation(record);
      showView('view-confirm');
    }).catch(function (err) {
      if (err && err.message === 'cancelled') toast('Payment cancelled.');
      else toast('Payment could not be completed. Please try again.');
    }).then(function () { btn.disabled = false; });
  }

  // ── VIEW 3 · Confirmation ────────────────────────────────
  // A booking with no package is a standalone chadhava offering.
  function isChadhavaOnly(rec) { return !rec.package || !rec.package.id; }
  function chadhavaLabel(rec) {
    return (rec.addons && rec.addons.length) ? rec.addons.map(function (a) { return a.name; }).join(', ') : 'Chadhava Offering';
  }

  function renderConfirmation(rec) {
    var names = rec.devotees.join(', ');
    var isChadhava = isChadhavaOnly(rec);
    var pkgLabel = isChadhava ? chadhavaLabel(rec) : rec.package.name;
    var details = passRow('Devotee(s)', names);
    if (!isChadhava) details += passRow('Gotra', rec.gotra + (rec.gotraUnknown ? ' (assigned)' : ''));
    details += passRow(isChadhava ? 'Offering' : 'Package', pkgLabel);
    details += passRow('Date', rec.event.date);
    details += passRow('Temple', rec.event.temple);
    details += passRow('Amount Paid', fmt(rec.total));
    var pass = $('#pass-card');
    pass.innerHTML =
      '<div class="pass-top">' +
        '<div><div class="pass-title">Devotee Pass</div><div class="pass-sub">' + esc(rec.event.title) + '</div></div>' +
        '<div class="pass-id"><small>Booking ID</small><b>' + esc(rec.id) + '</b></div>' +
      '</div>' +
      '<div class="pass-body">' +
        '<div class="pass-details">' + details + '</div>' +
        '<div class="pass-qr-wrap"><div class="pass-qr" id="pass-qr" aria-label="Booking QR code"></div><span class="pass-qr-cap">Scan to verify</span></div>' +
      '</div>';

    // QR → points at this bookable confirmation URL
    var url = location.origin + location.pathname + '?booking=' + rec.id;
    renderQR($('#pass-qr'), url, 200);

    // order breakdown
    var ob = '';
    if (!isChadhava) ob += billLine('Base Package — ' + rec.package.name, fmt(rec.package.price));
    rec.addons.forEach(function (a) { ob += billLine('+ ' + a.name + (a.homeDelivery ? ' (home delivery)' : ''), fmt(a.price)); });
    if (!isChadhava) ob += billLine('Pandit Dakshina', rec.dakshina > 0 ? fmt(rec.dakshina) : '<span style="color:var(--dim);">Not added</span>');
    ob += billLine('Platform Fee', '<span class="strike">' + fmt(P.FEES.platform) + '</span><span class="free">FREE</span>');
    ob += billLine('Video &amp; WhatsApp Delivery', '<span class="strike">' + fmt(P.FEES.video) + '</span><span class="free">FREE</span>');
    if (rec.address) ob += billLine('Delivery Address', esc(rec.address));
    ob += '<div class="bill-total"><span class="lbl">Total Paid</span><span class="amt">' + fmt(rec.total) + '</span></div>';
    $('#confirm-order').innerHTML = ob;

    // prasad line
    var hasDelivery = rec.address != null;
    $('#prasad-line').textContent = hasDelivery
      ? 'Your home-delivery items ship to your address within 5–7 days with a tracking number.'
      : 'No home-delivery items in this order — everything is offered at the temple.';

    // wire actions
    $('#download-pass').onclick = function () { downloadPass(rec); };
    $('#share-whatsapp').onclick = function () { shareWhatsApp(rec); };
  }
  function passRow(k, v) {
    return '<div class="row"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>';
  }

  function shareWhatsApp(rec) {
    var text = 'Har Har Mahadev! I have offered my Sankalp for the Sawan Vishesh Kotilingeshwara Maha Rudrabhishekam on ' +
      rec.event.date + ' at ' + rec.event.temple + ' through Ritham. ' +
      'Booking ID: ' + rec.id + '. Join in offering your prayers: ' +
      location.origin + location.pathname.replace(/\/[^/]*$/, '/');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  // ── QR helpers (qrcodejs) ────────────────────────────────
  function renderQR(el, text, size) {
    if (!el) return;
    el.innerHTML = '';
    if (!window.QRCode) return;
    try {
      new window.QRCode(el, { text: text, width: size, height: size, colorDark: '#1E1533', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      // qrcodejs appends both a <canvas> and a fallback <img>; keep one
      var c = el.querySelector('canvas'), im = el.querySelector('img');
      if (c && im) im.style.display = 'none';
    } catch (e) { /* ignore */ }
  }
  function qrDataURL(text, size) {
    if (!window.QRCode) return null;
    var div = document.createElement('div');
    try {
      new window.QRCode(div, { text: text, width: size, height: size, colorDark: '#1E1533', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    } catch (e) { return null; }
    var c = div.querySelector('canvas');
    if (c) { try { return c.toDataURL('image/png'); } catch (e) { return null; } }
    var img = div.querySelector('img');
    return img ? img.src : null;
  }
  // Load an image (webp/png) and return a JPEG dataURL + dimensions for jsPDF.
  function loadImageJPEG(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve({ data: c.toDataURL('image/jpeg', 0.9), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  // Load an image element (for canvas drawing).
  function loadImg(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  // ── PDF digital pass (styled, brand-themed, + Hindi page) ─
  function downloadPass(rec) {
    if (!window.jspdf) { toast('PDF library still loading — try again.'); return; }
    toast('Preparing your Devotee Pass…');
    var url = location.origin + location.pathname + '?booking=' + rec.id;
    var qr = qrDataURL(url, 260);
    var fontReady = (document.fonts && document.fonts.load)
      ? Promise.all([
          document.fonts.load('700 20px "Noto Sans Devanagari"'),
          document.fonts.load('600 20px "Noto Sans Devanagari"'),
          document.fonts.load('400 20px "Noto Sans Devanagari"')
        ]).catch(function () {})
      : Promise.resolve();
    Promise.all([loadImageJPEG('../img/puja-hero-1.webp'), loadImg('../img/puja-hero-1.webp'), loadImg(qr), fontReady])
      .then(function (r) { buildPassPDF(rec, r[0], qr, { bannerImg: r[1], qrImgEl: r[2] }); })
      .catch(function (e) { console.error(e); toast('Could not build the PDF.'); });
  }

  function buildPassPDF(rec, banner, qrImg, extras) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();

    // palette
    var VIOLET = [123, 44, 191], MAGENTA = [255, 0, 127], SAFFRON = [232, 133, 30],
        INK = [30, 21, 51], MUTED = [120, 110, 140], GOLD = [214, 160, 60];

    // page background (warm cream)
    doc.setFillColor(253, 248, 255); doc.rect(0, 0, W, H, 'F');

    // decorative frame
    doc.setDrawColor(VIOLET[0], VIOLET[1], VIOLET[2]); doc.setLineWidth(1.6);
    doc.roundedRect(18, 18, W - 36, H - 36, 14, 14, 'S');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(0.6);
    doc.roundedRect(24, 24, W - 48, H - 48, 10, 10, 'S');

    var M = 40;
    var bx = 34, bw = W - 68, bTop = 34, bh = 150;

    // banner image + scrim + title
    if (banner) {
      doc.addImage(banner.data, 'JPEG', bx, bTop, bw, bh, undefined, 'FAST');
    } else {
      doc.setFillColor(VIOLET[0], VIOLET[1], VIOLET[2]); doc.rect(bx, bTop, bw, bh, 'F');
    }
    // dark gradient-ish scrim (two stacked translucent bands)
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.38 })); doc.setFillColor(18, 8, 28); doc.rect(bx, bTop + bh - 74, bw, 74, 'F');
      doc.setGState(new doc.GState({ opacity: 0.55 })); doc.setFillColor(18, 8, 28); doc.rect(bx, bTop + bh - 44, bw, 44, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold'); doc.setFontSize(9);
    doc.text('RITHAM  ·  DEVOTEE PASS', bx + 16, bTop + bh - 30);
    doc.setFont('times', 'italic'); doc.setFontSize(17);
    doc.text('Sawan Vishesh Maha Rudrabhishekam & Bilva Arpan', bx + 16, bTop + bh - 12);

    var y = bTop + bh + 26;

    // Booking ID chip (left) + QR (right)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('BOOKING ID', M, y);
    doc.setFillColor(MAGENTA[0], MAGENTA[1], MAGENTA[2]);
    doc.roundedRect(M, y + 6, 168, 30, 8, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(rec.id, M + 14, y + 26);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Event: ' + rec.event.date + ' · Sawan Somvar + Nag Panchami', M, y + 56);
    doc.text('Temple: ' + rec.event.temple, M, y + 72);

    // QR at top-right
    var qrSize = 96, qrX = W - M - qrSize, qrY = y - 2;
    if (qrImg) {
      doc.setFillColor(255, 255, 255); doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6, 6, 'F');
      doc.setDrawColor(224, 214, 236); doc.setLineWidth(0.8); doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6, 6, 'S');
      doc.addImage(qrImg, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 14, { align: 'center' });
    }

    y += 96;

    // detail grid (2 columns)
    doc.setDrawColor(226, 216, 238); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 22;
    var colX = [M, W / 2 + 6];
    function cell(col, rowY, k, v) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(VIOLET[0], VIOLET[1], VIOLET[2]);
      doc.text(k.toUpperCase(), colX[col], rowY);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(INK[0], INK[1], INK[2]);
      var lines = doc.splitTextToSize(v, (W / 2) - M - 10);
      doc.text(lines, colX[col], rowY + 15);
    }
    var isChadhava = isChadhavaOnly(rec);
    var pairs = [['Devotee(s)', rec.devotees.join(', ')]];
    if (isChadhava) {
      pairs.push(['Offering', chadhavaLabel(rec)]);
    } else {
      pairs.push(['Gotra', rec.gotra + (rec.gotraUnknown ? ' (assigned — Kashyap)' : '')]);
      pairs.push(['Package', rec.package.name + ' (' + rec.package.subtitle + ')']);
      pairs.push(['Members', String(rec.package.capacity)]);
    }
    pairs.push(['Amount Paid', 'Rs. ' + Number(rec.total).toLocaleString('en-IN')]);
    pairs.push(['Status', 'Confirmed']);
    for (var i = 0; i < pairs.length; i += 2) {
      cell(0, y, pairs[i][0], pairs[i][1]);
      if (pairs[i + 1]) cell(1, y, pairs[i + 1][0], pairs[i + 1][1]);
      y += 44;
    }
    if (rec.wish) { cell(0, y, 'Sankalp / Wish', rec.wish); y += 40; }
    if (rec.address) { cell(0, y, 'Delivery Address', rec.address); y += 40; }

    // Om divider
    y += 4;
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(0.8);
    doc.line(M, y, W / 2 - 70, y); doc.line(W / 2 + 70, y, W - M, y);
    doc.setFont('times', 'bolditalic'); doc.setFontSize(12); doc.setTextColor(SAFFRON[0], SAFFRON[1], SAFFRON[2]);
    doc.text('Om Namah Shivaya', W / 2, y + 4, { align: 'center' });
    y += 26;

    // tinted info box helper
    function infoBox(title, lines, tint, headColor, italic) {
      var pad = 14, lh = 15, boxH = 30 + lines.length * lh + 8;
      doc.setFillColor(tint[0], tint[1], tint[2]);
      doc.roundedRect(M, y, W - 2 * M, boxH, 10, 10, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(headColor[0], headColor[1], headColor[2]);
      doc.text(title, M + pad, y + 22);
      doc.setFont('helvetica', italic ? 'italic' : 'normal'); doc.setFontSize(10.5); doc.setTextColor(70, 62, 90);
      var ty = y + 40;
      lines.forEach(function (t) { doc.text(t, M + pad, ty); ty += lh; });
      y += boxH + 14;
    }
    infoBox('Puja Guidelines', [
      '•  Observe a light, sattvic diet on Sawan Somvar (17 Aug 2026) if you can.',
      '•  Offer water or milk to a Shivling near you and light a diya at home.',
      '•  Your name & gotra will be recited by the priests during the Abhishek.',
      '•  Your personalised puja video arrives on WhatsApp within 3-4 days.'
    ], [244, 238, 252], VIOLET, false);

    infoBox('Sawan Somvar Mantras', [
      'Om Namah Shivaya',
      'Om Tryambakam Yajamahe Sugandhim Pushtivardhanam,',
      'Urvarukamiva Bandhanan Mrityor Mukshiya Maamritat.'
    ], [253, 243, 230], SAFFRON, true);

    // footer bar
    var fy = H - 34 - 26;
    doc.setFillColor(VIOLET[0], VIOLET[1], VIOLET[2]);
    doc.roundedRect(24, fy, W - 48, 26, 8, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text('Har Har Mahadev  ·  Ritham  ·  ritham.co.in', W / 2, fy + 17, { align: 'center' });

    // ── Page 2 · Hindi (Devanagari) translation of the whole pass ──
    try {
      var hc = renderHindiCanvas(rec, extras || {});
      doc.addPage();
      doc.addImage(hc.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
    } catch (e) { console.warn('Hindi page skipped:', e); }

    doc.save('Ritham-Devotee-Pass-' + rec.id + '.pdf');
  }

  // ── Hindi page (drawn to a canvas with a Devanagari web font) ──
  function hindiPackage(pkg) {
    if (!pkg) return '';
    var m = { individual: 'एक संकल्प (व्यक्तिगत)', couple: 'जोड़ी कल्याण (युगल)', family: 'कुटुम्ब रक्षा (परिवार)' };
    return m[pkg.id] || pkg.name;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawCover(ctx, img, x, y, w, h) {
    var ir = img.width / img.height, tr = w / h, sw, sh, sx, sy;
    if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function renderHindiCanvas(rec, extras) {
    var S = 2, W = 595, H = 842;
    var cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    var ctx = cv.getContext('2d'); ctx.scale(S, S);
    var DV = '"Noto Sans Devanagari","Nirmala UI",sans-serif';
    var VIOLET = '#7B2CBF', MAG = '#FF007F', SAFF = '#e8851e', INK = '#1e1533', MUTED = '#786e8c', GOLD = '#d6a03c';
    var M = 40;

    ctx.fillStyle = '#fdf8ff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = VIOLET; ctx.lineWidth = 1.6; rr(ctx, 18, 18, W - 36, H - 36, 14); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.6; rr(ctx, 24, 24, W - 48, H - 48, 10); ctx.stroke();

    // banner
    var bx = 34, bTop = 34, bw = W - 68, bh = 150;
    ctx.save(); rr(ctx, bx, bTop, bw, bh, 0); ctx.clip();
    if (extras.bannerImg) drawCover(ctx, extras.bannerImg, bx, bTop, bw, bh);
    else { ctx.fillStyle = VIOLET; ctx.fillRect(bx, bTop, bw, bh); }
    var g = ctx.createLinearGradient(0, bTop + bh - 78, 0, bTop + bh);
    g.addColorStop(0, 'rgba(18,8,28,0)'); g.addColorStop(1, 'rgba(18,8,28,0.8)');
    ctx.fillStyle = g; ctx.fillRect(bx, bTop + bh - 78, bw, 78);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 9px ' + DV; ctx.fillText('रिथम · भक्त पास', bx + 16, bTop + bh - 30);
    ctx.font = '700 15px ' + DV; ctx.fillText('श्रावण विशेष महा रुद्राभिषेक एवं बिल्व अर्पण', bx + 16, bTop + bh - 12);

    var y = bTop + bh + 26;
    // Booking ID pill
    ctx.font = '700 8px ' + DV; ctx.fillStyle = MUTED; ctx.fillText('बुकिंग आईडी', M, y);
    ctx.fillStyle = MAG; rr(ctx, M, y + 6, 168, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 15px "Inter",sans-serif'; ctx.fillText(rec.id, M + 14, y + 27);
    ctx.fillStyle = MUTED; ctx.font = '400 9px ' + DV;
    ctx.fillText('आयोजन: 17 अगस्त 2026 · सावन सोमवार + नाग पंचमी', M, y + 56);
    ctx.fillText('मंदिर: कोटिलिंगेश्वर मंदिर, कोलार', M, y + 72);

    // QR
    var qs = 96, qx = W - M - qs, qy = y - 2;
    if (extras.qrImgEl) {
      ctx.fillStyle = '#fff'; rr(ctx, qx - 6, qy - 6, qs + 12, qs + 12, 6); ctx.fill();
      ctx.strokeStyle = '#e0d6ec'; ctx.lineWidth = 0.8; rr(ctx, qx - 6, qy - 6, qs + 12, qs + 12, 6); ctx.stroke();
      ctx.drawImage(extras.qrImgEl, qx, qy, qs, qs);
      ctx.fillStyle = MUTED; ctx.font = '400 7.5px ' + DV; ctx.textAlign = 'center';
      ctx.fillText('सत्यापन हेतु स्कैन करें', qx + qs / 2, qy + qs + 14); ctx.textAlign = 'left';
    }

    y += 96;
    ctx.strokeStyle = '#e2d8ee'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();
    y += 22;
    var colX = [M, W / 2 + 6];
    function cell(col, rowY, k, v) {
      ctx.fillStyle = VIOLET; ctx.font = '700 8px ' + DV; ctx.fillText(k, colX[col], rowY);
      ctx.fillStyle = INK; ctx.font = '400 12px ' + DV;
      var maxW = (W / 2) - M - 10, words = String(v == null ? '' : v).split(' '), line = '', ty = rowY + 15;
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, colX[col], ty); line = words[i]; ty += 14; }
        else line = test;
      }
      ctx.fillText(line, colX[col], ty);
    }
    var isChadhava = isChadhavaOnly(rec);
    var pairs = [['भक्त', rec.devotees.join(', ')]];
    if (isChadhava) {
      pairs.push(['चढ़ावा', (rec.addons && rec.addons.length) ? rec.addons.map(function (a) { return a.name; }).join(', ') : 'चढ़ावा']);
    } else {
      pairs.push(['गोत्र', rec.gotra + (rec.gotraUnknown ? ' (निर्धारित — कश्यप)' : '')]);
      pairs.push(['पैकेज', hindiPackage(rec.package)]);
      pairs.push(['सदस्य', String(rec.package && rec.package.capacity ? rec.package.capacity : '')]);
    }
    pairs.push(['भुगतान राशि', '₹' + Number(rec.total).toLocaleString('en-IN')]);
    pairs.push(['स्थिति', 'पुष्टि (Confirmed)']);
    for (var i = 0; i < pairs.length; i += 2) {
      cell(0, y, pairs[i][0], pairs[i][1]);
      if (pairs[i + 1]) cell(1, y, pairs[i + 1][0], pairs[i + 1][1]);
      y += 44;
    }
    if (rec.wish) { cell(0, y, 'संकल्प / मनोकामना', rec.wish); y += 40; }
    if (rec.address) { cell(0, y, 'पता', rec.address); y += 40; }

    // Om divider
    y += 4;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W / 2 - 70, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 70, y); ctx.lineTo(W - M, y); ctx.stroke();
    ctx.fillStyle = SAFF; ctx.font = '700 13px ' + DV; ctx.textAlign = 'center';
    ctx.fillText('ॐ नमः शिवाय', W / 2, y + 5); ctx.textAlign = 'left';
    y += 26;

    function box(title, lines, tint, head, lh2) {
      var pad = 14, lh = lh2 || 16, boxH = 30 + lines.length * lh + 8;
      ctx.fillStyle = tint; rr(ctx, M, y, W - 2 * M, boxH, 10); ctx.fill();
      ctx.fillStyle = head; ctx.font = '700 12px ' + DV; ctx.fillText(title, M + pad, y + 22);
      ctx.fillStyle = '#463e5a'; ctx.font = '400 10.5px ' + DV;
      var ty = y + 40;
      lines.forEach(function (t) { ctx.fillText(t, M + pad, ty); ty += lh; });
      y += boxH + 14;
    }
    box('पूजा दिशा-निर्देश', [
      '•  सावन सोमवार (17 अगस्त 2026) पर यथासंभव हल्का, सात्विक आहार लें।',
      '•  अपने निकट किसी शिवलिंग पर जल/दूध अर्पित करें और घर में दीप जलाएँ।',
      '•  अभिषेक के समय पुजारी आपका नाम एवं गोत्र का उच्चारण करेंगे।',
      '•  आपकी व्यक्तिगत पूजा वीडियो 3-4 दिनों में व्हाट्सएप पर प्राप्त होगी।'
    ], '#f4eefc', VIOLET);
    box('सावन सोमवार मंत्र', [
      'ॐ नमः शिवाय',
      'ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् ।',
      'उर्वारुकमिव बन्धनान् मृत्योर्मुक्षीय माऽमृतात् ॥'
    ], '#fdf3e6', SAFF);

    // footer
    var fy = H - 34 - 26;
    ctx.fillStyle = VIOLET; rr(ctx, 24, fy, W - 48, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 9.5px ' + DV; ctx.textAlign = 'center';
    ctx.fillText('हर हर महादेव · रिथम · ritham.co.in', W / 2, fy + 17); ctx.textAlign = 'left';

    return cv;
  }

  // ── CHADHAVA · standalone offering flow (no full puja) ───
  // A lightweight parallel flow: pick one or more sevas, give a name + WhatsApp,
  // and pay. Reuses the shared checkout + confirmation; the booking is package-less.
  var chadhava = { addonIds: [] };

  function chadhavaDeliveryNeeded() {
    return P.needsAddress({ packageId: null, addonIds: chadhava.addonIds });
  }

  function renderChadhavaGrid() {
    var grid = $('#chadhava-grid');
    if (!grid) return;
    grid.innerHTML = P.ADDONS.map(function (a) {
      var on = chadhava.addonIds.indexOf(a.id) !== -1;
      var thumb = '<div class="chadhava-thumb">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + (a.icon || '') + '"/></svg>' +
        (a.img ? '<img src="' + a.img + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
        '</div>';
      return '' +
        '<div class="chadhava-card' + (on ? ' on' : '') + '" data-id="' + a.id + '">' +
          thumb +
          '<div class="chadhava-body">' +
            '<div class="chadhava-top"><span class="chadhava-name">' + esc(a.name) + '</span>' +
              '<span class="addon-tag' + (a.homeDelivery ? ' deliver' : '') + '">' + esc(a.tag) + '</span></div>' +
            '<p class="chadhava-desc">' + esc(a.desc) + '</p>' +
            '<div class="chadhava-incl">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 3zM10 8.5l4 2.5-4 2.5z"/></svg>' +
              '<span>Video of this seva <b>+ puja highlights</b>, sent on WhatsApp</span>' +
            '</div>' +
          '</div>' +
          '<div class="chadhava-foot">' +
            '<span class="chadhava-price">' + fmt(a.price) + '</span>' +
            '<button type="button" class="btn btn-sm chadhava-toggle ' + (on ? 'btn-grad' : 'btn-ghost') + '">' + (on ? 'Added ✓' : 'Add') + '</button>' +
          '</div>' +
        '</div>';
    }).join('');
    $$('.chadhava-card', grid).forEach(function (card) {
      var id = card.getAttribute('data-id');
      card.querySelector('.chadhava-toggle').addEventListener('click', function () { toggleChadhava(id); });
    });
  }

  function toggleChadhava(id) {
    var idx = chadhava.addonIds.indexOf(id);
    if (idx === -1) chadhava.addonIds.push(id); else chadhava.addonIds.splice(idx, 1);
    renderChadhavaGrid();
    renderChadhavaBill();
    $('#ch-address-panel').style.display = chadhavaDeliveryNeeded() ? 'block' : 'none';
    var box = $('#chadhava-checkout');
    box.style.display = chadhava.addonIds.length ? 'block' : 'none';
    updateChadhavaBar();
  }

  // Sticky bottom bar — reassures the user their seva is counted and gives a
  // one-tap jump to checkout (mirrors the package flow's "Proceed to Sankalp").
  function updateChadhavaBar() {
    var bar = $('#chadhava-bar');
    if (!bar) return;
    var n = chadhava.addonIds.length;
    if (!n) { bar.classList.remove('show'); return; }
    var total = chadhava.addonIds.map(P.getAddon).filter(Boolean).reduce(function (s, a) { return s + a.price; }, 0);
    $('#chadhava-bar-name').innerHTML = n + ' seva' + (n > 1 ? 's' : '') + ' added • <b>' + fmt(total) + '</b>';
    bar.classList.add('show');
  }
  function goToChadhavaCheckout() {
    var box = $('#chadhava-checkout');
    box.style.display = 'block';
    $('#chadhava-bar').classList.remove('show');  // hide so it doesn't cover the Pay button
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { var el = $('#ch-name'); if (el) el.focus({ preventScroll: true }); }, 420);
  }

  function renderChadhavaBill() {
    var addons = chadhava.addonIds.map(P.getAddon).filter(Boolean);
    var total = addons.reduce(function (s, a) { return s + a.price; }, 0);
    var lines = '';
    if (!addons.length) {
      lines = billLine('<span style="color:var(--dim);">No chadhava selected yet</span>', '');
    } else {
      addons.forEach(function (a) { lines += billLine(a.name + (a.homeDelivery ? ' (home delivery)' : ''), fmt(a.price)); });
      lines += billLine('Video Recording &amp; WhatsApp Delivery', '<span class="strike">' + fmt(P.FEES.video) + '</span><span class="free">FREE</span>');
    }
    $('#ch-bill-lines').innerHTML = lines;
    $('#ch-bill-total').textContent = fmt(total);
    $('#ch-pay-btn').textContent = 'Pay ' + fmt(total);
  }

  function validateChadhava() {
    var ok = true;
    var name = $('#ch-name'), nf = name.closest('.field');
    if (!name.value.trim()) { nf.classList.add('invalid'); ok = false; } else nf.classList.remove('invalid');
    var wa = $('#ch-whatsapp'), wf = wa.closest('.field');
    if (!validPhone(wa.value.trim())) { wf.classList.add('invalid'); ok = false; } else wf.classList.remove('invalid');
    if (chadhavaDeliveryNeeded()) {
      var ad = $('#ch-address'), af = ad.closest('.field');
      if (!ad.value.trim()) { af.classList.add('invalid'); ok = false; } else af.classList.remove('invalid');
    }
    return ok;
  }

  function payChadhava() {
    if (!chadhava.addonIds.length) { toast('Please select at least one chadhava.'); return; }
    if (!validateChadhava()) { toast('Please complete the required fields.'); return; }
    var draft = {
      packageId: null,
      addonIds: chadhava.addonIds.slice(),
      dakshina: 0,
      whatsapp: '+91' + $('#ch-whatsapp').value.trim(),
      callingNumber: '', sameAsWhatsapp: true,
      devotees: [$('#ch-name').value.trim()],
      gotra: '', gotraUnknown: false,
      wish: $('#ch-wish').value.trim(),
      address: chadhavaDeliveryNeeded() ? $('#ch-address').value.trim() : ''
    };
    var btn = $('#ch-pay-btn'); btn.disabled = true;
    draft.icEventId = icEventId();   // shared with the server-side InitiateCheckout (dedup)
    fbqTrack('InitiateCheckout', { value: P.computeTotal(draft), currency: 'INR' }, draft.icEventId);
    window.RithamPay.checkout(draft).then(function (record) {
      trackPurchaseOnce(record);
      $('#chadhava-bar').classList.remove('show');
      history.replaceState(null, '', '?booking=' + record.id);
      renderConfirmation(record);
      showView('view-confirm');
    }).catch(function (err) {
      if (err && err.message === 'cancelled') toast('Payment cancelled.');
      else toast('Payment could not be completed. Please try again.');
    }).then(function () { btn.disabled = false; });
  }

  // ── Deep link (?booking=ID) ──────────────────────────────
  function checkDeepLink() {
    var params = new URLSearchParams(location.search);
    var id = params.get('booking');
    if (!id) return;
    P.getBooking(id).then(function (rec) {
      if (!rec) { toast('Booking not found on this device.'); return; }
      renderConfirmation(rec);
      showView('view-confirm');
    });
  }

  // ── Wire up ──────────────────────────────────────────────
  // The full-puja flow (/puja) and the chadhava flow (/chadhava) live on separate
  // pages sharing this script. Each block only wires up if its markup is present.
  function initPackageFlow() {
    renderPackages();
    populateGotras();

    $('#proceed-sankalp').addEventListener('click', openSankalp);
    $('#sankalp-close').addEventListener('click', closeSankalp);
    $('#sankalp-cancel').addEventListener('click', closeSankalp);
    $('#sankalp-modal').addEventListener('click', function (e) {
      if (e.target === $('#sankalp-modal')) closeSankalp();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#sankalp-modal').classList.contains('show')) closeSankalp();
    });

    $('#f-diff-calling').addEventListener('change', function () {
      $('#calling-field').style.display = this.checked ? 'block' : 'none';
    });
    $('#f-unknown-gotra').addEventListener('change', applyUnknownGotra);

    // digit-only phone inputs
    ['#f-whatsapp', '#f-calling'].forEach(function (sel) {
      $(sel).addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
      });
    });

    $('#sankalp-next').addEventListener('click', function () {
      if (!validateSankalp()) { toast('Please complete the required fields.'); return; }
      collectSankalp();
      closeSankalp();
      goToReview();
    });

    $('#back-to-pkg').addEventListener('click', function () {
      showView('view-packages');
      $('.view.active .stepbar').setAttribute('data-step', '1');
      renderStepbars();
      if (draft.packageId) $('#sticky-bar').classList.add('show');
    });

    $('#pay-btn').addEventListener('click', handlePay);
    $('#f-address').addEventListener('input', function () {
      if (this.value.trim()) this.closest('.field').classList.remove('invalid');
    });
  }

  function initChadhavaFlow() {
    renderChadhavaGrid();
    renderChadhavaBill();

    $('#ch-whatsapp').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
      if (validPhone(this.value)) this.closest('.field').classList.remove('invalid');
    });
    $('#ch-name').addEventListener('input', function () {
      if (this.value.trim()) this.closest('.field').classList.remove('invalid');
    });
    $('#ch-address').addEventListener('input', function () {
      if (this.value.trim()) this.closest('.field').classList.remove('invalid');
    });
    $('#ch-pay-btn').addEventListener('click', payChadhava);
    $('#chadhava-checkout-btn').addEventListener('click', goToChadhavaCheckout);
  }

  function init() {
    renderStepbars();
    if ($('#pkg-grid')) initPackageFlow();
    if ($('#chadhava-grid')) initChadhavaFlow();
    checkDeepLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
