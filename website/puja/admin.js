/* ─────────────────────────────────────────────────────────────
   Puja Ops — Admin Dashboard controller
   NOTE: the passcode gate is a lightweight client-side deterrent
   only. For production, put this behind real server-side auth.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var P = window.RithamPuja;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = P.formatINR;

  var PASSCODE = 'harharmahadev';       // demo gate — replace with real auth
  var SESSION_KEY = 'ritham_puja_admin_ok';
  var BATCH_SIZE = 25;

  var state = { statusFilter: 'all', search: '' };
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

  // ── Gate ─────────────────────────────────────────────────
  function unlock() {
    $('#gate').style.display = 'none';
    $('#dash').style.display = 'block';
    renderAll();
  }
  function initGate() {
    if (sessionStorage.getItem(SESSION_KEY) === '1') { unlock(); return; }
    $('#gate-btn').addEventListener('click', tryUnlock);
    $('#gate-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
  }
  function tryUnlock() {
    if ($('#gate-pass').value === PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, '1');
      unlock();
    } else {
      $('#gate-err').style.display = 'block';
    }
  }

  // ── Data helpers ─────────────────────────────────────────
  function allBookings() { return P.listBookings(); }
  function filtered() {
    var q = state.search.trim().toLowerCase();
    return allBookings().filter(function (b) {
      if (state.statusFilter !== 'all' && b.status !== state.statusFilter) return false;
      if (!q) return true;
      var hay = [b.id, b.devotees.join(' '), b.whatsapp, b.gotra, b.package && b.package.name]
        .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  // ── KPIs ─────────────────────────────────────────────────
  function renderKPIs() {
    var list = allBookings();
    var gross = list.reduce(function (s, b) { return s + b.total; }, 0);
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
      var addons = b.addons.length ? b.addons.map(function (a) { return a.name; }).join(', ') : '—';
      var si = statusIdx(b.status);
      return '<tr>' +
        '<td class="mono">' + esc(b.id) + '</td>' +
        '<td class="cust"><b>' + esc(b.devotees[0] || '—') + '</b>' +
          (b.devotees.length > 1 ? '<small>+' + (b.devotees.length - 1) + ' more</small>' : '') + '</td>' +
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
    var b = P.getBooking(id);
    if (!b) return;
    $('#fulfil-title').textContent = 'Fulfilment · ' + b.id;
    $('#fulfil-sub').textContent = b.devotees.join(', ') + ' · ' + (b.package ? b.package.name : '');
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
        P.STATUSES.map(function (s, i) {
          return '<button type="button" class="pill' + (b.status === s ? ' on' : '') + '" data-status="' + esc(s) + '">' + esc(s) + '</button>';
        }).join('') +
      '</div></div>' +
      '<div class="field"><label for="fs-video">Video Link (Google Drive / Cloudinary)</label>' +
        '<input class="input" id="fs-video" type="url" placeholder="https://…" value="' + esc(b.fulfillment.videoLink || '') + '"></div>' +
      '<div class="field"><label for="fs-courier">Courier Tracking Number' +
        (b.address ? '' : ' <span class="hint">(no home-delivery items)</span>') + '</label>' +
        '<input class="input" id="fs-courier" type="text" placeholder="e.g. AWB123456789"' +
        (b.address ? '' : ' disabled') + ' value="' + esc(b.fulfillment.courierTracking || '') + '"></div>' +
      '<button type="button" class="btn btn-ghost btn-sm btn-block" id="fs-webhook">Send WhatsApp update (simulate webhook)</button>' +
      '<div class="webhook-log" id="fs-webhook-log"></div>';

    // status pills
    var chosen = b.status;
    $$('#fs-status .pill').forEach(function (p) {
      p.addEventListener('click', function () {
        chosen = p.getAttribute('data-status');
        $$('#fs-status .pill').forEach(function (x) { x.classList.remove('on'); });
        p.classList.add('on');
      });
    });
    // webhook sim
    $('#fs-webhook').addEventListener('click', function () {
      var log = $('#fs-webhook-log');
      log.classList.add('show');
      log.textContent = 'POST /whatsapp/notify → { to: "' + b.whatsapp + '", template: "puja_update", status: "' + chosen + '" } ✓ 200 OK';
    });

    $('#fulfil-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    // save handler bound fresh each open
    $('#fulfil-save').onclick = function () {
      P.updateBooking(currentId, {
        status: chosen,
        fulfillment: {
          videoLink: $('#fs-video').value.trim() || null,
          courierTracking: $('#fs-courier').value.trim() || null
        }
      });
      closeFulfil();
      toast('Booking updated.');
      renderAll();
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
      var cells = [
        b.id, b.devotees.join(' | '), b.gotra, b.whatsapp, b.callingNumber || '',
        b.package ? b.package.name : '', b.addons.map(function (a) { return a.name; }).join(' | '),
        b.dakshina, b.total, b.status, b.address || '',
        b.fulfillment.videoLink || '', b.fulfillment.courierTracking || '', b.createdAt
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

    // Flatten to one line per devotee, carrying the booking's gotra.
    var entries = [];
    rows.forEach(function (b) {
      b.devotees.forEach(function (name) {
        entries.push({ name: name, gotra: b.gotra, id: b.id });
      });
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
      // header
      doc.setFillColor(123, 44, 191); doc.rect(0, 0, W, 72, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('Ground Pandit Sankalp Sheet', M, 34);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text('Kotilingeshwara Maha Rudrabhishekam · 17 Aug 2026 · Batch ' + (bi + 1) + ' of ' + batches, M, 54);

      var y = 100;
      doc.setTextColor(30, 21, 51);
      // column headers
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('#', M, y); doc.text('Devotee Name', M + 30, y); doc.text('Gotra', W - 200, y); doc.text('Ref', W - 90, y);
      y += 8; doc.setDrawColor(210, 200, 228); doc.line(M, y, W - M, y); y += 18;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      slice.forEach(function (e, i) {
        var n = bi * BATCH_SIZE + i + 1;
        doc.text(String(n), M, y);
        doc.text(doc.splitTextToSize(e.name, W - 320)[0] || e.name, M + 30, y);
        doc.text(e.gotra, W - 200, y);
        doc.setFontSize(8); doc.setTextColor(150, 150, 160);
        doc.text(e.id.replace('RTH-SVN-', ''), W - 90, y);
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

  // ── Init ─────────────────────────────────────────────────
  function init() {
    initGate();
    $('#seed-btn').addEventListener('click', function () { P.seedDemo(); renderAll(); toast('Demo data loaded.'); });
    $('#logout-btn').addEventListener('click', function () {
      sessionStorage.removeItem(SESSION_KEY); location.reload();
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
