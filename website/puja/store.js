/* ─────────────────────────────────────────────────────────────
   Sawan Somvar Puja — Data Model & Persistence Layer
   -------------------------------------------------------------
   A tiny, framework-free "mock API" backed by localStorage.
   Everything the booking flow and the admin dashboard need goes
   through RithamPuja.* so this module can later be swapped for a
   real REST/Supabase backend without touching the UI code.
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  // ── Catalogue / constants (single source of truth) ──────────
  var EVENT = {
    title: 'Sawan Vishesh Kotilingeshwara Maha Rudrabhishekam',
    date: '17 August 2026',
    dateISO: '2026-08-17',
    temple: 'Kotilingeshwara Temple, Kolar',
    location: 'Kolar, Karnataka'
  };

  var PACKAGES = [
    {
      id: 'individual',
      name: 'Eka Sankalp',
      subtitle: 'Individual',
      price: 401,
      capacity: 1,
      homeDelivery: false,
      blurb: 'One devotee. Your name & gotra recited in the Sankalp during the Maha Rudrabhishekam.',
      perks: ['1 Member Sankalp', 'Personal Sankalp in your name', 'Video on WhatsApp']
    },
    {
      id: 'couple',
      name: 'Jodi Kalyan',
      subtitle: 'Couple',
      price: 701,
      capacity: 2,
      homeDelivery: false,
      blurb: 'For two — ideal for couples & partners seeking harmony, health and prosperity together.',
      perks: ['2 Members Sankalp', 'Joint Sankalp for the pair', 'Video on WhatsApp']
    },
    {
      id: 'family',
      name: 'Kutumb Raksha',
      subtitle: 'Family',
      price: 1251,
      capacity: 6,
      homeDelivery: true,
      blurb: 'Protect the whole household — up to 6 members, plus a sacred Prasad box delivered to your home.',
      perks: ['Up to 6 Members', 'Home Prasad Delivery included', 'Priority Sankalp & Video'],
      featured: true
    }
  ];

  var ADDONS = [
    {
      id: 'combo-trio',
      name: 'All 3 Offerings Combo',
      price: 101,
      homeDelivery: false,
      tag: 'Best Value',
      desc: 'Ganga Jal Arpan + Doodh & Bilva Patra Seva + Nandi & Gau Seva — all three offered in your name (save ₹52).',
      img: '../img/addon-combo.webp',
      icon: 'M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5'
    },
    {
      id: 'gau-seva',
      name: 'Nandi & Gau Seva',
      price: 51,
      homeDelivery: false,
      tag: 'At Temple',
      desc: 'Feed green fodder to cows and sacred bulls in temple premises.',
      img: '../img/addon-gau.webp',
      icon: 'M4 8c0 4.4 3.6 7.5 8 7.5s8-3.1 8-7.5M6.5 8 5 5.5M17.5 8 19 5.5M9.5 11.5h.01M14.5 11.5h.01'
    },
    {
      id: 'ganga-jal',
      name: 'Ganga Jal Arpan',
      price: 51,
      homeDelivery: false,
      tag: 'At Temple',
      desc: 'Sacred Ganga Jal offered over the Shivling in your name during the Abhishek.',
      img: '../img/addon-ganga-jal.webp',
      icon: 'M12 2c3.5 4 5.5 6.7 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 8.7 8.5 6 12 2zM9.2 11.6c.9.9 1.8.9 2.8 0s1.9-.9 2.8 0'
    },
    {
      id: 'doodh-bilva',
      name: 'Doodh & Bilva Patra Seva',
      price: 51,
      homeDelivery: false,
      tag: 'At Temple',
      desc: 'Special offering of Milk and 108 Bel Patra during Abhishek.',
      img: '../img/addon-doodh-bilva.webp',
      icon: 'M12 3c3.2 3.2 3.2 7.5 0 10.7-3.2-3.2-3.2-7.5 0-10.7zM12 13.7V21M8 21h8'
    },
    {
      id: 'prasad-box',
      name: 'Kotilingeshwara Sawan Prasad Box',
      price: 301,
      homeDelivery: true,
      tag: 'Home Delivery',
      desc: 'Panchmeva, Sacred Bhasma, Kolar Temple Jal, and Panchmukhi Rudraksha.',
      img: '../img/addon-prasad.webp',
      icon: 'M3 8h18v3H3zM5 11v9h14v-9M12 8v12M8.5 8C7 8 6 7 6 5.5S7.5 4 9 5s3 3 3 3M15.5 8C17 8 18 7 18 5.5S16.5 4 15 5s-3 3-3 3'
    }
  ];

  // Gotra list (type-to-filter + select). Source: gotras_list.csv
  var GOTRAS = ['Agastya','Alambayan','Angiras','Atri','Aupamanyav','Awasthi','Babrahavyan','Baikunth','Bansal','Bhardwaj','Bhargava','Bhrigu','Chahal','Chaudhary','Chauhan','Chhibber','Chikara','Dadhichi','Dahiya','Dalabhya','Dalal','Deshwal','Dhull','Dixit','Gahlot','Garg','Gat','Gautam','Ghosh','Giri','Goyal','Gyan','Hansi','Harita','Hooda','Jakhar','Jamadagni','Jatrana','Jethwa','Kadian','Kalar','Kanojia','Kapoor','Kashyap','Katyayan','Kaundinya','Kaushik','Khanna','Kharb','Khatri','Koli','Kushal','Lamba','Lohchab','Madan','Malik','Mandavya','Marichi','Moudgalya','Mudgal','Nandal','Ojha','Panchal','Parashar','Pathak','Phogat','Pradhan','Puri','Raghav','Rana','Rathi','Rathore','Sangwan','Saraswat','Sehrawat','Shandilya','Sharma','Sikarwar','Sindhu','Sirohi','Soni','Srivastava','Sukhija','Tayal','Tewari','Tomar','Upadhyay','Upreti','Vashistha','Vatsa','Verma','Vishwa','Vishwamitra','Yadav'];

  var DAKSHINA_OPTIONS = [51, 101, 251, 501];
  var DAKSHINA_DEFAULT = 251;

  // Waived (shown crossed-out to signal value)
  var FEES = { platform: 99, video: 99 };

  var STATUSES = ['Payment Successful', 'Sankalp Sent', 'Video Uploaded', 'Prasad Dispatched'];

  var STORAGE_KEY = 'ritham_puja_bookings_v1';

  // ── Lookups ─────────────────────────────────────────────────
  function getPackage(id) {
    for (var i = 0; i < PACKAGES.length; i++) if (PACKAGES[i].id === id) return PACKAGES[i];
    return null;
  }
  function getAddon(id) {
    for (var i = 0; i < ADDONS.length; i++) if (ADDONS[i].id === id) return ADDONS[i];
    return null;
  }

  // ── Supabase client (primary) with a localStorage fallback ──
  var _client = null, _clientTried = false;
  function db() {
    if (_clientTried) return _client;
    _clientTried = true;
    var cfg = global.RITHAM_SUPABASE;
    if (global.supabase && cfg && cfg.url && cfg.anonKey) {
      try { _client = global.supabase.createClient(cfg.url, cfg.anonKey); } catch (e) { _client = null; }
    }
    return _client;
  }
  function hasDB() { return !!db(); }

  // localStorage: fallback store + buyer's own-pass cache (deep link)
  function readAll() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function writeAll(list) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* disabled */ }
  }
  function cacheLocal(rec) {
    var list = readAll();
    var i = list.findIndex ? list.findIndex(function (r) { return r.id === rec.id; }) : -1;
    if (i >= 0) list[i] = rec; else list.push(rec);
    writeAll(list);
  }

  // Map a DB row (snake_case) to the client record shape.
  function rowToRecord(r) {
    return {
      id: r.booking_code,
      createdAt: r.created_at,
      status: r.status,
      event: EVENT,
      package: { id: r.package_id, name: r.package_name, subtitle: r.package_subtitle, price: r.package_price_inr, capacity: r.capacity },
      whatsapp: r.whatsapp,
      callingNumber: r.calling_number,
      devotees: r.devotees || [],
      gotra: r.gotra,
      gotraUnknown: !!r.gotra_unknown,
      wish: r.wish || '',
      addons: r.addons || [],
      dakshina: r.dakshina_inr,
      address: r.address,
      total: r.total_inr,
      payment: r.payment || {},
      fulfillment: r.fulfillment || { videoLink: null, courierTracking: null }
    };
  }

  function genId() {
    // RTH-SVN-XXXXX  (human-friendly, avoids ambiguous chars)
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return 'RTH-SVN-' + s;
  }

  // Compute the payable total from a draft booking.
  function computeTotal(draft) {
    var total = 0;
    var pkg = getPackage(draft.packageId);
    if (pkg) total += pkg.price;
    (draft.addonIds || []).forEach(function (id) {
      var a = getAddon(id);
      if (a) total += a.price;
    });
    total += (typeof draft.dakshina === 'number' ? draft.dakshina : DAKSHINA_DEFAULT);
    return total;
  }

  // Does this booking involve any home delivery (needs address)?
  function needsAddress(draft) {
    var pkg = getPackage(draft.packageId);
    if (pkg && pkg.homeDelivery) return true;
    return (draft.addonIds || []).some(function (id) {
      var a = getAddon(id);
      return a && a.homeDelivery;
    });
  }

  // Build the DB row + client record from a draft. Returns { row, record }.
  function draftToRowRecord(draft, payment, forceCode) {
    var pkg = getPackage(draft.packageId);
    var addons = (draft.addonIds || []).map(getAddon).filter(Boolean)
      .map(function (a) { return { id: a.id, name: a.name, price: a.price, homeDelivery: a.homeDelivery }; });
    var code = forceCode || genId();
    var dakshina = typeof draft.dakshina === 'number' ? draft.dakshina : DAKSHINA_DEFAULT;
    var address = needsAddress(draft) ? (draft.address || null) : null;
    var total = computeTotal(draft);
    payment = payment || { id: null, method: 'simulated' };
    var row = {
      booking_code: code, status: STATUSES[0],
      package_id: pkg ? pkg.id : null, package_name: pkg ? pkg.name : null,
      package_subtitle: pkg ? pkg.subtitle : null, capacity: pkg ? pkg.capacity : null,
      package_price_inr: pkg ? pkg.price : 0,
      whatsapp: draft.whatsapp, calling_number: draft.callingNumber || null,
      devotees: draft.devotees || [], gotra: draft.gotra, gotra_unknown: !!draft.gotraUnknown,
      wish: draft.wish || '', addons: addons, dakshina_inr: dakshina,
      address: address, total_inr: total, payment: payment, fulfillment: {}
    };
    return { row: row, record: rowToRecord(Object.assign({ created_at: new Date().toISOString() }, row)) };
  }

  // Persist a completed booking. Returns Promise<record>.
  function createBooking(draft, payment) {
    var built = draftToRowRecord(draft, payment);
    var c = db();
    if (!c) { cacheLocal(built.record); return Promise.resolve(built.record); }
    return c.from('web_puja_bookings').insert(built.row).then(function (res) {
      if (res.error) throw res.error;
      cacheLocal(built.record); // keep a local copy so the buyer's pass deep-link works
      return built.record;
    }).catch(function (err) {
      // Never strand the buyer: keep their pass locally even if the write failed.
      console.warn('Supabase booking insert failed, cached locally:', err && err.message);
      cacheLocal(built.record);
      return built.record;
    });
  }

  // Buyer's own pass (deep link) — served from the local cache (anon cannot read DB).
  function getBooking(id) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return Promise.resolve(list[i]);
    return Promise.resolve(null);
  }

  // Build a confirmed record for a given (server-issued) booking code + cache it
  // locally so the buyer's pass + deep link work. Used after Razorpay verify.
  function makeRecord(draft, code, payment) {
    var built = draftToRowRecord(draft, payment, code);
    cacheLocal(built.record);
    return built.record;
  }

  // Invoke a Supabase edge function (used by the Razorpay checkout flow).
  function invokeFn(name, body) {
    var c = db();
    if (!c) return Promise.reject(new Error('Supabase not configured'));
    return c.functions.invoke(name, { body: body });
  }

  // Admin: all real bookings, newest first (pending/failed checkouts hidden).
  function listBookings() {
    var c = db();
    if (!c) {
      return Promise.resolve(readAll().slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }));
    }
    return c.from('web_puja_bookings').select('*')
      .not('status', 'in', '("pending_payment","payment_failed")')
      .order('created_at', { ascending: false }).then(function (res) {
        if (res.error) throw res.error;
        return (res.data || []).map(rowToRecord);
      });
  }

  // Admin: update status / fulfilment by booking_code.
  function updateBooking(id, patch) {
    var c = db();
    if (!c) {
      var list = readAll();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) { list[i] = Object.assign({}, list[i], patch); writeAll(list); return Promise.resolve(list[i]); }
      return Promise.resolve(null);
    }
    var upd = {};
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.fulfillment !== undefined) upd.fulfillment = patch.fulfillment;
    return c.from('web_puja_bookings').update(upd).eq('booking_code', id).then(function (res) {
      if (res.error) throw res.error; return true;
    });
  }

  // Admin: delete a booking by booking_code (e.g. remove test data).
  function deleteBooking(id) {
    var c = db();
    if (!c) {
      writeAll(readAll().filter(function (b) { return b.id !== id; }));
      return Promise.resolve(true);
    }
    return c.from('web_puja_bookings').delete().eq('booking_code', id).then(function (res) {
      if (res.error) throw res.error; return true;
    });
  }

  // ── Auth (admin) ────────────────────────────────────────────
  function signIn(email, password) {
    var c = db();
    if (!c) return Promise.reject(new Error('Supabase not configured'));
    return c.auth.signInWithPassword({ email: email, password: password });
  }
  function signOut() { var c = db(); return c ? c.auth.signOut() : Promise.resolve(); }
  function currentUser() {
    var c = db();
    if (!c) return Promise.resolve(null);
    return c.auth.getUser().then(function (r) { return r.data ? r.data.user : null; });
  }
  function isAdmin() {
    var c = db();
    if (!c) return Promise.resolve(false);
    return c.rpc('is_web_puja_admin').then(function (r) { return !r.error && !!r.data; });
  }

  global.RithamPuja = {
    EVENT: EVENT,
    PACKAGES: PACKAGES,
    ADDONS: ADDONS,
    GOTRAS: GOTRAS,
    DAKSHINA_OPTIONS: DAKSHINA_OPTIONS,
    DAKSHINA_DEFAULT: DAKSHINA_DEFAULT,
    FEES: FEES,
    STATUSES: STATUSES,
    getPackage: getPackage,
    getAddon: getAddon,
    computeTotal: computeTotal,
    needsAddress: needsAddress,
    hasDB: hasDB,
    createBooking: createBooking,   // async → Promise<record>
    getBooking: getBooking,         // async → Promise<record|null>
    updateBooking: updateBooking,   // async → Promise
    listBookings: listBookings,     // async → Promise<record[]>
    deleteBooking: deleteBooking,   // async → Promise
    makeRecord: makeRecord,         // (draft, code, payment) → record (+cache)
    invokeFn: invokeFn,             // (name, body) → Promise (edge function)
    signIn: signIn,
    signOut: signOut,
    currentUser: currentUser,
    isAdmin: isAdmin,
    formatINR: function (n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  };
})(window);
