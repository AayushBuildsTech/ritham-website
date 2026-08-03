/* ─────────────────────────────────────────────────────────────
   Puja Ops — Admin Dashboard controller
   Auth: real Supabase Auth + RLS (only web_puja_admins can read).
   Falls back to a local passcode ONLY when Supabase isn't configured
   (e.g. opening the file directly for offline UI work).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var P = window.RithamPuja;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = P.formatINR;

  var PASSCODE = 'harharmahadev';       // offline fallback only
  var SESSION_KEY = 'ritham_puja_admin_ok';
  var BATCH_SIZE = 25;

  var state = { statusFilter: 'all', search: '', bookings: [] };
  var toastTimer;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  function statusIdx(s) { return Math.max(0, P.STATUSES.indexOf(s)); }

  // ── Gate / auth ──────────────────────────────────────────
  function gateErr(msg) { var e = $('#gate-err'); e.textContent = msg; e.style.display = 'block'; }
  function unlock() {
    $('#gate').style.display = 'none';
    $('#dash').style.display = 'block';
    loadData();
  }
  function initGate() {
    if (!P.hasDB()) { initPasscodeFallback(); return; }
    // Supabase mode
    $('#gate-hint').innerHTML = 'Sign in with your Ritham admin account. Access is enforced server-side (Supabase RLS).';
    $('#gate-email').style.display = '';
    $('#gate-btn').textContent = 'Sign in';
    $('#gate-btn').addEventListener('click', signInFlow);
    var onEnter = function (e) { if (e.key === 'Enter') signInFlow(); };
    $('#gate-email').addEventListener('keydown', onEnter);
    $('#gate-pass').addEventListener('keydown', onEnter);
    // resume an existing session
    P.currentUser().then(function (u) {
      if (!u) return;
      P.isAdmin().then(function (ok) { if (ok) unlock(); });
    });
  }
  function signInFlow() {
    var email = $('#gate-email').value.trim();
    var pw = $('#gate-pass').value;
    if (!email || !pw) { gateErr('Enter your email and password.'); return; }
    $('#gate-err').style.display = 'none';
    $('#gate-btn').disabled = true;
    P.signIn(email, pw).then(function (res) {
      if (res.error) { gateErr('Incorrect email or password.'); return; }
      return P.isAdmin().then(function (ok) {
        if (!ok) { gateErr('This account is not authorised for puja admin.'); return P.signOut(); }
        unlock();
      });
    }).catch(function () { gateErr('Sign-in failed — please try again.'); })
      .then(function () { $('#gate-btn').disabled = false; });
  }
  // offline-only passcode gate (no Supabase configured)
  function initPasscodeFallback() {
    $('#gate-email').style.display = 'none';
    $('#gate-hint').innerHTML = 'Offline mode (no backend) — demo passcode <b>harharmahadev</b>.';
    if (sessionStorage.getItem(SESSION_KEY) === '1') { unlock(); return; }
    var tryUnlock = function () {
      if ($('#gate-pass').value === PASSCODE) { sessionStorage.setItem(SESSION_KEY, '1'); unlock(); }
      else gateErr('Incorrect passcode.');
    };
    $('#gate-btn').addEventListener('click', tryUnlock);
    $('#gate-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
  }

  // ── Data ─────────────────────────────────────────────────
  function loadData() {
    P.listBookings().then(function (list) {
      state.bookings = list || [];
      renderAll();
    }).catch(function (e) {
      console.error('load bookings failed:', e);
      toast('Could not load bookings.');
    });
  }
  function allBookings() { return state.bookings; }
  function findBooking(id) {
    for (var i = 0; i < state.bookings.length; i++) if (state.bookings[i].id === id) return state.bookings[i];
    return null;
  }
  function filtered() {
    var q = state.search.trim().toLowerCase();
    return allBookings().filter(function (b) {
      if (state.statusFilter !== 'all' && b.status !== state.statusFilter) return false;
      if (!q) return true;
      var hay = [b.id, (b.devotees || []).join(' '), b.whatsapp, b.gotra, b.package && b.package.name]
        .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  // ── KPIs ─────────────────────────────────────────────────
  function renderKPIs() {
    var list = allBookings();
    var gross = list.reduce(function (s, b) { return s + (b.total || 0); }, 0);
    var counts = { individual: 0, couple: 0, family: 0 };
    var pendingPrasad = 0;
    list.forEach(function (b) {
      if (b.package && counts.hasOwnProperty(b.package.id)) counts[b.package.id]++;
      if (b.address && b.status !== 'Prasad Dispatched') pendingPrasad++;
    });
    $('#kpi-grid').innerHTML = '' +
      kpi('Gross Revenue', fmt(gross), 'accent') +
      kpi('Paid Orders', list.length) +
      '<div class="kpi"><div class="kpi-label">Bookings by Package</div>' +
        '<div class="kpi-split">' +
          '<div><b>' + counts.individual + '</b>Individual</div>' +
          '<div><b>' + counts.couple + '</b>Couple</div>' +
          '<div><b>' + counts.family + '</b>Family</div>' +
        '</div></div>' +
      kpi('Pending Prasad Deliveries', pendingPrasad, pendingPrasad ? 'warn' : '');
  }
  function kpi(label, value, cls) {
    return '<div class="kpi ' + (cls || '') + '"><div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-value">' + value + '</div></div>';
  }

  // ── Filters ──────────────────────────────────────────────
  function renderFilters() {
    var list = allBookings();
    var opts = [{ id: 'all', label: 'All' }].concat(P.STATUSES.map(function (s) { return { id: s, label: s }; }));
    $('#status-filters').innerHTML = opts.map(function (o) {
      var n = o.id === 'all' ? list.length : list.filter(function (b) { return b.status === o.id; }).length;
      return '<button class="pill' + (state.statusFilter === o.id ? ' on' : '') + '" data-status="' + esc(o.id) + '">' +
        esc(o.label) + ' <span class="count">' + n + '</span></button>';
    }).join('');
    $$('#status-filters .pill').forEach(function (p) {
      p.addEventListener('click', function () {
        state.statusFilter = p.getAttribute('data-status');
        renderFilters(); renderTable();
      });
    });
  }

  // ── Table ────────────────────────────────────────────────
  function renderTable() {
    var rows = filtered();
    var body = $('#ops-body');
    $('#empty-state').style.display = rows.length ? 'none' : 'block';
    body.innerHTML = rows.map(function (b) {
      var addons = (b.addons && b.addons.length) ? b.addons.map(function (a) { return a.name; }).join(', ') : '—';
      var si = statusIdx(b.status);
      return '<tr>' +
        '<td class="mono">' + esc(b.id) + '</td>' +
        '<td class="cust"><b>' + esc((b.devotees || [])[0] || '—') + '</b>' +
          (b.devotees && b.devotees.length > 1 ? '<small>+' + (b.devotees.length - 1) + ' more</small>' : '') + '</td>' +
        '<td>' + esc(b.whatsapp) + '</td>' +
        '<td>' + esc(b.gotra) + '</td>' +
        '<td>' + esc(b.package ? b.package.name : '—') + '</td>' +
        '<td class="addons-cell">' + esc(addons) + '</td>' +
        '<td class="amt">' + fmt(b.total) + '</td>' +
        '<td>' + esc(fmtDate(b.createdAt)) + '</td>' +
        '<td><span class="badge s' + si + '">' + esc(b.status) + '</span></td>' +
        '<td class="row-manage"><button class="btn btn-ghost btn-sm manage" data-id="' + esc(b.id) + '">Manage</button></td>' +
      '</tr>';
    }).join('');
    $$('.manage', body).forEach(function (btn) {
      btn.addEventListener('click', function () { openFulfil(btn.getAttribute('data-id')); });
    });
  }

  // ── Fulfilment modal ─────────────────────────────────────
  var currentId = null;
  function openFulfil(id) {
    currentId = id;
    var b = findBooking(id);
    if (!b) return;
    var fx = b.fulfillment || {};
    $('#fulfil-title').textContent = 'Fulfilment · ' + b.id;
    $('#fulfil-sub').textContent = (b.devotees || []).join(', ') + ' · ' + (b.package ? b.package.name : '');
    var addr = b.address ? ('<div><span class="k">Address:</span> ' + esc(b.address) + '</div>') : '';
    $('#fulfil-body').innerHTML =
      '<div class="fulfil-meta">' +
        '<div><span class="k">WhatsApp:</span> ' + esc(b.whatsapp) + '</div>' +
        '<div><span class="k">Gotra:</span> ' + esc(b.gotra) + '</div>' +
        '<div><span class="k">Total:</span> ' + fmt(b.total) + '</div>' +
        (b.wish ? '<div><span class="k">Wish:</span> ' + esc(b.wish) + '</div>' : '') +
        addr +
      '</div>' +
      '<div class="field"><label>Status</label><div class="fulfil-status-pills" id="fs-status">' +
        P.STATUSES.map(function (s) {
          return '<button type="button" class="pill' + (b.status === s ? ' on' : '') + '" data-status="' + esc(s) + '">' + esc(s) + '</button>';
        }).join('') +
      '</div></div>' +
      '<div class="field"><label for="fs-video">Video Link (Google Drive / Cloudinary)</label>' +
        '<input class="input" id="fs-video" type="url" placeholder="https://…" value="' + esc(fx.videoLink || '') + '"></div>' +
      '<div class="field"><label for="fs-courier">Courier Tracking Number' +
        (b.address ? '' : ' <span class="hint">(no home-delivery items)</span>') + '</label>' +
        '<input class="input" id="fs-courier" type="text" placeholder="e.g. AWB123456789"' +
        (b.address ? '' : ' disabled') + ' value="' + esc(fx.courierTracking || '') + '"></div>' +
      '<button type="button" class="btn btn-ghost btn-sm btn-block" id="fs-webhook">Send WhatsApp update (simulate webhook)</button>' +
      '<div class="webhook-log" id="fs-webhook-log"></div>';

    var chosen = b.status;
    $$('#fs-status .pill').forEach(function (p) {
      p.addEventListener('click', function () {
        chosen = p.getAttribute('data-status');
        $$('#fs-status .pill').forEach(function (x) { x.classList.remove('on'); });
        p.classList.add('on');
      });
    });
    $('#fs-webhook').addEventListener('click', function () {
      var log = $('#fs-webhook-log');
      log.classList.add('show');
      log.textContent = 'POST /whatsapp/notify → { to: "' + b.whatsapp + '", template: "puja_update", status: "' + chosen + '" } ✓ 200 OK';
    });

    $('#fulfil-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    $('#fulfil-save').onclick = function () {
      var btn = $('#fulfil-save'); btn.disabled = true;
      P.updateBooking(currentId, {
        status: chosen,
        fulfillment: {
          videoLink: $('#fs-video').value.trim() || null,
          courierTracking: $('#fs-courier').value.trim() || null
        }
      }).then(function () {
        closeFulfil(); toast('Booking updated.'); loadData();
      }).catch(function (e) {
        console.error('update failed:', e); toast('Update failed.');
      }).then(function () { btn.disabled = false; });
    };
    $('#fulfil-delete').onclick = function () {
      if (!window.confirm('Delete booking ' + currentId + '? This permanently removes it and cannot be undone.')) return;
      var dbtn = $('#fulfil-delete'); dbtn.disabled = true;
      P.deleteBooking(currentId).then(function () {
        closeFulfil(); toast('Booking deleted.'); loadData();
      }).catch(function (e) {
        console.error('delete failed:', e); toast('Delete failed.');
      }).then(function () { dbtn.disabled = false; });
    };
  }
  function closeFulfil() {
    $('#fulfil-modal').classList.remove('show');
    document.body.style.overflow = '';
  }

  // ── Exports ──────────────────────────────────────────────
  function exportCSV() {
    var rows = filtered();
    if (!rows.length) { toast('Nothing to export.'); return; }
    var headers = ['Order ID', 'Devotees', 'Gotra', 'WhatsApp', 'Calling', 'Package', 'Add-Ons', 'Dakshina', 'Total', 'Status', 'Address', 'Video Link', 'Courier', 'Date'];
    var lines = [headers.join(',')];
    rows.forEach(function (b) {
      var fx = b.fulfillment || {};
      var cells = [
        b.id, (b.devotees || []).join(' | '), b.gotra, b.whatsapp, b.callingNumber || '',
        b.package ? b.package.name : '', (b.addons || []).map(function (a) { return a.name; }).join(' | '),
        b.dakshina, b.total, b.status, b.address || '',
        fx.videoLink || '', fx.courierTracking || '', b.createdAt
      ];
      lines.push(cells.map(csvCell).join(','));
    });
    downloadBlob(lines.join('\r\n'), 'text/csv;charset=utf-8;', 'ritham-puja-bookings.csv');
  }
  function csvCell(v) {
    v = String(v == null ? '' : v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function downloadBlob(content, type, filename) {
    var blob = new Blob(['﻿' + content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // Ground Pandit Sheet — names & gotras batched by 25 for recitation.
  function exportPanditPDF() {
    var rows = filtered();
    if (!rows.length) { toast('Nothing to export.'); return; }
    if (!window.jspdf) { toast('PDF library still loading — try again.'); return; }

    var entries = [];
    rows.forEach(function (b) {
      (b.devotees || []).forEach(function (name) { entries.push({ name: name, gotra: b.gotra, id: b.id }); });
    });

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 44;
    var batches = Math.ceil(entries.length / BATCH_SIZE);

    for (var bi = 0; bi < batches; bi++) {
      if (bi > 0) doc.addPage();
      var slice = entries.slice(bi * BATCH_SIZE, (bi + 1) * BATCH_SIZE);
      doc.setFillColor(123, 44, 191); doc.rect(0, 0, W, 72, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('Ground Pandit Sankalp Sheet', M, 34);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text('Kotilingeshwara Maha Rudrabhishekam · 17 Aug 2026 · Batch ' + (bi + 1) + ' of ' + batches, M, 54);

      var y = 100;
      doc.setTextColor(30, 21, 51);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('#', M, y); doc.text('Devotee Name', M + 30, y); doc.text('Gotra', W - 200, y); doc.text('Ref', W - 90, y);
      y += 8; doc.setDrawColor(210, 200, 228); doc.line(M, y, W - M, y); y += 18;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      slice.forEach(function (e, i) {
        var n = bi * BATCH_SIZE + i + 1;
        doc.text(String(n), M, y);
        doc.text(doc.splitTextToSize(e.name, W - 320)[0] || e.name, M + 30, y);
        doc.text(e.gotra || '', W - 200, y);
        doc.setFontSize(8); doc.setTextColor(150, 150, 160);
        doc.text(String(e.id).replace('RTH-SVN-', ''), W - 90, y);
        doc.setFontSize(11); doc.setTextColor(30, 21, 51);
        y += 22;
        if (y > H - 60) { doc.addPage(); y = 60; }
      });

      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(150, 150, 160);
      doc.text('Om Namah Shivaya · Recite name & gotra during Abhishek · Ritham', M, H - 30);
    }
    doc.save('Pandit-Sankalp-Sheet.pdf');
  }

  // ── Render all ───────────────────────────────────────────
  function renderAll() { renderKPIs(); renderFilters(); renderTable(); }

  // ── Demo seed (inserts sample bookings via the public flow) ─
  function seedDemo() {
    var drafts = [
      { packageId: 'family', whatsapp: '+919876543210', devotees: ['Ramesh Kumar', 'Sita Kumar', 'Aarav Kumar'], gotra: 'Bhardwaj', addonIds: ['prasad-box', 'gau-seva'], dakshina: 501, address: '12 MG Road, Bengaluru, Karnataka 560001' },
      { packageId: 'individual', whatsapp: '+919812345678', devotees: ['Priya Sharma'], gotra: 'Kashyap', gotraUnknown: true, addonIds: ['doodh-bilva'], dakshina: 251 },
      { packageId: 'couple', whatsapp: '+919900112233', devotees: ['Arjun Rao', 'Meera Rao'], gotra: 'Vashistha', addonIds: ['prasad-box'], dakshina: 101, address: '4 Temple St, Kolar, Karnataka 563101' }
    ];
    var btn = $('#seed-btn'); btn.disabled = true;
    Promise.all(drafts.map(function (d, i) { return P.createBooking(d, { id: 'pay_demo_' + i, method: 'simulated' }); }))
      .then(function () { loadData(); toast('Demo data loaded.'); })
      .catch(function (e) { console.error(e); toast('Seeding failed.'); })
      .then(function () { btn.disabled = false; });
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    initGate();
    $('#seed-btn').addEventListener('click', seedDemo);
    $('#logout-btn').addEventListener('click', function () {
      sessionStorage.removeItem(SESSION_KEY);
      Promise.resolve(P.signOut()).then(function () { location.reload(); });
    });
    $('#search').addEventListener('input', function () { state.search = this.value; renderTable(); });
    $('#export-csv').addEventListener('click', exportCSV);
    $('#export-pdf').addEventListener('click', exportPanditPDF);
    $('#fulfil-close').addEventListener('click', closeFulfil);
    $('#fulfil-cancel').addEventListener('click', closeFulfil);
    $('#fulfil-modal').addEventListener('click', function (e) { if (e.target === $('#fulfil-modal')) closeFulfil(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#fulfil-modal').classList.contains('show')) closeFulfil();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
