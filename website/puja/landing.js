/* ─────────────────────────────────────────────────────────────
   Sawan Somvar landing page — countdown, carousel, tabs, nav,
   process timeline & reviews. Booking logic lives in puja.js.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Hard booking deadline — 15 Aug 2026, 23:59:59 IST (UTC+05:30).
  var DEADLINE = new Date('2026-08-15T23:59:59+05:30').getTime();

  // ── Countdown ────────────────────────────────────────────
  var cdTimer;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tickCountdown() {
    var diff = DEADLINE - Date.now();
    if (diff <= 0) { closeBookings(); return; }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    if ($('#cd-days')) $('#cd-days').textContent = pad(d);
    if ($('#cd-hours')) $('#cd-hours').textContent = pad(h);
    if ($('#cd-mins')) $('#cd-mins').textContent = pad(m);
    if ($('#cd-secs')) $('#cd-secs').textContent = pad(s);
  }
  function closeBookings() {
    clearInterval(cdTimer);
    document.body.classList.add('is-closed');
    var wrap = $('#countdown-wrap');
    if (wrap) wrap.innerHTML = '<span class="closed-badge">Bookings Closed for 2026</span>';
    var alertBar = $('#alert-bar');
    if (alertBar) {
      alertBar.style.background = '#fdecee';
      alertBar.innerHTML = '<b style="color:#d61f3a;">Bookings for Sawan 2026 are now closed.</b> ' +
        'Thank you to all the devotees who registered their Sankalp.';
    }
    // belt-and-suspenders: hard-disable booking-entry buttons
    ['#hero-cta', '#proceed-sankalp', '#pay-btn', '#sankalp-next'].forEach(function (sel) {
      var el = $(sel); if (el) { el.setAttribute('aria-disabled', 'true'); el.disabled = true; }
    });
  }
  function startCountdown() {
    if (Date.now() > DEADLINE) { closeBookings(); return; }
    tickCountdown();
    cdTimer = setInterval(tickCountdown, 1000);
  }

  // ── Carousel ─────────────────────────────────────────────
  function initCarousel() {
    var track = $('#carousel-track');
    if (!track) return;
    var slides = $$('.slide', track);
    var dotsWrap = $('#carousel-dots');
    var idx = 0, auto;
    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      if (i === 0) b.className = 'on';
      b.addEventListener('click', function () { go(i); restart(); });
      dotsWrap.appendChild(b);
    });
    function go(n) {
      idx = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (idx * 100) + '%)';
      $$('button', dotsWrap).forEach(function (d, i) { d.classList.toggle('on', i === idx); });
    }
    function next() { go(idx + 1); }
    function restart() { clearInterval(auto); auto = setInterval(next, 4500); }
    // Automatic carousel (no manual prev/next). Dots remain as passive indicators.
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) restart();
  }

  // ── Benefit tabs ─────────────────────────────────────────
  function initTabs() {
    var nav = $('#btabs-nav');
    if (!nav) return;
    $$('button', nav).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-tab');
        $$('button', nav).forEach(function (b) { b.classList.toggle('on', b === btn); });
        $$('.btab-panel').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-panel') === t); });
      });
    });
  }

  // ── 8-step process ───────────────────────────────────────
  // [title, description, icon-path(s) drawn with fill=none stroke]
  var STEPS = [
    ['Select Package', 'Choose the Sankalp that suits your family.', 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8'],
    ['Fill Sankalp Details', 'Enter devotee names, gotra & WhatsApp.', 'M5 3h9l5 5v13H5zM14 3v5h5M8 13h8M8 17h5'],
    ['Choose Add-Ons', 'Add prasad, seva & offerings you wish.', 'M12 4v16M4 12h16'],
    ['Secure Payment', 'Pay safely via UPI, card or netbanking.', 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9.3 12l1.8 1.8 3.4-3.8'],
    ['Temple Updates', 'Booking & status updates on WhatsApp.', 'M4 5h16v11H8l-4 3zM8 9h8M8 12h5'],
    ['Sacred Rituals', 'Priests perform your Sankalp on 17 Aug 2026.', 'M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9zM12 22v-3'],
    ['Personalised Video', 'Receive your puja video on WhatsApp.', 'M4 6h11v12H4zM15 10l5-3v10l-5-3z'],
    ['Prasad Home Delivery', 'Sacred prasad shipped to your door.', 'M3 8h10v8H3zM13 11h4l4 3v2h-8M7 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z']
  ];
  function renderProcess() {
    var t = $('#process-timeline');
    if (!t) return;
    t.innerHTML = STEPS.map(function (s, i) {
      return '<div class="pstep">' +
        '<div class="pnode"><span class="pnum">' + (i + 1) + '</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + s[2] + '"/></svg>' +
        '</div>' +
        '<h4>' + s[0] + '</h4><p>' + s[1] + '</p></div>';
    }).join('');
  }

  // ── Reviews ──────────────────────────────────────────────
  var REVIEWS = [
    ['Rajesh Iyer', 'Bengaluru', 5, 'The video of our Sankalp brought tears to my eyes. Hearing our names chanted at Kotilingeshwara was deeply moving.'],
    ['Anita Deshpande', 'Pune', 5, 'Booked the Family package for my parents. Prasad box arrived beautifully packed within a week. Highly recommend.'],
    ['Suresh Kumar', 'Chennai', 5, 'I did not know my gotra — the Kashyap option made it so simple. Everything was handled with care.'],
    ['Priya Nair', 'Kochi', 4, 'Smooth booking and genuine updates on WhatsApp. Felt connected to the puja despite being far away.'],
    ['Vikram Singh', 'Delhi', 5, 'Did the Kaal Sarp Shanti on Nag Panchami. The whole process was transparent and reassuring. Har Har Mahadev!'],
    ['Meera Rao', 'Hyderabad', 5, 'Beautiful experience. The digital pass and video made it feel personal and authentic.']
  ];
  function stars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }
  function renderReviews() {
    var box = $('#reviews-scroll');
    if (!box) return;
    box.innerHTML = REVIEWS.map(function (r) {
      var initial = r[0].charAt(0);
      return '<div class="review-card">' +
        '<div class="stars" aria-label="' + r[2] + ' out of 5">' + stars(r[2]) + '</div>' +
        '<p class="rv-text">"' + r[3] + '"</p>' +
        '<div class="rv-foot"><span class="rv-av">' + initial + '</span>' +
          '<span><span class="rv-name">' + r[0] + '</span><br><span class="rv-city">' + r[1] + '</span></span>' +
          '<span class="rv-badge">Verified Booking</span></div>' +
      '</div>';
    }).join('');
  }

  // ── Anchor nav active state ──────────────────────────────
  function initAnchorNav() {
    var links = $$('#anchor-nav a');
    if (!links.length) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          links.forEach(function (l) { l.classList.remove('active'); });
          map[e.target.id].classList.add('active');
          // keep the active pill visible in the horizontal scroller
          map[e.target.id].scrollIntoView({ block: 'nearest', inline: 'center' });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    renderProcess();
    renderReviews();
    initCarousel();
    initTabs();
    initAnchorNav();
    startCountdown();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
