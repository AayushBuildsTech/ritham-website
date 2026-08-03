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
      id: 'prasad-box',
      name: 'Kotilingeshwara Sawan Prasad Box',
      price: 301,
      homeDelivery: true,
      tag: 'Home Delivery',
      desc: 'Panchmeva, Sacred Bhasma, Kolar Temple Jal, and Panchmukhi Rudraksha.',
      img: '../img/addon-prasad.webp',
      icon: 'M3 8h18v3H3zM5 11v9h14v-9M12 8v12M8.5 8C7 8 6 7 6 5.5S7.5 4 9 5s3 3 3 3M15.5 8C17 8 18 7 18 5.5S16.5 4 15 5s-3 3-3 3'
    },
    {
      id: 'doodh-bilva',
      name: 'Doodh & Bilva Patra Seva',
      price: 101,
      homeDelivery: false,
      tag: 'At Temple',
      desc: 'Special offering of Milk and 108 Bel Patra during Abhishek.',
      img: '../img/addon-doodh-bilva.webp',
      icon: 'M12 3c3.2 3.2 3.2 7.5 0 10.7-3.2-3.2-3.2-7.5 0-10.7zM12 13.7V21M8 21h8'
    },
    {
      id: 'gau-seva',
      name: 'Nandi & Gau Seva',
      price: 151,
      homeDelivery: false,
      tag: 'At Temple',
      desc: 'Feed green fodder to cows and sacred bulls in temple premises.',
      img: '../img/addon-gau.webp',
      icon: 'M4 8c0 4.4 3.6 7.5 8 7.5s8-3.1 8-7.5M6.5 8 5 5.5M17.5 8 19 5.5M9.5 11.5h.01M14.5 11.5h.01'
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

  // ── Persistence (mock API) ──────────────────────────────────
  function readAll() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function writeAll(list) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* storage may be full / disabled */ }
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

  // Persist a completed booking. Returns the stored record.
  function createBooking(draft, payment) {
    var pkg = getPackage(draft.packageId);
    var addons = (draft.addonIds || []).map(getAddon).filter(Boolean);
    var record = {
      id: genId(),
      createdAt: new Date().toISOString(),
      status: STATUSES[0],
      event: EVENT,
      package: pkg ? { id: pkg.id, name: pkg.name, subtitle: pkg.subtitle, price: pkg.price, capacity: pkg.capacity } : null,
      whatsapp: draft.whatsapp,
      callingNumber: draft.callingNumber || null,
      devotees: draft.devotees || [],
      gotra: draft.gotra,
      gotraUnknown: !!draft.gotraUnknown,
      wish: draft.wish || '',
      addons: addons.map(function (a) { return { id: a.id, name: a.name, price: a.price, homeDelivery: a.homeDelivery }; }),
      dakshina: typeof draft.dakshina === 'number' ? draft.dakshina : DAKSHINA_DEFAULT,
      address: needsAddress(draft) ? (draft.address || null) : null,
      total: computeTotal(draft),
      payment: payment || { id: null, method: 'simulated' },
      fulfillment: { videoLink: null, courierTracking: null }
    };
    var list = readAll();
    list.push(record);
    writeAll(list);
    return record;
  }

  function getBooking(id) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function updateBooking(id, patch) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i] = Object.assign({}, list[i], patch);
        writeAll(list);
        return list[i];
      }
    }
    return null;
  }

  function listBookings() {
    // newest first
    return readAll().slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  // Seed a few demo bookings (admin preview) — only if empty.
  function seedDemo() {
    if (readAll().length) return;
    var drafts = [
      { packageId: 'family', whatsapp: '+919876543210', devotees: ['Ramesh Kumar', 'Sita Kumar', 'Aarav Kumar'], gotra: 'Bharadwaj', addonIds: ['prasad-box', 'gau-seva'], dakshina: 501, address: '12 MG Road, Bengaluru, Karnataka 560001' },
      { packageId: 'individual', whatsapp: '+919812345678', devotees: ['Priya Sharma'], gotra: 'Kashyap', gotraUnknown: true, addonIds: ['doodh-bilva'], dakshina: 251 },
      { packageId: 'couple', whatsapp: '+919900112233', devotees: ['Arjun Rao', 'Meera Rao'], gotra: 'Vashistha', addonIds: ['prasad-box'], dakshina: 101, address: '4 Temple St, Kolar, Karnataka 563101' }
    ];
    drafts.forEach(function (d, i) {
      var rec = createBooking(d, { id: 'pay_demo_' + i, method: 'simulated' });
      if (i === 0) updateBooking(rec.id, { status: 'Sankalp Sent' });
    });
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
    createBooking: createBooking,
    getBooking: getBooking,
    updateBooking: updateBooking,
    listBookings: listBookings,
    seedDemo: seedDemo,
    formatINR: function (n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  };
})(window);
