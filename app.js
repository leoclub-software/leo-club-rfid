
'use strict';

// ═══════════════════════════════════════════
//  FIREBASE CONFIG — YOUR PROJECT
// ═══════════════════════════════════════════
const FB_CFG = {
  apiKey: "AIzaSyCnC6lzdAmC3bYqdBSbBTvN4UArKAqzqc8",
  authDomain: "leo-club-afbb0.firebaseapp.com",
  databaseURL: "https://leo-club-afbb0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "leo-club-afbb0",
  storageBucket: "leo-club-afbb0.firebasestorage.app",
  messagingSenderId: "126494349998",
  appId: "1:126494349998:web:9d9eeaa53de19936252b3f"
};

// ═══════════════════════════════════════════
//  LOCAL STORAGE KEYS (backup)
// ═══════════════════════════════════════════
const LS = {cards:'lc5_cards',txns:'lc5_txns',menu:'lc5_menu',prices:'lc5_prices',amenities:'lc5_am',deleted:'lc5_deleted_cards',theatreSeats:'lc5_theatre_seats',theatreBookings:'lc5_theatre_bk',showSchedule:'lc5_show_schedule',members:'lc5_members',courtBk:'lc5_court_bk',kotDay:'lc5_kot_day',kotSeq:'lc5_kot_seq'};

// ── Daily KOT order counter ──────────────────────────────────────
// Resets to 1 every new calendar day. Stored in localStorage + Firebase.
function getTodayDateKey() { const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0'); }
function getNextKotNo() {
  const today = getTodayDateKey();
  const storedDay = localStorage.getItem(LS.kotDay);
  let seq = parseInt(localStorage.getItem(LS.kotSeq)||'0',10);
  if (storedDay !== today) { seq = 0; } // new day → reset
  seq++;
  localStorage.setItem(LS.kotDay, today);
  localStorage.setItem(LS.kotSeq, String(seq));
  // sync to Firebase if connected
  try { if(db) db.ref('kotCounter/'+today).set(seq); } catch(e){}
  return seq;
}
function lsGet(k){try{return JSON.parse(localStorage.getItem(k))||null;}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

// User management handled via initUsers() and Firebase sync

// ═══════════════════════════════════════════
//  DEFAULT DATA
// ═══════════════════════════════════════════
const DEFAULT_MENU = [
  // Bakery
  {cat:'Bakery',name:'Donuts',price:49},
  {cat:'Bakery',name:'Cupcake',price:69},
  {cat:'Bakery',name:'Muffins',price:69},
  {cat:'Bakery',name:'Pastry',price:99},
  {cat:'Bakery',name:'Brownie',price:99},
  // Sandwich
  {cat:'Sandwich',name:'Veg Sandwich',price:99},
  {cat:'Sandwich',name:'Cheese Sandwich',price:119},
  {cat:'Sandwich',name:'Coleslaw Sandwich',price:119},
  // Snacks
  {cat:'Snacks',name:'Samosa (2 Pcs)',price:80},
  {cat:'Snacks',name:'Chinese Puff',price:60},
  {cat:'Snacks',name:'Masala Puff',price:60},
  // Coffee
  {cat:'Coffee',name:'Cold Coffee',price:149},
  {cat:'Coffee',name:'Ice Coffee',price:149},
  {cat:'Coffee',name:'Americano (Hot)',price:149},
  {cat:'Coffee',name:'Cappuccino',price:149},
  {cat:'Coffee',name:'Espresso Coffee (Hot)',price:149},
  {cat:'Coffee',name:'Red Bull Coffee',price:299},
  {cat:'Coffee',name:'Tonic Water Coffee',price:299},
  // Add-On Beverages
  {cat:'Beverages',name:'Soft Drinks',price:60},
  {cat:'Beverages',name:'Mineral Water',price:20},
  {cat:'Beverages',name:'Red Bull',price:149},
  // Combos
  {cat:'Combo Offers',name:'Sandwich + Cold Coffee',price:229},
  {cat:'Combo Offers',name:'Samosa + Coffee',price:199},
  {cat:'Combo Offers',name:'Brownie + Ice Coffee',price:219},
];

const DEFAULT_AMENITIES = [
  {id:'bowling', name:'Bowling',          icon:'🎳', type:'bowling',  color:'cy',  active:true,  bonusOk:true},
  {id:'gamezone',name:'Game Zone',        icon:'🕹️', type:'gamezone', color:'go',  active:true,  bonusOk:true},
  {id:'food',    name:'Food & Beverages', icon:'🍕', type:'food',     color:'mg',  active:true,  bonusOk:false},
  {id:'theatre', name:'Mini Theatre',     icon:'🎬', type:'theatre',  color:'pu',  active:true,  bonusOk:false},
];

const DEFAULT_PRICES = {early:250,eve:250,wknd:300,token:20,bonus:{500:0,1000:100,2000:300,5000:1000},welcome:0};

// ═══════════════════════════════════════════
//  LIVE DATA (synced from Firebase)
// ═══════════════════════════════════════════
let cards = (lsGet(LS.cards)||[]).map(c=>({ ...c, rfid:(c.rfid&&c.rfid.trim())?c.rfid.trim():'' }));
let txns      = lsGet(LS.txns)      || [];
let menuItems = lsGet(LS.menu)      || DEFAULT_MENU;
let prices    = lsGet(LS.prices)    || DEFAULT_PRICES;
let amenities = lsGet(LS.amenities) || DEFAULT_AMENITIES;
let members    = lsGet(LS.members)   || [];
let courtBk    = lsGet(LS.courtBk)   || [];  // [{id,sport,date,slot,dur,customer,rfid,pay,amt,status}]
let deletedCards = lsGet(LS.deleted) || [];

// ═══════════════════════════════════════════
//  THEATRE — Seat layout & booking state
// ═══════════════════════════════════════════
// Layout: top row (Premium ₹350 = 8 seats), rows A-F (₹300 = 9 seats each)
// Screen at bottom (Row F side)
const THEATRE_ROWS = [
  {id:'TOP', label:'★', seats:8,  price:350, cls:'premium'},
  {id:'A',   label:'A', seats:9,  price:300, cls:'standard'},
  {id:'B',   label:'B', seats:9,  price:300, cls:'standard'},
  {id:'C',   label:'C', seats:9,  price:300, cls:'standard'},
  {id:'D',   label:'D', seats:9,  price:300, cls:'standard'},
  {id:'E',   label:'E', seats:9,  price:300, cls:'standard'},
  {id:'F',   label:'F', seats:9,  price:300, cls:'standard'},
];
// allShowSeats: { showId: { 'TOP-1': 'available'|'booked'|'held'|'blocked' OR {status,heldFor,heldRef,heldAt,bookingId} } }
let allShowSeats = lsGet(LS.theatreSeats) || {};

// Helper: get seats for the currently active show
function getShowSeats(showId) {
  const id = showId || activeShowId;
  if(!id) return {};
  if(!allShowSeats[id]) allShowSeats[id] = {};
  return allShowSeats[id];
}
// Get status string from a seat value (could be string or object)
function seatStatus(val) {
  if(!val) return 'available';
  if(typeof val === 'string') return val;
  return val.status || 'available';
}
// Get display metadata for a seat (for tooltip / click action)
function seatMeta(val) {
  if(!val || typeof val === 'string') return null;
  return val;
}
// For backward-compat alias used throughout
Object.defineProperty(window, 'theatreSeats', {
  get() { return getShowSeats(activeShowId); },
  set(v) { if(activeShowId) allShowSeats[activeShowId] = v; }
});
let theatreBookings = lsGet(LS.theatreBookings) || [];
let theatreSelected = []; // array of seatIds being selected in current booking
let theatrePayMode = 'rfid'; // 'rfid'|'cash'|'upi'
// showSchedule: array of {id, movie, timing, date, active}
let showSchedule = lsGet(LS.showSchedule) || [];
let activeShowId = null; // which show is currently selected for booking

function getActiveShow() {
  return showSchedule.find(s=>s.id===activeShowId) || null;
}

function addShow() {
  const movie  = (document.getElementById('th-new-movie')||{}).value||'';
  const timing = (document.getElementById('th-new-time')||{}).value||'';
  const date   = (document.getElementById('th-new-date')||{}).value||'';
  if(!movie.trim()) { toast('Enter movie name', true); return; }
  const show = {id: Date.now(), movie: movie.trim(), timing, date, createdAt: nowStr()};
  showSchedule.unshift(show);
  lsSet(LS.showSchedule, showSchedule);
  if(db&&syncOk) db.ref('show_schedule').set(showSchedule);
  // Clear inputs
  ['th-new-movie','th-new-time','th-new-date'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  // Auto-select new show if none active
  if(!activeShowId) { activeShowId=show.id; }
  renderShowSchedule();
  toast('Show added — ' + show.movie + (show.timing?' at '+show.timing:''));
}

function selectShow(id) {
  activeShowId = id;
  theatreSelected = []; // clear any pending selection
  initTheatreSeats(id);  // ensure seats initialised for this show
  renderShowSchedule();
  renderTheatreNowShowing();
  renderTheatreMap();    // refresh seat map for the new show
  updateTheatreCounts();
  toast('Show selected — seat map updated');
}

function deleteShow(id) {
  showSchedule = showSchedule.filter(s=>s.id!==id);
  if(activeShowId===id) activeShowId = showSchedule.length ? showSchedule[0].id : null;
  lsSet(LS.showSchedule, showSchedule);
  if(db&&syncOk) db.ref('show_schedule').set(showSchedule);
  renderShowSchedule();
  renderTheatreNowShowing();
  toast('Show removed');
}

function renderShowSchedule() {
  const el = document.getElementById('th-schedule-list');
  if(!el) return;
  if(!showSchedule.length) {
    el.innerHTML = '<div class="empty" style="padding:14px;font-size:0.85rem;">No shows added yet. Add a show above.</div>';
    return;
  }
  el.innerHTML = showSchedule.map(s => {
    const isActive = s.id === activeShowId;
    return `<div onclick="selectShow(${s.id})" style="display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-radius:9px;cursor:pointer;margin-bottom:6px;transition:all 0.15s;
      background:${isActive?'rgba(91,191,255,0.12)':'rgba(255,255,255,0.03)'};
      border:${isActive?'1.5px solid rgba(78,203,138,0.5)':'1px solid rgba(255,255,255,0.08)'};">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.3rem;">${isActive?'▶':'⏸'}</span>
        <div>
          <div style="font-weight:700;font-size:0.92rem;color:${isActive?'#fff':'var(--tx)'};">${s.movie}</div>
          <div style="font-size:0.75rem;color:var(--mu);margin-top:2px;">
            ${s.timing?'⏰ '+s.timing+'&nbsp;&nbsp;':''}${s.date?'📅 '+s.date:''}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        ${isActive?'<span style="font-size:0.65rem;letter-spacing:0.1em;color:var(--mg);background:rgba(91,191,255,0.15);padding:2px 7px;border-radius:20px;font-weight:700;">ACTIVE</span>':''}
        <button onclick="event.stopPropagation();deleteShow(${s.id})" style="background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.3);color:#f87171;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.75rem;">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderTheatreNowShowing() {
  const el = document.getElementById('th-now-showing-bar');
  if(!el) return;
  const show = getActiveShow();
  if(show) {
    el.style.display='block';
    el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-size:1.3rem;">🎬</span>
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.92rem;font-weight:700;color:var(--mg);">${show.movie}</div>
        <div style="font-size:0.78rem;color:var(--go);margin-top:2px;">
          ${show.timing?'⏰ '+show.timing+'&nbsp;&nbsp;':''}
          ${show.date?'📅 '+show.date:''}
        </div>
      </div>
      <span style="margin-left:auto;font-size:0.68rem;color:var(--mu);background:rgba(255,255,255,0.06);padding:3px 9px;border-radius:20px;">TAP SHOW TO CHANGE</span>
    </div>`;
  } else {
    el.style.display='none';
  }
}

function initTheatreSeats(showId) {
  const id = showId || activeShowId;
  if(!id) return;
  if(!allShowSeats[id]) allShowSeats[id] = {};
  let changed = false;
  THEATRE_ROWS.forEach(row => {
    for(let s=1; s<=row.seats; s++) {
      const key = row.id+'-'+s;
      if(!allShowSeats[id][key]) { allShowSeats[id][key]='available'; changed=true; }
    }
  });
  if(changed) { lsSet(LS.theatreSeats, allShowSeats); }
}

// ═══════════════════════════════════════════
//  AUTH — Users synced via Firebase, passwords hashed
// ═══════════════════════════════════════════

// Simple hash — not cryptographic but safe enough for internal staff system
// Passwords are never stored in plain text in Firebase
function hashPwd(pwd) {
  let h = 0x12345678;
  for (let i = 0; i < pwd.length; i++) {
    h = Math.imul(31, h) + pwd.charCodeAt(i) | 0;
    h ^= (h >>> 16);
  }
  return 'h' + (h >>> 0).toString(36) + pwd.length.toString(36) + 'x' + (pwd.charCodeAt(0)||0).toString(36);
}

// Local users cache
let users = [];

function initUsers() {
  // Load from localStorage as immediate fallback
  try { users = JSON.parse(localStorage.getItem('lc5_users'))||[]; } catch(e) { users=[]; }
  // Ensure admin exists locally
  if (!users.find(u=>u.username==='admin')) {
    users.push({id:'admin',name:'Admin (Owner)',username:'admin',pwdHash:hashPwd('leo@2024'),role:'admin'});
    localStorage.setItem('lc5_users', JSON.stringify(users));
  }
}

function syncUsersFromFirebase() {
  if (!db) return;
  db.ref('users').on('value', snap => {
    if (snap.val()) {
      const fbUsers = Object.values(snap.val());
      // Merge: keep local admin, update rest from Firebase
      const admin = users.find(u=>u.username==='admin');
      users = fbUsers;
      // If admin not in Firebase yet, push it
      if (!users.find(u=>u.username==='admin') && admin) {
        users.unshift(admin);
        db.ref('users/admin').set(admin);
      }
      localStorage.setItem('lc5_users', JSON.stringify(users));
      if (document.getElementById('scr-users').classList.contains('active')) renderUsersList();
    } else if (users.length > 0) {
      // Push local users to Firebase (first time)
      const obj = {};
      users.forEach(u => { obj[u.username] = u; });
      db.ref('users').set(obj);
    }
  });
}

function pushUserToFirebase(user) {
  if (!db || !syncOk) return;
  db.ref('users/' + user.username).set(user);
}

function deleteUserFromFirebase(username) {
  if (!db || !syncOk) return;
  db.ref('users/' + username).remove();
}

let me = null;

const ROLES = {
  admin:  {label:'Admin',  tabs:['reception','counter','lookup','clients','members','courts','reports','admin','hotel','amenities','bonus','users','settings'], canDel:true,  canExp:true,  canEditMembers:true},
  staff:  {label:'Staff',  tabs:['reception','counter','lookup','clients','members','courts','reports'], canDel:false, canExp:false, canEditMembers:true},
  lookup: {label:'Lookup', tabs:['lookup','clients','members','admin'],      canDel:false, canExp:false, canEditMembers:true},
  hotel:  {label:'Hotel',  tabs:['reception','hotel'],                      canDel:false, canExp:false, canEditMembers:false},
};

function doLogin() {
  const uname = document.getElementById('l-user').value.trim().toLowerCase();
  const pwd   = document.getElementById('l-pass').value;
  const errEl = document.getElementById('l-err');
  // Try hash match first, then plain text (for legacy/migration)
  const user = users.find(u =>
    u.username.toLowerCase() === uname &&
    (u.pwdHash === hashPwd(pwd) || u.password === pwd)
  );
  if (!user) { errEl.textContent = 'Incorrect username or password.'; return; }
  // Migrate plain password to hash if needed
  if (user.password && !user.pwdHash) {
    user.pwdHash = hashPwd(user.password);
    delete user.password;
    pushUserToFirebase(user);
  }
  errEl.textContent = '';
  me = user;
  document.getElementById('login-bg').style.display = 'none';
  applyRole();
  toast('Welcome, ' + user.name + '!');
}

function doLogout() {
  me = null;
  document.getElementById('login-bg').style.display = 'flex';
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
  document.getElementById('l-err').textContent = '';
}

function applyRole() {
  const cfg = ROLES[me.role] || ROLES.staff;
  ['reception','counter','lookup','clients','members','courts','reports','admin','hotel','amenities','bonus','users','settings'].forEach(id => {
    const el = document.getElementById('tab-'+id);
    if (el) el.style.display = cfg.tabs.includes(id) ? '' : 'none';
  });
  const be=document.getElementById('btn-exp'); const br=document.getElementById('btn-rst');
  if(be) be.style.display = cfg.canExp ? '' : 'none';
  if(br) br.style.display = cfg.canDel ? '' : 'none';
  const badge = document.getElementById('u-badge');
  badge.textContent = cfg.label;
  badge.className = 'badge ' + (me.role==='admin'?'bg-adm':me.role==='lookup'?'bg-lkp':me.role==='hotel'?'bg-htl':'bg-stf');
  document.getElementById('u-name').textContent = me.name;
  const isHotel = me.role === 'hotel';
  const topupCol     = document.getElementById('reception-topup-col');
  const topupInner   = document.getElementById('reception-topup-inner');
  const rechargeSection = document.getElementById('issue-recharge-section');
  const gzWrap       = document.getElementById('gz-card-select-wrap');
  const mobileWrap   = document.getElementById('issue-mobile-wrap');
  if (topupCol)        topupCol.style.display = '';
  if (topupInner)      topupInner.style.display      = isHotel ? 'none' : '';
  if (rechargeSection) rechargeSection.style.display  = isHotel ? 'none' : '';
  if (gzWrap)          gzWrap.style.display           = isHotel ? 'none' : '';
  if (mobileWrap)      mobileWrap.style.display       = isHotel ? 'none' : '';
  if (isHotel) { if (!isResortGuest) toggleResortGuest(); }
  const firstTab = cfg.tabs[0];
  const firstEl = document.getElementById('tab-'+firstTab);
  if (firstEl) firstEl.click();
}

// ═══════════════════════════════════════════
//  FIREBASE
// ═══════════════════════════════════════════
let db = null;
let syncOk = false;

function fbKey(s) { return s.replace(/[.#$[\]/]/g, '_'); }

function setSyncUI(state) {
  const dot = document.getElementById('sdot');
  const lbl = document.getElementById('slbl');
  if (!dot) return;
  syncOk = (state === 'live');
  dot.className = 'sdot ' + (state === 'live' ? 'live' : state === 'conn' ? 'conn' : '');
  lbl.textContent = state === 'live' ? 'LIVE SYNC' : state === 'conn' ? 'SYNCING…' : 'OFFLINE';
}

function initFirebase() {
  try {
    firebase.initializeApp(FB_CFG);
    db = firebase.database();
    setSyncUI('conn');

    const startListeners = () => {
    db.ref('.info/connected').on('value', snap => {
      console.log('[LEO] .info/connected =', snap.val());
      setSyncUI(snap.val() ? 'live' : 'conn');
      if (snap.val()) syncUsersFromFirebase();
    });

    // MENU V2 listener (full sync with waiter & QR menu)
    loadMenuV2FromFirebase();

    // CARDS listener
    db.ref('cards').on('value', snap => {
      const d = snap.val();
      cards = d ? Object.entries(d).map(([k,v]) => { const rfid = (v.rfid && v.rfid.trim()) ? v.rfid.trim() : k; return { ...v, rfid }; }) : [];
      lsSet(LS.cards, cards);
      refreshCardsTable();
      refreshGZDropdown();
      if (document.getElementById('scr-admin').classList.contains('active')) refreshAdmin();
      if (document.getElementById('scr-clients').classList.contains('active')) renderClientsList();
    });

    // TRANSACTIONS listener
    db.ref('txns').on('value', snap => {
      const d = snap.val();
      txns = d ? Object.values(d).sort((a,b) => b.id - a.id) : [];
      lsSet(LS.txns, txns);
      if (document.getElementById('scr-admin').classList.contains('active')) refreshAdmin();
      refreshCounterTxns();
    });

    // PRICES listener
    db.ref('show_schedule').on('value', snap => {
      if(snap.val()) {
        showSchedule = Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val());
        lsSet(LS.showSchedule, showSchedule);
        renderShowSchedule(); renderTheatreNowShowing();
      }
    });
    db.ref('theatre_seats').on('value', snap => {
      if(snap.val() && typeof snap.val()==='object') {
        allShowSeats = snap.val();
        lsSet(LS.theatreSeats, allShowSeats);
        renderTheatreMap();
      }
    });
    db.ref('court_bk').on('value', snap => {
      if(snap.val()) {
        const raw = snap.val();
        courtBk = Array.isArray(raw) ? raw : Object.values(raw);
        lsSet(LS.courtBk, courtBk);
        renderCourtSlots(); renderCourtTodayBk(); renderReceptionBookings(); renderTodaysSales();
      }
    });
    db.ref('members').on('value', snap => {
      if(snap.val()) {
        const raw = snap.val();
        members = Array.isArray(raw) ? raw : Object.values(raw);
        lsSet(LS.members, members);
        renderMembersList(); checkMemberExpiry();
      }
    });
    db.ref('prices').on('value', snap => {
      if (snap.val()) { prices = snap.val(); lsSet(LS.prices, prices); updateWelcomeNotice(); renderGZPackages(); }
    });

    // AMENITIES listener
    db.ref('amenities').on('value', snap => {
      if (snap.val()) {
        amenities = Object.values(snap.val());
        lsSet(LS.amenities, amenities);
        buildCounterTabs();
        if (document.getElementById('scr-amenities').classList.contains('active')) renderAmGrid();
      }
    });

    // MENU listener
    db.ref('menu').on('value', snap => {
      if (snap.val()) {
        menuItems = Object.values(snap.val());
        lsSet(LS.menu, menuItems);
        renderFoodMenu();
        if (document.getElementById('scr-settings').classList.contains('active')) renderMenuEditor();
      }
    });

    // Push initial local data if Firebase is empty
    db.ref('cards').once('value', snap => {
      if (!snap.val() && cards.length > 0) pushCards();
    });

    }; // end startListeners

    // Rules are open (read/write: true) — connect directly without auth
    // Anonymous auth causes delays/CONNECTING stuck issue on Netlify
    startListeners();

  } catch(e) {
    setSyncUI('off');
    console.error('Firebase init error:', e);
  }
}

function pushCards() {
  if (!db) return;
  const obj = {};
  cards.forEach(c => { obj[fbKey(c.rfid)] = c; });
  db.ref('cards').set(obj);
}

function pushTxn(t) {
  if (!db || !syncOk) return;
  db.ref('txns/' + t.id).set(t);
}

function pushPrices() {
  if (!db || !syncOk) return;
  db.ref('prices').set(prices);
}

function pushAmenities() {
  if (!db || !syncOk) return;
  const obj = {};
  amenities.forEach((a,i) => { obj['a'+i] = a; });
  db.ref('amenities').set(obj);
}

function pushMenu() {
  if (!db || !syncOk) return;
  const obj = {};
  menuItems.forEach((m,i) => { obj['m'+i] = m; });
  db.ref('menu').set(obj);
}

// ═══════════════════════════════════════════
//  PERSIST — always local + Firebase when live
// ═══════════════════════════════════════════
function persist(what) {
  what = what || 'all';
  if (what === 'all' || what === 'cards')     { lsSet(LS.cards, cards);     if (db) pushCards(); }
  if (what === 'all' || what === 'prices')    { lsSet(LS.prices, prices);   if (syncOk) pushPrices(); }
  if (what === 'all' || what === 'amenities') { lsSet(LS.amenities, amenities); if (syncOk) pushAmenities(); }
  if (what === 'all' || what === 'menu')      { lsSet(LS.menu, menuItems);  if (syncOk) pushMenu(); }
}

function saveTxn(t) {
  lsSet(LS.txns, txns);
  pushTxn(t);
}

// ═══════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════
function tick() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}
setInterval(tick, 1000); tick();
function autoTier() {
  const d = new Date(), dy = d.getDay(), h = d.getHours();
  if (dy===0||dy===6) return 'wknd';
  return h < 17 ? 'early' : 'eve';
}

// ═══════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════
function goTo(id, el) {
  if (me) {
    const cfg = ROLES[me.role] || ROLES.staff;
    if (!cfg.tabs.includes(id)) { toast('Access denied', true); return; }
  }
  // Reset issue tap when leaving reception — prevents RFID being routed to register flow
  if (id !== 'reception') { issueTapActive = false; if (activeZone === 'issue') activeZone = 'tu'; }
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  document.getElementById('scr-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'reports')   { setReportDefaultDate(); renderReport(); }
  if (id === 'admin')     refreshAdmin();
  if (id === 'members')   { renderMembersList(); checkMemberExpiry(); }
  if (id === 'courts')    { renderCourtPage(); }
  if (id === 'reception') { renderReceptionBookings(); renderTodaysSales(); }
  if (id === 'settings')  refreshSettings();
  if (id === 'amenities') renderAmGrid();
  if (id === 'bonus')     refreshBonusPanel();
  if (id === 'users')     renderUsersList();
  if (id === 'clients')   renderClientsList();
  if (id === 'hotel')     renderHotelDash();
}

// ═══════════════════════════════════════════
//  TOAST / MODAL
// ═══════════════════════════════════════════
function toast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + (err ? 'err' : 'ok');
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
}
function openM(title, body, acts, wide=false) {
  document.getElementById('mtitle').textContent = title;
  document.getElementById('mbody').innerHTML = body;
  document.getElementById('mbox').className = 'mbox' + (wide ? ' wide' : '');
  const ac = document.getElementById('macts'); ac.innerHTML = '';
  acts.forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + a.cls; b.textContent = a.label; b.onclick = a.fn;
    ac.appendChild(b);
  });
  document.getElementById('mbg').classList.add('open');
}
function closeM() { document.getElementById('mbg').classList.remove('open'); }

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function nowStr() {
  return new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
}
function fmt(n) { return '₹' + (n||0).toLocaleString('en-IN'); }

function bonusForAmt(amt) {
  const b = prices.bonus || {500:0,1000:100,2000:300,5000:1000};
  if (amt >= 5000) return b[5000]||0;
  if (amt >= 2000) return b[2000]||0;
  if (amt >= 1000) return b[1000]||0;
  if (amt >= 500)  return b[500]||0;
  return 0;
}
function welcomeBonus() { return prices.welcome || 0; }

function splitPay(card, total, bonusOk) {
  if (!bonusOk) return {fromBonus:0, fromCash:total};
  const fromBonus = Math.min(card.bonusBalance||0, total);
  return {fromBonus, fromCash: total - fromBonus};
}

function walletHTML(card) {
  return `<div class="wc">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div><div class="wc-name">${card.name}</div><div class="wc-meta">${card.rfid} · ${card.mobile||'—'}</div></div>
      <span class="badge bg-gr">ACTIVE</span>
    </div>
    <div class="wc-bals">
      <div class="bal cash"><div class="bal-lbl">Cash Balance</div><div class="bal-val">${fmt(card.cashBalance)}</div><div class="bal-sub">Usable everywhere</div></div>
      <div class="bal bonus"><div class="bal-lbl">★ Bonus Balance</div><div class="bal-val">${fmt(card.bonusBalance)}</div><div class="bal-sub">Bowling &amp; Game Zone only</div></div>
    </div>
  </div>`;
}

function addTxnRecord(card, counter, desc, cashAmt, bonusAmt, type) {
  const t = {
    id: Date.now(), time: nowStr(), customer: card.name, rfid: card.rfid,
    counter, desc, cashAmt:cashAmt||0, bonusAmt:bonusAmt||0, type,
    cashBalAfter: card.cashBalance, bonusBalAfter: card.bonusBalance
  };
  txns.unshift(t);
  saveTxn(t);
  // Live-refresh home dashboard if visible
  if (document.getElementById('scr-reception') && document.getElementById('scr-reception').classList.contains('active')) {
    renderTodaysSales();
  }
}

function findCard(q) {
  if (!q) return null;
  const qu = q.trim().toUpperCase();
  return cards.find(c =>
    (c.rfid && c.rfid.trim().toUpperCase() === qu) ||
    (c.cardLabel && c.cardLabel.trim().toUpperCase() === qu) ||
    c.mobile === q ||
    c.mobile === q.replace(/\D/g,'') ||
    (c.name && c.name.toLowerCase().includes(q.toLowerCase()))
  );
}

function badgeCls(counter) {
  if (counter==='Bowling') return 'bg-cy';
  if (counter==='Game Zone') return 'bg-go';
  if (counter==='Food' || counter==='Food & Beverages') return 'bg-mg';
  if (counter==='Reception') return 'bg-cy';
  return 'bg-pu';
}

// ═══════════════════════════════════════════
//  RFID READER LISTENER
// ═══════════════════════════════════════════
let rfidBuf = '', rfidTimer = null;
let activeZone = 'tu'; // default zone
let issueTapActive = false;

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    if (rfidBuf.length >= 4) {
      handleRfidScan(rfidBuf.trim());
    }
    rfidBuf = '';
    clearTimeout(rfidTimer);
    return;
  }
  if (e.key.length === 1) {
    rfidBuf += e.key;
    clearTimeout(rfidTimer);
    rfidTimer = setTimeout(() => { rfidBuf = ''; }, 200);
  }
});

function handleRfidScan(id) {
  // Replace card modal tap
  if (window._repTapActive && document.getElementById('rep-new-rfid')) {
    setRepCard(id); window._repTapActive = false; return;
  }
  // Issue registration tap
  if (issueTapActive || document.activeElement.id === 'r-rfid') {
    setIssueTapResult(id); return;
  }
  // Known single-field inputs
  const fieldMap = {'tu-q':'tu','lk-q':'lk','mb-q':'mb','co-q':'co'};
  const fid = document.activeElement.id;
  if (fieldMap[fid]) {
    document.getElementById(fid).value = id;
    if (fid==='tu-q') lookupCard('tu');
    if (fid==='lk-q') doLookup();
    if (fid==='mb-q') lookupCard('mb');
    if (fid==='co-q') coSearch();
    return;
  }
  // If activeZone is co, route tap to checkout
  if (activeZone === 'co') {
    document.getElementById('co-q').value = id;
    coSearch();
    return;
  }
  // Counter zones
  const card = findCard(id);
  if (!card) { toast('Card ' + id + ' not registered. Register at Reception first.', true); return; }
  applyCardToZone(activeZone, card);
}

// ═══════════════════════════════════════════
//  ISSUE TAP
// ═══════════════════════════════════════════
function activateIssueTap() {
  issueTapActive = true;
  activeZone = 'issue';
  setTapState('issue-tap', 'wait', 'WAITING FOR CARD TAP…', 'Now tap the RFID card on the reader');
  document.getElementById('r-rfid').focus();
  toast('Ready — tap the card on the reader now');
}

function onRfidType() {
  const val = document.getElementById('r-rfid').value.trim();
  if (val.length > 2) setIssueTapResult(val);
}

function setIssueTapResult(id) {
  issueTapActive = false;
  if (cards.find(c => c.rfid===id)) {
    setTapState('issue-tap', 'err', '⚠ CARD ALREADY REGISTERED', id + ' belongs to another customer. Use a different card.');
    document.getElementById('r-rfid').value = '';
    toast('This card is already registered!', true); return;
  }
  setTapState('issue-tap', 'ok', '✓ CARD DETECTED', 'Card ID: ' + id + ' — ready to register');
  document.getElementById('r-rfid').value = id;
  toast('Card detected: ' + id);
}

function resetIssueTap() {
  issueTapActive = false;
  setTapState('issue-tap', '', 'TAP NEW CARD HERE', 'Click here, then tap the RFID card on the reader');
  document.getElementById('r-rfid').value = '';
}

function setTapState(tapId, state, lbl, sub) {
  const el = document.getElementById(tapId); if (!el) return;
  el.className = 'tap' + (state ? ' '+state : '');
  const ll = document.getElementById(tapId+'-lbl') || el.querySelector('.tap-lbl');
  const sl = document.getElementById(tapId+'-sub') || el.querySelector('.tap-sub');
  if (ll) ll.textContent = lbl; if (sl) sl.textContent = sub;
}

// ═══════════════════════════════════════════
//  CARD LOOKUP (for tap zones)
// ═══════════════════════════════════════════
let zoneCards = {tu:null, lk:null, mb:null, bowl:null, gz:null, food:null, th:null, ct:null};

function activateTap(zone) {
  activeZone = zone;
  toast('Ready — tap card on the reader');
}

function applyCardToZone(zone, card) {
  zoneCards[zone] = card;
  const wcEl = document.getElementById(zone+'-wc');
  const tapEl = document.getElementById(zone+'-tap');
  if (wcEl) { wcEl.style.display='block'; wcEl.innerHTML=walletHTML(card); }
  if (tapEl) tapEl.className = 'tap ok';
  if (zone==='bowl') calcBowl();
  if (zone==='gz') calcTokens();
  if (zone==='th') setTimeout(renderTheatreMap, 0);
  if (zone==='ct') { const wc=document.getElementById('ct-wc'); if(wc){wc.style.display='block';wc.innerHTML=walletHTML(card);} }
  toast('Card detected: ' + card.name);
}

function lookupCard(zone) {
  const q = (document.getElementById(zone+'-q')||{}).value || '';
  const card = findCard(q.trim());
  if (!card) { toast('Card not found — try RFID or mobile number', true); return; }
  applyCardToZone(zone, card);
}

// ═══════════════════════════════════════════
//  ISSUE CARD
// ═══════════════════════════════════════════
function onCardSelectChange() {
  const sel = document.getElementById('r-card-select');
  const val = sel.value;
  if (!val) return;
  // Check if GZ label is already assigned to a card
  if (cards.find(c => (c.cardLabel||'').toUpperCase() === val.toUpperCase())) {
    toast(val+' label already in use — pick another', true);
    sel.value = '';
    return;
  }
  // GZ number is a LABEL only — do NOT write it to r-rfid.
  // Staff still needs to physically tap the RFID chip to fill r-rfid.
  toast('GZ label '+val+' selected — now tap the physical RFID card on the reader');
}
let iBonus = 0, iAmt = 0;
function selRC(el, prefix, amt, bonus) {
  document.querySelectorAll('#'+(prefix==='i'?'issue':'tu')+'-rc .rc').forEach(r => r.classList.remove('sel'));
  el.classList.add('sel');
  if (prefix === 'i') { iBonus = bonus; iAmt = amt; document.getElementById('r-amt').value = amt; }
  else               { tuBonus = bonus; document.getElementById('tu-amt').value = amt; }
  const biId = prefix==='i' ? 'i-bi' : 'tu-bi';
  const bi = document.getElementById(biId);
  if (bi) {
    if (bonus > 0) { bi.style.display='block'; bi.textContent='★ +'+fmt(bonus)+' added to bonus wallet (bowling & game zone only)'; }
    else bi.style.display='none';
  }
}

let isResortGuest = false;
function toggleResortGuest() {
  // Hotel role: toggle is always locked ON
  if (me && me.role === 'hotel' && isResortGuest) return;
  isResortGuest = !isResortGuest;
  document.getElementById('rg-dot').style.background = isResortGuest ? 'var(--go)' : 'rgba(255,255,255,0.15)';
  document.getElementById('rg-knob').style.left = isResortGuest ? '20px' : '2px';
  document.getElementById('room-number-wrap').style.display = isResortGuest ? 'block' : 'none';
  // Hide/show recharge packs
  document.getElementById('issue-rc').style.display = isResortGuest ? 'none' : '';
  document.querySelector('label[for-rc-section]') && (document.querySelector('label[for-rc-section]').style.display = isResortGuest ? 'none' : '');
  // Update button label
  document.getElementById('issue-btn').textContent = isResortGuest ? '🏨 Activate Room Guest Card' : 'Activate Card & Issue';
  // Update welcome notice
  const wel = document.getElementById('i-welcome');
  if (isResortGuest) {
    wel.textContent = '🏨 Resort guest: ₹100 bonus auto-loaded. Main balance refundable at checkout.';
    wel.style.color = 'var(--go)';
  } else {
    updateWelcomeNotice();
  }
}

function issueCard() {
  const name   = document.getElementById('r-name').value.trim();
  const isHotel = me && me.role === 'hotel';
  const mobile = document.getElementById('r-mobile').value.trim();
  const rfid   = document.getElementById('r-rfid').value.trim();
  if (!name)   { toast('Enter guest name', true); return; }
  if (!isHotel && (!mobile || mobile.length !== 10)) { toast('Mobile number must be exactly 10 digits', true); return; }
  if (!rfid)   { toast('Tap card or select a card number first', true); return; }
  // If card exists and is a guest card — auto-wipe it for new guest (room keys get reused)
  const existingIdx = cards.findIndex(c => c.rfid===rfid);
  if (existingIdx !== -1) {
    const existing = cards[existingIdx];
    if (existing.isGuest) {
      // Silent reset — remove old guest record, continue with fresh registration
      cards.splice(existingIdx, 1);
      if (db) db.ref('cards/'+fbKey(rfid)).remove();
    } else {
      // Regular card already registered — block as before
      toast('Card already registered to ' + existing.name + '!', true); return;
    }
  }

  // GZ label comes from dropdown (cardLabel), NOT from rfid field
  const cardLabel = (document.getElementById('r-card-select')||{}).value.trim() || '';
  const isGZ = cardLabel && /^GZ\d+$/i.test(cardLabel);

  // Validate: if GZ label selected, make sure it's not already in use by another card
  if (cardLabel && cards.find(c => (c.cardLabel||'').toUpperCase() === cardLabel.toUpperCase() && c.rfid !== rfid)) {
    toast('GZ label ' + cardLabel + ' is already assigned to another card!', true); return;
  }

  let amt, totalBonus, card;
  if (isResortGuest) {
    const room = document.getElementById('r-room').value.trim();
    if (!room) { toast('Enter room number', true); return; }
    amt = 0;
    totalBonus = 100;
    card = {name, mobile, rfid, cashBalance:0, bonusBalance:100, spent:0, joined:nowStr(), status:'active', isGuest:true, room, ...(cardLabel ? {cardLabel, cardType:'guest'} : {})};
    cards.push(card);
    persist('cards');
    addTxnRecord(card, 'Reception', '🏨 Room guest activation — Room ' + room, 0, 100, 'credit');
    toast('🏨 Room guest card activated · Room ' + room + ' · ₹100 bonus loaded');
  } else {
    amt = parseFloat(document.getElementById('r-amt').value)||0;
    const rcBonus = iBonus || bonusForAmt(amt);
    const wb = welcomeBonus();
    totalBonus = rcBonus + wb;
    card = {name, mobile, rfid, cashBalance:amt, bonusBalance:totalBonus, spent:0, joined:nowStr(), status:'active', cardType: isGZ ? 'gz' : 'walkin', ...(cardLabel ? {cardLabel} : {})};
    cards.push(card);
    persist('cards');
    addTxnRecord(card, 'Reception', 'Card activation'+(wb>0?' + welcome bonus':''), amt, totalBonus, 'credit');
    toast('Card issued · ' + fmt(amt) + ' cash' + (totalBonus>0 ? ' · '+fmt(totalBonus)+' bonus' : '') + (cardLabel ? ' · Label: '+cardLabel : ''));
  }

  // Clear all fields
  document.getElementById('r-name').value = '';
  document.getElementById('r-mobile').value = '';
  document.getElementById('r-rfid').value = '';
  document.getElementById('r-amt').value = '';
  document.getElementById('r-room').value = '';
  document.getElementById('r-card-select').value = '';
  document.getElementById('i-bi').style.display = 'none';
  document.getElementById('i-bi').textContent = '';
  document.querySelectorAll('#issue-rc .rc').forEach(r => r.classList.remove('sel'));
  iBonus = 0; iAmt = 0;
  // Reset guest toggle
  if (isResortGuest) { isResortGuest = false; toggleResortGuest(); }
  // For hotel role, always re-engage resort guest mode after issue
  if (me && me.role === 'hotel' && !isResortGuest) toggleResortGuest();
  resetIssueTap();
  refreshCardsTable();
  renderClientsList();
  refreshGZDropdown();
}

function guestCheckout(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  const refund = card.cashBalance;
  openM('🏨 Guest Checkout — Room ' + (card.room||'?'),
    `<div style="font-size:0.9rem;margin-bottom:14px;">
      <b style="color:var(--tx);">${card.name}</b> · Room <b>${card.room||'—'}</b>
     </div>
     <div style="background:rgba(0,255,136,0.07);border:1px solid rgba(0,255,136,0.2);border-radius:9px;padding:12px 14px;margin-bottom:12px;">
       <div style="font-size:0.8rem;color:var(--mu);margin-bottom:4px;">REFUNDABLE (Main Wallet)</div>
       <div style="font-family:'JetBrains Mono',monospace;font-size:1.6rem;color:var(--gr);">${fmt(refund)}</div>
       <div style="font-size:0.78rem;color:var(--mu);margin-top:3px;">Refund this amount in cash to the guest</div>
     </div>
     <div style="background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.18);border-radius:9px;padding:10px 14px;margin-bottom:14px;">
       <div style="font-size:0.8rem;color:var(--mu);margin-bottom:2px;">BONUS BALANCE (non-refundable)</div>
       <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:var(--go);">${fmt(card.bonusBalance)}</div>
       <div style="font-size:0.75rem;color:var(--mu);margin-top:2px;">Bonus credits lapse on checkout</div>
     </div>
     <div class="n-cy" style="font-size:0.8rem;">After confirming, this card will be deactivated and the room key is reset.</div>`,
    [{label: refund>0 ? `✓ Refund ${fmt(refund)} & Checkout` : '✓ Checkout (no refund)', cls:'btn-gn', fn:()=>{
      addTxnRecord(card, 'Reception', '🏨 Guest checkout — Room '+(card.room||'?')+' — Refund '+fmt(refund), 0, 0, 'debit');
      card.cashBalance  = 0;
      card.bonusBalance = 0;
      card.status       = 'checked-out';
      // Remove card from Firebase so same physical card can be reissued to a new guest
      if (db) db.ref('cards/'+fbKey(rfid)).remove();
      // Remove from local array too
      const coIdx = cards.findIndex(c => c.rfid === rfid);
      if (coIdx !== -1) cards.splice(coIdx, 1);
      lsSet(LS.cards, cards);
      closeM();
      toast('🏨 Guest checked out · Refund: ' + fmt(refund));
      renderClientsList(); refreshCardsTable();
      const cliDetail = document.getElementById('cli-detail');
      if(cliDetail && cliDetail.style.display!=='none') cliDetail.style.display='none';
      // Clear hotel checkout search UI
      const hcoSearch = document.getElementById('hco-search');
      const hcoResult = document.getElementById('hco-result');
      if (hcoSearch) hcoSearch.value = '';
      if (hcoResult) hcoResult.innerHTML = '';
    }},{label:'Cancel', cls:'btn-gh', fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  TOP-UP
// ═══════════════════════════════════════════
let tuBonus = 0;
function topupCard() {
  const card = zoneCards.tu;
  if (!card) { toast('Tap or look up a card first', true); return; }
  const amt = parseFloat(document.getElementById('tu-amt').value)||0;
  if (amt <= 0) { toast('Enter amount', true); return; }
  const bonus = tuBonus || bonusForAmt(amt);
  const payMethod = window._tuPayMode || 'cash';
  card.cashBalance  += amt;
  card.bonusBalance += bonus;
  persist('cards');
  // Store payMethod in transaction for accurate Cash/UPI report reconciliation
  const t = {
    id: Date.now(), time: nowStr(), customer: card.name, rfid: card.rfid,
    counter: 'Reception', desc: 'Top-up' + (bonus>0?' + bonus':''),
    cashAmt: amt, bonusAmt: bonus, type: 'credit',
    cashBalAfter: card.cashBalance, bonusBalAfter: card.bonusBalance,
    payMethod: payMethod
  };
  txns.unshift(t);
  saveTxn(t);
  if (document.getElementById('scr-reception')?.classList.contains('active')) renderTodaysSales();
  toast(fmt(amt) + ' added via ' + (payMethod==='upi'?'UPI':'Cash') + (bonus>0 ? ' · '+fmt(bonus)+' bonus' : ''));
  document.getElementById('tu-wc').innerHTML = walletHTML(card);
  // Clear all topup fields
  document.getElementById('tu-amt').value = '';
  document.getElementById('tu-q').value = '';
  document.getElementById('tu-bi').style.display = 'none';
  document.getElementById('tu-bi').textContent = '';
  document.getElementById('tu-tap').className = 'tap';
  document.querySelectorAll('#tu-rc .rc').forEach(r => r.classList.remove('sel'));
  tuBonus = 0;
  zoneCards.tu = null;
  document.getElementById('tu-wc').style.display = 'none';
  refreshCardsTable();
  renderClientsList();
}

let _tuPayMode = 'cash';
window._tuPayMode = 'cash';
function setTuPay(mode) {
  window._tuPayMode = mode;
  const cash = document.getElementById('tu-pay-cash');
  const upi  = document.getElementById('tu-pay-upi');
  if (!cash || !upi) return;
  if (mode === 'cash') {
    cash.style.cssText = 'flex:1;padding:8px;border-radius:8px;border:2px solid var(--cy);background:#f0fdf4;color:var(--cy);font-weight:700;font-size:0.82rem;cursor:pointer;';
    upi.style.cssText  = 'flex:1;padding:8px;border-radius:8px;border:2px solid var(--border);background:#fff;color:var(--mu);font-weight:700;font-size:0.82rem;cursor:pointer;';
  } else {
    upi.style.cssText  = 'flex:1;padding:8px;border-radius:8px;border:2px solid var(--go);background:#fffbeb;color:var(--go);font-weight:700;font-size:0.82rem;cursor:pointer;';
    cash.style.cssText = 'flex:1;padding:8px;border-radius:8px;border:2px solid var(--border);background:#fff;color:var(--mu);font-weight:700;font-size:0.82rem;cursor:pointer;';
  }
}

// ═══════════════════════════════════════════
//  COUNTER — DYNAMIC TABS
// ═══════════════════════════════════════════
let bowlTier = 'early';
let foodBill = [];

function buildCounterTabs() {
  const active = amenities.filter(a => a.active);
  const tabsEl = document.getElementById('c-stabs');
  const scrsEl = document.getElementById('c-sscreens');
  if (!tabsEl || !scrsEl) return;
  tabsEl.innerHTML = ''; scrsEl.innerHTML = '';
  active.forEach((am, i) => {
    // Tab button
    const tab = document.createElement('div');
    tab.className = 'stab' + (i===0 ? ' active' : '');
    tab.textContent = am.icon + ' ' + am.name;
    tab.onclick = () => {
      document.querySelectorAll('#c-stabs .stab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#c-sscreens .ss').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('css-'+am.id).classList.add('active');
      activeZone = am.id;
      if(am.type==='theatre') setTimeout(renderTheatreMap, 0);
    };
    tabsEl.appendChild(tab);
    // Screen content
    const sc = document.createElement('div');
    sc.id = 'css-' + am.id;
    sc.className = 'ss' + (i===0 ? ' active' : '');
    sc.innerHTML = buildCounterHtml(am);
    scrsEl.appendChild(sc);
    if (i===0) activeZone = am.id;
  });
  // Init bowling tier
  bowlTier = autoTier();
  bowlPayMode = 'rfid';
  gzPayMode = 'rfid';
  foodActiveCat = 'ALL';
  const foodSrch = document.getElementById('food-search'); if(foodSrch) foodSrch.value='';
  const btEl = document.getElementById('bt-' + bowlTier);
  if (btEl) { document.querySelectorAll('.to').forEach(t=>t.classList.remove('sel')); btEl.classList.add('sel'); }
  calcBowl();
  renderFoodMenu();
  renderGZPackages();
  // Render theatre map if it's the active tab
  if(active.length>0 && active[0].type==='theatre') setTimeout(renderTheatreMap, 50);
  else {
    const hasTheatre = active.some(a=>a.type==='theatre');
    if(hasTheatre) {} // will render on tab click
  }
}

function buildCounterHtml(am) {
  if (am.type==='bowling')  return buildBowlingHtml(am);
  if (am.type==='gamezone') return buildGZHtml(am);
  if (am.type==='food')     return buildFoodHtml(am);
  if (am.type==='theatre')  return buildTheatreHtml(am);
  return buildGenericHtml(am);
}

function buildBowlingHtml(am) {
  return `<div class="n-go">★ Bonus wallet accepted — bonus used first, then cash.</div>
  <!-- Payment mode selector -->
  <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
    <button class="btn btn-sm" id="bowl-pm-rfid" onclick="setBowlPayMode('rfid')" style="background:rgba(78,203,138,0.15);border:1.5px solid var(--cy);color:var(--cy);">📡 RFID Card</button>
    <button class="btn btn-sm" id="bowl-pm-cash" onclick="setBowlPayMode('cash')" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--mu);">💵 Walk-in Cash</button>
    <button class="btn btn-sm" id="bowl-pm-upi"  onclick="setBowlPayMode('upi')"  style="background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--mu);">📱 Walk-in UPI</button>
  </div>
  <div class="two-col">
    <div>
      <div id="bowl-rfid-zone">
        <div class="tap" id="bowl-tap" onclick="activateTap('bowl')">
          <div class="tap-ic">📡</div><div class="tap-lbl">TAP CUSTOMER CARD</div><div class="tap-sub">both balances will show</div>
        </div>
        <div id="bowl-wc" style="display:none;"></div>
      </div>
      <div id="bowl-walkin-zone" style="display:none;">
        <div class="n-cy" style="margin-bottom:9px;font-size:0.82rem;">Walk-in — collect <span id="bowl-walkin-method-label">Cash</span> at counter</div>
        <label class="f">Guest Name (optional)</label>
        <input type="text" id="bowl-walkin-name" placeholder="e.g. Rahul or Table 3" style="margin-bottom:6px;">
      </div>
      <div class="sl">Rate</div>
      <div class="tier-grid">
        <div class="to early sel" id="bt-early" onclick="selBowlTier(this,'early')">
          <div class="to-pr" id="bp-early">${fmt(prices.early||199)}</div><div class="to-ds">Weekday before 5pm</div>
        </div>
        <div class="to eve" id="bt-eve" onclick="selBowlTier(this,'eve')">
          <div class="to-pr" id="bp-eve">${fmt(prices.eve||250)}</div><div class="to-ds">Weekday after 5pm</div>
        </div>
        <div class="to wknd" id="bt-wknd" onclick="selBowlTier(this,'wknd')">
          <div class="to-pr" id="bp-wknd">${fmt(prices.wknd||300)}</div><div class="to-ds">Weekend / holiday</div>
        </div>
      </div>
      <label class="f">Persons</label><input type="number" id="bowl-p" value="1" min="1" max="20" oninput="calcBowl()">
      <label class="f">Games</label><input type="number" id="bowl-g" value="1" min="1" max="10" oninput="calcBowl()">
      <div class="pb">
        <div class="pb-title">Payment Breakdown</div>
        <div class="pb-row pb-bonus"><span>★ From bonus wallet</span><span id="bd-b">—</span></div>
        <div class="pb-row pb-cash"><span>From cash balance</span><span id="bd-c">—</span></div>
        <div class="pb-row pb-tot"><span>Total charge</span><span id="bd-t">${fmt(prices.early||250)}</span></div>
      </div>
      <!-- Discount & Reference -->
      <div class="disc-ref-box">
        <div style="font-size:0.74rem;font-weight:700;color:var(--mu);margin-bottom:8px;letter-spacing:0.04em;">DISCOUNT & REFERENCE</div>
        <div class="dr-row">
          <span style="font-size:0.74rem;color:var(--mu);">Discount:</span>
          <button class="disc-btn" id="bowl-disc-none" onclick="setBowlDisc('none')" style="background:rgba(255,255,255,0.08);border-color:var(--cy);color:var(--cy);">None</button>
          <button class="disc-btn" id="bowl-disc-pct"  onclick="setBowlDisc('pct')">% Off</button>
          <button class="disc-btn" id="bowl-disc-flat" onclick="setBowlDisc('flat')">Flat ₹</button>
        </div>
        <div class="disc-amt-row" id="bowl-disc-row" style="display:none;">
          <input type="number" id="bowl-disc-val" placeholder="Enter value" min="0" oninput="calcBowl()" style="max-width:140px;">
          <span class="disc-preview" id="bowl-disc-preview"></span>
        </div>
        <label class="f" style="margin-top:4px;">Reference / Reason <span style="color:var(--mu);font-weight:400;font-size:0.7rem;">(required only when discount applied)</span></label>
        <input type="text" id="bowl-ref" placeholder="e.g. Manager approval, Birthday, Staff" style="margin-bottom:0;">
      </div>
      <button class="btn btn-cy btn-fw" id="bowl-charge-btn" onclick="chargeBowling()">Charge via RFID</button>
    </div>
    <div>
      <div class="sl">Recent Bowling Transactions</div>
      <div class="card" style="padding:11px;"><div id="bowl-txns"><div class="empty">No transactions yet</div></div></div>
    </div>
  </div>`;
}

function buildGZHtml(am) {
  return `<div class="n-go">★ Bonus wallet accepted — bonus used first, then cash.</div>
  <!-- Payment mode selector -->
  <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
    <button class="btn btn-sm" id="gz-pm-rfid" onclick="setGZPayMode('rfid')" style="background:rgba(78,203,138,0.15);border:1.5px solid var(--cy);color:var(--cy);">📡 RFID Card</button>
    <button class="btn btn-sm" id="gz-pm-cash" onclick="setGZPayMode('cash')" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--mu);">💵 Walk-in Cash</button>
    <button class="btn btn-sm" id="gz-pm-upi"  onclick="setGZPayMode('upi')"  style="background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--mu);">📱 Walk-in UPI</button>
  </div>
  <div class="two-col">
    <div>
      <div id="gz-rfid-zone">
        <div class="tap" id="gz-tap" onclick="activateTap('gz')">
          <div class="tap-ic">📡</div><div class="tap-lbl">TAP CUSTOMER CARD</div><div class="tap-sub">both balances will show</div>
        </div>
        <div id="gz-wc" style="display:none;"></div>
      </div>
      <div id="gz-walkin-zone" style="display:none;">
        <div class="n-cy" style="margin-bottom:9px;font-size:0.82rem;">Walk-in — collect <span id="gz-walkin-method-label">Cash</span> at counter</div>
        <label class="f">Guest Name (optional)</label>
        <input type="text" id="gz-walkin-name" placeholder="e.g. Priya or Group 5" style="margin-bottom:6px;">
      </div>
      <div class="sl">Token Calculator</div>
      <div class="tc">
        <label class="f" style="text-align:left;">Amount customer wants to spend (₹)</label>
        <input type="number" id="gz-amt" placeholder="e.g. 100" oninput="calcTokens()">
        <div style="font-size:0.6rem;letter-spacing:0.1em;color:var(--mu);text-align:center;">TOKENS TO GIVE</div>
        <div class="tc-res" id="gz-tok">0 Tokens</div>
        <div class="tc-sub">₹${prices.token||20} per token</div>
      </div>
      <div class="pb" id="gz-pb" style="display:none;">
        <div class="pb-title">Payment Breakdown</div>
        <div class="pb-row pb-bonus"><span>★ From bonus wallet</span><span id="gz-bd-b">₹0</span></div>
        <div class="pb-row pb-cash"><span>From cash balance</span><span id="gz-bd-c">₹0</span></div>
        <div class="pb-row pb-tot"><span>Total</span><span id="gz-bd-t">₹0</span></div>
      </div>
      <div class="sl">Quick Packages</div>
      <div class="card" style="padding:11px;" id="gz-quick-packages"></div>
      <!-- Discount & Reference -->
      <div class="disc-ref-box">
        <div style="font-size:0.74rem;font-weight:700;color:var(--mu);margin-bottom:8px;letter-spacing:0.04em;">DISCOUNT & REFERENCE</div>
        <div class="dr-row">
          <span style="font-size:0.74rem;color:var(--mu);">Discount:</span>
          <button class="disc-btn" id="gz-disc-none" onclick="setGZDisc('none')" style="background:rgba(255,255,255,0.08);border-color:var(--cy);color:var(--cy);">None</button>
          <button class="disc-btn" id="gz-disc-pct"  onclick="setGZDisc('pct')">% Off</button>
          <button class="disc-btn" id="gz-disc-flat" onclick="setGZDisc('flat')">Flat ₹</button>
        </div>
        <div class="disc-amt-row" id="gz-disc-row" style="display:none;">
          <input type="number" id="gz-disc-val" placeholder="Enter value" min="0" oninput="calcTokens()" style="max-width:140px;">
          <span class="disc-preview" id="gz-disc-preview"></span>
        </div>
        <label class="f" style="margin-top:4px;">Reference / Reason <span style="color:var(--mu);font-weight:400;font-size:0.7rem;">(required only when discount applied)</span></label>
        <input type="text" id="gz-ref" placeholder="e.g. Manager approval, Birthday, Staff" style="margin-bottom:0;">
      </div>
      <button class="btn btn-go btn-fw" onclick="chargeGZCustom()">Charge Custom Amount</button>
    </div>
    <div>
      <div class="sl">Recent Game Zone Transactions</div>
      <div class="card" style="padding:11px;"><div id="gz-txns"><div class="empty">No transactions yet</div></div></div>
    </div>
  </div>`;
}

function buildFoodHtml(am) {
  // Show today's order count badge (updates after DOM render)
  setTimeout(()=>{
    const today=getTodayDateKey();
    const storedDay=localStorage.getItem(LS.kotDay);
    const seq=(storedDay===today)?parseInt(localStorage.getItem(LS.kotSeq)||'0',10):0;
    const el=document.getElementById('kot-today-count'); if(el) el.textContent=String(seq);
  },80);
  return `
  <!-- KOT Order System -->
  <style>
    /* ── BIG ICON MENU GRID ── */
    .kot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:10px;}
    .kot-item{background:#fff;border:2px solid var(--border);border-radius:14px;padding:12px 8px 10px;text-align:center;cursor:pointer;transition:all 0.15s;user-select:none;position:relative;}
    .kot-item:hover{border-color:var(--mg);background:#eff6ff;transform:translateY(-2px);box-shadow:0 4px 12px rgba(37,99,235,0.15);}
    .kot-item:active{transform:scale(0.97);}
    .kot-item-icon{font-size:2.4rem;display:block;margin-bottom:5px;line-height:1;}
    .kot-item-name{font-size:0.8rem;font-weight:700;color:var(--tx);line-height:1.25;margin-bottom:5px;}
    .kot-item-price{font-family:'JetBrains Mono',monospace;font-size:1rem;color:var(--mg);font-weight:800;display:block;}
    .kot-item-in-cart{position:absolute;top:5px;right:5px;background:var(--mg);color:#fff;border-radius:50%;width:20px;height:20px;font-size:0.65rem;font-weight:900;display:flex;align-items:center;justify-content:center;}
    .kot-cat-btn{padding:7px 16px;border:2px solid var(--border);border-radius:24px;font-size:0.8rem;font-weight:700;cursor:pointer;background:#fff;color:var(--mu);transition:all 0.15s;white-space:nowrap;}
    .kot-cat-btn.active{border-color:var(--mg);background:var(--mg);color:#fff;}
    .kot-bill-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.9rem;}
    .kot-qty-btn{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--border);background:#f8fafc;cursor:pointer;font-size:1.05rem;font-weight:900;color:var(--tx);display:flex;align-items:center;justify-content:center;transition:all 0.12s;flex-shrink:0;}
    .kot-qty-btn:hover{background:var(--mg);color:#fff;border-color:var(--mg);}
    .kot-table-row{display:flex;gap:8px;align-items:center;margin-bottom:10px;}
    .kot-pm-btn{padding:9px 16px;border-radius:9px;border:1.5px solid var(--border);background:#fff;color:var(--mu);font-size:0.82rem;font-weight:700;cursor:pointer;transition:all 0.15s;}
    .kot-pm-btn.active{border-color:var(--mg);background:#eff6ff;color:var(--mg);}
    .kot-order-badge{background:var(--mg);color:#fff;font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:800;padding:4px 12px;border-radius:8px;letter-spacing:0.04em;}
    @media print{
      body *{visibility:hidden;}
      #kot-print-area,#kot-print-area *{visibility:visible;}
      #kot-print-area{position:fixed;top:0;left:0;width:80mm;font-family:monospace;font-size:12px;padding:8px;}
    }
  </style>
  <div id="kot-print-area" style="display:none;"></div>

  <!-- Payment mode + Today's order counter -->
  <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:0.75rem;font-weight:700;color:var(--mu);white-space:nowrap;">Pay via:</span>
      <button class="kot-pm-btn active" id="food-pm-rfid" onclick="setFoodPayMode('rfid')">📡 RFID Wallet</button>
      <button class="kot-pm-btn" id="food-pm-cash" onclick="setFoodPayMode('cash')">💵 Cash</button>
      <button class="kot-pm-btn" id="food-pm-upi"  onclick="setFoodPayMode('upi')">📱 UPI</button>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:0.7rem;color:var(--mu);font-weight:600;">Today's Orders:</span>
      <span class="kot-order-badge" id="kot-today-count">0</span>
    </div>
  </div>

  <!-- RFID Tap / Walk-in -->
  <div id="food-rfid-zone">
    <div class="tap" id="food-tap" onclick="activateTap('food')" style="padding:14px;margin-bottom:10px;">
      <div class="tap-ic" style="font-size:1.7rem;">📡</div>
      <div class="tap-lbl">TAP CUSTOMER CARD</div>
      <div class="tap-sub">or use Cash / UPI above</div>
    </div>
    <div id="food-wc" style="display:none;margin-bottom:10px;"></div>
  </div>
  <div id="food-walkin-zone" style="display:none;">
    <div class="n-cy" style="margin-bottom:9px;font-size:0.82rem;">💵 Walk-in — bill total collected as <span id="food-walkin-method-label">Cash</span></div>
  </div>

  <!-- Table number -->
  <div class="kot-table-row">
    <label style="font-size:0.78rem;font-weight:700;color:var(--mu);white-space:nowrap;">Table / Token:</label>
    <input type="text" id="kot-table-no" placeholder="e.g. T3 or Counter" style="margin-bottom:0;flex:1;padding:8px 11px;font-size:0.9rem;">
    <label style="font-size:0.78rem;font-weight:700;color:var(--mu);white-space:nowrap;">Guest Name:</label>
    <input type="text" id="kot-guest-name" placeholder="Optional" style="margin-bottom:0;flex:1;padding:8px 11px;font-size:0.9rem;">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <!-- LEFT: Big icon menu -->
    <div>
      <div class="sl" style="margin-bottom:8px;">Menu — tap to add</div>
      <!-- Category filter pills -->
      <div id="kot-cat-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;overflow-x:auto;padding-bottom:2px;"></div>
      <!-- Search -->
      <div style="position:relative;margin-bottom:10px;">
        <input type="text" id="food-search" placeholder="🔍 Search item..." oninput="renderFoodMenu()" style="padding:9px 34px 9px 12px;font-size:0.9rem;margin-bottom:0;border-radius:10px;">
        <button onclick="document.getElementById('food-search').value='';renderFoodMenu()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:0.95rem;color:var(--mu);cursor:pointer;padding:0;">✕</button>
      </div>
      <!-- Big item grid -->
      <div id="food-menu" style="max-height:430px;overflow-y:auto;padding-right:2px;"></div>
    </div>

    <!-- RIGHT: Current Order + KOT -->
    <div>
      <div class="sl" style="margin-bottom:8px;">Order Slip</div>
      <div class="card" style="padding:11px;min-height:140px;">
        <div id="food-bill-items"><div class="empty" style="font-size:0.82rem;">Tap items to add</div></div>
        <div id="food-bill-foot" style="display:none;">
          <div class="bill-tot" style="margin-bottom:8px;"><span>Total</span><span id="food-bill-tot">₹0</span></div>
          <!-- Discount -->
          <div style="margin-bottom:8px;">
            <div style="font-size:0.72rem;font-weight:700;color:var(--mu);margin-bottom:5px;">DISCOUNT</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
              <button class="disc-btn" id="food-disc-none" onclick="setFoodDisc('none')" style="border-color:var(--cy);color:var(--cy);">None</button>
              <button class="disc-btn" id="food-disc-pct"  onclick="setFoodDisc('pct')">% Off</button>
              <button class="disc-btn" id="food-disc-flat" onclick="setFoodDisc('flat')">Flat ₹</button>
            </div>
            <div id="food-disc-row" style="display:none;margin-top:5px;display:flex;gap:6px;align-items:center;">
              <input type="number" id="food-disc-val" placeholder="Value" min="0" oninput="renderBill()" style="max-width:110px;margin-bottom:0;padding:7px 9px;font-size:0.9rem;">
              <span id="food-disc-preview" style="font-size:0.82rem;color:var(--rd);font-weight:700;"></span>
            </div>
          </div>
          <!-- Ref -->
          <label class="f" style="font-size:0.72rem;">Ref / Note</label>
          <input type="text" id="food-ref" placeholder="Manager approval, staff, complaint..." style="margin-bottom:10px;padding:7px 9px;font-size:0.84rem;">
          <!-- Action buttons -->
          <div style="display:flex;gap:6px;">
            <button class="btn btn-rd btn-sm" onclick="clearBill()" style="flex:0 0 auto;">Clear</button>
            <button class="btn btn-gn btn-sm" onclick="printKOT()" style="flex:1;">🖨 Print Bill</button>
            <button class="btn btn-mg" style="flex:1;" id="food-charge-btn" onclick="chargeFoodBill()">Charge</button>
          </div>
        </div>
      </div>
      <div class="sl" style="margin-top:8px;margin-bottom:6px;">Recent Orders</div>
      <div class="card" style="padding:11px;"><div id="food-txns"><div class="empty">No orders yet</div></div></div>
    </div>
  </div>`;
}

/* ─── KOT PRINT ─── */
function printKOT() {
  if (!foodBill.length) { toast('Add items first', true); return; }
  const tableNo   = (document.getElementById('kot-table-no')  ||{}).value || '—';
  const guestName = (document.getElementById('kot-guest-name')||{}).value || '';
  const rawTotal  = foodBill.reduce((s,b)=>s+b.price*b.qty,0);
  const {final:total, discAmt} = applyDiscount(rawTotal, foodDiscMode, 'food-disc-val', 'food-disc-preview');
  const orderNo   = getNextKotNo();
  const billNo    = getTodayDateKey().replace(/-/g,'').slice(4) + '-' + String(orderNo).padStart(3,'0');
  const nowT      = nowStr();
  const payLabel  = foodPayMode==='rfid' ? 'RFID Wallet' : foodPayMode==='upi' ? 'UPI' : 'Cash';

  const rows = foodBill.map(b=>
    `<tr><td>${b.name}</td><td>${b.qty}</td><td>&#8377;${(b.price*b.qty).toLocaleString('en-IN')}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill</title>
<style>
  @page{margin:4mm 3mm;size:80mm auto;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:74mm;font-family:'Courier New',monospace;font-size:11.5px;color:#000;background:#fff;}
  h1{font-size:13px;font-weight:900;text-align:center;letter-spacing:1px;margin-bottom:1px;}
  .sub{text-align:center;font-size:9.5px;color:#444;margin-bottom:5px;}
  .dash{border:none;border-top:1px dashed #000;margin:4px 0;}
  .row{display:flex;justify-content:space-between;font-size:10.5px;margin:1.5px 0;}
  .bill-no{background:#000;color:#fff;text-align:center;font-size:14px;font-weight:900;padding:3px 0;margin:3px 0;letter-spacing:1.5px;}
  table{width:100%;border-collapse:collapse;margin:3px 0;}
  th{border-bottom:1px solid #000;padding:1.5px 2px;font-size:10px;text-align:left;}
  th:nth-child(2){text-align:center;}th:nth-child(3){text-align:right;}
  td{padding:2px 2px;font-size:11px;vertical-align:top;}
  td:nth-child(2){text-align:center;}td:nth-child(3){text-align:right;white-space:nowrap;}
  .total-line{border-top:1.5px solid #000;font-weight:900;font-size:13px;display:flex;justify-content:space-between;padding-top:4px;margin-top:2px;}
  .footer{text-align:center;font-size:9px;margin-top:5px;color:#555;line-height:1.5;}
</style></head><body>
<h1>LEO CLUB</h1>
<div class="sub">The Fern, Junagadh &nbsp;|&nbsp; Bowling Alley Cafe</div>
<div class="dash"></div>
<div class="bill-no">BILL # ${String(orderNo).padStart(3,'0')}</div>
<div class="dash"></div>
<div class="row"><span><b>Date:</b> ${nowT}</span><span><b>Ref:</b> ${billNo}</span></div>
${tableNo!=='—'?`<div class="row"><span><b>Table/Token:</b> ${tableNo}</span>${guestName?`<span><b>Guest:</b> ${guestName}</span>`:''}</div>`:''}
<div class="row"><span><b>Payment:</b> ${payLabel}</span></div>
<div class="dash"></div>
<table>
  <thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="dash"></div>
${discAmt>0?`<div class="row"><span>Subtotal</span><span>&#8377;${rawTotal.toLocaleString('en-IN')}</span></div><div class="row"><span>Discount</span><span>-&#8377;${discAmt.toLocaleString('en-IN')}</span></div>`:''}
<div class="total-line"><span>TOTAL</span><span>&#8377;${total.toLocaleString('en-IN')}</span></div>
<div class="dash"></div>
<div class="footer">Thank you for visiting Leo Club!<br>The Fern, Junagadh &mdash; www.thefernhotels.com</div>
</body></html>`;

  const w = window.open('','_blank','width=320,height=500');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>{ w.print(); setTimeout(()=>w.close(),1500); },350);
  toast('Bill #' + String(orderNo).padStart(3,'0') + ' printed');
}

function buildGenericHtml(am) {
  const cfg = (prices.customAm && prices.customAm[am.id]) || {};
  const notice = am.bonusOk
    ? `<div class="n-go">★ Bonus wallet accepted here.</div>`
    : `<div class="n-mg">⚠ Cash balance only.</div>`;
  const noteHtml = cfg.note
    ? `<div class="n-cy" style="margin-bottom:9px;font-size:0.78rem;">💡 ${cfg.note}</div>` : '';
  const defAmt = cfg.defaultAmt || '';
  return `${notice}${noteHtml}
  <div class="two-col">
    <div>
      <div class="tap" id="${am.id}-tap" onclick="activateTap('${am.id}')">
        <div class="tap-ic">📡</div><div class="tap-lbl">TAP CUSTOMER CARD</div><div class="tap-sub">balance will appear</div>
      </div>
      <div id="${am.id}-wc" style="display:none;"></div>
      <div class="card">
        <label class="f">Amount to Charge (₹)</label><input type="number" id="${am.id}-g-amt" placeholder="Enter amount" value="${defAmt}">
        <label class="f">Description</label><input type="text" id="${am.id}-g-desc" placeholder="e.g. ${am.name} charge">
        <button class="btn btn-cy btn-fw" onclick="chargeGeneric('${am.id}','${am.name}',${am.bonusOk})">Charge via RFID</button>
      </div>
    </div>
    <div>
      <div class="sl">Recent Transactions</div>
      <div class="card" style="padding:11px;"><div id="${am.id}-txns"><div class="empty">No transactions yet</div></div></div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
//  BOWLING
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  DISCOUNT + REFERENCE HELPERS
// ═══════════════════════════════════════════

let bowlDiscMode = 'none';
let gzDiscMode   = 'none';
let foodDiscMode = 'none';

function _setDiscMode(prefix, mode) {
  ['none','pct','flat'].forEach(m => {
    const el = document.getElementById(prefix+'-disc-'+m); if(!el) return;
    if(m===mode){ el.style.background='rgba(255,255,255,0.08)'; el.style.borderColor='#d97706'; el.style.color='#d97706'; }
    else        { el.style.background=''; el.style.borderColor=''; el.style.color=''; }
  });
  const row = document.getElementById(prefix+'-disc-row');
  if(row) row.style.display = mode==='none' ? 'none' : '';
  const val = document.getElementById(prefix+'-disc-val');
  if(val) val.value = '';
  const prev = document.getElementById(prefix+'-disc-preview');
  if(prev) prev.textContent = '';
}

function setBowlDisc(mode) { bowlDiscMode = mode; _setDiscMode('bowl', mode); calcBowl(); }
function setGZDisc(mode)   { gzDiscMode   = mode; _setDiscMode('gz',   mode); calcTokens(); }
function setFoodDisc(mode) { foodDiscMode = mode; _setDiscMode('food', mode); renderBill(); }

function applyDiscount(raw, mode, valId, previewId) {
  if (mode === 'none') return { final: raw, discAmt: 0 };
  const v = parseFloat((document.getElementById(valId)||{}).value) || 0;
  let discAmt = 0;
  if (mode === 'pct')  discAmt = Math.min(Math.round(raw * v / 100), raw);
  if (mode === 'flat') discAmt = Math.min(v, raw);
  const final = raw - discAmt;
  const prev = document.getElementById(previewId);
  if (prev) prev.textContent = discAmt > 0 ? ('−₹' + discAmt.toLocaleString('en-IN') + ' saved') : '';
  return { final, discAmt };
}

function getRef(fieldId) {
  return ((document.getElementById(fieldId)||{}).value||'').trim();
}

function requireRef(fieldId, discountActive) {
  // Reference is only required when a discount is being applied
  if (!discountActive) return true;
  const ref = getRef(fieldId);
  if (!ref) {
    const el = document.getElementById(fieldId);
    if(el){ el.style.border='2px solid #ef4444'; el.focus(); setTimeout(()=>el.style.border='',2000); }
    toast('Reference / reason is required when applying a discount ✱', true);
    return false;
  }
  return true;
}

// ─── BOWLING PAYMENT MODE ──────────────────────────────────────────────────
let bowlPayMode = 'rfid';

function setBowlPayMode(mode) {
  bowlPayMode = mode;
  ['rfid','cash','upi'].forEach(m => {
    const el = document.getElementById('bowl-pm-'+m); if(!el) return;
    if(m===mode){ el.style.background='rgba(78,203,138,0.15)'; el.style.border='1.5px solid var(--cy)'; el.style.color='var(--cy)'; }
    else        { el.style.background='rgba(255,255,255,0.05)'; el.style.border='1px solid var(--border)'; el.style.color='var(--mu)'; }
  });
  const rfidZone   = document.getElementById('bowl-rfid-zone');
  const walkinZone = document.getElementById('bowl-walkin-zone');
  const lbl        = document.getElementById('bowl-walkin-method-label');
  const chargeBtn  = document.getElementById('bowl-charge-btn');
  const pbBonus    = document.querySelector('.pb-row.pb-bonus');
  if(mode === 'rfid') {
    if(rfidZone)   rfidZone.style.display='';
    if(walkinZone) walkinZone.style.display='none';
    if(chargeBtn)  chargeBtn.textContent='Charge via RFID';
    if(pbBonus)    pbBonus.style.display='';
  } else {
    if(rfidZone)   rfidZone.style.display='none';
    if(walkinZone) walkinZone.style.display='';
    if(lbl)        lbl.textContent = mode==='cash'?'Cash':'UPI';
    if(chargeBtn)  chargeBtn.textContent='Record '+(mode==='cash'?'💵 Cash':'📱 UPI')+' Sale';
    if(pbBonus)    pbBonus.style.display='none';
    zoneCards.bowl = null;
    const wc = document.getElementById('bowl-wc'); if(wc) wc.style.display='none';
  }
  calcBowl();
}

// ─── GAME ZONE PAYMENT MODE ─────────────────────────────────────────────────
let gzPayMode = 'rfid';

function setGZPayMode(mode) {
  gzPayMode = mode;
  ['rfid','cash','upi'].forEach(m => {
    const el = document.getElementById('gz-pm-'+m); if(!el) return;
    if(m===mode){ el.style.background='rgba(78,203,138,0.15)'; el.style.border='1.5px solid var(--cy)'; el.style.color='var(--cy)'; }
    else        { el.style.background='rgba(255,255,255,0.05)'; el.style.border='1px solid var(--border)'; el.style.color='var(--mu)'; }
  });
  const rfidZone   = document.getElementById('gz-rfid-zone');
  const walkinZone = document.getElementById('gz-walkin-zone');
  const lbl        = document.getElementById('gz-walkin-method-label');
  if(mode === 'rfid') {
    if(rfidZone)   rfidZone.style.display='';
    if(walkinZone) walkinZone.style.display='none';
    zoneCards.gz = null; // don't carry over stale card
  } else {
    if(rfidZone)   rfidZone.style.display='none';
    if(walkinZone) walkinZone.style.display='';
    if(lbl)        lbl.textContent = mode==='cash'?'Cash':'UPI';
    zoneCards.gz = null;
    const wc = document.getElementById('gz-wc'); if(wc) wc.style.display='none';
  }
}

function selBowlTier(el, tier) {
  document.querySelectorAll('.to').forEach(t => t.classList.remove('sel'));
  el.classList.add('sel'); bowlTier = tier; calcBowl();
}
function calcBowl() {
  const p = parseInt((document.getElementById('bowl-p')||{}).value)||1;
  const g = parseInt((document.getElementById('bowl-g')||{}).value)||1;
  const card = zoneCards.bowl;
  const disc = card ? getMemberDiscount(card.rfid) : {bowlingFlat:false};
  const rate  = disc.bowlingFlat ? 199 : (prices[bowlTier]||250);
  const rawTotal = p * g * rate;
  const {final:total, discAmt} = applyDiscount(rawTotal, bowlDiscMode, 'bowl-disc-val', 'bowl-disc-preview');
  const bdt = document.getElementById('bd-t'); if (bdt) bdt.textContent = fmt(total) + (discAmt>0?' (−'+fmt(discAmt)+')':'');
  const bdb = document.getElementById('bd-b'); const bdc = document.getElementById('bd-c');
  if (card && bdb && bdc) {
    const {fromBonus,fromCash} = splitPay(card, total, true);
    bdb.textContent = fmt(fromBonus); bdc.textContent = fmt(fromCash);
  } else { if(bdb)bdb.textContent='—'; if(bdc)bdc.textContent='—'; }
}
function chargeBowling() {
  const p = parseInt(document.getElementById('bowl-p').value)||1;
  const g = parseInt(document.getElementById('bowl-g').value)||1;
  const rate2 = prices[bowlTier]||250;
  const rawTotal = p * g * rate2;
  const {final:total, discAmt} = applyDiscount(rawTotal, bowlDiscMode, 'bowl-disc-val', 'bowl-disc-preview');
  if (!requireRef('bowl-ref', bowlDiscMode !== 'none')) return;
  const ref = getRef('bowl-ref');
  const discNote = discAmt > 0 ? ' [disc −'+fmt(discAmt)+']' : '';

  // ── Walk-in Cash / UPI ──────────────────────────────────
  if (bowlPayMode !== 'rfid') {
    const guestName = (document.getElementById('bowl-walkin-name')||{}).value || 'Walk-in';
    const modeLabel = bowlPayMode==='cash'?'💵 Cash':'📱 UPI';
    const desc = p+'p × '+g+'g ['+bowlTier+']'+discNote+' | Ref: '+ref;
    openM('Confirm '+modeLabel+' Bowling Sale',
      '<div style="font-size:0.86rem;line-height:1.9;">'
      +'Guest: <b>'+guestName+'</b><br>'
      +p+'p × '+g+'g ['+bowlTier+']'
      +(discAmt>0?'<div style="color:#d97706;font-size:0.8rem;">Discount: −'+fmt(discAmt)+'</div>':'')
      +'<div style="background:rgba(26,122,94,0.07);border:1px solid rgba(26,122,94,0.25);border-radius:8px;padding:11px;text-align:center;margin:10px 0;">'
      +'<div style="font-size:0.72rem;letter-spacing:0.08em;color:var(--mu);margin-bottom:4px;">COLLECT FROM GUEST</div>'
      +'<div style="font-family:JetBrains Mono,monospace;font-size:1.6rem;font-weight:700;color:var(--cy);">'+fmt(total)+'</div>'
      +'<div style="font-size:0.82rem;margin-top:4px;color:var(--go);">'+modeLabel+'</div>'
      +'</div>'
      +'<div style="font-size:0.75rem;color:var(--mu);">Ref: '+ref+'</div>'
      +'</div>',
      [{label:'✓ Collected — Record Sale', cls:'btn-cy', fn:()=>{
        const wt = {id:Date.now(), time:nowStr(), customer:guestName, rfid:'WALKIN',
          counter:'Bowling', desc:desc, cashAmt:total, bonusAmt:0, type:'debit',
          cashBalAfter:0, bonusBalAfter:0, payMethod:bowlPayMode, ref:ref, discAmt:discAmt||0};
        txns.unshift(wt); lsSet(LS.txns, txns);
        if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
        if (document.getElementById('scr-reception')&&document.getElementById('scr-reception').classList.contains('active')) renderTodaysSales();
        toast(fmt(total)+' '+modeLabel+' bowling sale recorded ✓');
        const nameEl = document.getElementById('bowl-walkin-name'); if(nameEl) nameEl.value='';
        document.getElementById('bowl-ref').value='';
        refreshBowlTxns(); closeM();
      }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
    );
    return;
  }

  // ── RFID mode ───────────────────────────────────────────
  const card = zoneCards.bowl;
  if (!card) { toast('Tap a customer card first', true); return; }
  const disc2 = getMemberDiscount(card.rfid);
  const rate3  = disc2.bowlingFlat ? 199 : rate2;
  const rawTotal2 = p * g * rate3;
  const {final:total2, discAmt:discAmt2} = applyDiscount(rawTotal2, bowlDiscMode, 'bowl-disc-val', 'bowl-disc-preview');
  const discNote2 = discAmt2 > 0 ? ' [disc −'+fmt(discAmt2)+']' : '';
  const {fromBonus,fromCash} = splitPay(card, total2, true);
  if (fromCash > card.cashBalance) { toast('Insufficient balance! Cash: '+fmt(card.cashBalance)+' Bonus: '+fmt(card.bonusBalance), true); return; }
  const memberNote = disc2.bowlingFlat ? ' <span style="color:var(--go);font-size:0.75rem;">👑 Member flat ₹199</span>' : '';
  openM('Confirm Bowling Charge',
    '<div style="font-size:0.86rem;line-height:1.9;">Customer: <b>'+card.name+'</b>'+memberNote+'<br>'+p+' person(s) × '+g+' game(s) × '+fmt(rate3)+' ['+( disc2.bowlingFlat?'member':bowlTier)+']'
    +(discAmt2>0?'<div style="color:#d97706;font-size:0.8rem;margin-top:2px;">Manual discount: −'+fmt(discAmt2)+'</div>':'')
    +'<div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:9px;margin:9px 0;">'
    +'<div style="color:var(--go);">★ Bonus: <b>'+fmt(fromBonus)+'</b></div>'
    +'<div style="color:var(--cy);">Cash: <b>'+fmt(fromCash)+'</b></div>'
    +'<div style="font-weight:700;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:5px;">Total: '+fmt(total2)+'</div>'
    +'</div>After — Cash: <span style="color:var(--cy);">'+fmt(card.cashBalance-fromCash)+'</span> Bonus: <span style="color:var(--go);">'+fmt(card.bonusBalance-fromBonus)+'</span>'
    +'<div style="font-size:0.75rem;color:var(--mu);margin-top:8px;">Ref: '+ref+'</div></div>',
    [{label:'Confirm & Charge',cls:'btn-cy',fn:()=>{
      doChargeBowl(card,total2,fromBonus,fromCash,p,g,discNote2+' | Ref: '+ref,discAmt2);
      closeM();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}
function doChargeBowl(card, total, fromBonus, fromCash, p, g, extraDesc, discAmt) {
  card.cashBalance -= fromCash; card.bonusBalance -= fromBonus; card.spent += total;
  persist('cards');
  const desc = p+'p × '+g+'g ['+bowlTier+']'+(extraDesc||'');
  addTxnRecord(card, 'Bowling', desc, fromCash, fromBonus, 'debit');
  // Attach discount amount to last txn for reporting
  if(discAmt > 0 && txns[0]) { txns[0].discAmt = discAmt; lsSet(LS.txns, txns); if(db&&syncOk) db.ref('txns/'+txns[0].id+'/discAmt').set(discAmt); }
  toast(fmt(total) + ' charged for bowling');
  document.getElementById('bowl-ref').value='';
  clearManualLookup();
  clearCounterZone('bowl');
  calcBowl(); refreshBowlTxns();
}
function refreshBowlTxns() {
  const el = document.getElementById('bowl-txns'); if(!el) return;
  const t = txns.filter(x => x.counter==='Bowling').slice(0,8);
  el.innerHTML = t.length ? t.map(x => {
    const isWalkin = x.rfid==='WALKIN';
    const pm = x.payMethod ? (x.payMethod==='cash'?'💵':'📱') : '';
    return '<div class="hr"><div><div>'+x.customer+(isWalkin?' <span style="font-size:0.65rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:1px 5px;color:#16a34a;">'+pm+' walk-in</span>':'')+'</div><div style="font-size:0.65rem;color:var(--mu);">'+x.time+'</div></div><div style="text-align:right;">'+(x.bonusAmt>0?'<div class="dbb">-'+fmt(x.bonusAmt)+' bonus</div>':'')+(x.cashAmt>0?'<div class="db">-'+fmt(x.cashAmt)+' cash</div>':'')+'</div></div>';
  }).join('') : '<div class="empty">No transactions yet</div>';
}

// ═══════════════════════════════════════════
//  GAME ZONE
// ═══════════════════════════════════════════
function calcTokens() {
  const rawAmt = parseFloat((document.getElementById('gz-amt')||{}).value)||0;
  const {final:amt, discAmt} = applyDiscount(rawAmt, gzDiscMode, 'gz-disc-val', 'gz-disc-preview');
  const tok = Math.floor(amt / (prices.token||20));
  const tr = document.getElementById('gz-tok'); if(tr) tr.textContent = tok + ' Token' + (tok!==1?'s':'') + (discAmt>0?' (−'+fmt(discAmt)+')':'');
  const pb = document.getElementById('gz-pb');
  const card = zoneCards.gz;
  if (amt > 0 && card && pb) {
    const {fromBonus,fromCash} = splitPay(card, amt, true);
    pb.style.display='block';
    document.getElementById('gz-bd-b').textContent = fmt(fromBonus);
    document.getElementById('gz-bd-c').textContent = fmt(fromCash);
    document.getElementById('gz-bd-t').textContent = fmt(amt) + (discAmt>0?' (disc −'+fmt(discAmt)+')':'');
  } else if(pb) pb.style.display='none';
}
function renderGZPackages() {
  const el = document.getElementById('gz-quick-packages');
  if (!el) return;
  const tp = prices.token || 20;
  // Fixed token counts; amounts auto-calculated from current token price
  const pkgs = [
    { tokens: 5,  amt: tp * 5  },
    { tokens: 10, amt: tp * 10 },
    { tokens: 25, amt: tp * 25 },
    { tokens: 50, amt: tp * 50 },
  ];
  el.innerHTML = pkgs.map(p =>
    `<div class="m-row">
      <div class="m-name">₹${p.amt.toLocaleString('en-IN')} — ${p.tokens} Tokens</div>
      <div style="display:flex;align-items:center;">
        <span class="m-price">₹${p.amt.toLocaleString('en-IN')}</span>
        <button class="btn btn-gh btn-sm" onclick="chargeGZ(${p.amt},${p.tokens})">Charge</button>
      </div>
    </div>`
  ).join('');
}

function chargeGZ(amt, tokens) {
  // Walk-in mode — bypass RFID
  if (gzPayMode !== 'rfid') {
    const guestName = (document.getElementById('gz-walkin-name')||{}).value || 'Walk-in';
    const modeLabel = gzPayMode==='cash'?'💵 Cash':'📱 UPI';
    openM('Confirm '+modeLabel+' Game Zone Sale',
      '<div style="font-size:0.86rem;line-height:2;">'
      +'Guest: <b>'+guestName+'</b><br>'
      +tokens+' token'+(tokens!==1?'s':'')+' — '+fmt(amt)
      +'<div style="background:rgba(26,122,94,0.07);border:1px solid rgba(26,122,94,0.25);border-radius:8px;padding:11px;text-align:center;margin:10px 0;">'
      +'<div style="font-size:0.72rem;letter-spacing:0.08em;color:var(--mu);margin-bottom:4px;">COLLECT FROM GUEST</div>'
      +'<div style="font-family:JetBrains Mono,monospace;font-size:1.6rem;font-weight:700;color:var(--cy);">'+fmt(amt)+'</div>'
      +'<div style="font-size:0.82rem;margin-top:4px;color:var(--go);">'+modeLabel+'</div>'
      +'</div></div>',
      [{label:'✓ Collected — Record Sale', cls:'btn-go', fn:()=>{
        const wt = {id:Date.now(), time:nowStr(), customer:guestName, rfid:'WALKIN',
          counter:'Game Zone', desc:tokens+' token'+(tokens!==1?'s':'')+' ['+gzPayMode.toUpperCase()+']',
          cashAmt:amt, bonusAmt:0, type:'debit', cashBalAfter:0, bonusBalAfter:0, payMethod:gzPayMode};
        txns.unshift(wt); lsSet(LS.txns, txns);
        if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
        if (document.getElementById('scr-reception')&&document.getElementById('scr-reception').classList.contains('active')) renderTodaysSales();
        toast(fmt(amt)+' '+modeLabel+' — '+tokens+' tokens recorded ✓');
        const nameEl = document.getElementById('gz-walkin-name'); if(nameEl) nameEl.value='';
        refreshGZTxns(); closeM();
      }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
    );
    return;
  }
  // RFID mode below (original)
  const card = zoneCards.gz;
  if (!card) { toast('Tap a customer card first', true); return; }
  const {fromBonus,fromCash} = splitPay(card, amt, true);
  if (fromCash > card.cashBalance) { toast('Insufficient balance!', true); return; }
  openM('Confirm Token Charge',
    `<div style="font-size:0.86rem;line-height:2;">Customer: <b>${card.name}</b><br>Giving: <span style="color:var(--go);font-weight:700;">${tokens} token${tokens!==1?'s':''}</span>
    <div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:9px;margin:9px 0;">
      <div style="color:var(--go);">★ Bonus: <b>${fmt(fromBonus)}</b></div>
      <div style="color:var(--cy);">Cash: <b>${fmt(fromCash)}</b></div>
      <div style="font-weight:700;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:5px;">Total: ${fmt(amt)}</div>
    </div>After — Cash: <span style="color:var(--cy);">${fmt(card.cashBalance-fromCash)}</span> Bonus: <span style="color:var(--go);">${fmt(card.bonusBalance-fromBonus)}</span></div>`,
    [{label:'Give Tokens & Charge',cls:'btn-go',fn:()=>{doChargeGZ(card,amt,tokens,fromBonus,fromCash);closeM();}},
     {label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}
function chargeGZCustom() {
  if (gzPayMode !== 'rfid') {
    const amt = parseFloat((document.getElementById('gz-amt')||{}).value)||0;
    if (!amt) { toast('Enter an amount first', true); return; }
    const tokens = Math.floor(amt / (prices.token||20));
    chargeGZ(amt, tokens);
    return;
  }
  const amt = parseFloat((document.getElementById('gz-amt')||{}).value)||0;
  if (amt <= 0) { toast('Enter amount first', true); return; }
  chargeGZ(amt, Math.floor(amt/(prices.token||20)));
}
function doChargeGZ(card, amt, tokens, fromBonus, fromCash, ref, discAmt) {
  card.cashBalance -= fromCash; card.bonusBalance -= fromBonus; card.spent += amt;
  persist('cards');
  const desc = tokens+' game token'+(tokens!==1?'s':'')+(discAmt>0?' [disc −₹'+discAmt+']':'')+(ref?' | Ref: '+ref:'');
  addTxnRecord(card, 'Game Zone', desc, fromCash, fromBonus, 'debit');
  if(discAmt > 0 && txns[0]) { txns[0].discAmt = discAmt; lsSet(LS.txns, txns); if(db&&syncOk) db.ref('txns/'+txns[0].id+'/discAmt').set(discAmt); }
  toast(fmt(amt)+' charged · '+tokens+' tokens given');
  const ga = document.getElementById('gz-amt'); if(ga) ga.value='';
  const pb = document.getElementById('gz-pb'); if(pb) pb.style.display='none';
  const gt = document.getElementById('gz-tok'); if(gt) gt.textContent='0 Tokens';
  const refEl = document.getElementById('gz-ref'); if(refEl) refEl.value='';
  clearManualLookup();
  clearCounterZone('gz');
  refreshGZTxns();
}
function refreshGZTxns() {
  const el = document.getElementById('gz-txns'); if(!el) return;
  const t = txns.filter(x => x.counter==='Game Zone').slice(0,8);
  el.innerHTML = t.length ? t.map(x => {
    const isWalkin = x.rfid==='WALKIN';
    const pm = x.payMethod ? (x.payMethod==='cash'?'💵':'📱') : '';
    return '<div class="hr"><div><div>'+x.customer+(isWalkin?' <span style="font-size:0.65rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:1px 5px;color:#16a34a;">'+pm+' walk-in</span>':'')+'</div><div style="font-size:0.65rem;color:var(--mu);">'+x.time+'</div></div><div style="text-align:right;">'+(x.bonusAmt>0?'<div class="dbb">-'+fmt(x.bonusAmt)+' bonus</div>':'')+(x.cashAmt>0?'<div class="db">-'+fmt(x.cashAmt)+' cash</div>':'')+'</div></div>';
  }).join('') : '<div class="empty">No transactions yet</div>';
}

// ═══════════════════════════════════════════
//  FOOD
// ═══════════════════════════════════════════
let foodPayMode = 'rfid'; // 'rfid' | 'cash' | 'upi'

function setFoodPayMode(mode) {
  foodPayMode = mode;
  ['rfid','cash','upi'].forEach(m => {
    const el = document.getElementById('food-pm-'+m); if(!el) return;
    el.classList.toggle('active', m===mode);
  });
  const rfidZone   = document.getElementById('food-rfid-zone');
  const walkinZone = document.getElementById('food-walkin-zone');
  const lbl        = document.getElementById('food-walkin-method-label');
  const chargeBtn  = document.getElementById('food-charge-btn');
  if(mode === 'rfid') {
    if(rfidZone)   rfidZone.style.display='';
    if(walkinZone) walkinZone.style.display='none';
    if(chargeBtn)  chargeBtn.textContent='Charge (RFID)';
  } else {
    if(rfidZone)   rfidZone.style.display='none';
    if(walkinZone) walkinZone.style.display='';
    if(lbl)        lbl.textContent = mode==='cash'?'Cash':'UPI';
    if(chargeBtn)  chargeBtn.textContent='Record '+( mode==='cash'?'💵 Cash':'📱 UPI')+' Sale';
    // Clear RFID card for food zone
    zoneCards.food = null;
    const wc = document.getElementById('food-wc'); if(wc) wc.style.display='none';
  }
}
let foodActiveCat = 'ALL';

// Map categories to emoji icons for big-icon grid
const FOOD_CAT_ICONS = {
  'Bakery':'🧁','Sandwich':'🥪','Snacks':'🥐','Coffee':'☕','Beverages':'🥤',
  'Combo Offers':'🎁','Add-On Beverages':'🥤','Tea & Coffee':'☕','Mocktails':'🍹',
  'Shakes & Juice':'🥤','Energy Drinks':'⚡','Pizzas':'🍕','Garlic Bread':'🥖',
  'Pasta':'🍝','Sandwiches':'🥪','Nachos':'🫓','Grilled Wraps':'🌯',
  'World of Fries':'🍟','Premium Burgers':'🍔',
};
function foodCatIcon(cat) { return FOOD_CAT_ICONS[cat] || '🍽'; }

function renderFoodMenu() {
  const el       = document.getElementById('food-menu');
  const tabsEl   = document.getElementById('food-cat-tabs') || document.getElementById('kot-cat-tabs');
  const searchEl = document.getElementById('food-search');
  if (!el) return;

  if (!menuItems.length) {
    el.innerHTML = '<div class="empty">No menu items. Add in Settings.</div>';
    if (tabsEl) tabsEl.innerHTML = '';
    return;
  }

  const cats = [...new Set(menuItems.map(i => i.cat))];
  const query = (searchEl ? searchEl.value : '').trim().toLowerCase();

  // ── Build category tabs (only when not searching) ──
  if (tabsEl) {
    if (query) {
      tabsEl.style.display = 'none';
    } else {
      tabsEl.style.display = '';
      const allCats = ['ALL', ...cats];
      tabsEl.innerHTML = allCats.map(c => {
        const active = c === foodActiveCat;
        const icon = c === 'ALL' ? '🍽' : foodCatIcon(c);
        return '<button class="kot-cat-btn' + (active ? ' active' : '') + '" onclick="_foodCatClick(\''+ c + '\')">' + icon + ' ' + c + '</button>';
      }).join('');
    }
  }

  // ── Filter items ──
  let filtered;
  if (query) {
    filtered = menuItems
      .map((item, gi) => ({item, gi}))
      .filter(({item}) => item.name.toLowerCase().includes(query) || item.cat.toLowerCase().includes(query));
    if (!filtered.length) {
      el.innerHTML = '<div class="empty">No items match "' + query + '"</div>';
      return;
    }
    // Show search results as big icon grid
    const resultCats = [...new Set(filtered.map(({item}) => item.cat))];
    el.innerHTML = resultCats.map(cat => {
      const catItems = filtered.filter(({item}) => item.cat === cat);
      const icon = foodCatIcon(cat);
      return '<div class="m-sec">' + icon + ' ' + cat + '</div><div class="kot-grid">'
        + catItems.map(({item, gi}) => {
            const inCart = foodBill.find(b=>b.name===item.name);
            return '<div class="kot-item" onclick="addToBill(' + gi + ')">'
              + (inCart ? '<div class="kot-item-in-cart">'+inCart.qty+'</div>' : '')
              + '<span class="kot-item-icon">' + icon + '</span>'
              + '<div class="kot-item-name">' + _highlight(item.name, query) + '</div>'
              + '<span class="kot-item-price">' + fmt(item.price) + '</span>'
              + '</div>';
          }).join('') + '</div>';
    }).join('');
  } else {
    // Category mode — big icon grid per category
    const showCats = foodActiveCat === 'ALL' ? cats : cats.filter(c => c === foodActiveCat);
    el.innerHTML = showCats.map(cat => {
      const catItems = menuItems
        .map((item, gi) => ({item, gi}))
        .filter(({item}) => item.cat === cat);
      const icon = foodCatIcon(cat);
      return '<div class="m-sec">' + icon + ' ' + cat + '</div><div class="kot-grid">'
        + catItems.map(({item, gi}) => {
            const inCart = foodBill.find(b=>b.name===item.name);
            return '<div class="kot-item" onclick="addToBill(' + gi + ')">'
              + (inCart ? '<div class="kot-item-in-cart">'+inCart.qty+'</div>' : '')
              + '<span class="kot-item-icon">' + icon + '</span>'
              + '<div class="kot-item-name">' + item.name + '</div>'
              + '<span class="kot-item-price">' + fmt(item.price) + '</span>'
              + '</div>';
          }).join('') + '</div>';
    }).join('');
  }
}

function _highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return text.slice(0, idx)
    + '<mark style="background:#fef08a;padding:0;border-radius:2px;">' + text.slice(idx, idx + query.length) + '</mark>'
    + text.slice(idx + query.length);
}

function _foodCatClick(i) { setFoodCat((window._foodCatList||[])[i]||'ALL'); }
function setFoodCat(cat) {
  foodActiveCat = cat;
  const searchEl = document.getElementById('food-search');
  if (searchEl) searchEl.value = '';
  renderFoodMenu();
  // Scroll menu to top when switching category
  const el = document.getElementById('food-menu');
  if (el) el.scrollTop = 0;
}

function addToBill(idx) {
  const item = menuItems[idx]; if(!item) return;
  const ex = foodBill.find(b=>b.name===item.name);
  if (ex) ex.qty++; else foodBill.push({name:item.name,price:item.price,qty:1});
  renderBill();
  renderFoodMenu(); // refresh cart badges on menu grid
}

function renderBill() {
  const bi = document.getElementById('food-bill-items');
  const bf = document.getElementById('food-bill-foot');
  if (!foodBill.length) {
    if(bi) bi.innerHTML='<div class="empty">Add items from menu</div>';
    if(bf) bf.style.display='none'; return;
  }
  const total = foodBill.reduce((s,b)=>s+b.price*b.qty,0);
  if(bi) bi.innerHTML = foodBill.map((b,i)=>`<div class="kot-bill-row">
    <div style="flex:1;font-size:0.87rem;font-weight:600;">${b.name}</div>
    <button class="kot-qty-btn" onclick="changeBillQty(${i},-1)">−</button>
    <span style="font-family:'JetBrains Mono',monospace;font-size:0.9rem;font-weight:700;min-width:18px;text-align:center;">${b.qty}</span>
    <button class="kot-qty-btn" onclick="changeBillQty(${i},1)">+</button>
    <span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--cy);min-width:52px;text-align:right;">${fmt(b.price*b.qty)}</span>
    <button onclick="removeBillItem(${i})" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1rem;padding:0 2px;">✕</button>
  </div>`).join('');
  const {final:discTotal, discAmt} = applyDiscount(total, foodDiscMode, 'food-disc-val', 'food-disc-preview');
  const bt = document.getElementById('food-bill-tot');
  if(bt) bt.textContent = fmt(discTotal) + (discAmt>0?' (−'+fmt(discAmt)+' disc)':'');
  if(bf) bf.style.display='block';
}
function removeBillItem(i) { foodBill.splice(i,1); renderBill(); }
function changeBillQty(i,delta) { if(!foodBill[i]) return; foodBill[i].qty+=delta; if(foodBill[i].qty<=0) foodBill.splice(i,1); renderBill(); }
function clearBill() { foodBill=[]; renderBill(); renderFoodMenu(); }

function chargeFoodBill() {
  const rawTotal = foodBill.reduce((s,b)=>s+b.price*b.qty,0);
  if (rawTotal===0) { toast('Add items to bill first', true); return; }

  // ── Walk-in cash/UPI mode ──────────────────────────────
  if(foodPayMode !== 'rfid') {
    const {final:chargeTotal, discAmt} = applyDiscount(rawTotal, foodDiscMode, 'food-disc-val', 'food-disc-preview');
    if (!requireRef('food-ref', foodDiscMode !== 'none')) return;
    const ref = getRef('food-ref');
    const desc = foodBill.map(b=>b.name+(b.qty>1?' x'+b.qty:'')).join(', ');
    const modeLabel = foodPayMode==='cash'?'💵 Cash':'📱 UPI';
    openM('Confirm '+modeLabel+' Sale',
      '<div style="font-size:0.86rem;line-height:1.9;">'
      +'<div style="color:var(--mu);font-size:0.8rem;margin-bottom:8px;">'+desc+'</div>'
      +(discAmt>0?'<div style="color:#d97706;font-size:0.8rem;margin-bottom:6px;">Discount: −'+fmt(discAmt)+'</div>':'')
      +'<div style="background:rgba(91,191,255,0.06);border:1px solid rgba(91,191,255,0.2);border-radius:8px;padding:11px;text-align:center;">'
      +'<div style="font-size:0.72rem;letter-spacing:0.08em;color:var(--mu);margin-bottom:4px;">TOTAL TO COLLECT</div>'
      +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:1.6rem;font-weight:700;color:var(--cy);">'+fmt(chargeTotal)+'</div>'
      +'<div style="font-size:0.82rem;margin-top:4px;color:var(--go);">'+modeLabel+'</div>'
      +'</div>'
      +'<div style="font-size:0.75rem;color:var(--mu);margin-top:8px;">Ref: '+ref+'</div>'
      +'</div>',
      [{label:'✓ Collected — Record Sale',cls:'btn-mg',fn:()=>{
        const fullDesc = desc+(discAmt>0?' [disc −'+fmt(discAmt)+']':'')+' ['+foodPayMode.toUpperCase()+'] | Ref: '+ref;
        const wt = {id:Date.now(),time:nowStr(),customer:'Walk-in',rfid:'WALKIN',counter:'Food & Beverages',
          desc:fullDesc,cashAmt:chargeTotal,bonusAmt:0,type:'debit',cashBalAfter:0,bonusBalAfter:0,payMethod:foodPayMode,ref:ref,discAmt:discAmt||0};
        txns.unshift(wt); lsSet(LS.txns,txns);
        if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
        toast(fmt(chargeTotal)+' '+modeLabel+' sale recorded ✓');
        clearBill(); document.getElementById('food-ref').value='';
        refreshFoodTxns(); closeM();
      }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
    );
    return;
  }

  // ── RFID mode ──────────────────────────────────────────
  const card = zoneCards.food;
  if (!card) { toast('Tap a customer card first', true); return; }
  if (!requireRef('food-ref', foodDiscMode !== 'none')) return;
  const ref = getRef('food-ref');
  const disc3 = getMemberDiscount(card.rfid);
  const memberDisc = disc3.foodPct ? Math.round(rawTotal * disc3.foodPct / 100) : 0;
  const afterMember = rawTotal - memberDisc;
  const {final:total, discAmt:manualDisc} = applyDiscount(afterMember, foodDiscMode, 'food-disc-val', 'food-disc-preview');
  const totalDisc = memberDisc + manualDisc;
  if (card.cashBalance < total) { toast('Insufficient cash! Card has '+fmt(card.cashBalance), true); return; }
  const desc = foodBill.map(b=>b.name+(b.qty>1?' x'+b.qty:'')).join(', ');
  openM('Confirm Food Charge',
    '<div style="font-size:0.86rem;line-height:1.9;">Customer: <b>'+card.name+'</b>'+(disc3.isMember?' <span style="color:var(--go);font-size:0.75rem;">👑 Member 10% off</span>':'')+'<br>'
    +'<span style="color:var(--mu);font-size:0.8rem;">'+desc+'</span>'
    +'<div style="background:rgba(91,191,255,0.06);border:1px solid rgba(91,191,255,0.2);border-radius:8px;padding:9px;margin:9px 0;">'
    +(memberDisc>0?'<div style="color:var(--mu);text-decoration:line-through;font-size:0.8rem;">₹'+rawTotal.toLocaleString('en-IN')+'</div><div style="color:var(--gr);font-size:0.8rem;">👑 Member: −'+fmt(memberDisc)+'</div>':'')
    +(manualDisc>0?'<div style="color:#d97706;font-size:0.8rem;">Manual discount: −'+fmt(manualDisc)+'</div>':'')
    +'<div style="color:var(--cy);font-weight:700;">Total: <b>'+fmt(total)+'</b></div>'
    +'</div>Cash after: <span style="color:var(--cy);">'+fmt(card.cashBalance-total)+'</span>'
    +'<div style="font-size:0.75rem;color:var(--mu);margin-top:8px;">Ref: '+ref+'</div>'
    +'</div>',
    [{label:'Confirm & Charge',cls:'btn-mg',fn:()=>{
      const noteDisc = (totalDisc>0?' [disc −'+fmt(totalDisc)+']':'');
      doChargeFood(card,total,desc+noteDisc+' | Ref: '+ref, totalDisc);closeM();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}
function doChargeFood(card, total, desc, discAmt) {
  card.cashBalance -= total; card.spent += total;
  persist('cards');
  addTxnRecord(card, 'Food & Beverages', desc, total, 0, 'debit');
  if(discAmt > 0 && txns[0]) { txns[0].discAmt = discAmt; lsSet(LS.txns, txns); if(db&&syncOk) db.ref('txns/'+txns[0].id+'/discAmt').set(discAmt); }
  toast(fmt(total)+' charged for food');
  const refEl = document.getElementById('food-ref'); if(refEl) refEl.value='';
  clearBill(); clearManualLookup();
  clearCounterZone('food');
  refreshFoodTxns();
}
function refreshFoodTxns() {
  const el = document.getElementById('food-txns'); if(!el) return;
  const t = txns.filter(x=>x.counter==='Food & Beverages').slice(0,8);
  el.innerHTML = t.length ? t.map(x=>`<div class="hr"><div><div>${x.customer}</div><div style="font-size:0.65rem;color:var(--mu);">${x.time}</div></div><div class="db">-${fmt(x.cashAmt)}</div></div>`).join('') : '<div class="empty">No transactions yet</div>';
  // Update today's order counter badge
  const badge = document.getElementById('kot-today-count');
  if (badge) {
    const today = getTodayDateKey();
    const storedDay = localStorage.getItem(LS.kotDay);
    const seq = (storedDay === today) ? parseInt(localStorage.getItem(LS.kotSeq)||'0',10) : 0;
    badge.textContent = String(seq);
  }
}

function refreshCounterTxns() { refreshBowlTxns(); refreshGZTxns(); refreshFoodTxns(); }

// ═══════════════════════════════════════════
//  GENERIC COUNTER
// ═══════════════════════════════════════════
function chargeGeneric(cid, counterName, bonusOk) {
  const card = zoneCards[cid];
  if (!card) { toast('Tap a card first', true); return; }
  const amt = parseFloat((document.getElementById(cid+'-g-amt')||{}).value)||0;
  const desc = (document.getElementById(cid+'-g-desc')||{}).value || counterName;
  if (amt<=0) { toast('Enter amount', true); return; }
  const {fromBonus,fromCash} = splitPay(card, amt, bonusOk);
  if (fromCash > card.cashBalance) { toast('Insufficient balance!', true); return; }
  openM('Confirm Charge',
    `<div style="font-size:0.86rem;line-height:2;">Customer: <b>${card.name}</b><br>${desc}
    <div style="background:rgba(78,203,138,0.06);border:1px solid rgba(78,203,138,0.15);border-radius:8px;padding:9px;margin:9px 0;">
      ${fromBonus>0?`<div style="color:var(--go);">★ Bonus: <b>${fmt(fromBonus)}</b></div>`:''}
      <div style="color:var(--cy);">Cash: <b>${fmt(fromCash)}</b></div>
      <div style="font-weight:700;margin-top:5px;">Total: ${fmt(amt)}</div>
    </div></div>`,
    [{label:'Confirm',cls:'btn-cy',fn:()=>{
      card.cashBalance-=fromCash; card.bonusBalance-=fromBonus; card.spent+=amt;
      persist('cards');
      addTxnRecord(card, counterName, desc, fromCash, fromBonus, 'debit');
      toast(fmt(amt)+' charged');
      clearManualLookup();
      clearCounterZone(cid);
      closeM();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  LOOKUP
// ═══════════════════════════════════════════
function doLookup() {
  const q = document.getElementById('lk-q').value.trim();
  const card = findCard(q);
  if (!card) { toast('Card not found — try RFID or mobile', true); return; }
  document.getElementById('lk-result').style.display = 'block';
  document.getElementById('lk-wc').innerHTML = walletHTML(card);
  const ct = txns.filter(t=>t.rfid===card.rfid).sort((a,b)=>(b.ts||b.id||0)-(a.ts||a.id||0));
  document.getElementById('lk-tbl').innerHTML = ct.length ? ct.map(t=>`
    <tr>
      <td style="color:var(--mu);font-size:0.72rem;">${t.time}</td>
      <td><span class="badge ${badgeCls(t.counter)}">${t.counter}</span></td>
      <td style="font-size:0.79rem;">${t.desc}</td>
      <td class="${t.type==='credit'?'cr':'db'}">${t.type==='credit'?'+':'-'}${fmt(t.cashAmt)}</td>
      <td class="${t.bonusAmt>0?(t.type==='credit'?'cr':'dbb'):''}">${t.bonusAmt>0?(t.type==='credit'?'+':'-')+fmt(t.bonusAmt):'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--cy);">${fmt(t.cashBalAfter)}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">No transactions</td></tr>';
}

// ═══════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  HOTEL DASHBOARD
// ═══════════════════════════════════════════
function hotelSetToday() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  document.getElementById('hotel-date').value = y+'-'+m+'-'+day;
  renderHotelDash();
}

// ═══════════════════════════════════════════
//  HOTEL CHECKOUT SEARCH (Reception screen)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  GUEST CHECKOUT — right column (all roles)
// ═══════════════════════════════════════════
function coSearch() {
  const q = (document.getElementById('co-q').value || '').trim().toLowerCase();
  const res = document.getElementById('co-result');
  if (!q) { res.innerHTML = ''; return; }

  const allGuests = cards.filter(c => c.isGuest);
  const matches = allGuests.filter(c =>
    (c.room   && c.room.trim().toLowerCase() === q) ||
    (c.mobile && c.mobile.trim().includes(q)) ||
    (c.rfid   && c.rfid.toLowerCase().includes(q))
  );

  if (allGuests.length === 0) {
    res.innerHTML = `<div style="padding:11px;background:#fef3c7;border:1px solid #fde68a;border-radius:9px;color:#92400e;font-size:0.88rem;font-weight:600;">No hotel guests in system. Issue a guest card first.</div>`;
    return;
  }
  if (matches.length === 0) {
    const activeList = allGuests.filter(c => c.status==='active').map(c=>`Room ${c.room||'?'} — ${c.name}`).join(' · ');
    res.innerHTML = `<div style="padding:11px;background:#fef2f2;border:1px solid #fecaca;border-radius:9px;color:var(--rd);font-size:0.88rem;font-weight:600;">
      No match for "<b>${q}</b>".
      ${activeList ? `<div style="margin-top:5px;font-weight:500;color:#555;font-size:0.8rem;">Active: ${activeList}</div>` : ''}
    </div>`;
    return;
  }
  renderCoResults(matches, res);
}

function coLiveSearch() {
  const q = (document.getElementById('co-q').value || '').trim();
  if (q.length >= 2) coSearch();
  else document.getElementById('co-result').innerHTML = '';
}

function renderCoResults(matches, res) {
  res.innerHTML = matches.map(card => {
    const isActive = card.status === 'active';
    const rfidSafe = encodeURIComponent(card.rfid);
    const bonusUsed = Math.max(0, 100 - (card.bonusBalance || 0));
    return `<div style="background:#fff;border:1.5px solid ${isActive?'var(--border)':'#fecaca'};border-radius:10px;padding:13px;margin-bottom:8px;">
      <div style="font-size:1rem;font-weight:800;color:var(--tx);margin-bottom:3px;">🏨 Room ${card.room||'?'} — ${card.name}</div>
      <div style="font-size:0.8rem;color:var(--mu);margin-bottom:10px;">Checked in: ${card.joined||'—'}</div>
      ${isActive ? `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:11px;">
          <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:9px;text-align:center;">
            <div style="font-size:0.65rem;font-weight:700;color:var(--mu);text-transform:uppercase;margin-bottom:3px;">Cash — Refund</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--gr);">${fmt(card.cashBalance||0)}</div>
          </div>
          <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:8px;padding:9px;text-align:center;">
            <div style="font-size:0.65rem;font-weight:700;color:var(--mu);text-transform:uppercase;margin-bottom:3px;">Bonus — Expires</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--go);">${fmt(card.bonusBalance||0)}</div>
          </div>
          <div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:8px;padding:9px;text-align:center;">
            <div style="font-size:0.65rem;font-weight:700;color:var(--mu);text-transform:uppercase;margin-bottom:3px;">Bonus Used</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--mu);">${fmt(bonusUsed)}</div>
          </div>
        </div>
        <div id="co-confirm-${rfidSafe}" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:11px;margin-bottom:8px;font-size:0.88rem;">
          <b style="color:var(--rd);">Confirm checkout for Room ${card.room||'?'}?</b><br>
          Refund <b style="color:var(--gr);">${fmt(card.cashBalance||0)}</b> cash to guest. Bonus expires.
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-gn" style="flex:1;" onclick="doCoCheckout('${rfidSafe}')">✓ Yes, Checkout</button>
            <button class="btn btn-gh" onclick="document.getElementById('co-confirm-${rfidSafe}').style.display='none'">Cancel</button>
          </div>
        </div>
        <button class="btn btn-rd btn-fw" onclick="document.getElementById('co-confirm-${rfidSafe}').style.display='block'">
          🏨 Checkout Room ${card.room||'?'}
        </button>
      ` : `<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">Checked Out — Card ready to reuse</span>`}
    </div>`;
  }).join('');
}

function doCoCheckout(rfidEncoded) {
  const rfid = decodeURIComponent(rfidEncoded);
  const card = cards.find(c => c.rfid === rfid);
  if (!card) { toast('Card not found', true); return; }
  const refund = card.cashBalance || 0;
  addTxnRecord(card, 'Reception', '🏨 Guest checkout — Room '+(card.room||'?')+' — Refund '+fmt(refund), 0, 0, 'debit');
  if (db) db.ref('cards/'+fbKey(rfid)).remove();
  const idx = cards.findIndex(c => c.rfid === rfid);
  if (idx !== -1) cards.splice(idx, 1);
  lsSet(LS.cards, cards);
  toast('🏨 Room '+(card.room||'?')+' checked out · Refund: '+fmt(refund));
  renderClientsList(); refreshCardsTable();
  // Show success and clear
  const res = document.getElementById('co-result');
  const srch = document.getElementById('co-q');
  if (srch) srch.value = '';
  if (res) res.innerHTML = `<div style="padding:11px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;color:var(--gr);font-size:0.88rem;font-weight:700;">
    ✓ Room ${card.room||'?'} — ${card.name} checked out. ${refund>0?'Refund '+fmt(refund)+' cash to guest.':''} Card is free to reuse.
  </div>`;
  const cliDetail = document.getElementById('cli-detail');
  if (cliDetail && cliDetail.style.display!=='none') cliDetail.style.display='none';
}

function hotelCheckoutSearch() {
  const q = (document.getElementById('hco-search').value || '').trim().toLowerCase();
  const res = document.getElementById('hco-result');
  if (!q) { res.innerHTML = ''; return; }

  const allGuests = cards.filter(c => c.isGuest);
  const matches = allGuests.filter(c =>
    (c.room   && c.room.trim().toLowerCase() === q) ||
    (c.mobile && c.mobile.trim().includes(q))
  );

  if (allGuests.length === 0) {
    res.innerHTML = `<div style="padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:9px;color:#92400e;font-size:0.88rem;font-weight:600;">
      No hotel guests in system yet. Issue a guest card first.
    </div>`;
    return;
  }

  if (matches.length === 0) {
    const activeList = allGuests.filter(c => c.status === 'active')
      .map(c => `Room ${c.room||'?'} — ${c.name}`).join(' · ');
    res.innerHTML = `<div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:9px;color:var(--rd);font-size:0.88rem;font-weight:600;">
      No match for "<b>${q}</b>".
      ${activeList ? `<div style="margin-top:6px;font-weight:500;color:#555;font-size:0.82rem;">Active guests: ${activeList}</div>` : ''}
    </div>`;
    return;
  }

  res.innerHTML = matches.map(card => {
    const isActive = card.status === 'active';
    const bonusUsed = Math.max(0, 100 - (card.bonusBalance || 0));
    const rfidSafe = encodeURIComponent(card.rfid);
    return `<div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;">
      <div style="font-weight:800;font-size:1.05rem;color:var(--tx);margin-bottom:4px;">🏨 Room ${card.room||'?'} — ${card.name}</div>
      <div style="font-size:0.8rem;color:var(--mu);margin-bottom:10px;">${card.mobile||''} &nbsp;·&nbsp; Checked in: ${card.joined||'—'}</div>
      ${isActive ? `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.68rem;color:var(--mu);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Cash — Refund</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--gr);">${fmt(card.cashBalance||0)}</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.68rem;color:var(--mu);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Bonus — Expires</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--go);">${fmt(card.bonusBalance||0)}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.68rem;color:var(--mu);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Bonus Used</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--mu);">${fmt(bonusUsed)}</div>
          </div>
        </div>
        <div id="hco-confirm-${rfidSafe}" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:11px;margin-bottom:8px;font-size:0.88rem;">
          <b style="color:var(--rd);">Confirm checkout for Room ${card.room||'?'}?</b>
          Refund <b style="color:var(--gr);">${fmt(card.cashBalance||0)}</b> cash to guest. Bonus of <b style="color:var(--go);">${fmt(card.bonusBalance||0)}</b> will lapse.
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-gn" style="flex:1;" onclick="doHotelCheckout('${rfidSafe}')">✓ Yes, Checkout</button>
            <button class="btn btn-gh" onclick="document.getElementById('hco-confirm-${rfidSafe}').style.display='none'">Cancel</button>
          </div>
        </div>
        <button class="btn btn-rd btn-fw" onclick="document.getElementById('hco-confirm-${rfidSafe}').style.display='block'">
          Checkout Room ${card.room||'?'} →
        </button>
      ` : `<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:5px;font-size:0.8rem;font-weight:700;">Already Checked Out — Card ready to reuse</span>`}
    </div>`;
  }).join('');
}

function doHotelCheckout(rfidEncoded) {
  const rfid = decodeURIComponent(rfidEncoded);
  const card = cards.find(c => c.rfid === rfid);
  if (!card) { toast('Card not found', true); return; }
  const refund = card.cashBalance || 0;
  addTxnRecord(card, 'Reception', '🏨 Guest checkout — Room '+(card.room||'?')+' — Refund '+fmt(refund), 0, 0, 'debit');
  if (db) db.ref('cards/'+fbKey(rfid)).remove();
  const idx = cards.findIndex(c => c.rfid === rfid);
  if (idx !== -1) cards.splice(idx, 1);
  lsSet(LS.cards, cards);
  toast('🏨 Room '+(card.room||'?')+' checked out · Refund: '+fmt(refund));
  renderClientsList();
  refreshCardsTable();
  const hcoSearch = document.getElementById('hco-search');
  const hcoResult = document.getElementById('hco-result');
  if (hcoSearch) hcoSearch.value = '';
  if (hcoResult) hcoResult.innerHTML = `<div style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;color:var(--gr);font-size:0.88rem;font-weight:700;">
    ✓ Room ${card.room||'?'} — ${card.name} checked out. Refund: ${fmt(refund)}. Card is now free to reuse.
  </div>`;
}

function renderHotelDash() {
  const dateVal = document.getElementById('hotel-date').value; // 'YYYY-MM-DD' or ''
  const periodLabel = dateVal ? '— ' + dateVal : '— All Time';

  // ── Filter txns to the selected date ──────────────────────
  function inDate(timeStr) {
    if (!dateVal) return true;
    return timeStr && timeStr.startsWith(dateVal);
  }

  // ── All guest cards (active + checked-out) ─────────────────
  const guestCards = cards.filter(c => c.isGuest);

  // ── Activation txns (cards issued) ────────────────────────
  const activationTxns = txns.filter(t =>
    t.counter === 'Reception' && t.type === 'credit' &&
    t.desc && t.desc.includes('Room guest activation') &&
    inDate(t.time)
  );

  // ── Checkout txns ──────────────────────────────────────────
  const checkoutTxns = txns.filter(t =>
    t.counter === 'Reception' && t.type === 'debit' &&
    t.desc && t.desc.includes('Guest checkout') &&
    inDate(t.time)
  );

  // ── Active guests right now (ignore date filter) ───────────
  const activeGuests = cards.filter(c => c.isGuest && c.status === 'active');

  // ── KPIs ──────────────────────────────────────────────────
  const bonusIssued   = activationTxns.length * 100;
  const bonusUsed     = guestCards.reduce((s, c) => {
    // bonus used = 100 minus what's left, but only for cards activated in filter period
    const actTxn = txns.find(t => t.rfid === c.rfid && t.desc && t.desc.includes('Room guest activation') && inDate(t.time));
    if (!actTxn && dateVal) return s;
    const used = 100 - (c.status === 'checked-out' ? 0 : (c.bonusBalance || 0));
    return s + Math.max(0, used);
  }, 0);

  document.getElementById('hotel-kpis').innerHTML = `
    <div class="met"><div class="met-lbl">Cards Issued</div><div class="met-val">${activationTxns.length}</div><div class="met-sub">${periodLabel}</div></div>
    <div class="met"><div class="met-lbl">Active Guests</div><div class="met-val">${activeGuests.length}</div><div class="met-sub">checked in now</div></div>
    <div class="met"><div class="met-lbl">Checkouts</div><div class="met-val">${checkoutTxns.length}</div><div class="met-sub">${periodLabel}</div></div>
    <div class="met"><div class="met-lbl">Bonus Given</div><div class="met-val">₹${bonusIssued}</div><div class="met-sub">${periodLabel}</div></div>
    <div class="met"><div class="met-lbl">Bonus Used</div><div class="met-val">₹${Math.round(bonusUsed)}</div><div class="met-sub">at counters</div></div>
  `;

  // ── Active guests table ────────────────────────────────────
  const actEl = document.getElementById('hotel-active');
  if (activeGuests.length === 0) {
    actEl.innerHTML = '<tr><td colspan="8" class="empty">No active hotel guests right now</td></tr>';
  } else {
    actEl.innerHTML = activeGuests
      .sort((a,b) => (a.room||'').localeCompare(b.room||'', undefined, {numeric:true}))
      .map(c => {
        const bonusUsedByCard = Math.max(0, 100 - (c.bonusBalance || 0));
        const countersUsed = txns.filter(t => t.rfid === c.rfid && t.type === 'debit' && t.bonusAmt > 0)
          .map(t => t.counter).filter((v,i,a) => a.indexOf(v)===i).join(', ') || '—';
        return `<tr>
          <td><b style="color:var(--go);">${c.room||'—'}</b></td>
          <td>${c.name}</td>
          <td>${c.mobile||'—'}</td>
          <td style="font-family:monospace;font-size:0.78rem;">${c.cardLabel ? '<span style="color:var(--cy);font-weight:700;">'+c.cardLabel+'</span> <span style="color:var(--mu);font-size:0.7rem;">'+c.rfid+'</span>' : c.rfid}</td>
          <td style="font-size:0.8rem;">${c.joined||'—'}</td>
          <td style="color:var(--cy);">${fmt(c.cashBalance||0)}</td>
          <td style="color:var(--go);">${fmt(c.bonusBalance||0)}</td>
          <td style="color:${bonusUsedByCard>0?'var(--mg)':'var(--mu)'};">${bonusUsedByCard > 0 ? fmt(bonusUsedByCard) + ' (' + countersUsed + ')' : '—'}</td>
        </tr>`;
      }).join('');
  }

  // ── Cards issued table ─────────────────────────────────────
  document.getElementById('hotel-period-label').textContent = periodLabel;
  document.getElementById('hotel-bonus-period').textContent = periodLabel;
  document.getElementById('hotel-checkout-period').textContent = periodLabel;

  const issuedEl = document.getElementById('hotel-issued');
  if (activationTxns.length === 0) {
    issuedEl.innerHTML = '<tr><td colspan="7" class="empty">No guest cards issued' + (dateVal ? ' on this date' : '') + '</td></tr>';
  } else {
    // Sort by room number
    const sorted = [...activationTxns].sort((a,b) => {
      const ra = (a.desc.match(/Room (\S+)/)||[])[1]||'';
      const rb = (b.desc.match(/Room (\S+)/)||[])[1]||'';
      return ra.localeCompare(rb, undefined, {numeric:true});
    });
    issuedEl.innerHTML = sorted.map(t => {
      const roomMatch = t.desc.match(/Room (\S+)/);
      const room = roomMatch ? roomMatch[1] : '?';
      const card = cards.find(c => c.rfid === t.rfid);
      const status = card ? (card.status === 'checked-out' ? '<span style="color:#f87171;">Checked Out</span>' : '<span style="color:var(--gr);">Active</span>') : '<span style="color:var(--mu);">—</span>';
      return `<tr>
        <td style="font-size:0.8rem;">${t.time||'—'}</td>
        <td><b style="color:var(--go);">${room}</b></td>
        <td>${t.customer}</td>
        <td>${card ? card.mobile||'—' : '—'}</td>
        <td style="font-family:monospace;font-size:0.78rem;">${t.rfid}</td>
        <td style="color:var(--go);">₹${t.bonusAmt||100} ✓</td>
        <td>${status}</td>
      </tr>`;
    }).join('');
  }

  // ── Bonus usage table ──────────────────────────────────────
  // For each guest card activated in the period, show bonus breakdown
  const bonusRows = [];
  activationTxns.forEach(t => {
    const card = cards.find(c => c.rfid === t.rfid);
    const roomMatch = t.desc.match(/Room (\S+)/);
    const room = roomMatch ? roomMatch[1] : '?';
    const bonusGiven = t.bonusAmt || 100;
    const bonusLeft = card ? (card.status === 'checked-out' ? 0 : (card.bonusBalance || 0)) : 0;
    const bonusUsedAmt = bonusGiven - bonusLeft;
    // Find where bonus was spent
    const bonusDebitTxns = txns.filter(tx => tx.rfid === t.rfid && tx.type === 'debit' && tx.bonusAmt > 0);
    const countersUsed = bonusDebitTxns.map(tx => tx.counter).filter((v,i,a) => a.indexOf(v)===i).join(', ') || '—';
    const statusTxt = card ? (card.status === 'checked-out' ? 'Checked Out' : 'Active') : '—';
    bonusRows.push({room, name: t.customer, bonusGiven, bonusUsedAmt: Math.max(0, bonusUsedAmt), bonusLeft: Math.max(0, bonusLeft), countersUsed, statusTxt});
  });
  bonusRows.sort((a,b) => a.room.localeCompare(b.room, undefined, {numeric:true}));

  const bonusEl = document.getElementById('hotel-bonus');
  if (bonusRows.length === 0) {
    bonusEl.innerHTML = '<tr><td colspan="7" class="empty">No data' + (dateVal ? ' for this date' : '') + '</td></tr>';
  } else {
    bonusEl.innerHTML = bonusRows.map(r => `<tr>
      <td><b style="color:var(--go);">${r.room}</b></td>
      <td>${r.name}</td>
      <td style="color:var(--go);">₹${r.bonusGiven}</td>
      <td style="color:${r.bonusUsedAmt>0?'var(--mg)':'var(--mu)'};">${r.bonusUsedAmt > 0 ? fmt(r.bonusUsedAmt) : '—'}</td>
      <td style="color:${r.bonusLeft>0?'var(--go)':'var(--mu)'};">${r.bonusLeft > 0 ? fmt(r.bonusLeft) : '—'}</td>
      <td style="font-size:0.8rem;">${r.countersUsed}</td>
      <td style="color:${r.statusTxt==='Active'?'var(--gr)':'#f87171'};">${r.statusTxt}</td>
    </tr>`).join('');
  }

  // ── Checkout history table ─────────────────────────────────
  const coEl = document.getElementById('hotel-checkouts');
  if (checkoutTxns.length === 0) {
    coEl.innerHTML = '<tr><td colspan="5" class="empty">No checkouts' + (dateVal ? ' on this date' : '') + '</td></tr>';
  } else {
    const sortedCo = [...checkoutTxns].sort((a,b) => b.id - a.id);
    coEl.innerHTML = sortedCo.map(t => {
      const roomMatch = t.desc.match(/Room (\S+)/);
      const room = roomMatch ? roomMatch[1] : '?';
      // Find original activation to get bonus given
      const actTxn = txns.find(tx => tx.rfid === t.rfid && tx.desc && tx.desc.includes('Room guest activation'));
      const bonusGiven = actTxn ? (actTxn.bonusAmt || 100) : 100;
      // Refund amount: from checkout txn desc
      const refundMatch = t.desc.match(/Refund ([\d.]+)/);
      const refund = refundMatch ? parseFloat(refundMatch[1]) : 0;
      // Bonus lapsed = bonus given minus bonus spent before checkout
      const bonusSpent = txns.filter(tx => tx.rfid === t.rfid && tx.type === 'debit' && tx.bonusAmt > 0).reduce((s,tx)=>s+tx.bonusAmt,0);
      const bonusLapsed = Math.max(0, bonusGiven - bonusSpent);
      return `<tr>
        <td style="font-size:0.8rem;">${t.time||'—'}</td>
        <td><b style="color:var(--go);">${room}</b></td>
        <td>${t.customer}</td>
        <td style="color:var(--cy);">${refund > 0 ? fmt(refund) : '—'}</td>
        <td style="color:${bonusLapsed>0?'#f87171':'var(--mu)'};">${bonusLapsed > 0 ? fmt(bonusLapsed) + ' (expired)' : '—'}</td>
      </tr>`;
    }).join('');
  }
}

function refreshAdmin() {
  const isAdmin = me && me.role==='admin';
  const be=document.getElementById('btn-exp'); const br=document.getElementById('btn-rst');
  if(be) be.style.display=isAdmin?'':'none';
  if(br) br.style.display=isAdmin?'':'none';

  document.getElementById('m-cards').textContent = cards.length;
  const loaded = txns.filter(t=>t.counter==='Reception'&&t.type==='credit').reduce((s,t)=>s+t.cashAmt,0);
  document.getElementById('m-loaded').textContent = fmt(loaded);

  const amEl = document.getElementById('am-metrics');
  let totalRev = 0;
  if (amEl) {
    amEl.innerHTML = amenities.filter(a=>a.active).map(am=>{
      const rev = txns.filter(t=>t.counter===am.name&&t.type==='debit').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0);
      totalRev += rev;
      return `<div class="met"><div class="met-lbl">${am.name}</div><div class="met-val" style="font-size:0.95rem;">${fmt(rev)}</div></div>`;
    }).join('');
  }
  document.getElementById('m-rev').textContent = fmt(totalRev);

  // Update filter dropdown
  const fsel = document.getElementById('adm-filter');
  const curVal = fsel.value;
  fsel.innerHTML = '<option value="all">All Counters</option>' +
    ['Reception',...amenities.map(a=>a.name)].map(n=>`<option value="${n}" ${curVal===n?'selected':''}>${n}</option>`).join('');

  // Cards table
  const q = (document.getElementById('adm-csearch')||{}).value||'';
  const fc = q ? cards.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())||c.rfid.includes(q)||(c.mobile||'').includes(q)) : cards;
  document.getElementById('adm-cards').innerHTML = fc.length ? fc.map(c=>`
    <tr>
      <td>${c.name}</td>
      <td style="font-family:monospace;font-size:0.72rem;">${c.rfid}</td>
      <td style="color:var(--mu);font-size:0.74rem;">${c.mobile||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--cy);font-size:0.77rem;">${fmt(c.cashBalance)}</td>
      <td style="color:var(--go);font-size:0.77rem;">${fmt(c.bonusBalance)}</td>
      <td>${fmt(c.spent)}</td>
      <td style="color:var(--mu);font-size:0.7rem;">${c.joined}</td>
      <td>${isAdmin?`<button class="btn btn-rd btn-xs" onclick="deleteCard('${c.rfid}')">Delete</button>`:'—'}</td>
    </tr>`).join('') : '<tr><td colspan="8" class="empty">No cards found</td></tr>';

  // Txns table with counter + date filter
  const filter = fsel.value;
  const dateF  = (document.getElementById('adm-date-filter')||{}).value||'';
  let ft = filter==='all' ? txns : txns.filter(t=>t.counter===filter);
  if(dateF){
    // dateF is YYYY-MM-DD, t.time is like "27 Mar 2025, 03:45 pm"
    const [yr,mo,dy] = dateF.split('-');
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const moName = months[parseInt(mo)-1];
    ft = ft.filter(t=>t.time && t.time.toLowerCase().includes(dy+' '+moName) && t.time.includes(yr));
  }
  document.getElementById('adm-txns').innerHTML = ft.length ? ft.map(t=>`
    <tr>
      <td style="color:var(--mu);font-size:0.7rem;">${t.time}</td>
      <td>${t.customer}</td>
      <td><span class="badge ${badgeCls(t.counter)}">${t.counter}</span></td>
      <td style="font-size:0.79rem;">${t.desc}</td>
      <td class="${t.type==='credit'?'cr':'db'}">${t.type==='credit'?'+':'-'}${fmt(t.cashAmt)}</td>
      <td class="${t.bonusAmt>0?(t.type==='credit'?'cr':'dbb'):''}">${t.bonusAmt>0?(t.type==='credit'?'+':'-')+fmt(t.bonusAmt):'—'}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">No transactions</td></tr>';
}

function replaceCard(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  const REPLACEMENT_FEE = 100;

  openM('🔄 Replace Lost / Damaged Card',
    `<div style="font-size:0.85rem;line-height:1.9;">
      <div style="background:rgba(226,75,74,0.08);border:1px solid rgba(226,75,74,0.2);border-radius:9px;padding:11px;margin-bottom:12px;">
        <div style="font-weight:700;">${card.name}</div>
        <div style="color:var(--mu);font-size:0.78rem;">Old card: <span style="font-family:'JetBrains Mono',monospace;">${card.rfid}</span></div>
        <div style="color:var(--cy);font-size:0.82rem;margin-top:3px;">Cash balance: ${fmt(card.cashBalance)} &nbsp;·&nbsp; Bonus: ${fmt(card.bonusBalance)}</div>
      </div>
      <div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:9px;padding:11px;margin-bottom:12px;font-size:0.82rem;">
        ⚠ A replacement fee of <b style="color:var(--go);">₹${REPLACEMENT_FEE}</b> will be deducted from the card balance.<br>
        All existing balance and transaction history will be transferred to the new card.
      </div>
      <label class="f" style="margin-bottom:4px;">New Card ID <span style="color:var(--mu);font-size:0.75rem;">(tap or type manually)</span></label>
      <input type="text" id="rc-new-rfid" placeholder="e.g. GZ045" style="margin-bottom:10px;text-transform:uppercase;font-family:'JetBrains Mono',monospace;font-size:0.95rem;"
        oninput="this.value=this.value.toUpperCase()">
      <label class="f" style="margin-bottom:4px;">Replacement Fee Payment</label>
      <select id="rc-fee-pay" style="margin-bottom:10px;">
        <option value="deduct">Deduct ₹${REPLACEMENT_FEE} from card balance</option>
        <option value="cash">Paid separately in Cash</option>
        <option value="upi">Paid separately via UPI</option>
      </select>
      <label class="f" style="margin-bottom:4px;">Reason <span style="color:var(--mu);font-size:0.75rem;">(optional)</span></label>
      <select id="rc-reason" style="margin-bottom:0;">
        <option value="lost">Card lost</option>
        <option value="damaged">Card damaged / not reading</option>
        <option value="other">Other</option>
      </select>
    </div>`,
    [{label:'✓ Replace Card',cls:'btn-cy',fn:()=>{
      const newRfid = (document.getElementById('rc-new-rfid')||{}).value.trim().toUpperCase();
      if(!newRfid){ toast('Enter new card ID',true); return; }
      if(newRfid === card.rfid){ toast('New card ID is the same as the old one',true); return; }
      if(cards.find(c=>c.rfid===newRfid)){ toast('Card ID '+newRfid+' is already registered to another customer',true); return; }

      const feePay  = (document.getElementById('rc-fee-pay')||{}).value;
      const reason  = (document.getElementById('rc-reason')||{}).value;

      // Check sufficient balance if deducting
      if(feePay==='deduct' && card.cashBalance < REPLACEMENT_FEE){
        toast('Insufficient cash balance (₹'+card.cashBalance+') to deduct fee. Choose separate payment.',true); return;
      }

      // Snapshot old card for audit
      const oldRfid = card.rfid;
      const snap = {
        ...card,
        replacedAt: nowStr(),
        replacedBy: me ? me.name : 'Staff',
        replacedWith: newRfid,
        reason,
        feeMethod: feePay,
        deletedAt: nowStr(),
        deletedBy: me ? me.name : 'Staff',
        txnCount: txns.filter(t=>t.rfid===oldRfid).length
      };
      deletedCards.unshift(snap);
      lsSet(LS.deleted, deletedCards);
      if(db&&syncOk) db.ref('deleted_cards/'+fbKey(oldRfid)+'_'+Date.now()).set(snap);

      // Deduct fee from balance if selected
      if(feePay==='deduct') {
        card.cashBalance -= REPLACEMENT_FEE;
      }

      // Transfer to new card
      const newCard = {
        ...card,
        rfid: newRfid,
        joined: card.joined, // keep original join date
        replacedFrom: oldRfid,
        replacedAt: nowStr(),
      };

      // Remove old, add new
      cards = cards.filter(c=>c.rfid!==oldRfid);
      cards.push(newCard);

      // Update all transactions to new RFID
      txns.forEach(t=>{ if(t.rfid===oldRfid) t.rfid=newRfid; });

      // Update member linkage if any
      members.forEach(m=>{ if(m.cardId===oldRfid) { m.cardId=newRfid; } });
      lsSet(LS.members, members);
      if(db&&syncOk) db.ref('members').set(Object.fromEntries(members.map(m=>[m.id,m])));

      // Log replacement fee transaction
      addTxnRecord(newCard, 'Card Replacement',
        'Card replaced: '+oldRfid+' → '+newRfid+' ['+reason+']'+(feePay==='deduct'?' — ₹'+REPLACEMENT_FEE+' fee deducted':''),
        feePay==='deduct' ? REPLACEMENT_FEE : 0, 0, 'debit');

      persist('cards');
      lsSet(LS.txns, txns);
      if(db&&syncOk) {
        db.ref('cards/'+fbKey(oldRfid)).remove();
        db.ref('cards/'+fbKey(newRfid)).set(newCard);
        db.ref('txns').set(Object.fromEntries(txns.map(t=>[t.id,t])));
      }

      refreshAdmin(); refreshCardsTable(); renderClientsList();
      closeClientDetail();
      closeM();
      toast('Card replaced ✓ — '+oldRfid+' → '+newRfid+(feePay==='deduct'?' · ₹'+REPLACEMENT_FEE+' fee deducted':''));
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}],
    true
  );
}

function deleteCard(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  openM('Delete Card',
    `<div style="font-size:0.86rem;line-height:1.8;">Delete card for <b>${card.name}</b>?<br><span style="color:var(--mu);">${card.rfid} · Cash: ${fmt(card.cashBalance)} · Bonus: ${fmt(card.bonusBalance)}</span><br><br><span style="color:#f87171;">Cannot be undone. Transaction history kept.</span></div>`,
    [{label:'Yes, Delete',cls:'btn-rd',fn:()=>{
      cards = cards.filter(c=>c.rfid!==rfid);
      persist('cards');
      if(db) db.ref('cards/'+fbKey(rfid)).remove();
      refreshAdmin(); refreshCardsTable(); renderClientsList();
      closeClientDetail();
      closeM(); toast('Card deleted');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function confirmReset() {
  openM('⚠ Reset ALL Data',
    '<div style="color:var(--tx);">This permanently deletes ALL cards and transactions. Cannot be undone.</div>',
    [{label:'Yes, Delete Everything',cls:'btn-rd',fn:()=>{
      cards=[]; txns=[];
      lsSet(LS.cards,[]); lsSet(LS.txns,[]);
      if(db){db.ref('cards').remove();db.ref('txns').remove();}
      refreshAdmin(); refreshCardsTable(); closeM(); toast('All data cleared');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function exportCSV() {
  const filter = document.getElementById('adm-filter').value;
  const dateF  = (document.getElementById('adm-date-filter')||{}).value||'';
  let ft = filter==='all' ? txns : txns.filter(t=>t.counter===filter);
  if(dateF){
    const [yr,mo,dy]=dateF.split('-');
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const moName=months[parseInt(mo)-1];
    ft=ft.filter(t=>t.time&&t.time.toLowerCase().includes(dy+' '+moName)&&t.time.includes(yr));
  }
  if (!ft.length) { toast('No transactions to export', true); return; }
  downloadCSV(ft, 'LeoClub_Transactions_'+(dateF||new Date().toISOString().slice(0,10)));
  toast('Exported '+ft.length+' transactions');
}

function downloadCSV(rows, filename) {
  const headers = ['Date & Time','Customer','RFID','Mobile','Counter','Description','Cash Amount','Bonus Amount','Type','Cash Balance After'];
  const card4mobile = (rfid) => { const c=cards.find(x=>x.rfid===rfid); return c?c.mobile||'':''};
  const data = rows.map(t=>[
    t.time, t.customer, t.rfid, card4mobile(t.rfid), t.counter, t.desc,
    (t.type==='credit'?'+':'-')+(t.cashAmt||0),
    t.bonusAmt>0?(t.type==='credit'?'+':'-')+(t.bonusAmt||0):'',
    t.type, t.cashBalAfter||0
  ]);
  const csv = [headers,...data].map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = filename+'.csv'; a.click();
}

// ─── CLIENT INDIVIDUAL REPORT ───
function downloadClientReport(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  const ct = txns.filter(t=>t.rfid===rfid);
  const totalLoaded  = ct.filter(t=>t.counter==='Reception'&&t.type==='credit').reduce((s,t)=>s+t.cashAmt,0);
  const totalBowling = ct.filter(t=>t.counter==='Bowling').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0);
  const totalGZ      = ct.filter(t=>t.counter==='Game Zone').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0);
  const totalFood    = ct.filter(t=>t.counter==='Food & Beverages').reduce((s,t)=>s+(t.cashAmt||0),0);
  const totalBonus   = ct.filter(t=>t.type==='credit').reduce((s,t)=>s+(t.bonusAmt||0),0);

  const lines = [
    ['LEO CLUB — CLIENT REPORT','','','Managed by The Fern, Junagadh'],
    ['Report Generated',nowStr(),'',''],
    ['','','',''],
    ['CLIENT DETAILS','','',''],
    ['Name',card.name,'',''],
    ['Mobile',card.mobile||'—','',''],
    ['RFID Card',card.rfid,'',''],
    ['Member Since',card.joined,'',''],
    ['Status',card.status||'Active','',''],
    ['','','',''],
    ['WALLET SUMMARY','','',''],
    ['Current Cash Balance',card.cashBalance,'',''],
    ['Current Bonus Balance',card.bonusBalance,'',''],
    ['Total Cash Loaded',totalLoaded,'',''],
    ['Total Bonus Received',totalBonus,'',''],
    ['Total Amount Spent',card.spent,'',''],
    ['','','',''],
    ['SPENDING BREAKDOWN','','',''],
    ['Bowling',totalBowling,'',''],
    ['Game Zone',totalGZ,'',''],
    ['Food & Beverages',totalFood,'',''],
    ['','','',''],
    ['FULL TRANSACTION HISTORY','','',''],
    ['Date & Time','Counter','Description','Cash','Bonus','Type'],
    ...ct.map(t=>[
      t.time, t.counter, t.desc,
      (t.type==='credit'?'+':'-')+(t.cashAmt||0),
      t.bonusAmt>0?(t.type==='credit'?'+':'-')+(t.bonusAmt||0):'—',
      t.type
    ])
  ];
  const csv = lines.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'LeoClub_Client_'+card.name.replace(/\s+/g,'_')+'_'+card.rfid+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('Report downloaded for '+card.name);
}

// ─── DAILY FULL REPORT ───
function downloadDailyReport() {
  // Default to today
  const dateInput = document.getElementById('adm-date-filter');
  let dateF = dateInput ? dateInput.value : '';
  if(!dateF) {
    // Use today
    const now = new Date();
    dateF = now.toISOString().slice(0,10);
    if(dateInput) dateInput.value = dateF;
  }
  const [yr,mo,dy] = dateF.split('-');
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const moName=months[parseInt(mo)-1];
  const dayTxns = txns.filter(t=>t.time&&t.time.toLowerCase().includes(dy+' '+moName)&&t.time.includes(yr));

  if(!dayTxns.length){ toast('No transactions found for '+dy+'/'+mo+'/'+yr, true); return; }

  // Summary by counter
  const counters = [...new Set(dayTxns.map(t=>t.counter))];
  const summaryLines = [
    ['LEO CLUB — DAILY TRANSACTION REPORT','',''],
    ['Managed by The Fern, Junagadh','',''],
    ['Report Date', dy+'/'+mo+'/'+yr,''],
    ['Generated At', nowStr(),''],
    ['','',''],
    ['DAILY SUMMARY','',''],
    ['Total Transactions', dayTxns.length,''],
    ['Total Cash Collected', dayTxns.filter(t=>t.type==='debit').reduce((s,t)=>s+(t.cashAmt||0),0),''],
    ['','',''],
    ['── HISSAB CLARITY (GZ Card Accounting) ──','',''],
    ['Cash Physically Received (Recharges + Walk-in)', dayTxns.filter(t=>t.counter==='Reception'&&t.type==='credit').reduce((s,t)=>s+(t.cashAmt||0),0) + dayTxns.filter(t=>t.type==='debit'&&!(t.rfid&&t.rfid!=='WALKIN'&&t.counter!=='Reception')).reduce((s,t)=>s+(t.cashAmt||0),0),''],
    ['Wallet Loaded on GZ Cards (Total Recharged)', dayTxns.filter(t=>t.counter==='Reception'&&t.type==='credit').reduce((s,t)=>s+(t.cashAmt||0),0),''],
    ['Wallet Actually Spent by Guests', dayTxns.filter(t=>t.type==='debit'&&t.rfid&&t.rfid!=='WALKIN').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0),''],
    ['Wallet Balance Still on Cards (Liability)', Math.max(0,dayTxns.filter(t=>t.counter==='Reception'&&t.type==='credit').reduce((s,t)=>s+(t.cashAmt||0),0)-dayTxns.filter(t=>t.type==='debit'&&t.rfid&&t.rfid!=='WALKIN').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0)),''],
    ['NOTE: Recharge appears as SALES but unused portion stays as LIABILITY on card','',''],
    ['Total Loaded (Top-ups)', dayTxns.filter(t=>t.counter==='Reception'&&t.type==='credit').reduce((s,t)=>s+(t.cashAmt||0),0),''],
    ['','',''],
    ['REVENUE BY COUNTER','',''],
    ...counters.filter(c=>c!=='Reception').map(c=>{
      const rev=dayTxns.filter(t=>t.counter===c&&t.type==='debit').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0);
      return [c, rev, ''];
    }),
    ['','',''],
    ['UNIQUE CUSTOMERS TODAY', [...new Set(dayTxns.map(t=>t.rfid))].length,''],
    ['NEW CARDS ISSUED', dayTxns.filter(t=>t.counter==='Reception'&&t.type==='credit'&&t.desc.includes('activation')).length,''],
    ['','',''],
    ['FULL TRANSACTION LOG','',''],
    ['Date & Time','Customer','Mobile','RFID','Counter','Description','Cash','Bonus','Type'],
    ...dayTxns.map(t=>{
      const c=cards.find(x=>x.rfid===t.rfid);
      return [
        t.time, t.customer, c?c.mobile||'—':'—', t.rfid, t.counter, t.desc,
        (t.type==='credit'?'+':'-')+(t.cashAmt||0),
        t.bonusAmt>0?(t.type==='credit'?'+':'-')+(t.bonusAmt||0):'—',
        t.type
      ];
    })
  ];
  const csv = summaryLines.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'LeoClub_DailyReport_'+dateF+'.csv';
  a.click();
  toast('Daily report downloaded — '+dayTxns.length+' transactions on '+dy+'/'+mo+'/'+yr);
}


// ═══════════════════════════════════════════
//  SALES REPORTS
// ═══════════════════════════════════════════
function setReportDefaultDate() {
  const el = document.getElementById('rpt-date');
  if (el && !el.value) {
    // Default to yesterday
    const d = new Date(); d.setDate(d.getDate()-1);
    el.value = d.toISOString().slice(0,10);
  }
}

function txnInDate(t, dateStr) {
  // dateStr = YYYY-MM-DD
  if (!t.time) return false;
  const [yr,mo,dy] = dateStr.split('-');
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const moName = months[parseInt(mo)-1];
  const tl = t.time.toLowerCase();
  return tl.includes(dy+' '+moName) && tl.includes(yr);
}

function txnInMonth(t, dateStr) {
  if (!t.time) return false;
  const [yr,mo] = dateStr.split('-');
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const moName = months[parseInt(mo)-1];
  const tl = t.time.toLowerCase();
  return tl.includes(moName) && tl.includes(yr);
}

function getPaymentLabel(t) {
  // Prefer stored payMethod (set at transaction time)
  if (t.payMethod === 'upi')  return 'UPI';
  if (t.payMethod === 'cash') return 'Cash';
  if (t.payMethod === 'rfid') return 'RFID';
  // Fallback: infer from description
  const d = (t.desc||'').toLowerCase();
  if (d.includes('[upi]') || d.includes('upi')) return 'UPI';
  if (d.includes('[cash]') || d.includes('cash')) return 'Cash';
  if (d.includes('rfid') || d.includes('card') || d.includes('wallet')) return 'RFID';
  // Debit txns from non-Reception counters without payMethod = RFID wallet
  if (t.type === 'debit' && t.counter !== 'Reception') return 'RFID';
  if (t.type === 'credit' && t.counter === 'Reception') return 'Cash'; // legacy recharges assumed cash
  return 'RFID';
}

function buildCounterSummary(filteredTxns) {
  const COUNTER_ORDER = ['Bowling','Game Zone','Food & Beverages','Mini Theatre','Courts'];
  const allCounters = [...new Set(filteredTxns.map(t=>t.counter))];
  const counters = [...COUNTER_ORDER.filter(c=>allCounters.includes(c)), ...allCounters.filter(c=>!COUNTER_ORDER.includes(c)&&c!=='Reception')];

  let totalCash=0, totalUpi=0, totalRfid=0, grandTotal=0;

  const rows = counters.map(c=>{
    const cTxns = filteredTxns.filter(t=>t.counter===c && t.type==='debit');
    if (!cTxns.length) return null;
    const rfid = cTxns.filter(t=>getPaymentLabel(t)==='RFID').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0);
    const cash = cTxns.filter(t=>getPaymentLabel(t)==='Cash').reduce((s,t)=>s+(t.cashAmt||0),0);
    const upi  = cTxns.filter(t=>getPaymentLabel(t)==='UPI').reduce((s,t)=>s+(t.cashAmt||0),0);
    const total = rfid+cash+upi;
    totalCash+=cash; totalUpi+=upi; totalRfid+=rfid; grandTotal+=total;
    return {counter:c, rfid, cash, upi, total, count:cTxns.length};
  }).filter(Boolean);

  // ── Reception: recharge breakdown by payment method ──
  const rcpTxns = filteredTxns.filter(t=>t.counter==='Reception'&&t.type==='credit');
  const rechargeCash = rcpTxns.filter(t=>getPaymentLabel(t)!=='UPI').reduce((s,t)=>s+(t.cashAmt||0),0);
  const rechargeUpi  = rcpTxns.filter(t=>getPaymentLabel(t)==='UPI').reduce((s,t)=>s+(t.cashAmt||0),0);
  const rechargeTotal = rechargeCash + rechargeUpi;
  const newCards = rcpTxns.filter(t=>(t.desc||'').toLowerCase().includes('activ')).length;
  const checkouts = filteredTxns.filter(t=>t.counter==='Reception'&&(t.desc||'').toLowerCase().includes('checkout')).length;

  // ── Walk-in direct cash/UPI (non-RFID sales) ──
  const walkinTxns = filteredTxns.filter(t=>t.type==='debit'&&(getPaymentLabel(t)==='Cash'||getPaymentLabel(t)==='UPI'));
  const walkinCash = walkinTxns.filter(t=>getPaymentLabel(t)==='Cash').reduce((s,t)=>s+(t.cashAmt||0),0);
  const walkinUpi  = walkinTxns.filter(t=>getPaymentLabel(t)==='UPI').reduce((s,t)=>s+(t.cashAmt||0),0);

  // ── Wallet stats ──
  const walletLoaded = rechargeTotal; // cash put onto cards today
  const walletSpent  = filteredTxns.filter(t=>t.type==='debit'&&getPaymentLabel(t)==='RFID').reduce((s,t)=>s+(t.cashAmt||0)+(t.bonusAmt||0),0);

  // ── TOTAL CARD BALANCE currently on ALL active cards (liability) ──
  const totalCardBalance = cards.filter(c=>c.cashBalance>0||c.bonusBalance>0).reduce((s,c)=>s+(c.cashBalance||0)+(c.bonusBalance||0),0);
  const totalCardCash    = cards.filter(c=>c.cashBalance>0).reduce((s,c)=>s+(c.cashBalance||0),0);
  const totalCardBonus   = cards.filter(c=>c.bonusBalance>0).reduce((s,c)=>s+(c.bonusBalance||0),0);

  // ── Cash reconciliation ──
  // What you should have in hand = recharge cash + walk-in cash
  // What you should have in UPI = recharge UPI + walk-in UPI
  const reconcileCash = rechargeCash + walkinCash;
  const reconcileUpi  = rechargeUpi  + walkinUpi;

  return {rows, totalCash, totalUpi, totalRfid, grandTotal,
          rechargeCash, rechargeUpi, rechargeTotal, newCards, checkouts,
          walkinCash, walkinUpi, walletLoaded, walletSpent,
          totalCardBalance, totalCardCash, totalCardBonus,
          reconcileCash, reconcileUpi};
}

function renderReport() {
  const type    = document.getElementById('rpt-type').value;
  const dateStr = document.getElementById('rpt-date').value;
  if (!dateStr) { document.getElementById('rpt-output').innerHTML='<div class="n-cy">Please select a date.</div>'; return; }

  const filtered = type==='daily'
    ? txns.filter(t=>txnInDate(t,dateStr))
    : txns.filter(t=>txnInMonth(t,dateStr));

  const [yr,mo,dy] = dateStr.split('-');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const moFull   = months[parseInt(mo)-1];
  const periodLabel = type==='daily' ? dy+' '+moFull+' '+yr : moFull+' '+yr;

  if (!filtered.length) {
    document.getElementById('rpt-output').innerHTML=`<div class="card" style="padding:20px;text-align:center;color:var(--mu);">No transactions found for ${periodLabel}.</div>`;
    return;
  }

  const D = buildCounterSummary(filtered);
  const fmt2 = v => '₹'+v.toLocaleString('en-IN');
  const kpi = (lbl,val,color,sub='') =>
    `<div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 12px;text-align:center;">
       <div style="font-size:0.68rem;color:var(--mu);font-weight:700;letter-spacing:0.05em;margin-bottom:4px;">${lbl}</div>
       <div style="font-family:'JetBrains Mono',monospace;font-size:1.35rem;font-weight:800;color:${color};">${val}</div>
       ${sub?`<div style="font-size:0.7rem;color:var(--mu);margin-top:3px;">${sub}</div>`:''}
     </div>`;

  const counterRows = D.rows.map(r=>`
    <tr>
      <td style="font-weight:600;">${r.counter}</td>
      <td style="text-align:right;color:#7c3aed;">${r.rfid>0?fmt2(r.rfid):'—'}</td>
      <td style="text-align:right;color:var(--cy);">${r.cash>0?fmt2(r.cash):'—'}</td>
      <td style="text-align:right;color:var(--go);">${r.upi>0?fmt2(r.upi):'—'}</td>
      <td style="text-align:right;font-weight:800;color:var(--tx);">${fmt2(r.total)}</td>
      <td style="text-align:right;color:var(--mu);font-size:0.8rem;">${r.count}</td>
    </tr>`).join('');

  // Recharge detail rows
  const rcpTxns = filtered.filter(t=>t.counter==='Reception'&&t.type==='credit');
  const rcpRows = rcpTxns.map(t=>`
    <tr>
      <td style="font-size:0.78rem;color:var(--mu);">${t.time}</td>
      <td style="font-weight:600;">${t.customer||'—'}</td>
      <td>${t.desc||'—'}</td>
      <td style="text-align:right;color:var(--gr);font-weight:700;">${fmt2(t.cashAmt||0)}</td>
      <td style="text-align:right;color:var(--go);">${t.bonusAmt>0?'+'+fmt2(t.bonusAmt):'—'}</td>
      <td style="text-align:center;">
        <span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;font-weight:700;background:${getPaymentLabel(t)==='UPI'?'#fef3c7;color:#92400e':'#f0fdf4;color:#166534'};">
          ${getPaymentLabel(t)==='UPI'?'📱 UPI':'💵 Cash'}
        </span>
      </td>
    </tr>`).join('');

  // Walk-in direct sales
  const walkinTxns = filtered.filter(t=>t.type==='debit'&&(getPaymentLabel(t)==='Cash'||getPaymentLabel(t)==='UPI'));
  const walkinRows = walkinTxns.map(t=>`
    <tr>
      <td style="font-size:0.78rem;color:var(--mu);">${t.time}</td>
      <td style="font-weight:600;">${t.customer||'Walk-in'}</td>
      <td>${t.counter||'—'}</td>
      <td style="font-size:0.8rem;">${t.desc||'—'}</td>
      <td style="text-align:right;font-weight:700;">${fmt2(t.cashAmt||0)}</td>
      <td style="text-align:center;">
        <span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;font-weight:700;background:${getPaymentLabel(t)==='UPI'?'#fef3c7;color:#92400e':'#f0fdf4;color:#166534'};">
          ${getPaymentLabel(t)==='UPI'?'📱 UPI':'💵 Cash'}
        </span>
      </td>
    </tr>`).join('');

  const html = `<div id="report-printable">

  <!-- ── HEADER ── -->
  <div class="card" style="padding:16px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
    <div>
      <div style="font-size:1.1rem;font-weight:800;color:var(--tx);">🏆 LEO CLUB — ${type==='daily'?'DAILY':'MONTHLY'} REPORT</div>
      <div style="font-size:0.82rem;color:var(--mu);">The Fern · Junagadh</div>
      <div style="font-size:0.9rem;font-weight:700;color:var(--cy);margin-top:3px;">📅 ${periodLabel}</div>
    </div>
    <div style="text-align:right;font-size:0.75rem;color:var(--mu);">Generated: ${nowStr()}<br>By: ${me?me.name:'—'}</div>
  </div>

  <!-- ══ SECTION 1: REVENUE ══ -->
  <div class="card" style="padding:16px;margin-bottom:12px;">
    <div style="font-size:0.8rem;font-weight:800;color:var(--tx);letter-spacing:0.04em;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
      <span style="background:var(--cy);width:4px;height:16px;border-radius:2px;display:inline-block;"></span>
      SECTION 1 — BUSINESS REVENUE
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">
      ${kpi('TOTAL REVENUE',fmt2(D.grandTotal),'var(--gr)','all payment modes')}
      ${kpi('RFID WALLET',fmt2(D.totalRfid),'#7c3aed','spent from cards')}
      ${kpi('DIRECT CASH SALES',fmt2(D.totalCash),'var(--cy)','walk-in cash')}
      ${kpi('DIRECT UPI SALES',fmt2(D.totalUpi),'var(--go)','walk-in UPI')}
      ${kpi('TRANSACTIONS',D.rows.reduce((s,r)=>s+r.count,0),'var(--tx)','')}
      ${kpi('NEW CARDS',D.newCards,'var(--mg)','')}
    </div>

    <!-- Counter breakdown table -->
    <div style="font-size:0.78rem;font-weight:700;color:var(--mu);margin-bottom:8px;">COUNTER-WISE BREAKDOWN</div>
    <div style="overflow-x:auto;">
      <table class="tbl" style="min-width:480px;">
        <thead><tr>
          <th>Counter</th>
          <th style="text-align:right;">RFID Wallet</th>
          <th style="text-align:right;">💵 Cash</th>
          <th style="text-align:right;">📱 UPI</th>
          <th style="text-align:right;">Total</th>
          <th style="text-align:right;">Txns</th>
        </tr></thead>
        <tbody>
          ${counterRows}
          <tr style="border-top:2px solid var(--border);font-weight:800;background:var(--bg);">
            <td>TOTAL</td>
            <td style="text-align:right;color:#7c3aed;">${fmt2(D.totalRfid)}</td>
            <td style="text-align:right;color:var(--cy);">${fmt2(D.totalCash)}</td>
            <td style="text-align:right;color:var(--go);">${fmt2(D.totalUpi)}</td>
            <td style="text-align:right;font-size:1rem;color:var(--gr);">${fmt2(D.grandTotal)}</td>
            <td style="text-align:right;color:var(--mu);">${D.rows.reduce((s,r)=>s+r.count,0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ══ SECTION 2: CASH/UPI YOU SHOULD HAVE IN HAND ══ -->
  <div class="card" style="padding:16px;margin-bottom:12px;border-color:#bbf7d0;">
    <div style="font-size:0.8rem;font-weight:800;color:var(--tx);letter-spacing:0.04em;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
      <span style="background:var(--gr);width:4px;height:16px;border-radius:2px;display:inline-block;"></span>
      SECTION 2 — CASH &amp; UPI RECONCILIATION (what staff should have collected)
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <!-- CASH box -->
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:14px;">
        <div style="font-size:0.72rem;font-weight:800;color:#166534;letter-spacing:0.05em;margin-bottom:6px;">💵 TOTAL CASH TO COLLECT</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.6rem;font-weight:900;color:#15803d;">${fmt2(D.reconcileCash)}</div>
        <div style="margin-top:8px;font-size:0.78rem;color:#166534;line-height:2;">
          <div style="display:flex;justify-content:space-between;"><span>Recharges (cash)</span><span style="font-weight:700;">${fmt2(D.rechargeCash)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Walk-in cash sales</span><span style="font-weight:700;">${fmt2(D.walkinCash)}</span></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #86efac;padding-top:4px;font-weight:800;"><span>= Cash in hand</span><span>${fmt2(D.reconcileCash)}</span></div>
        </div>
      </div>
      <!-- UPI box -->
      <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:14px;">
        <div style="font-size:0.72rem;font-weight:800;color:#92400e;letter-spacing:0.05em;margin-bottom:6px;">📱 TOTAL UPI TO VERIFY</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.6rem;font-weight:900;color:#d97706;">${fmt2(D.reconcileUpi)}</div>
        <div style="margin-top:8px;font-size:0.78rem;color:#92400e;line-height:2;">
          <div style="display:flex;justify-content:space-between;"><span>Recharges (UPI)</span><span style="font-weight:700;">${fmt2(D.rechargeUpi)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Walk-in UPI sales</span><span style="font-weight:700;">${fmt2(D.walkinUpi)}</span></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #fcd34d;padding-top:4px;font-weight:800;"><span>= UPI in app</span><span>${fmt2(D.reconcileUpi)}</span></div>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:0.8rem;color:var(--mu);line-height:1.8;">
      <b>How to verify:</b> Count your cash drawer — it should be <b style="color:#15803d;">${fmt2(D.reconcileCash)}</b>. Open your UPI app and check today's received payments — total should be <b style="color:#d97706;">${fmt2(D.reconcileUpi)}</b>. Any difference means a missed entry.
    </div>
  </div>

  <!-- ══ SECTION 3: CARD BALANCE LIABILITY ══ -->
  <div class="card" style="padding:16px;margin-bottom:12px;border-color:#bfdbfe;">
    <div style="font-size:0.8rem;font-weight:800;color:var(--tx);letter-spacing:0.04em;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
      <span style="background:#2563eb;width:4px;height:16px;border-radius:2px;display:inline-block;"></span>
      SECTION 3 — RFID CARD WALLET STATUS (current liability)
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
      ${kpi('TOTAL LOADED TODAY',fmt2(D.walletLoaded),'var(--cy)','cash put on cards')}
      ${kpi('TOTAL SPENT TODAY',fmt2(D.walletSpent),'#7c3aed','used at counters')}
      ${kpi('TOTAL CASH BALANCE<br><span style="font-size:0.65rem;font-weight:500;">all active cards</span>',fmt2(D.totalCardCash),'#2563eb','unused cash wallet')}
      ${kpi('TOTAL BONUS BALANCE<br><span style="font-size:0.65rem;font-weight:500;">all active cards</span>',fmt2(D.totalCardBonus),'var(--go)','bonus (bowling/GZ only)')}
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;font-size:0.8rem;color:#1e40af;line-height:1.8;">
      <b>Card liability:</b> Guests have <b>${fmt2(D.totalCardCash)}</b> in cash + <b>${fmt2(D.totalCardBonus)}</b> bonus = <b>${fmt2(D.totalCardBalance)}</b> total sitting on cards. This is money already received but not yet earned (guests can still spend it).
    </div>
  </div>

  <!-- ══ SECTION 4: RECHARGE DETAIL ══ -->
  ${rcpTxns.length ? `
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 14px;font-weight:800;font-size:0.85rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span>RECHARGE LOG (${rcpTxns.length} recharges · ${fmt2(D.rechargeTotal)} total)</span>
      <span style="font-size:0.75rem;color:var(--mu);">💵 Cash: ${fmt2(D.rechargeCash)} &nbsp;|&nbsp; 📱 UPI: ${fmt2(D.rechargeUpi)}</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="tbl" style="min-width:500px;">
        <thead><tr><th>Time</th><th>Guest</th><th>Description</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Bonus</th><th style="text-align:center;">Payment</th></tr></thead>
        <tbody>${rcpRows}</tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- ══ SECTION 5: WALK-IN DIRECT SALES ══ -->
  ${walkinTxns.length ? `
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 14px;font-weight:800;font-size:0.85rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span>DIRECT SALES LOG — Cash &amp; UPI (${walkinTxns.length} entries)</span>
      <span style="font-size:0.75rem;color:var(--mu);">💵 ${fmt2(D.walkinCash)} &nbsp;|&nbsp; 📱 ${fmt2(D.walkinUpi)}</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="tbl" style="min-width:520px;">
        <thead><tr><th>Time</th><th>Guest</th><th>Counter</th><th>Description</th><th style="text-align:right;">Amount</th><th style="text-align:center;">Payment</th></tr></thead>
        <tbody>${walkinRows}</tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- ══ FULL LOG ══ -->
  <div class="card" style="padding:0;overflow:hidden;">
    <div style="padding:12px 14px;font-weight:800;font-size:0.85rem;border-bottom:1px solid var(--border);">FULL TRANSACTION LOG (${filtered.length} entries)</div>
    <div style="overflow-x:auto;">
      <table class="tbl" style="min-width:600px;">
        <thead><tr><th>Time</th><th>Guest</th><th>Counter</th><th>Description</th><th style="text-align:right;">Cash</th><th style="text-align:right;">Bonus</th><th>Pay</th></tr></thead>
        <tbody>
          ${filtered.map(t=>`
            <tr>
              <td style="font-size:0.78rem;color:var(--mu);white-space:nowrap;">${t.time}</td>
              <td style="font-weight:600;">${t.customer||'—'}</td>
              <td><span style="font-size:0.72rem;padding:2px 6px;border-radius:8px;background:var(--bg);font-weight:700;">${t.counter||'—'}</span></td>
              <td style="font-size:0.8rem;">${t.desc||'—'}</td>
              <td style="text-align:right;color:${t.type==='credit'?'var(--gr)':'var(--rd)'};">${t.type==='credit'?'+':'-'}${fmt2(t.cashAmt||0)}</td>
              <td style="text-align:right;color:var(--go);">${(t.bonusAmt||0)>0?(t.type==='credit'?'+':'-')+'₹'+(t.bonusAmt||0).toLocaleString('en-IN'):'—'}</td>
              <td style="font-size:0.75rem;">${t.payMethod?('📱 UPI'==='📱 '+t.payMethod.toUpperCase()||t.payMethod==='upi'?'📱':'💵')+(t.payMethod==='upi'?' UPI':t.payMethod==='cash'?' Cash':' RFID'):'—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
</div>`;

  document.getElementById('rpt-output').innerHTML = html;
}

function printReport() {
function printReport() {
  const content = document.getElementById('report-printable');
  if (!content) { toast('Generate a report first', true); return; }
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Leo Club Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:16px;}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}
    th{background:#f5f5f5;font-weight:700;}
    .card{border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:12px;}
    h2{font-size:15px;font-weight:800;margin-bottom:4px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;}
    .kpi{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center;}
    .kpi-val{font-size:18px;font-weight:800;}
    .kpi-lbl{font-size:10px;color:#666;font-weight:700;}
    @media print{body{padding:0;}}
  </style></head><body>`);
  const d = document.getElementById('rpt-date').value;
  const [yr,mo,dy] = d.split('-');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const moFull = months[parseInt(mo)-1];
  const type = document.getElementById('rpt-type').value;
  const periodLabel = type==='daily' ? dy+' '+moFull+' '+yr : moFull+' '+yr;
  w.document.write(`<h2>LEO CLUB — ${type==='daily'?'DAILY':'MONTHLY'} SALES REPORT</h2>`);
  w.document.write(`<p style="color:#666;font-size:11px;">Managed by The Fern · Junagadh &nbsp;|&nbsp; Period: ${periodLabel} &nbsp;|&nbsp; Generated: ${nowStr()}</p>`);
  w.document.write('<hr style="margin:10px 0;">');
  // Strip colors, copy table structure
  w.document.write(content.innerHTML.replace(/color:var\([^)]+\)/g,'').replace(/background:var\([^)]+\)/g,'background:#f9f9f9'));
  w.document.write('</body></html>');
  w.document.close();
  setTimeout(()=>{w.print();},400);
}


// ═══════════════════════════════════════════
//  BULK FIX: Assign GZ labels to untagged cards
// ═══════════════════════════════════════════
function openBulkGZFix() {
  const untagged = cards.filter(c => !c.isGuest && !c.cardLabel);
  if (!untagged.length) { toast('All cards already have labels assigned!'); return; }
  const rows = untagged.map((c,i) => `
    <tr>
      <td style="font-family:monospace;font-size:0.8rem;">${c.rfid}</td>
      <td style="font-weight:600;">${c.name}</td>
      <td>${c.mobile||'—'}</td>
      <td>
        <select id="gz-fix-${i}" style="margin-bottom:0;font-size:0.8rem;padding:3px 6px;">
          <option value="">— Skip —</option>
          ${Array.from({length:50},(_,n)=>{const l='GZ'+String(n+1).padStart(3,'0');return`<option value="${l}">${l}</option>`;}).join('')}
        </select>
      </td>
    </tr>`).join('');

  openM('Assign GZ Labels to Existing Cards',
    `<div style="font-size:0.82rem;color:var(--mu);margin-bottom:10px;">These cards have no GZ label. Select the printed card number for each guest. Cards already tapped and working don't need labels — only set if you need manual GZ search to work.</div>
     <div style="overflow-x:auto;"><table class="tbl">
       <thead><tr><th>RFID Chip</th><th>Name</th><th>Mobile</th><th>Assign GZ Label</th></tr></thead>
       <tbody>${rows}</tbody>
     </table></div>`,
    [{label:'Save Labels',cls:'btn-cy',fn:()=>{
      let saved=0;
      untagged.forEach((c,i)=>{
        const sel=document.getElementById('gz-fix-'+i);
        if(sel&&sel.value){
          c.cardLabel=sel.value;
          c.cardType='gz';
          saved++;
        }
      });
      if(saved){persist('cards');toast(saved+' card labels saved');renderClientsList();}
      else toast('No labels selected');
      closeM();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  AMENITIES
// ═══════════════════════════════════════════
function renderAmGrid() {
  const el = document.getElementById('am-grid'); if(!el) return;
  el.innerHTML = amenities.map((am,i)=>`
    <div class="am-card${am.active?'':' off'}">
      <div class="am-icon">${am.icon}</div>
      <div class="am-name">${am.name}</div>
      <div class="am-type">${am.type} · <span style="color:${am.bonusOk?'var(--go)':'var(--mg)'};">${am.bonusOk?'Bonus ok':'Cash only'}</span></div>
      <span class="badge ${am.active?'bg-gr':'bg-rd'}">${am.active?'ACTIVE':'DISABLED'}</span>
      <div class="am-acts">
        <button class="btn btn-xs btn-gh" onclick="editAm(${i})">Edit</button>
        <button class="btn btn-xs ${am.active?'btn-rd':'btn-gn'}" onclick="toggleAm(${i})">${am.active?'Disable':'Enable'}</button>
        ${['bowling','gamezone','food'].includes(am.id)?'':` <button class="btn btn-xs btn-rd" onclick="removeAm(${i})">Remove</button>`}
      </div>
    </div>`).join('');
}

function toggleAm(i) {
  amenities[i].active = !amenities[i].active;
  persist('amenities'); renderAmGrid(); buildCounterTabs();
  toast(amenities[i].name + ' ' + (amenities[i].active?'enabled':'disabled'));
}

function editAm(i) {
  const am = amenities[i];
  openM('Edit Amenity',
    `<label class="f">Name</label><input type="text" id="ea-n" value="${am.name}" style="margin-bottom:9px;">
     <label class="f">Icon (emoji)</label><input type="text" id="ea-i" value="${am.icon}" style="margin-bottom:9px;">
     <label class="f">Bonus Wallet Accepted?</label>
     <select id="ea-b" style="margin-bottom:9px;">
       <option value="1" ${am.bonusOk?'selected':''}>Yes — bonus wallet usable here</option>
       <option value="0" ${!am.bonusOk?'selected':''}>No — cash only</option>
     </select>`,
    [{label:'Save',cls:'btn-cy',fn:()=>{
      amenities[i].name = document.getElementById('ea-n').value.trim()||am.name;
      amenities[i].icon = document.getElementById('ea-i').value||am.icon;
      amenities[i].bonusOk = document.getElementById('ea-b').value==='1';
      persist('amenities'); renderAmGrid(); buildCounterTabs(); closeM(); toast('Amenity updated');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function removeAm(i) {
  openM('Remove Amenity',`<div>Remove <b>${amenities[i].name}</b>? Cannot be undone.</div>`,
    [{label:'Remove',cls:'btn-rd',fn:()=>{amenities.splice(i,1);persist('amenities');renderAmGrid();buildCounterTabs();closeM();toast('Removed');}},
     {label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function openAddAm() {
  openM('Add New Amenity',
    `<label class="f">Name</label><input type="text" id="na-n" placeholder="e.g. Theatre" style="margin-bottom:9px;">
     <label class="f">Icon (emoji)</label><input type="text" id="na-i" placeholder="🎭" style="margin-bottom:9px;">
     <label class="f">Type</label>
     <select id="na-t" style="margin-bottom:9px;">
       <option value="generic">Generic Counter (enter amount manually)</option>
       <option value="theatre">Theatre (seat map, 62 seats)</option>
     </select>
     <label class="f">Bonus Wallet Accepted?</label>
     <select id="na-b" style="margin-bottom:9px;">
       <option value="0">No — cash only</option><option value="1">Yes — bonus wallet usable</option>
     </select>`,
    [{label:'Add',cls:'btn-cy',fn:()=>{
      const name = document.getElementById('na-n').value.trim();
      if(!name){toast('Enter a name',true);return;}
      const type = document.getElementById('na-t').value;
      amenities.push({id:'am'+Date.now(),name,icon:document.getElementById('na-i').value||'🎯',type,color:'pu',active:true,bonusOk:document.getElementById('na-b').value==='1'});
      persist('amenities'); renderAmGrid(); buildCounterTabs(); closeM(); toast(name+' added!');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  BONUS PANEL
// ═══════════════════════════════════════════
function refreshBonusPanel() {
  const b = prices.bonus || {500:0,1000:100,2000:300,5000:1000};
  document.getElementById('b-wel').value  = prices.welcome||0;
  document.getElementById('b-500').value  = b[500]||0;
  document.getElementById('b-1000').value = b[1000]||100;
  document.getElementById('b-2000').value = b[2000]||300;
  document.getElementById('b-5000').value = b[5000]||1000;
  updateBonusPreview();
}

function updateBonusPreview() {
  const wb   = parseFloat(document.getElementById('b-wel').value)||0;
  const b500 = parseFloat(document.getElementById('b-500').value)||0;
  const b1k  = parseFloat(document.getElementById('b-1000').value)||0;
  const b2k  = parseFloat(document.getElementById('b-2000').value)||0;
  const b5k  = parseFloat(document.getElementById('b-5000').value)||0;

  const wp = document.getElementById('b-wel-prev');
  if(wp) wp.textContent = wb>0?'New cards get '+fmt(wb)+' welcome bonus':'Welcome bonus disabled (₹0)';

  const p1=document.getElementById('b-1000-p'); if(p1) p1.textContent=b1k>0?'₹1,000 → ₹1,000 cash + '+fmt(b1k)+' bonus':'No bonus';
  const p2=document.getElementById('b-2000-p'); if(p2) p2.textContent=b2k>0?'₹2,000 → ₹2,000 cash + '+fmt(b2k)+' bonus':'No bonus';
  const p5=document.getElementById('b-5000-p'); if(p5) p5.textContent=b5k>0?'₹5,000 → ₹5,000 cash + '+fmt(b5k)+' bonus':'No bonus';

  const pw = document.getElementById('b-preview');
  if(pw) pw.innerHTML = [
    {label:'Welcome (new card)',amt:wb,note:'on activation'},
    {label:'₹500 recharge',amt:b500,note:'per recharge'},
    {label:'₹1,000 recharge',amt:b1k,note:'per recharge'},
    {label:'₹2,000 recharge',amt:b2k,note:'per recharge'},
    {label:'₹5,000 recharge',amt:b5k,note:'per recharge'},
  ].map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
    <span style="font-size:0.83rem;">${r.label}</span>
    <span style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:${r.amt>0?'var(--go)':'var(--mu)'};">${r.amt>0?'+'+fmt(r.amt):'No bonus'}</span>
  </div>`).join('');

  updateWelcomeNotice();
}

function updateWelcomeNotice() {
  const wb = prices.welcome||0;
  const el = document.getElementById('i-welcome');
  if(el) el.textContent = wb>0?'★ Welcome bonus: +'+fmt(wb)+' on first activation':'';
}

function saveBonusSettings() {
  prices.welcome = parseFloat(document.getElementById('b-wel').value)||0;
  prices.bonus = {
    500:  parseFloat(document.getElementById('b-500').value)||0,
    1000: parseFloat(document.getElementById('b-1000').value)||0,
    2000: parseFloat(document.getElementById('b-2000').value)||0,
    5000: parseFloat(document.getElementById('b-5000').value)||0,
  };
  persist('prices'); updateBonusPreview(); updateWelcomeNotice();
  toast('★ Bonus settings saved');
}

let mbCard = null;
function lookupCard_mb() { lookupCard('mb'); }
function giveManualBonus() {
  const card = zoneCards.mb;
  if (!card) { toast('Tap or look up a card first', true); return; }
  const amt = parseFloat(document.getElementById('mb-amt').value)||0;
  if (amt<=0) { toast('Enter bonus amount', true); return; }
  const reason = document.getElementById('mb-reason').value.trim()||'Manual bonus';
  openM('Confirm Manual Bonus',
    `<div style="font-size:0.86rem;line-height:2;">Give <span style="color:var(--go);font-weight:700;">+${fmt(amt)} bonus</span> to <b>${card.name}</b>?<br>
    Reason: <span style="color:var(--mu);">${reason}</span><br>
    Bonus after: <span style="color:var(--go);">${fmt(card.bonusBalance+amt)}</span></div>`,
    [{label:'Give Bonus',cls:'btn-go',fn:()=>{
      card.bonusBalance+=amt;
      persist('cards');
      addTxnRecord(card,'Reception','Manual bonus — '+reason,0,amt,'credit');
      document.getElementById('mb-wc').innerHTML=walletHTML(card);
      document.getElementById('mb-amt').value='';
      document.getElementById('mb-reason').value='';
      closeM(); toast('★ '+fmt(amt)+' bonus given to '+card.name);
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════
function showRoleDesc() {
  const role = document.getElementById('nu-role').value;
  const el = document.getElementById('role-desc');
  if (!el) return;
  const descs = {
    staff:  'Can access Reception, Counter and Lookup. Can issue cards, top-up, and charge customers. Cannot delete, export, or change settings.',
    hotel:  'Hotel Reception only. Can issue new guest room cards (₹100 bonus auto-loaded), and check out guests (resets card for reuse). Cannot top-up cash, access counters, or view settings.',
    lookup: 'Can access Lookup (search card history) and Admin (view-only — no delete, no export).',
  };
  el.textContent = descs[role]||'';
}

function renderUsersList() {
  const el = document.getElementById('users-list'); if(!el) return;
  el.innerHTML = users.map((u,i)=>`
    <div class="u-row">
      <div><div class="u-n">${u.name}</div><div class="u-un">@${u.username}</div></div>
      <div style="display:flex;align-items:center;gap:7px;">
        <span class="badge ${u.role==='admin'?'bg-adm':u.role==='lookup'?'bg-lkp':u.role==='hotel'?'bg-htl':'bg-stf'}">${u.role==='admin'?'Admin':u.role==='lookup'?'Lookup':u.role==='hotel'?'🏨 Hotel':'Staff'}</span>
        ${u.username==='admin'
          ?`<button class="btn btn-xs btn-gh" onclick="chgAdminPwd()">Change Password</button>`
          :`<button class="btn btn-xs btn-gh" onclick="editUser(${i})">Edit</button>
            <button class="btn btn-xs btn-rd" onclick="delUser(${i})">Delete</button>`}
      </div>
    </div>`).join('');
}

function createUser() {
  const name  = document.getElementById('nu-name').value.trim();
  const uname = document.getElementById('nu-user').value.trim().toLowerCase();
  const pass  = document.getElementById('nu-pass').value;
  const role  = document.getElementById('nu-role').value;
  if(!name){toast('Enter name',true);return;}
  if(!uname){toast('Enter username',true);return;}
  if(!pass){toast('Enter password',true);return;}
  if(users.find(u=>u.username===uname)){toast('Username already taken',true);return;}
  const newUser = {id:'u'+Date.now(), name, username:uname, pwdHash:hashPwd(pass), role};
  users.push(newUser);
  localStorage.setItem('lc5_users', JSON.stringify(users));
  pushUserToFirebase(newUser);
  renderUsersList();
  document.getElementById('nu-name').value='';
  document.getElementById('nu-user').value='';
  document.getElementById('nu-pass').value='';
  toast('Account created for '+name+' — synced to both computers');
}

function editUser(i) {
  const u=users[i];
  openM('Edit Account',
    `<label class="f">Name</label><input type="text" id="eu-n" value="${u.name}" style="margin-bottom:9px;">
     <label class="f">New Password (blank = keep current)</label><input type="password" id="eu-p" placeholder="Leave blank to keep" style="margin-bottom:9px;" autocomplete="new-password">
     <label class="f">Role</label>
     <select id="eu-r" style="margin-bottom:9px;">
       <option value="staff" ${u.role==='staff'?'selected':''}>Staff</option>
       <option value="hotel" ${u.role==='hotel'?'selected':''}>Hotel Reception</option>
       <option value="lookup" ${u.role==='lookup'?'selected':''}>Lookup</option>
     </select>`,
    [{label:'Save',cls:'btn-cy',fn:()=>{
      users[i].name=document.getElementById('eu-n').value.trim()||u.name;
      const np=document.getElementById('eu-p').value;
      if(np){ users[i].pwdHash=hashPwd(np); delete users[i].password; }
      users[i].role=document.getElementById('eu-r').value;
      localStorage.setItem('lc5_users',JSON.stringify(users));
      pushUserToFirebase(users[i]);
      renderUsersList(); closeM(); toast('Account updated — synced to both computers');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function delUser(i) {
  openM('Delete Account',`<div>Delete <b>${users[i].name}</b>? They won't be able to login on any computer.</div>`,
    [{label:'Delete',cls:'btn-rd',fn:()=>{
      const uname=users[i].username;
      users.splice(i,1);
      localStorage.setItem('lc5_users',JSON.stringify(users));
      deleteUserFromFirebase(uname);
      renderUsersList(); closeM(); toast('Account deleted from all computers');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function chgAdminPwd() {
  openM('Change Admin Password',
    `<label class="f">Current Password</label><input type="password" id="cp-old" style="margin-bottom:9px;">
     <label class="f">New Password</label><input type="password" id="cp-new" style="margin-bottom:9px;">
     <label class="f">Confirm New Password</label><input type="password" id="cp-con" style="margin-bottom:9px;">`,
    [{label:'Change',cls:'btn-cy',fn:()=>{
      const admin=users.find(u=>u.username==='admin');
      const oldPwd=document.getElementById('cp-old').value;
      const valid = (admin.pwdHash && admin.pwdHash===hashPwd(oldPwd)) || (admin.password && admin.password===oldPwd);
      if(!valid){toast('Current password incorrect',true);return;}
      const np=document.getElementById('cp-new').value;
      if(!np){toast('Enter new password',true);return;}
      if(np!==document.getElementById('cp-con').value){toast('Passwords do not match',true);return;}
      admin.pwdHash=hashPwd(np); delete admin.password;
      localStorage.setItem('lc5_users',JSON.stringify(users));
      pushUserToFirebase(admin);
      closeM(); toast('Admin password changed on all computers');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  FULL MENU DATA MODEL
//  menuV2 = [{id,cat,icon,items:[{name,desc,price,hot}]}]
// ═══════════════════════════════════════════
const DEFAULT_MENU_V2 = [
  {id:'bakery',cat:'Bakery',icon:'🧁',items:[
    {name:'Donuts',desc:'Fresh baked daily',price:49,hot:false},
    {name:'Cupcake',desc:'Soft & delicious',price:69,hot:false},
    {name:'Muffins',desc:'Soft & fluffy',price:69,hot:false},
    {name:'Pastry',desc:'Flaky & buttery',price:99,hot:false},
    {name:'Brownie',desc:'Rich chocolate brownie',price:99,hot:false},
  ]},
  {id:'sandwich',cat:'Sandwich',icon:'🥪',items:[
    {name:'Veg Sandwich',desc:'Classic veg filling',price:99,hot:false},
    {name:'Cheese Sandwich',desc:'Loaded with cheese',price:119,hot:false},
    {name:'Coleslaw Sandwich',desc:'Creamy coleslaw',price:119,hot:false},
  ]},
  {id:'snacks',cat:'Snacks',icon:'🥐',items:[
    {name:'Samosa (2 Pcs)',desc:'Crispy golden samosa',price:80,hot:true},
    {name:'Chinese Puff',desc:'Chinese spiced puff pastry',price:60,hot:true},
    {name:'Masala Puff',desc:'Spiced masala puff pastry',price:60,hot:true},
  ]},
  {id:'coffee',cat:'Coffee',icon:'☕',items:[
    {name:'Cold Coffee',desc:'Chilled & refreshing',price:149,hot:false},
    {name:'Ice Coffee',desc:'Iced blended coffee',price:149,hot:false},
    {name:'Americano (Hot)',desc:'Bold & strong',price:149,hot:false},
    {name:'Cappuccino',desc:'Frothy espresso & milk',price:149,hot:false},
    {name:'Espresso Coffee (Hot)',desc:'Strong shot of espresso',price:149,hot:false},
    {name:'Red Bull Coffee',desc:'Energy + espresso blend',price:299,hot:false},
    {name:'Tonic Water Coffee',desc:'Refreshing coffee tonic',price:299,hot:false},
  ]},
  {id:'beverages',cat:'Beverages',icon:'🥤',items:[
    {name:'Soft Drinks',desc:'Pepsi / 7Up / Mirinda',price:60,hot:false},
    {name:'Mineral Water',desc:'500ml chilled',price:20,hot:false},
    {name:'Red Bull',desc:'250ml energy drink',price:149,hot:false},
  ]},
  {id:'combos',cat:'Combo Offers',icon:'🎁',items:[
    {name:'Sandwich + Cold Coffee',desc:'Save ₹10!',price:229,hot:false},
    {name:'Samosa + Coffee',desc:'Tea time combo',price:199,hot:false},
    {name:'Brownie + Ice Coffee',desc:'Sweet & chilled',price:219,hot:false},
  ]},
];

let menuV2 = null; // loaded from Firebase or default
let activeMenuCat = null; // currently selected category id in editor
let newItemHot = false;

function getMenuV2() { return menuV2 || DEFAULT_MENU_V2; }

function saveMenuV2ToFirebase() {
  try {
    const data = getMenuV2();
    lsSet('lc5_menu_v2', data);
    try {
      if (db) {
        const obj = {};
        data.forEach((cat, ci) => { obj['cat_'+ci] = {...cat, items: Object.fromEntries(cat.items.map((it,ii)=>['item_'+ii,it]))}; });
        db.ref('menu_v2').set(obj).then(()=>toast('✓ Menu saved & synced to all devices')).catch(e=>toast('Saved locally — will sync when online','err'));
      }
    } catch(fe) { /* Firebase offline — saved locally */ }
    menuItems = [];
    data.forEach(cat => cat.items.forEach(it => menuItems.push({cat:cat.cat, name:it.name, price:it.price})));
    persist('menu');
    renderFoodMenu();
  } catch(e) { console.error('saveMenuV2 error:', e); }
}

function loadMenuV2FromFirebase() {
  if (!db) return;
  db.ref('menu_v2').on('value', snap => {
    if (snap.val()) {
      const raw = snap.val();
      const parsed = Object.values(raw).map(cat => ({
        id: cat.id, cat: cat.cat, icon: cat.icon,
        items: cat.items ? Object.values(cat.items) : []
      })).filter(c => c.id && c.cat); // guard against malformed entries
      if (parsed.length) {
        menuV2 = parsed;
        lsSet('lc5_menu_v2', menuV2);
        // Sync flat menuItems for food counter
        menuItems = [];
        menuV2.forEach(cat => cat.items.forEach(it => menuItems.push({cat:cat.cat, name:it.name, price:it.price})));
        lsSet(LS.menu, menuItems);
        renderFoodMenu();
        if (document.getElementById('scr-settings').classList.contains('active')) renderMenuEditorV2();
      }
    } else {
      // menu_v2 doesn't exist in Firebase yet — seed it from DEFAULT_MENU_V2
      menuV2 = DEFAULT_MENU_V2;
      saveMenuV2ToFirebase();
      if (document.getElementById('scr-settings').classList.contains('active')) renderMenuEditorV2();
    }
  });
}

function refreshSettings() {
  document.getElementById('s-early').value = prices.early||199;
  document.getElementById('s-eve').value   = prices.eve||250;
  document.getElementById('s-wknd').value  = prices.wknd||300;
  document.getElementById('s-tok').value   = prices.token||20;
  // Court prices
  const cp = prices.courtPrices || {};
  const cr = cp.cricket    || {30:500,60:1000,90:1500,120:2000,180:3000};
  const bd = cp.badminton  || {30:400,60:800, 90:1200,120:1600,180:2400};
  const pb = cp.pickleball || {30:400,60:800, 90:1200,120:1600,180:2400};
  const op = cp.ownPaddle  || {30:300,60:600, 90:900, 120:1200,180:1800};
  [30,60,90,120,180].forEach(d => {
    const s = (id,v) => { const e=document.getElementById(id); if(e) e.value=v; };
    s('cp-cr-'+d, cr[d]||0);
    s('cp-bd-'+d, bd[d]||0);
    s('cp-pb-'+d, pb[d]||0);
    s('cp-op-'+d, op[d]||0);
  });
  // Always ensure menuV2 is populated — works offline and online
  if (!menuV2) {
    menuV2 = lsGet('lc5_menu_v2') || DEFAULT_MENU_V2;
  }
  setTimeout(() => {
    try { renderMenuEditorV2(); } catch(e) { console.error('renderMenuEditorV2 error:', e); }
  }, 50);
  renderCustomAmSettings();
}

function saveCourtPrices() {
  const gv = id => parseFloat((document.getElementById(id)||{}).value)||0;
  if (!prices.courtPrices) prices.courtPrices = {};
  prices.courtPrices.cricket    = {30:gv('cp-cr-30'), 60:gv('cp-cr-60'), 90:gv('cp-cr-90'), 120:gv('cp-cr-120'), 180:gv('cp-cr-180')};
  prices.courtPrices.badminton  = {30:gv('cp-bd-30'), 60:gv('cp-bd-60'), 90:gv('cp-bd-90'), 120:gv('cp-bd-120'), 180:gv('cp-bd-180')};
  prices.courtPrices.pickleball = {30:gv('cp-pb-30'), 60:gv('cp-pb-60'), 90:gv('cp-pb-90'), 120:gv('cp-pb-120'), 180:gv('cp-pb-180')};
  prices.courtPrices.ownPaddle  = {30:gv('cp-op-30'), 60:gv('cp-op-60'), 90:gv('cp-op-90'), 120:gv('cp-op-120'), 180:gv('cp-op-180')};
  // Apply to live COURTS object
  const cp = prices.courtPrices;
  COURTS.cricket.price30=cp.cricket[30];   COURTS.cricket.price60=cp.cricket[60];   COURTS.cricket.price90=cp.cricket[90];   COURTS.cricket.price120=cp.cricket[120];  COURTS.cricket.price180=cp.cricket[180];
  COURTS.badminton.price30=cp.badminton[30]; COURTS.badminton.price60=cp.badminton[60]; COURTS.badminton.price90=cp.badminton[90]; COURTS.badminton.price120=cp.badminton[120]; COURTS.badminton.price180=cp.badminton[180];
  COURTS.pickleball.price30=cp.pickleball[30]; COURTS.pickleball.price60=cp.pickleball[60]; COURTS.pickleball.price90=cp.pickleball[90]; COURTS.pickleball.price120=cp.pickleball[120]; COURTS.pickleball.price180=cp.pickleball[180];
  COURTS.pickleball.ownPaddle30=cp.ownPaddle[30]; COURTS.pickleball.ownPaddle60=cp.ownPaddle[60]; COURTS.pickleball.ownPaddle90=cp.ownPaddle[90]; COURTS.pickleball.ownPaddle120=cp.ownPaddle[120]; COURTS.pickleball.ownPaddle180=cp.ownPaddle[180];
  persist('prices');
  toast('✓ Court prices saved & applied');
}

// ── Full Menu Editor V2 ──────────────────────────────────
function renderMenuEditorV2() {
  const menu = getMenuV2();
  if (!activeMenuCat) activeMenuCat = menu[0]?.id || null;

  // Category tabs
  const tabsEl = document.getElementById('menu-cat-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = menu.map(cat =>
      `<button class="stab${cat.id===activeMenuCat?' active':''}" onclick="selectMenuCat('${cat.id}')" style="font-size:0.75rem;padding:5px 12px;">
        ${cat.icon} ${cat.cat}
        <span onclick="event.stopPropagation();deleteMenuCategory('${cat.id}')" style="margin-left:5px;color:#f87171;font-size:0.7rem;cursor:pointer;" title="Delete category">✕</span>
      </button>`
    ).join('');
    // Populate add-item category dropdown
    const sel = document.getElementById('nm-cat-sel');
    if (sel) {
      sel.innerHTML = '<option value="">— Select existing —</option>' +
        menu.map(cat => `<option value="${cat.id}">${cat.icon} ${cat.cat}</option>`).join('');
    }
  }

  // Items for active category
  const itemsEl = document.getElementById('menu-items-editor');
  if (!itemsEl) return;
  const cat = menu.find(c => c.id === activeMenuCat);
  if (!cat) { itemsEl.innerHTML = '<div class="empty">No category selected</div>'; return; }

  itemsEl.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">${cat.icon} ${cat.cat} — ${cat.items.length} items</div>
    <div style="display:grid;grid-template-columns:2fr 2fr 80px 36px 36px;gap:4px;align-items:center;margin-bottom:4px;padding:0 2px;">
      <div style="font-size:0.65rem;color:var(--mu);font-weight:700;">ITEM NAME</div>
      <div style="font-size:0.65rem;color:var(--mu);font-weight:700;">DESCRIPTION</div>
      <div style="font-size:0.65rem;color:var(--mu);font-weight:700;">PRICE ₹</div>
      <div style="font-size:0.65rem;color:var(--mu);font-weight:700;">🌶️</div>
      <div></div>
    </div>
    ${cat.items.map((item, ii) => `
    <div style="display:grid;grid-template-columns:2fr 2fr 80px 36px 36px;gap:4px;align-items:center;margin-bottom:4px;" id="menu-row-${cat.id}-${ii}">
      <input type="text" value="${item.name.replace(/"/g,'&quot;')}" style="margin-bottom:0;font-size:0.82rem;"
        onchange="updateMenuItemField('${cat.id}',${ii},'name',this.value)">
      <input type="text" value="${(item.desc||'').replace(/"/g,'&quot;')}" placeholder="Description" style="margin-bottom:0;font-size:0.78rem;"
        onchange="updateMenuItemField('${cat.id}',${ii},'desc',this.value)">
      <input type="number" value="${item.price}" style="margin-bottom:0;font-size:0.88rem;"
        onchange="updateMenuItemField('${cat.id}',${ii},'price',parseFloat(this.value)||0)">
      <div onclick="toggleMenuItemHot('${cat.id}',${ii})" title="Toggle spicy"
        style="cursor:pointer;text-align:center;font-size:1rem;border-radius:7px;padding:5px 2px;background:${item.hot?'#fee2e2':'#f8fafc'};border:1.5px solid ${item.hot?'#fca5a5':'var(--border)'};">
        ${item.hot?'🌶️':'·'}
      </div>
      <button class="delbtn" style="font-size:0.75rem;padding:5px 6px;" onclick="deleteMenuItem('${cat.id}',${ii})">✕</button>
    </div>`).join('')}
    <button class="btn btn-cy btn-sm" style="margin-top:6px;" onclick="saveMenuV2ToFirebase()">💾 Save All Changes</button>
  `;
}

function selectMenuCat(id) {
  activeMenuCat = id;
  renderMenuEditorV2();
}

function updateMenuItemField(catId, itemIdx, field, value) {
  const menu = getMenuV2();
  const cat = menu.find(c=>c.id===catId); if(!cat) return;
  cat.items[itemIdx][field] = value;
  menuV2 = menu;
  // Don't auto-save on every keystroke — user clicks Save button
}

function toggleMenuItemHot(catId, itemIdx) {
  const menu = getMenuV2();
  const cat = menu.find(c=>c.id===catId); if(!cat) return;
  cat.items[itemIdx].hot = !cat.items[itemIdx].hot;
  menuV2 = menu;
  saveMenuV2ToFirebase();
  renderMenuEditorV2();
}

function deleteMenuItem(catId, itemIdx) {
  const menu = getMenuV2();
  const cat = menu.find(c=>c.id===catId); if(!cat) return;
  const name = cat.items[itemIdx]?.name || 'item';
  openM('Delete Item', `<div>Remove <b>${name}</b> from ${cat.cat}?</div>`,
    [{label:'Delete',cls:'btn-rd',fn:()=>{ cat.items.splice(itemIdx,1); menuV2=menu; saveMenuV2ToFirebase(); renderMenuEditorV2(); closeM(); toast(name+' removed'); }},
     {label:'Cancel',cls:'btn-gh',fn:closeM}]);
}

function deleteMenuCategory(catId) {
  const menu = getMenuV2();
  const cat = menu.find(c=>c.id===catId); if(!cat) return;
  openM('Delete Category', `<div>Delete <b>${cat.icon} ${cat.cat}</b> and all ${cat.items.length} items in it? Cannot be undone.</div>`,
    [{label:'Delete',cls:'btn-rd',fn:()=>{
      menuV2 = menu.filter(c=>c.id!==catId);
      if(activeMenuCat===catId) activeMenuCat = menuV2[0]?.id||null;
      saveMenuV2ToFirebase(); renderMenuEditorV2(); closeM(); toast(cat.cat+' deleted');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]);
}

function toggleNewHot() {
  newItemHot = !newItemHot;
  const btn = document.getElementById('nm-hot-btn');
  const lbl = document.getElementById('nm-hot-status');
  if(btn) { btn.style.background=newItemHot?'#fee2e2':'#fff8f8'; btn.style.borderColor=newItemHot?'#fca5a5':'#fecaca'; }
  if(lbl) lbl.textContent = '🌶️ Spicy: '+(newItemHot?'ON':'OFF');
}

function addMenuItemFull() {
  const selCatId = (document.getElementById('nm-cat-sel')||{}).value;
  const newCatName = (document.getElementById('nm-cat-new')||{}).value.trim();
  const name  = (document.getElementById('nm-name')||{}).value.trim();
  const price = parseFloat((document.getElementById('nm-price')||{}).value)||0;
  const desc  = (document.getElementById('nm-desc')||{}).value.trim();
  if (!name) { toast('Enter item name', true); return; }
  if (!price) { toast('Enter price', true); return; }

  const menu = getMenuV2();
  let cat;
  if (newCatName) {
    // Create new category
    const newId = 'cat_'+Date.now();
    cat = {id:newId, cat:newCatName, icon:'🍽️', items:[]};
    menu.push(cat);
    activeMenuCat = newId;
  } else if (selCatId) {
    cat = menu.find(c=>c.id===selCatId);
    activeMenuCat = selCatId;
  } else {
    toast('Select a category or enter a new one', true); return;
  }
  if (!cat) { toast('Category not found', true); return; }
  cat.items.push({name, desc, price, hot: newItemHot});
  menuV2 = menu;
  saveMenuV2ToFirebase();
  renderMenuEditorV2();
  // Clear fields
  document.getElementById('nm-name').value='';
  document.getElementById('nm-price').value='';
  document.getElementById('nm-desc').value='';
  document.getElementById('nm-cat-new').value='';
  if(document.getElementById('nm-cat-sel')) document.getElementById('nm-cat-sel').value='';
  newItemHot=false; toggleNewHot(); toggleNewHot(); // reset visual
  toast('✓ '+name+' added — synced to Waiter & QR Menu');
}

function addMenuCategory() {
  const icon = (document.getElementById('nc-icon')||{}).value.trim()||'🍽️';
  const name = (document.getElementById('nc-name')||{}).value.trim();
  if (!name) { toast('Enter category name', true); return; }
  const menu = getMenuV2();
  const newId = 'cat_'+Date.now();
  menu.push({id:newId, cat:name, icon, items:[]});
  menuV2 = menu;
  activeMenuCat = newId;
  saveMenuV2ToFirebase();
  renderMenuEditorV2();
  document.getElementById('nc-icon').value='';
  document.getElementById('nc-name').value='';
  toast('✓ '+name+' category added');
}

function renderCustomAmSettings() {
  const el = document.getElementById('custom-am-settings'); if(!el) return;
  // Custom amenities = any that are NOT the 3 built-in ones
  const custom = amenities.filter(am => !['bowling','gamezone','food'].includes(am.id));
  if (!custom.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="sl" style="margin-top:6px;">Custom Amenity Settings</div>
    <div class="n-cy" style="margin-bottom:11px;">Configure pricing info and options for your custom amenities. These appear as counter tabs.</div>
    <div class="two-col">
      ${custom.map(am => {
        const cfg = (prices.customAm && prices.customAm[am.id]) || {};
        return `
        <div>
          <div class="sl" style="margin-top:0;">${am.icon} ${am.name}</div>
          <div class="card">
            <div style="font-size:0.75rem;color:var(--mu);margin-bottom:10px;">
              Status: <span class="badge ${am.active?'bg-gr':'bg-rd'}">${am.active?'ACTIVE':'DISABLED'}</span>
              &nbsp;·&nbsp; Bonus: <span style="color:${am.bonusOk?'var(--go)':'var(--mg)'};">${am.bonusOk?'Accepted':'Cash only'}</span>
            </div>
            <label class="f">Display Label (shown on receipt / transactions)</label>
            <input type="text" id="cas-lbl-${am.id}" value="${cfg.label||am.name}" placeholder="${am.name}" style="margin-bottom:9px;">
            <label class="f">Default Charge Amount (₹) — pre-fills counter field</label>
            <input type="number" id="cas-def-${am.id}" value="${cfg.defaultAmt||''}" placeholder="Leave blank for no default" style="margin-bottom:9px;" min="0">
            <label class="f">Price Info / Note (shown to staff at counter)</label>
            <input type="text" id="cas-note-${am.id}" value="${cfg.note||''}" placeholder="e.g. ₹200 per person per show" style="margin-bottom:9px;">
            <button class="btn btn-cy btn-sm" onclick="saveCustomAmSetting('${am.id}')">Save ${am.name} Settings</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function saveCustomAmSetting(amId) {
  const am = amenities.find(a=>a.id===amId); if(!am) return;
  if (!prices.customAm) prices.customAm = {};
  const lbl  = (document.getElementById('cas-lbl-'+amId)||{}).value||am.name;
  const def  = parseFloat((document.getElementById('cas-def-'+amId)||{}).value)||0;
  const note = (document.getElementById('cas-note-'+amId)||{}).value||'';
  prices.customAm[amId] = {label:lbl, defaultAmt:def, note};
  // Also update the amenity display name if label changed
  if (lbl && lbl !== am.name) { am.name = lbl; persist('amenities'); renderAmGrid(); buildCounterTabs(); }
  persist('prices');
  toast(am.name+' settings saved');
  renderCustomAmSettings();
}

function saveBowlingPrices() {
  prices.early = parseFloat(document.getElementById('s-early').value)||199;
  prices.eve   = parseFloat(document.getElementById('s-eve').value)||250;
  prices.wknd  = parseFloat(document.getElementById('s-wknd').value)||300;
  persist('prices');
  // Update displayed prices in bowling tab
  const ep=document.getElementById('bp-early'); if(ep) ep.textContent=fmt(prices.early);
  const evp=document.getElementById('bp-eve');  if(evp) evp.textContent=fmt(prices.eve);
  const wp=document.getElementById('bp-wknd');  if(wp) wp.textContent=fmt(prices.wknd);
  toast('Bowling prices saved');
}

function saveTokenRate() {
  prices.token = parseFloat(document.getElementById('s-tok').value)||20;
  persist('prices'); renderGZPackages(); toast('Token rate saved: ₹'+prices.token+' per token');
}

// Legacy stub — replaced by full menu editor V2
function renderMenuEditor() { renderMenuEditorV2(); }
function addMenuItem() { addMenuItemFull(); }
function delMenuItem(i) { menuItems.splice(i,1); persist('menu'); renderMenuEditorV2(); renderFoodMenu(); }

// ═══════════════════════════════════════════
//  CARDS TABLE
// ═══════════════════════════════════════════
function refreshCardsTable() {
  const el = document.getElementById('rcards-tbl'); if(!el) return;
  el.innerHTML = cards.length ?
    cards.slice().reverse().slice(0,20).map(c=>`
      <tr>
        <td>${c.name}</td>
        <td style="font-family:monospace;font-size:0.72rem;">${c.rfid}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--cy);">${fmt(c.cashBalance)}</td>
        <td style="font-size:0.75rem;color:var(--go);">${fmt(c.bonusBalance)}</td>
        <td><span class="badge bg-gr">ACTIVE</span></td>
      </tr>`).join('') :
    '<tr><td colspan="5" class="empty">No cards yet</td></tr>';
}

// Clear a specific counter zone after a successful charge
function clearCounterZone(zone) {
  zoneCards[zone] = null;
  const wEl = document.getElementById(zone+'-wc');
  const tEl = document.getElementById(zone+'-tap');
  if(wEl) { wEl.style.display='none'; wEl.innerHTML=''; }
  if(tEl) tEl.className='tap';
}
function clearManualLookup() {
  const mr = document.getElementById('manual-result');
  const ms = document.getElementById('manual-card-sel');
  const mm = document.getElementById('manual-mobile');
  if(mr) { mr.style.display='none'; mr.innerHTML=''; }
  if(ms) ms.value='';
  if(mm) mm.value='';
  // Clear all counter zone card state and wallet displays
  ['bowl','gz','food','th','ct'].forEach(z => {
    clearCounterZone(z);
  });
  // Clear generic amenity zones
  amenities.forEach(am => {
    if(!['bowling','gamezone','food','theatre'].includes(am.type)) {
      zoneCards[am.id] = null;
      const wEl = document.getElementById(am.id+'-wc');
      if(wEl) { wEl.style.display='none'; wEl.innerHTML=''; }
    }
  });
}

// ═══════════════════════════════════════════
//  GZ DROPDOWN REFRESH
// ═══════════════════════════════════════════
function refreshGZDropdown() {
  ['r-card-select','manual-card-sel'].forEach(selId => {
    const sel = document.getElementById(selId); if(!sel) return;
    const cur = sel.value;
    // Clear and rebuild
    while(sel.options.length > 1) sel.remove(1);
    for (let i=1; i<=999; i++) {
      const num = String(i).padStart(3,'0');
      const id  = 'GZ'+num;
      const opt = document.createElement('option');
      opt.value = id;
      // Match by cardLabel OR rfid (backwards compat with old cards that stored GZ as rfid)
      const alreadyUsed = cards.find(c =>
        (c.cardLabel && c.cardLabel.toUpperCase() === id) ||
        (c.rfid && c.rfid.toUpperCase() === id)
      );
      opt.textContent = alreadyUsed ? id+' — '+alreadyUsed.name : id;
      if (alreadyUsed) opt.style.color='rgba(78,203,138,0.6)';
      sel.appendChild(opt);
    }
    if(cur) sel.value = cur;
  });
}

// ═══════════════════════════════════════════
//  MANUAL COUNTER LOOKUP (no RFID reader)
// ═══════════════════════════════════════════
function manualLookupCounter() {
  const gzSel = document.getElementById('manual-card-sel').value.trim();
  const mob   = document.getElementById('manual-mobile').value.trim();
  const q = gzSel || mob;
  if (!q) { toast('Select a card number or enter mobile', true); return; }

  let card;
  if (gzSel) {
    // Match by cardLabel first (new cards), then fall back to rfid (old cards with GZ as rfid)
    card = cards.find(c =>
      (c.cardLabel && c.cardLabel.toUpperCase() === gzSel.toUpperCase()) ||
      (c.rfid && c.rfid.toUpperCase() === gzSel.toUpperCase())
    );
  } else {
    card = findCard(mob);
  }

  if (!card) { toast('No customer found with that card/mobile', true); return; }

  const res = document.getElementById('manual-result');
  res.style.display = 'block';
  res.innerHTML = walletHTML(card) +
    `<div class="n-cy" style="margin-top:8px;">Customer found: <b>${card.name}</b> — counter tabs below are now loaded. Go to the tab and charge directly.</div>`;

  // Auto-apply card to all counter zones so staff can charge directly
  ['bowl','gz','food','th','ct'].forEach(z => {
    zoneCards[z] = card;
    const wEl = document.getElementById(z+'-wc');
    const tEl = document.getElementById(z+'-tap');
    if(wEl){ wEl.style.display='block'; wEl.innerHTML=walletHTML(card); }
    if(tEl) tEl.className='tap ok';
  });
  // Also apply to generic amenity zones
  amenities.filter(a=>a.active&&!['bowling','gamezone','food','theatre'].includes(a.type)).forEach(am=>{
    zoneCards[am.id]=card;
    const wEl=document.getElementById(am.id+'-wc');
    if(wEl){wEl.style.display='block';wEl.innerHTML=walletHTML(card);}
  });
  if(typeof calcBowl==='function') calcBowl();
  toast('Customer loaded: '+card.name+' — proceed to counter tab');
}

// ═══════════════════════════════════════════
//  CLIENTS TAB
// ═══════════════════════════════════════════
function cardSection(c) {
  if (c.isGuest) return 'hotel';
  // Check cardLabel OR rfid field itself — some cards were issued with GZ number as rfid
  const lbl = (c.cardLabel||'').trim();
  const rfidVal = (c.rfid||'').trim();
  if (/^GZ\d+$/i.test(lbl) || /^GZ\d+$/i.test(rfidVal)) return 'gz';
  if (isMember(c.rfid)) return 'member';
  return 'other';
}

function getCardDisplayLabel(c) {
  // Show GZ number prominently — could be in cardLabel or rfid field
  const lbl = (c.cardLabel||'').trim();
  const rfidVal = (c.rfid||'').trim();
  if (/^GZ\d+$/i.test(lbl)) return lbl.toUpperCase();
  if (/^GZ\d+$/i.test(rfidVal)) return rfidVal.toUpperCase();
  return lbl || rfidVal;
}

function renderClientsList() {
  const q = ((document.getElementById('cli-search')||{}).value||'').toLowerCase().trim();
  const isAdmin = me && me.role==='admin';

  let filtered = q ? cards.filter(c=>
    c.name.toLowerCase().includes(q) ||
    (c.mobile||'').includes(q) ||
    c.rfid.toLowerCase().includes(q) ||
    (c.room||'').toLowerCase().includes(q) ||
    (c.cardLabel||'').toLowerCase().includes(q)
  ) : cards;

  filtered = [...filtered].sort((a,b)=>a.name.localeCompare(b.name));

  const hotel  = filtered.filter(c=>cardSection(c)==='hotel');
  const gz     = filtered.filter(c=>cardSection(c)==='gz').sort((a,b)=>{
    const la = getCardDisplayLabel(a); const lb = getCardDisplayLabel(b);
    const n1=parseInt(la.replace(/\D/g,'')||9999);
    const n2=parseInt(lb.replace(/\D/g,'')||9999);
    return n1-n2;
  });
  const mem    = filtered.filter(c=>cardSection(c)==='member');
  const other  = filtered.filter(c=>cardSection(c)==='other');

  const actBtns = (c) => `
    <button class="btn btn-xs btn-gh" onclick="viewClient('${c.rfid}')">View</button>
    ${c.isGuest && c.status==='active' ? `<button class="btn btn-xs btn-gn" onclick="guestCheckout('${c.rfid}')" style="margin-left:4px;">Checkout</button>` : ''}
    ${isAdmin ? `<button class="btn btn-xs btn-go" onclick="editClientCard('${c.rfid}')" style="margin-left:4px;">Edit</button>` : ''}`;

  // Hotel
  const hotelEl = document.getElementById('cli-tbl-hotel');
  document.getElementById('cli-count-hotel').textContent = hotel.length + ' guest' + (hotel.length!==1?'s':'');
  if (hotelEl) hotelEl.innerHTML = hotel.length ? hotel.map(c=>`
    <tr>
      <td style="font-weight:700;">${c.name}</td>
      <td><b style="color:var(--go);">Room ${c.room||'—'}</b></td>
      <td>${c.mobile||'—'}</td>
      <td style="font-family:monospace;font-size:0.75rem;color:var(--mu);">${c.cardLabel||c.rfid}</td>
      <td style="color:var(--cy);font-weight:700;">${fmt(c.cashBalance)}</td>
      <td style="color:var(--go);">${fmt(c.bonusBalance)}</td>
      <td><span style="padding:2px 8px;border-radius:10px;font-size:0.72rem;font-weight:700;background:${c.status==='active'?'rgba(22,163,74,0.15)':'rgba(148,163,184,0.15)'};color:${c.status==='active'?'var(--gr)':'var(--mu)'};">${(c.status||'active').toUpperCase()}</span></td>
      <td style="color:var(--mu);font-size:0.78rem;">${c.joined||'—'}</td>
      <td>${actBtns(c)}</td>
    </tr>`).join('') : '<tr><td colspan="9" class="empty">No hotel guests</td></tr>';

  // GZ
  const gzEl = document.getElementById('cli-tbl-gz');
  document.getElementById('cli-count-gz').textContent = gz.length + ' card' + (gz.length!==1?'s':'');
  // Detect duplicates (same cardLabel or same mobile)
  const gzLabels = {}; const gzMobiles = {};
  gz.forEach(c => {
    const lbl = getCardDisplayLabel(c);
    if (lbl) gzLabels[lbl] = (gzLabels[lbl]||0)+1;
    if (c.mobile) gzMobiles[c.mobile] = (gzMobiles[c.mobile]||0)+1;
  });
  if (gzEl) gzEl.innerHTML = gz.length ? gz.map(c=>{
    const lbl = getCardDisplayLabel(c);
    const isDup = (gzLabels[lbl]>1) || (c.mobile && gzMobiles[c.mobile]>1);
    return `<tr style="${isDup?'background:rgba(239,68,68,0.07);':''}">
      <td><span style="font-family:monospace;font-weight:800;font-size:1rem;color:var(--cy);">${lbl||'—'}</span>${isDup?` <span style="color:var(--rd);font-size:0.68rem;font-weight:700;">⚠ DUP</span>`:''}</td>
      <td style="font-weight:700;">${c.name}</td>
      <td>${c.mobile||'—'}</td>
      <td style="color:var(--cy);font-weight:700;">${fmt(c.cashBalance)}</td>
      <td style="color:var(--go);">${fmt(c.bonusBalance)}</td>
      <td>${fmt(c.spent||0)}</td>
      <td style="color:var(--mu);font-size:0.78rem;">${c.joined||'—'}</td>
      <td>${actBtns(c)}</td>
    </tr>`;}).join('') : '<tr><td colspan="8" class="empty">No GZ cards issued</td></tr>';

  // Members
  const memEl = document.getElementById('cli-tbl-mem');
  document.getElementById('cli-count-mem').textContent = mem.length + ' member' + (mem.length!==1?'s':'');
  if (memEl) memEl.innerHTML = mem.length ? mem.map(c=>`
    <tr>
      <td style="font-weight:700;">${c.name} <span style="color:var(--go);font-size:0.72rem;">👑</span></td>
      <td>${c.mobile||'—'}</td>
      <td style="font-family:monospace;font-size:0.75rem;color:var(--mu);">${c.rfid}</td>
      <td style="color:var(--cy);font-weight:700;">${fmt(c.cashBalance)}</td>
      <td style="color:var(--go);">${fmt(c.bonusBalance)}</td>
      <td>${fmt(c.spent||0)}</td>
      <td style="color:var(--mu);font-size:0.78rem;">${c.joined||'—'}</td>
      <td>${actBtns(c)}</td>
    </tr>`).join('') : '<tr><td colspan="8" class="empty">No club members</td></tr>';

  // Other
  const otherEl = document.getElementById('cli-tbl-other');
  document.getElementById('cli-count-other').textContent = other.length + ' card' + (other.length!==1?'s':'');
  if (otherEl) otherEl.innerHTML = other.length ? other.map(c=>`
    <tr>
      <td style="font-weight:700;">${c.name}</td>
      <td>${c.mobile||'—'}</td>
      <td style="font-family:monospace;font-size:0.75rem;color:var(--mu);">${c.cardLabel||c.rfid}</td>
      <td style="color:var(--cy);font-weight:700;">${fmt(c.cashBalance)}</td>
      <td style="color:var(--go);">${fmt(c.bonusBalance)}</td>
      <td>${fmt(c.spent||0)}</td>
      <td style="color:var(--mu);font-size:0.78rem;">${c.joined||'—'}</td>
      <td>${actBtns(c)}</td>
    </tr>`).join('') : '<tr><td colspan="8" class="empty">No walk-in cards</td></tr>';
}

function viewClient(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  const isAdmin = me && me.role==='admin';
  document.getElementById('cli-list-wrap').style.display='none';
  document.getElementById('cli-detail').style.display='block';
  document.getElementById('cli-detail-info').innerHTML=`
    <div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:700;">${card.name}${card.isGuest?` <span class="badge bg-go" style="font-size:0.65rem;">🏨 ROOM ${card.room||'?'}</span>`:''}</div>
    <div style="font-size:0.85rem;color:var(--mu);margin-top:3px;">${card.rfid} · 📱 ${card.mobile||'—'} · Member since ${card.joined}</div>
    <div style="margin-top:6px;"><span class="badge ${card.status==='checked-out'?'bg-rd':'bg-gr'}">${card.status==='checked-out'?'CHECKED OUT':'ACTIVE'}</span>&nbsp;<span style="font-size:0.82rem;color:var(--mu);">Total spent: <b style="color:var(--tx);">${fmt(card.spent)}</b></span></div>`;
  document.getElementById('cli-detail-wallets').innerHTML=walletHTML(card);
  document.getElementById('cli-detail-actions').innerHTML = isAdmin ? `
    ${card.isGuest && card.status!=='checked-out' ? `<button class="btn btn-gn btn-sm" onclick="guestCheckout('${rfid}')">🏨 Guest Checkout</button>` : ''}
    <button class="btn btn-go btn-sm" onclick="editClientCard('${rfid}')">✏ Edit Details</button>
    <button class="btn btn-cy btn-sm" onclick="adjustBalance('${rfid}')">₹ Adjust Balance</button>
    <button class="btn btn-cy btn-sm" onclick="replaceCard('${rfid}')">🔄 Replace Card</button>
    <button class="btn btn-gn btn-sm" onclick="downloadClientReport('${rfid}')">📥 Download Report</button>
    <button class="btn btn-rd btn-sm" onclick="deleteCard('${rfid}')">🗑 Delete</button>` :
    `<button class="btn btn-gn btn-sm" onclick="downloadClientReport('${rfid}')">📥 Download Report</button>`;

  const ct = txns.filter(t=>t.rfid===rfid);
  document.getElementById('cli-txn-tbl').innerHTML = ct.length ? ct.map(t=>`
    <tr>
      <td style="color:var(--mu);font-size:0.78rem;">${t.time}</td>
      <td><span class="badge ${badgeCls(t.counter)}">${t.counter}</span></td>
      <td style="font-size:0.85rem;">${t.desc}</td>
      <td class="${t.type==='credit'?'cr':'db'}">${t.type==='credit'?'+':'-'}${fmt(t.cashAmt)}</td>
      <td class="${t.bonusAmt>0?(t.type==='credit'?'cr':'dbb'):''}">${t.bonusAmt>0?(t.type==='credit'?'+':'-')+fmt(t.bonusAmt):'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--cy);">${fmt(t.cashBalAfter)}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">No transactions yet</td></tr>';
}

function closeClientDetail() {
  document.getElementById('cli-detail').style.display='none';
  document.getElementById('cli-list-wrap').style.display='block';
}

function editClientCard(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  openM('Edit Client Details',
    `<label class="f">Full Name</label><input type="text" id="ec-name" value="${card.name}" style="margin-bottom:10px;">
     <label class="f">Mobile Number (10 digits)</label><input type="text" id="ec-mobile" value="${card.mobile||''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)" style="margin-bottom:10px;">
     <label class="f">Card Label (e.g. GZ001) — for manual lookup</label><input type="text" id="ec-label" value="${card.cardLabel||''}" placeholder="e.g. GZ001" style="margin-bottom:10px;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()">
     <div style="font-size:0.8rem;color:var(--mu);margin-bottom:10px;">RFID Chip: <b>${card.rfid}</b> · Cash: <b>${fmt(card.cashBalance)}</b> · Bonus: <b>${fmt(card.bonusBalance)}</b></div>`,
    [{label:'Save Changes',cls:'btn-cy',fn:()=>{
      const newName   = document.getElementById('ec-name').value.trim();
      const newMobile = document.getElementById('ec-mobile').value.trim();
      const newLabel  = document.getElementById('ec-label').value.trim().toUpperCase();
      if(!newName){toast('Name cannot be empty',true);return;}
      if(newMobile && newMobile.length!==10){toast('Mobile must be 10 digits',true);return;}
      card.name   = newName;
      card.mobile = newMobile;
      if(newLabel) card.cardLabel = newLabel; else delete card.cardLabel;
      persist('cards'); closeM(); toast('Client details updated');
      renderClientsList(); refreshCardsTable();
      // Refresh detail view if open
      if(document.getElementById('cli-detail').style.display!=='none') viewClient(rfid);
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function adjustBalance(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  openM('Adjust Card Balance',
    `<div style="margin-bottom:12px;">${walletHTML(card)}</div>
     <label class="f">Adjustment Type</label>
     <select id="adj-type" style="margin-bottom:10px;">
       <option value="cash-add">Add to Cash Balance</option>
       <option value="cash-sub">Deduct from Cash Balance</option>
       <option value="bonus-add">Add to Bonus Balance</option>
       <option value="bonus-sub">Deduct from Bonus Balance</option>
     </select>
     <label class="f">Amount (₹)</label><input type="number" id="adj-amt" placeholder="Enter amount" style="margin-bottom:10px;">
     <label class="f">Reason (for records)</label><input type="text" id="adj-reason" placeholder="e.g. Manual correction, refund" style="margin-bottom:10px;">`,
    [{label:'Apply Adjustment',cls:'btn-cy',fn:()=>{
      const type   = document.getElementById('adj-type').value;
      const amt    = parseFloat(document.getElementById('adj-amt').value)||0;
      const reason = document.getElementById('adj-reason').value.trim()||'Manual adjustment';
      if(amt<=0){toast('Enter valid amount',true);return;}
      let cashChange=0, bonusChange=0;
      if(type==='cash-add')  { card.cashBalance+=amt;  cashChange=amt; }
      if(type==='cash-sub')  { if(card.cashBalance<amt){toast('Cash balance too low',true);return;} card.cashBalance-=amt; cashChange=-amt; }
      if(type==='bonus-add') { card.bonusBalance+=amt; bonusChange=amt; }
      if(type==='bonus-sub') { if(card.bonusBalance<amt){toast('Bonus balance too low',true);return;} card.bonusBalance-=amt; bonusChange=-amt; }
      if(cashChange!==0||bonusChange!==0){
        const isCredit=cashChange>0||bonusChange>0;
        addTxnRecord(card,'Reception','Admin adj: '+reason,Math.abs(cashChange),Math.abs(bonusChange),isCredit?'credit':'debit');
        persist('cards');
        toast('Balance adjusted for '+card.name);
        closeM(); renderClientsList(); refreshCardsTable();
        if(document.getElementById('cli-detail').style.display!=='none') viewClient(rfid);
      }
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function replaceCard(rfid) {
  const card = cards.find(c=>c.rfid===rfid); if(!card) return;
  // State for the replace modal tap zone
  let newCardId = '';

  openM('Replace RFID Card',
    `<div style="font-size:0.88rem;color:var(--mu);margin-bottom:14px;">
       Replacing physical card for <b style="color:var(--tx);">${card.name}</b>.<br>
       Old card <b>${card.rfid}</b> will be deactivated. All balance &amp; history transfers.
     </div>

     <div style="font-size:0.82rem;font-weight:600;color:var(--cy);margin-bottom:8px;">Step 1 — Tap the NEW physical card on the reader:</div>
     <div class="tap" id="rep-tap" onclick="activateRepTap()">
       <div class="tap-ic">📡</div>
       <div class="tap-lbl" id="rep-tap-lbl">TAP NEW CARD HERE</div>
       <div class="tap-sub" id="rep-tap-sub">Click here, then tap the new RFID card on reader</div>
     </div>

     <div style="font-size:0.82rem;font-weight:600;color:var(--cy);margin-bottom:8px;">— OR select card number manually —</div>
     <label class="f">Select New GZ Card Number</label>
     <select id="rep-card-sel" style="margin-bottom:10px;" onchange="onRepCardSelect()"><option value="">— Select GZ card —</option></select>

     <div id="rep-card-confirmed" style="display:none;background:rgba(0,255,136,0.07);border:1px solid rgba(0,255,136,0.25);border-radius:8px;padding:9px 12px;font-size:0.85rem;color:var(--gr);margin-bottom:10px;"></div>

     <input type="hidden" id="rep-new-rfid" value="">`,
    [{label:'Confirm Replacement',cls:'btn-cy',fn:()=>{
      const newRfid = document.getElementById('rep-new-rfid').value.trim();
      if(!newRfid){toast('Tap a new card or select a card number first',true);return;}
      if(newRfid===card.rfid){toast('New card cannot be the same as old card',true);return;}
      if(cards.find(c=>c.rfid===newRfid)){toast('That card is already registered to another customer',true);return;}
      const oldRfid = card.rfid;
      card.rfid = newRfid;
      txns.forEach(t=>{ if(t.rfid===oldRfid) t.rfid=newRfid; });
      if(db){ db.ref('cards/'+fbKey(oldRfid)).remove(); }
      persist('cards'); lsSet(LS.txns,txns);
      if(db&&syncOk){ txns.forEach(t=>{ if(t.rfid===newRfid) db.ref('txns/'+t.id).set(t); }); }
      addTxnRecord(card,'Reception','Card replaced: '+oldRfid+' → '+newRfid,0,0,'credit');
      // Remove tap listener
      window._repTapActive = false;
      closeM(); toast('Card replaced successfully for '+card.name);
      refreshGZDropdown(); renderClientsList(); refreshCardsTable();
      if(document.getElementById('cli-detail').style.display!=='none') viewClient(newRfid);
    }},{label:'Cancel',cls:'btn-gh',fn:()=>{window._repTapActive=false;closeM();}}],
    false
  );

  // Populate GZ dropdown after modal opens
  setTimeout(()=>{
    const rs = document.getElementById('rep-card-sel'); if(!rs) return;
    for(let i=1;i<=999;i++){
      const id='GZ'+String(i).padStart(3,'0');
      if(!cards.find(c=>c.rfid===id)){
        const o=document.createElement('option'); o.value=id; o.textContent=id; rs.appendChild(o);
      }
    }
    // Activate RFID tap listener for replace modal
    window._repTapActive = true;
  },60);
}

function activateRepTap(){
  window._repTapActive = true;
  const tz=document.getElementById('rep-tap'); if(!tz) return;
  tz.className='tap wait';
  document.getElementById('rep-tap-lbl').textContent='WAITING FOR CARD TAP…';
  document.getElementById('rep-tap-sub').textContent='Now tap the new physical RFID card on the reader';
  toast('Ready — tap the new card now');
}

function setRepCard(id){
  const tz=document.getElementById('rep-tap');
  const conf=document.getElementById('rep-card-confirmed');
  const hi=document.getElementById('rep-new-rfid');
  const sel=document.getElementById('rep-card-sel');
  if(!hi) return;
  hi.value=id;
  if(tz){ tz.className='tap ok'; }
  const lbl=document.getElementById('rep-tap-lbl'); if(lbl) lbl.textContent='✓ NEW CARD DETECTED';
  const sub=document.getElementById('rep-tap-sub'); if(sub) sub.textContent='Card ID: '+id+' — ready to replace';
  if(conf){ conf.style.display='block'; conf.textContent='✓ New card ready: '+id; }
  if(sel) sel.value='';
  toast('New card detected: '+id);
}

function onRepCardSelect(){
  const sel=document.getElementById('rep-card-sel'); if(!sel||!sel.value) return;
  setRepCard(sel.value);
  const tz=document.getElementById('rep-tap'); if(tz) tz.className='tap ok';
}
// ═══════════════════════════════════════════════════════════════════
//  THEATRE MODULE
// ═══════════════════════════════════════════════════════════════════

function buildTheatreHtml(am) {
  // If no show is active, auto-select first show
  if(!activeShowId && showSchedule.length) {
    activeShowId = showSchedule[0].id;
  }
  if(activeShowId) initTheatreSeats(activeShowId);
  const premPrice = (prices.theatre && prices.theatre.premium) || 350;
  const stdPrice  = (prices.theatre && prices.theatre.standard) || 300;
  const totalSeats = THEATRE_ROWS.reduce((s,r)=>s+r.seats,0);
  const currentSeats = getShowSeats(activeShowId);
  const bookedCount = Object.values(currentSeats).filter(v=>seatStatus(v)==='booked').length;
  const heldCount   = Object.values(currentSeats).filter(v=>seatStatus(v)==='held').length;
  const availCount  = totalSeats - bookedCount - heldCount - Object.values(currentSeats).filter(v=>seatStatus(v)==='blocked').length;

  return `
  <!-- NOW SHOWING BAR -->
  <div id="th-now-showing-bar" style="background:linear-gradient(135deg,rgba(109,143,255,0.10),rgba(91,191,255,0.1));border:1px solid rgba(91,191,255,0.3);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:none;"></div>

  <!-- SHOW SCHEDULE -->
  <div class="card" style="padding:13px;margin-bottom:12px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;letter-spacing:0.15em;color:var(--mg);margin-bottom:11px;">🎬 SHOW SCHEDULE</div>
    <!-- Add new show row -->
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:7px;align-items:end;margin-bottom:11px;">
      <div>
        <label class="f" style="margin-bottom:3px;">Movie Name</label>
        <input type="text" id="th-new-movie" placeholder="e.g. Pushpa 2" style="margin-bottom:0;font-size:0.92rem;">
      </div>
      <div>
        <label class="f" style="margin-bottom:3px;">Show Time</label>
        <input type="text" id="th-new-time" placeholder="e.g. 7:00 PM" style="margin-bottom:0;font-size:0.92rem;">
      </div>
      <div>
        <label class="f" style="margin-bottom:3px;">Date</label>
        <input type="date" id="th-new-date" style="margin-bottom:0;font-size:0.92rem;">
      </div>
      <button class="btn btn-mg" onclick="addShow()" style="padding:10px 14px;white-space:nowrap;">+ Add Show</button>
    </div>
    <!-- Schedule list -->
    <div style="font-size:0.72rem;color:var(--mu);margin-bottom:7px;letter-spacing:0.08em;text-transform:uppercase;">Tap a show to make it active for booking</div>
    <div id="th-schedule-list"></div>
  </div>

  <div class="two-col">
    <div>
      <!-- Payment mode -->
      <div class="sl">Payment Method</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="btn btn-sm" id="th-pm-rfid" onclick="setTheatrePayMode('rfid')" style="flex:1;background:rgba(78,203,138,0.15);border:1.5px solid var(--cy);color:var(--cy);">📡 RFID Wallet</button>
        <button class="btn btn-sm" id="th-pm-cash" onclick="setTheatrePayMode('cash')" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:var(--mu);">💵 Cash</button>
        <button class="btn btn-sm" id="th-pm-upi"  onclick="setTheatrePayMode('upi')"  style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:var(--mu);">📱 UPI</button>
      </div>
      <!-- RFID tap -->
      <div class="tap" id="th-tap" onclick="activateTap('th')">
        <div class="tap-ic">📡</div><div class="tap-lbl">TAP CUSTOMER CARD</div><div class="tap-sub">wallet charged per seat</div>
      </div>
      <div id="th-wc" style="display:none;"></div>

      <!-- Seat stats -->
      <div class="met-grid" style="grid-template-columns:repeat(4,1fr);margin-top:8px;">
        <div class="met"><div class="met-lbl">Total</div><div class="met-val" id="th-total-count">${totalSeats}</div><div class="met-sub">seats</div></div>
        <div class="met"><div class="met-lbl">Available</div><div class="met-val" id="th-avail-count" style="color:var(--gr);">${availCount}</div><div class="met-sub">open</div></div>
        <div class="met"><div class="met-lbl">Booked</div><div class="met-val" id="th-booked-count" style="color:#f87171;">${bookedCount}</div><div class="met-sub">taken</div></div>
        <div class="met" id="th-held-met" style="display:none;"><div class="met-lbl">On Hold</div><div class="met-val" id="th-held-count" style="color:#ffa500;">0</div><div class="met-sub">held</div></div>
      </div>

      <!-- Prices -->
      <div class="theatre-prices" style="margin-top:10px;">
        <div class="tp premium"><div class="tp-price">₹${premPrice}</div><div class="tp-lbl">★ Premium Row (8 seats)</div></div>
        <div class="tp standard"><div class="tp-price">₹${stdPrice}</div><div class="tp-lbl">Standard Rows A–F (9 seats)</div></div>
      </div>

      <!-- Legend -->
      <div class="theatre-legend">
        <div class="leg-item"><div class="leg-dot" style="background:rgba(255,215,0,0.25);border:2px solid rgba(255,215,0,0.6);"></div><span>★ Premium</span></div>
        <div class="leg-item"><div class="leg-dot" style="background:rgba(78,203,138,0.12);border:2px solid rgba(78,203,138,0.6);"></div><span>Available</span></div>
        <div class="leg-item"><div class="leg-dot" style="background:linear-gradient(135deg,var(--pu),var(--mg));"></div><span>Selected ✓</span></div>
        <div class="leg-item"><div class="leg-dot" style="background:rgba(226,75,74,0.2);border:2px solid rgba(226,75,74,0.5);"></div><span>Booked ✗</span></div>
        <div class="leg-item"><div class="leg-dot" style="background:rgba(255,165,0,0.2);border:2px solid rgba(255,165,0,0.6);"></div><span>On Hold 🟠</span></div>
      </div>

      <!-- Selection summary -->
      <div class="theatre-summary" id="th-sel-summary" style="display:none;">
        <div style="font-size:0.78rem;color:var(--mu);margin-bottom:5px;">SELECTED SEATS</div>
        <div id="th-sel-list" style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:var(--mg);margin-bottom:8px;line-height:1.6;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:7px;">
          <div style="font-size:0.95rem;">Total: <b id="th-sel-total" style="color:var(--cy);font-family:'JetBrains Mono',monospace;"></b></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-rd btn-xs" onclick="theatreClearSelection()">✕ Clear</button>
            <button class="btn btn-go btn-sm" onclick="holdSelectedSeats()">🟠 Hold</button>
            <button class="btn btn-mg btn-sm" onclick="theatreConfirmBooking()">✓ Book</button>
          </div>
        </div>
      </div>

      <!-- Recent bookings -->
      <div class="sl" style="margin-top:12px;">Recent Bookings</div>
      <div class="card" style="padding:11px;"><div id="th-recent"><div class="empty">No bookings yet</div></div></div>
    </div>

    <div>
      <!-- Seat map — screen at BOTTOM, premium/back at top -->
      <div class="theatre-wrap">
        <div style="text-align:center;margin-bottom:6px;">
          <span style="font-size:0.62rem;letter-spacing:0.18em;color:var(--mu);text-transform:uppercase;">← BACK OF THEATRE →</span>
        </div>
        <div id="th-seat-map"></div>
        <!-- SCREEN at bottom (near Row F) -->
        <div style="margin-top:14px;">
          <div class="screen-bar"></div>
          <div class="screen-lbl" style="font-size:0.78rem;letter-spacing:0.15em;padding:5px 0;background:rgba(78,203,138,0.08);border-radius:6px;">
            📽️ &nbsp; S C R E E N &nbsp; 📽️
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderTheatreMap() {
  const el = document.getElementById('th-seat-map'); if(!el) return;
  const premPrice = (prices.theatre && prices.theatre.premium) || 350;
  const stdPrice  = (prices.theatre && prices.theatre.standard) || 300;
  el.innerHTML = '';
  // Render from top row (back) down to Row F (screen side)
  // Seats numbered right-to-left: seat 1 is on the RIGHT (aisle side), seat 9 on LEFT
  THEATRE_ROWS.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'seat-row';
    const lbl = document.createElement('div');
    lbl.className = 'seat-row-lbl';
    lbl.textContent = row.label;
    rowDiv.appendChild(lbl);
    // Loop from highest to lowest so seat 1 appears on the right
    for(let s=row.seats; s>=1; s--) {
      const sid = row.id+'-'+s;
      const _showSeats = getShowSeats(activeShowId);
      const rawVal = _showSeats[sid];
      const status = seatStatus(rawVal);
      const meta   = seatMeta(rawVal);
      const seat = document.createElement('div');
      seat.className = 'seat ' + row.cls + ' ' + status;
      seat.textContent = s;
      const basePrice = '₹'+(row.id==='TOP'?premPrice:stdPrice);
      if(status==='available') {
        seat.title = 'Row '+row.label+' Seat '+s+' — '+basePrice+' — Click to select';
        seat.addEventListener('click', ()=>theatreToggleSeat(sid));
      } else if(status==='booked') {
        const bk = theatreBookings.find(b=>b.showId===activeShowId && b.seats.includes(sid));
        seat.title = 'BOOKED — '+(bk?bk.customer:'Unknown')+' | Click to cancel/manage';
        seat.style.cursor='pointer';
        seat.addEventListener('click', ()=>openSeatAction(sid, rawVal, row, s));
      } else if(status==='held') {
        seat.title = 'HELD for '+(meta&&meta.heldFor?meta.heldFor:'?')+' | Click to release or book';
        seat.addEventListener('click', ()=>openSeatAction(sid, rawVal, row, s));
      } else {
        seat.title = 'Row '+row.label+' Seat '+s+' — Blocked';
      }
      if(theatreSelected.includes(sid)) { seat.classList.add('selected'); }
      rowDiv.appendChild(seat);
    }
    // Add seat number label on the right end too
    const lbl2 = document.createElement('div');
    lbl2.className = 'seat-row-lbl';
    lbl2.textContent = row.label;
    rowDiv.appendChild(lbl2);
    el.appendChild(rowDiv);
  });
  updateTheatreSelSummary();
  refreshTheatreRecent();
  updateTheatreCounts();
  setTimeout(()=>{ renderTheatreNowShowing(); renderShowSchedule(); }, 0);
}

function theatreToggleSeat(sid) {
  const idx = theatreSelected.indexOf(sid);
  if(idx>=0) theatreSelected.splice(idx,1);
  else theatreSelected.push(sid);
  renderTheatreMap();
}

function theatreClearSelection() {
  theatreSelected = [];
  renderTheatreMap();
}

function updateTheatreSelSummary() {
  const el = document.getElementById('th-sel-summary'); if(!el) return;
  if(!theatreSelected.length) { el.style.display='none'; return; }
  el.style.display='block';
  const premPrice = (prices.theatre && prices.theatre.premium) || 350;
  const stdPrice  = (prices.theatre && prices.theatre.standard) || 300;
  let total = 0;
  const labels = theatreSelected.map(sid => {
    const [row,seat] = sid.split('-');
    const price = row==='TOP' ? premPrice : stdPrice;
    total += price;
    return (row==='TOP'?'★':row)+seat;
  });
  document.getElementById('th-sel-list').textContent = labels.join(', ');
  document.getElementById('th-sel-total').textContent = '₹'+total.toLocaleString('en-IN');
}

function updateTheatreCounts() {
  const totalSeats = THEATRE_ROWS.reduce((s,r)=>s+r.seats,0);
  const _seats = getShowSeats(activeShowId);
  const booked  = Object.values(_seats).filter(v=>seatStatus(v)==='booked').length;
  const held    = Object.values(_seats).filter(v=>seatStatus(v)==='held').length;
  const blocked = Object.values(_seats).filter(v=>seatStatus(v)==='blocked').length;
  const avail = totalSeats - booked - blocked;
  const tc = document.getElementById('th-total-count'); if(tc) tc.textContent=totalSeats;
  const ac = document.getElementById('th-avail-count'); if(ac) ac.textContent=avail - held;
  const bc = document.getElementById('th-booked-count'); if(bc) bc.textContent=booked;
  const hc = document.getElementById('th-held-count'); if(hc) { hc.textContent=held; hc.closest('.met').style.display=held?'':'none'; }
}

function setTheatrePayMode(mode) {
  theatrePayMode = mode;
  ['rfid','cash','upi'].forEach(m=>{
    const el=document.getElementById('th-pm-'+m); if(!el) return;
    if(m===mode){el.style.background='rgba(78,203,138,0.15)';el.style.border='1.5px solid var(--cy)';el.style.color='var(--cy)';}
    else{el.style.background='rgba(255,255,255,0.05)';el.style.border='1px solid rgba(255,255,255,0.15)';el.style.color='var(--mu)';}
  });
  const tap=document.getElementById('th-tap');
  const wc=document.getElementById('th-wc');
  if(mode==='rfid'){
    if(tap) tap.style.display='';
  } else {
    if(tap) tap.style.display='none';
    if(wc) { wc.style.display='none'; }
    zoneCards.th = null;
  }
}

function theatreConfirmBooking() {
  if(!theatreSelected.length) { toast('Select at least one seat', true); return; }
  const premPrice = (prices.theatre && prices.theatre.premium) || 350;
  const stdPrice  = (prices.theatre && prices.theatre.standard) || 300;
  let total = 0;
  const seatLabels = theatreSelected.map(sid=>{
    const [row,seat]=sid.split('-');
    total += row==='TOP' ? premPrice : stdPrice;
    return 'Row '+(row==='TOP'?'★(Top)':row)+' Seat '+seat;
  });

  if(theatrePayMode==='rfid') {
    const card = zoneCards.th;
    if(!card) { toast('Tap customer card first', true); return; }
    const {fromBonus, fromCash} = splitPay(card, total, false); // no bonus for theatre
    if(fromCash > card.cashBalance) { toast('Insufficient balance! Card has ₹'+card.cashBalance, true); return; }
    openM('Confirm Theatre Booking',
      `<div style="font-size:0.85rem;line-height:1.9;">
       Customer: <b>${card.name}</b>
       <div style="background:rgba(91,191,255,0.06);border:1px solid rgba(91,191,255,0.2);border-radius:8px;padding:9px;margin:8px 0;font-size:0.8rem;">
         ${seatLabels.join('<br>')}
       </div>
       <div style="background:rgba(78,203,138,0.06);border:1px solid rgba(78,203,138,0.15);border-radius:8px;padding:9px;margin:8px 0;">
         <div style="color:var(--cy);">Total: <b style="font-family:'JetBrains Mono',monospace;">₹${total.toLocaleString('en-IN')}</b></div>
         <div style="color:var(--mu);font-size:0.74rem;margin-top:3px;">Charged from RFID wallet</div>
       </div>
       Cash after: <span style="color:var(--cy);">₹${(card.cashBalance-fromCash).toLocaleString('en-IN')}</span>
       </div>`,
      [{label:'Confirm & Book',cls:'btn-mg',fn:()=>{ doTheatreBook(card, total, fromCash, 0, seatLabels); closeM(); }},
       {label:'Cancel',cls:'btn-gh',fn:closeM}]
    );
  } else {
    const modeLabel = theatrePayMode==='upi' ? '📱 UPI' : '💵 Cash';
    openM('Confirm Theatre Booking — '+modeLabel,
      `<div style="font-size:0.85rem;line-height:1.9;">
       <div style="background:rgba(91,191,255,0.06);border:1px solid rgba(91,191,255,0.2);border-radius:8px;padding:9px;margin:8px 0;font-size:0.8rem;">
         ${seatLabels.join('<br>')}
       </div>
       <div style="color:var(--cy);font-family:'JetBrains Mono',monospace;font-size:1.2rem;">₹${total.toLocaleString('en-IN')}</div>
       <div style="color:var(--mu);font-size:0.78rem;margin-top:4px;">Paid by ${theatrePayMode==='upi'?'UPI':'Cash'} — confirm receipt before booking</div>
       </div>`,
      [{label:'✓ Received & Book',cls:'btn-mg',fn:()=>{ doTheatreBook(null, total, 0, 0, seatLabels); closeM(); }},
       {label:'Cancel',cls:'btn-gh',fn:closeM}]
    );
  }
}

function doTheatreBook(card, total, fromCash, fromBonus, seatLabels) {
  // Mark seats as booked under this specific show
  if(activeShowId) {
    if(!allShowSeats[activeShowId]) allShowSeats[activeShowId]={};
    theatreSelected.forEach(sid => { allShowSeats[activeShowId][sid]={status:'booked',bookingId:bkId,customer:card?card.name:'Walk-in',bookedAt:nowStr()}; });
    lsSet(LS.theatreSeats, allShowSeats);
    if(db&&syncOk) db.ref('theatre_seats/'+activeShowId).set(allShowSeats[activeShowId]);
  }

  // Save booking record
  const bkId = Date.now();
  const bk = {
    id: bkId,
    showId: activeShowId,
    time: nowStr(),
    movie: getActiveShow() ? getActiveShow().movie : '',
    showTime: getActiveShow() ? getActiveShow().timing : '',
    showDate: getActiveShow() ? getActiveShow().date : '',
    seats: [...theatreSelected],
    seatLabels,
    total,
    status: 'confirmed',
    customer: card ? card.name : 'Walk-in ('+(theatrePayMode==='upi'?'UPI':'Cash')+')',
    rfid: card ? card.rfid : 'WALKIN',
    payMethod: theatrePayMode
  };
  theatreBookings.unshift(bk);
  if(theatreBookings.length > 200) theatreBookings = theatreBookings.slice(0,200);
  lsSet(LS.theatreBookings, theatreBookings);
  if(db&&syncOk) db.ref('theatre_bookings/'+bk.id).set(bk);

  // Charge card if RFID
  if(card) {
    card.cashBalance -= fromCash;
    card.bonusBalance -= fromBonus;
    card.spent += total;
    persist('cards');
    addTxnRecord(card, 'Mini Theatre', theatreSelected.length+' seat(s) — '+theatreSelected.join(', '), fromCash, fromBonus, 'debit');
    const wc = document.getElementById('th-wc');
    if(wc) wc.innerHTML = walletHTML(card);
  } else {
    // Walk-in txn record (no card)
    const wt = {
      id:bk.id, time:nowStr(), customer:bk.customer, rfid:'WALKIN',
      counter:'Mini Theatre', desc: theatreSelected.length+' seat(s) — '+theatreSelected.join(', '),
      cashAmt:total, bonusAmt:0, type:'debit', cashBalAfter:0, bonusBalAfter:0, payMethod:theatrePayMode
    };
    txns.unshift(wt);
    lsSet(LS.txns, txns);
    if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
  }

  toast(theatreSelected.length+' seat(s) booked · ₹'+total.toLocaleString('en-IN'));
  theatreSelected = [];
  renderTheatreMap();
}

function refreshTheatreRecent() {
  const el = document.getElementById('th-recent'); if(!el) return;
  // Show bookings for current show + any held seats for current show
  const showBks = theatreBookings.filter(b=>b.showId===activeShowId||(!b.showId)).slice(0,8);
  // Also show held seats summary
  const showSeats = getShowSeats(activeShowId);
  const heldList = Object.entries(showSeats)
    .filter(([,v])=>seatStatus(v)==='held')
    .map(([sid,v])=>({sid, meta: seatMeta(v)}));

  let html = '';
  if(heldList.length) {
    html += `<div style="background:rgba(255,165,0,0.07);border:1px solid rgba(255,165,0,0.25);border-radius:8px;padding:9px 11px;margin-bottom:9px;">
      <div style="font-size:0.72rem;letter-spacing:0.08em;color:#ffa500;text-transform:uppercase;margin-bottom:6px;">🟠 On Hold (${heldList.length} seat${heldList.length>1?'s':''})</div>
      ${heldList.map(({sid,meta})=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--cy);">${sid}</span>
          <span style="color:var(--tx);font-size:0.8rem;margin-left:8px;">${meta&&meta.heldFor?meta.heldFor:''}</span>
          ${meta&&meta.heldRef?`<span style="color:var(--mu);font-size:0.72rem;margin-left:5px;">${meta.heldRef}</span>`:''}
        </div>
        <button onclick="releaseSeat('${sid}','Seat ${sid}')" style="background:rgba(78,203,138,0.1);border:1px solid rgba(78,203,138,0.3);color:var(--gr);border-radius:5px;padding:2px 8px;cursor:pointer;font-size:0.72rem;">Release</button>
      </div>`).join('')}
    </div>`;
  }

  if(!showBks.length && !heldList.length) {
    el.innerHTML='<div class="empty">No bookings yet for this show</div>'; return;
  }
  html += showBks.map(b=>{
    const cancelled = b.status==='cancelled';
    const partial = b.status==='partial-cancel';
    return `<div class="hr" style="${cancelled?'opacity:0.5;':''}">
      <div>
        <div style="font-size:0.82rem;font-weight:600;">${b.customer}
          ${cancelled?'<span style="color:#f87171;font-size:0.68rem;margin-left:6px;">CANCELLED</span>':''}
          ${partial?'<span style="color:#ffa500;font-size:0.68rem;margin-left:6px;">PARTIAL CANCEL</span>':''}
        </div>
        <div style="font-size:0.65rem;color:var(--mu);">${b.time} · ${b.seats.length} seat(s)${b.payMethod?' · '+(b.payMethod==='upi'?'📱 UPI':'💵 Cash'):''}</div>
        <div style="font-size:0.72rem;color:var(--cy);margin-top:2px;font-family:'JetBrains Mono',monospace;">${b.seats.join('  ')}</div>
        ${b.cancelledSeats&&b.cancelledSeats.length?`<div style="font-size:0.68rem;color:#f87171;margin-top:2px;">Cancelled: ${b.cancelledSeats.join(', ')}</div>`:''}
      </div>
      <div style="text-align:right;">
        <div style="color:var(--cy);font-family:'JetBrains Mono',monospace;font-size:0.82rem;">₹${(b.total||0).toLocaleString('en-IN')}</div>
        ${!cancelled?`<button onclick="cancelFullBooking(${b.id})" style="background:rgba(226,75,74,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;border-radius:5px;padding:2px 7px;cursor:pointer;font-size:0.65rem;margin-top:3px;">Cancel All</button>`:''}
      </div>
    </div>`;
  }).join('');
  el.innerHTML = html;
}

function cancelFullBooking(bkId) {
  const bk = theatreBookings.find(b=>b.id===bkId); if(!bk) return;
  openM('❌ Cancel Full Booking',
    `<div style="font-size:0.86rem;">Cancel all ${bk.seats.length} seat(s) for <b>${bk.customer}</b>?<br>
     Seats: <span style="color:var(--cy);">${bk.seats.join(', ')}</span><br>
     <div style="color:var(--mu);font-size:0.78rem;margin-top:7px;">All seats will be freed. Refund handled manually.</div></div>`,
    [{label:'Yes, Cancel Booking',cls:'btn-rd',fn:()=>{
      if(activeShowId && allShowSeats[activeShowId]) {
        bk.seats.forEach(sid=>{ allShowSeats[activeShowId][sid]='available'; });
        lsSet(LS.theatreSeats, allShowSeats);
        if(db&&syncOk) db.ref('theatre_seats/'+activeShowId).set(allShowSeats[activeShowId]);
      }
      bk.status='cancelled';
      bk.cancelledSeats=[...bk.seats];
      lsSet(LS.theatreBookings, theatreBookings);
      if(db&&syncOk) db.ref('theatre_bookings/'+bk.id).set(bk);
      closeM(); toast('Booking cancelled — all seats freed ✓');
      renderTheatreMap();
    }},{label:'Back',cls:'btn-gh',fn:closeM}]
  );
}


// ─── SEAT ACTION PANEL (click booked/held seat) ───────────────
function openSeatAction(sid, rawVal, row, seatNum) {
  const status = seatStatus(rawVal);
  const meta   = seatMeta(rawVal);
  const seatLabel = 'Row '+(row.id==='TOP'?'★(Premium)':row.label)+' · Seat '+seatNum;
  const bk = status==='booked' ? theatreBookings.find(b=>b.showId===activeShowId && b.seats.includes(sid)) : null;

  if(status==='booked') {
    openM('🎫 Seat — '+seatLabel,
      `<div style="font-size:0.85rem;line-height:1.9;">
       <div style="background:rgba(226,75,74,0.08);border:1px solid rgba(226,75,74,0.25);border-radius:9px;padding:10px 13px;margin-bottom:11px;">
         <div style="font-weight:700;font-size:0.92rem;">${bk?bk.customer:'Unknown customer'}</div>
         ${bk?`<div style="color:var(--mu);font-size:0.78rem;">${bk.time}${bk.payMethod?' · '+(bk.payMethod==='upi'?'📱 UPI':'💵 Cash'):''}</div>`:''}
         ${bk&&bk.seats&&bk.seats.length>1?`<div style="font-size:0.75rem;color:var(--cy);margin-top:3px;">Part of booking: ${bk.seats.join(', ')}</div>`:''}
       </div>
       <div style="color:var(--mu);font-size:0.8rem;">What would you like to do?</div>
       </div>`,
      [
        {label:'❌ Cancel This Seat',cls:'btn-rd',fn:()=>{ closeM(); cancelSeat(sid, seatLabel, bk); }},
        {label:'🟠 Put On Hold',cls:'btn-go',fn:()=>{ closeM(); promptHoldSeat(sid, seatLabel, 'booked'); }},
        {label:'Close',cls:'btn-gh',fn:closeM}
      ]
    );
  } else if(status==='held') {
    openM('🟠 Held Seat — '+seatLabel,
      `<div style="font-size:0.85rem;line-height:1.9;">
       <div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);border-radius:9px;padding:10px 13px;margin-bottom:11px;">
         <div style="font-weight:700;">Held for: <span style="color:#ffa500;">${meta&&meta.heldFor?meta.heldFor:'—'}</span></div>
         ${meta&&meta.heldRef?`<div style="color:var(--mu);font-size:0.78rem;">Ref: ${meta.heldRef}</div>`:''}
         ${meta&&meta.heldAt?`<div style="color:var(--mu);font-size:0.75rem;">${meta.heldAt}</div>`:''}
       </div>
       <div style="color:var(--mu);font-size:0.8rem;">What would you like to do?</div>
       </div>`,
      [
        {label:'✅ Release Hold (Free seat)',cls:'btn-gn',fn:()=>{ releaseSeat(sid, seatLabel); closeM(); }},
        {label:'❌ Cancel & Free Seat',cls:'btn-rd',fn:()=>{ releaseSeat(sid, seatLabel); closeM(); }},
        {label:'Close',cls:'btn-gh',fn:closeM}
      ]
    );
  }
}

function cancelSeat(sid, seatLabel, bk) {
  const msg = bk && bk.seats.length > 1
    ? `This will free only seat <b>${seatLabel}</b>. The rest of the booking (${bk.seats.filter(s=>s!==sid).join(', ')}) stays booked.`
    : `This will free seat <b>${seatLabel}</b> and mark it available.`;
  openM('❌ Cancel Seat',
    `<div style="font-size:0.86rem;line-height:1.8;">${msg}<br>
     <div style="color:var(--mu);font-size:0.78rem;margin-top:7px;">Note: Refund if any must be handled manually at reception.</div>
     </div>`,
    [{label:'Yes, Cancel & Free Seat',cls:'btn-rd',fn:()=>{
      if(!activeShowId) return;
      if(!allShowSeats[activeShowId]) allShowSeats[activeShowId]={};
      allShowSeats[activeShowId][sid]='available';
      lsSet(LS.theatreSeats, allShowSeats);
      if(db&&syncOk) db.ref('theatre_seats/'+activeShowId+'/'+sid.replace('-','_')).set('available');
      // Mark booking as partially cancelled
      if(bk) {
        bk.status = bk.seats.length>1 ? 'partial-cancel' : 'cancelled';
        bk.cancelledSeats = [...(bk.cancelledSeats||[]), sid];
        lsSet(LS.theatreBookings, theatreBookings);
        if(db&&syncOk) db.ref('theatre_bookings/'+bk.id).set(bk);
      }
      closeM();
      toast('Seat '+seatLabel+' freed ✓');
      theatreSelected = theatreSelected.filter(s=>s!==sid);
      renderTheatreMap();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function promptHoldSeat(sid, seatLabel, fromStatus) {
  openM('🟠 Put Seat On Hold',
    `<div style="font-size:0.85rem;">
     <div style="margin-bottom:10px;color:var(--mu);">Hold seat <b style="color:var(--tx);">${seatLabel}</b> in someone's name for later payment.</div>
     <label class="f">Hold For (Name)</label>
     <input type="text" id="hold-name" placeholder="e.g. Ramesh Shah" style="margin-bottom:10px;">
     <label class="f">Reference / Phone (optional)</label>
     <input type="text" id="hold-ref" placeholder="e.g. 9876543210 or Walk-in" style="margin-bottom:0;">
     </div>`,
    [{label:'🟠 Put On Hold',cls:'btn-go',fn:()=>{
      const name = (document.getElementById('hold-name')||{}).value.trim();
      if(!name){ toast('Enter a name for the hold',true); return; }
      const ref = (document.getElementById('hold-ref')||{}).value.trim();
      holdSeat(sid, name, ref, seatLabel);
      closeM();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function holdSeat(sid, heldFor, heldRef, seatLabel) {
  if(!activeShowId) return;
  if(!allShowSeats[activeShowId]) allShowSeats[activeShowId]={};
  allShowSeats[activeShowId][sid] = {status:'held', heldFor, heldRef, heldAt: nowStr()};
  lsSet(LS.theatreSeats, allShowSeats);
  if(db&&syncOk) db.ref('theatre_seats/'+activeShowId).set(allShowSeats[activeShowId]);
  toast(seatLabel+' held for '+heldFor+' 🟠');
  renderTheatreMap();
}

function releaseSeat(sid, seatLabel) {
  if(!activeShowId) return;
  if(!allShowSeats[activeShowId]) allShowSeats[activeShowId]={};
  allShowSeats[activeShowId][sid]='available';
  lsSet(LS.theatreSeats, allShowSeats);
  if(db&&syncOk) db.ref('theatre_seats/'+activeShowId).set(allShowSeats[activeShowId]);
  toast(seatLabel+' released — now available ✓');
  renderTheatreMap();
}

// ─── HOLD from available seat (right-click alternative — long press or shift+click) ──
// Staff can also select available seats and hold them in bulk
function holdSelectedSeats() {
  if(!theatreSelected.length){ toast('Select seats to hold first',true); return; }
  openM('🟠 Hold Selected Seats',
    `<div style="font-size:0.85rem;">
     <div style="margin-bottom:8px;color:var(--mu);">Holding <b style="color:var(--tx);">${theatreSelected.length} seat(s)</b>: <span style="color:var(--cy);font-family:'JetBrains Mono',monospace;">${theatreSelected.join(', ')}</span></div>
     <label class="f">Hold For (Name)</label>
     <input type="text" id="bulk-hold-name" placeholder="e.g. Ramesh Shah" style="margin-bottom:10px;">
     <label class="f">Reference / Phone (optional)</label>
     <input type="text" id="bulk-hold-ref" placeholder="e.g. 9876543210" style="margin-bottom:0;">
     </div>`,
    [{label:'🟠 Hold These Seats',cls:'btn-go',fn:()=>{
      const name=(document.getElementById('bulk-hold-name')||{}).value.trim();
      if(!name){toast('Enter name',true);return;}
      const ref=(document.getElementById('bulk-hold-ref')||{}).value.trim();
      if(!allShowSeats[activeShowId]) allShowSeats[activeShowId]={};
      theatreSelected.forEach(sid=>{ allShowSeats[activeShowId][sid]={status:'held',heldFor:name,heldRef:ref,heldAt:nowStr()}; });
      lsSet(LS.theatreSeats, allShowSeats);
      if(db&&syncOk) db.ref('theatre_seats/'+activeShowId).set(allShowSeats[activeShowId]);
      toast(theatreSelected.length+' seat(s) held for '+name+' 🟠');
      theatreSelected=[];
      closeM(); renderTheatreMap();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function saveTheatrePrices() {
  const prem = parseFloat(document.getElementById('th-price-premium').value)||350;
  const std  = parseFloat(document.getElementById('th-price-standard').value)||300;
  if(!prices.theatre) prices.theatre = {};
  prices.theatre.premium  = prem;
  prices.theatre.standard = std;
  persist('prices');
  toast('Theatre prices saved');
  buildCounterTabs(); // re-render theatre tab with new prices
}

function resetTheatreSeats() {
  openM('Reset Theatre Seats?',
    '<div style="font-size:0.86rem;">This marks all seats as <b style="color:var(--cy);">Available</b> for a new show.<br>Booking history is preserved and not deleted.</div>',
    [{label:'Yes, Reset for New Show',cls:'btn-go',fn:()=>{
      if(!activeShowId) { toast('Select a show first',true); closeM(); return; }
      allShowSeats[activeShowId] = {};
      THEATRE_ROWS.forEach(row=>{
        for(let s=1;s<=row.seats;s++) allShowSeats[activeShowId][row.id+'-'+s]='available';
      });
      lsSet(LS.theatreSeats, allShowSeats);
      if(db&&syncOk) db.ref('theatre_seats/'+activeShowId).set(allShowSeats[activeShowId]);
      closeM(); toast('Seats reset for this show 🎬');
      renderTheatreMap();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// Hook theatre map render when tab becomes active
const _origBuildCounterTabs = buildCounterTabs;

// ═══════════════════════════════════════════════════════════════════
//  MEMBERS MODULE
// ═══════════════════════════════════════════════════════════════════

const MEMBER_TYPES = {
  annual:   { label:'Annual',      fee:40000, duration:365,  durationLabel:'1 Year',   cls:'mbr-annual', badge:'ANNUAL' },
  half:     { label:'Half-Yearly', fee:20000, duration:182,  durationLabel:'6 Months', cls:'mbr-half',   badge:'HALF-YR' },
  lifetime: { label:'Lifetime',    fee:300000,duration:5475, durationLabel:'15 Years', cls:'mbr-life',   badge:'LIFETIME' },
};

function memberExpiry(m) {
  if(m.type === 'lifetime') return null; // Lifetime members never expire
  if(!m.joinDate) return null;
  const cfg = MEMBER_TYPES[m.type];
  if(!cfg) return null;
  const d = new Date(m.joinDate);
  d.setDate(d.getDate() + cfg.duration);
  return d;
}

function memberStatus(m) {
  if(m.type === 'lifetime') return 'active'; // Lifetime members are always active
  const exp = memberExpiry(m);
  if(!exp) return 'unknown';
  const now = new Date();
  const daysLeft = Math.ceil((exp - now) / 86400000);
  if(daysLeft < 0) return 'expired';
  if(daysLeft <= 30) return 'expiring';
  return 'active';
}

function daysLeft(m) {
  if(m.type === 'lifetime') return null; // No expiry for lifetime
  const exp = memberExpiry(m);
  if(!exp) return null;
  return Math.ceil((exp - new Date()) / 86400000);
}

function isMember(rfid) {
  if(!rfid) return null;
  return members.find(m => m.cardId && m.cardId.trim().toUpperCase() === rfid.trim().toUpperCase()) || null;
}

function checkMemberExpiry() {
  const banner = document.getElementById('mbr-expiry-banner');
  if(!banner) return;
  const expiring = members.filter(m => {
    const s = memberStatus(m);
    return s === 'expiring' || s === 'expired';
  });
  if(!expiring.length) { banner.style.display='none'; return; }
  banner.style.display='block';
  const expired  = expiring.filter(m=>memberStatus(m)==='expired');
  const expiringS= expiring.filter(m=>memberStatus(m)==='expiring');
  let html = '<div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;">⚠️ Membership Alerts</div>';
  if(expired.length)   html += `<div style="color:#f87171;font-size:0.82rem;margin-bottom:4px;">❌ Expired (${expired.length}): ${expired.map(m=>m.name).join(', ')}</div>`;
  if(expiringS.length) html += `<div style="color:#ffa500;font-size:0.82rem;">🔔 Expiring within 30 days (${expiringS.length}): ${expiringS.map(m=>m.name+' ('+daysLeft(m)+' days)').join(', ')}</div>`;
  banner.innerHTML = html;
}

function renderMembersList() {
  const q = (document.getElementById('mbr-search')||{}).value||'';
  let list = members;
  if(q) {
    const ql = q.toLowerCase();
    list = list.filter(m =>
      (m.name||'').toLowerCase().includes(ql) ||
      (m.cardId||'').toLowerCase().includes(ql) ||
      (m.mobile||'').includes(ql)
    );
  }

  // Update stats
  document.getElementById('mbr-count').textContent  = members.length;
  document.getElementById('mbr-annual').textContent  = members.filter(m=>m.type==='annual').length;
  document.getElementById('mbr-half').textContent    = members.filter(m=>m.type==='half').length;
  document.getElementById('mbr-life').textContent    = members.filter(m=>m.type==='lifetime').length;

  const tbody = document.getElementById('mbr-tbl');
  if(!tbody) return;
  if(!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--mu);padding:22px;">No members found</td></tr>`;
    return;
  }
  const cfg = MEMBER_TYPES;
  const canEdit = me && (ROLES[me.role]||{}).canEditMembers;
  tbody.innerHTML = list.map(m => {
    const tc  = cfg[m.type] || cfg.annual;
    const st  = memberStatus(m);
    const exp = memberExpiry(m);
    const dl  = daysLeft(m);
    const stBadge = st==='active' && m.type==='lifetime' ? '<span class="mbr-badge mbr-life">♾ Lifetime</span>'
                  : st==='active' ? '<span class="mbr-badge mbr-ok">Active</span>'
                  : st==='expiring' ? `<span class="mbr-badge mbr-expiring">⚠ ${dl}d left</span>`
                  : st==='expired'  ? '<span class="mbr-badge mbr-expired">Expired</span>'
                  : '—';
    const photo = m.photo
      ? `<img src="${m.photo}" class="mbr-photo" onerror="this.style.display='none'">`
      : `<div class="mbr-photo-ph">👤</div>`;
    return `<tr>
      <td style="padding:8px 10px;">
        <div style="display:flex;align-items:center;gap:9px;">
          ${photo}
          <div>
            <div style="font-weight:600;font-size:0.88rem;">${m.name}</div>
            ${m.dob?`<div style="font-size:0.68rem;color:var(--mu);">DOB: ${m.dob}</div>`:''}
          </div>
        </div>
      </td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;padding:8px 10px;">${m.cardId||'—'}</td>
      <td style="padding:8px 10px;"><span class="mbr-badge ${tc.cls}">${tc.badge}</span></td>
      <td style="padding:8px 10px;font-size:0.82rem;">${m.mobile||'—'}</td>
      <td style="padding:8px 10px;font-size:0.78rem;color:var(--mu);">${m.joinDate||'—'}</td>
      <td style="padding:8px 10px;font-size:0.78rem;color:var(--mu);">${m.type==='lifetime' ? '<span style="color:var(--go);">♾ Lifetime</span>' : exp?exp.toLocaleDateString('en-IN'):'—'}</td>
      <td style="padding:8px 10px;">${stBadge}</td>
      <td style="padding:8px 10px;">
        <button class="btn btn-cy btn-xs" onclick="openMemberDetail('${m.id}')">View</button>
        ${canEdit ? `<button class="btn btn-go btn-xs" onclick="editMember('${m.id}')" style="margin-left:4px;">Edit</button>` : ''}
        <button class="btn btn-go btn-xs" onclick="topUpMemberCard('${m.id}')" style="margin-left:4px;">Top-Up</button>
      </td>
    </tr>`;
  }).join('');
  checkMemberExpiry();
}

function openAddMember() {
  openM('👑 Add Club Member',
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
      <div>
        <label class="f">Full Name *</label>
        <input type="text" id="mb-name" placeholder="e.g. Ramesh Shah" style="margin-bottom:0;">
      </div>
      <div>
        <label class="f">Mobile *</label>
        <input type="text" id="mb-mobile" placeholder="9876543210" style="margin-bottom:0;">
      </div>
      <div>
        <label class="f">Card ID (manual) *</label>
        <input type="text" id="mb-card" placeholder="e.g. GZ101" style="margin-bottom:0;text-transform:uppercase;">
      </div>
      <div>
        <label class="f">Membership Type *</label>
        <select id="mb-type" style="margin-bottom:0;">
          <option value="annual">Annual — ₹40,000 / 1 Year</option>
          <option value="half">Half-Yearly — ₹20,000 / 6 Months</option>
          <option value="lifetime">Lifetime — ₹3,00,000 / 15 Years</option>
        </select>
      </div>
      <div>
        <label class="f">Date of Joining *</label>
        <input type="date" id="mb-join" style="margin-bottom:0;" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div>
        <label class="f">Date of Birth</label>
        <input type="date" id="mb-dob" style="margin-bottom:0;">
      </div>
      <div style="grid-column:1/-1;">
        <label class="f">Address</label>
        <input type="text" id="mb-addr" placeholder="Full address" style="margin-bottom:0;">
      </div>
      <div>
        <label class="f">Nominee Name</label>
        <input type="text" id="mb-nominee" placeholder="Nominee full name" style="margin-bottom:0;">
      </div>
      <div>
        <label class="f">Photo (URL or paste base64)</label>
        <input type="text" id="mb-photo" placeholder="Optional photo URL" style="margin-bottom:0;">
      </div>
      <div style="grid-column:1/-1;">
        <label class="f">Fee Paid Via</label>
        <select id="mb-feepay" style="margin-bottom:0;">
          <option value="cash">💵 Cash</option>
          <option value="upi">📱 UPI</option>
          <option value="bank">🏦 Bank Transfer</option>
          <option value="cheque">📄 Cheque</option>
        </select>
      </div>
    </div>`,
    [{label:'Add Member',cls:'btn-mg',fn:()=>{
      const name   = (document.getElementById('mb-name')||{}).value.trim();
      const mobile = (document.getElementById('mb-mobile')||{}).value.trim();
      const cardId = (document.getElementById('mb-card')||{}).value.trim().toUpperCase();
      const type   = (document.getElementById('mb-type')||{}).value;
      const join   = (document.getElementById('mb-join')||{}).value;
      if(!name||!cardId||!join){ toast('Name, Card ID and Join Date are required',true); return; }
      if(members.find(m=>m.cardId===cardId)){ toast('Card ID already used by another member',true); return; }
      const m = {
        id: 'mbr'+Date.now(),
        name, mobile, cardId, type, joinDate:join,
        dob:     (document.getElementById('mb-dob')||{}).value||'',
        address: (document.getElementById('mb-addr')||{}).value.trim()||'',
        nominee: (document.getElementById('mb-nominee')||{}).value.trim()||'',
        photo:   (document.getElementById('mb-photo')||{}).value.trim()||'',
        feePaidVia: (document.getElementById('mb-feepay')||{}).value,
        addedAt: nowStr(),
        addedBy: me ? me.name : 'Admin',
      };
      members.push(m);
      lsSet(LS.members, members);
      if(db&&syncOk) db.ref('members/'+m.id).set(m);
      renderMembersList();
      closeM();
      toast('Member added — '+name+' ('+cardId+')');
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}],
    true
  );
}

function openMemberDetail(id) {
  const m = members.find(x=>x.id===id); if(!m) return;
  const tc  = MEMBER_TYPES[m.type]||MEMBER_TYPES.annual;
  const exp = memberExpiry(m);
  const st  = memberStatus(m);
  const dl  = daysLeft(m);
  const linked = cards.find(c=>c.rfid&&c.rfid.toUpperCase()===m.cardId.toUpperCase());
  const stColor = st==='active'?'var(--gr)':st==='expiring'?'#ffa500':'#e24b4a';
  openM('👑 '+m.name,
    `<div style="font-size:0.85rem;line-height:1.9;">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        ${m.photo?`<img src="${m.photo}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.2);">`:'<div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;">👤</div>'}
        <div>
          <div style="font-weight:700;font-size:1rem;">${m.name}</div>
          <div><span class="mbr-badge ${tc.cls}">${tc.badge}</span> <span style="color:${stColor};font-size:0.78rem;margin-left:6px;">${st==='active'?'✅ Active':st==='expiring'?'⚠ Expiring in '+dl+' days':'❌ Expired'}</span></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:rgba(255,255,255,0.03);border-radius:9px;padding:11px;margin-bottom:11px;font-size:0.8rem;">
        <div><span style="color:var(--mu);">Card ID:</span> <b style="font-family:'JetBrains Mono',monospace;">${m.cardId}</b></div>
        <div><span style="color:var(--mu);">Mobile:</span> ${m.mobile||'—'}</div>
        <div><span style="color:var(--mu);">Joined:</span> ${m.joinDate||'—'}</div>
        <div><span style="color:var(--mu);">Expires:</span> <b style="color:${stColor};">${exp?exp.toLocaleDateString('en-IN'):'—'}</b></div>
        <div><span style="color:var(--mu);">DOB:</span> ${m.dob||'—'}</div>
        <div><span style="color:var(--mu);">Nominee:</span> ${m.nominee||'—'}</div>
        <div style="grid-column:1/-1;"><span style="color:var(--mu);">Address:</span> ${m.address||'—'}</div>
        <div><span style="color:var(--mu);">Fee via:</span> ${m.feePaidVia||'—'}</div>
        <div><span style="color:var(--mu);">Added by:</span> ${m.addedBy||'—'}</div>
      </div>
      ${linked
        ? `<div style="background:rgba(78,203,138,0.07);border:1px solid rgba(78,203,138,0.2);border-radius:8px;padding:9px;">
            <div style="font-size:0.72rem;color:var(--mu);margin-bottom:4px;">LINKED RFID WALLET</div>
            <div>Cash: <b style="color:var(--cy);">${fmt(linked.cashBalance)}</b> &nbsp; Bonus: <b style="color:var(--go);">${fmt(linked.bonusBalance)}</b></div>
           </div>`
        : `<div style="color:var(--mu);font-size:0.78rem;">No wallet card linked (card ID not found in RFID system)</div>`
      }
      <div style="margin-top:11px;display:flex;gap:7px;flex-wrap:wrap;">
        <div><b style="color:var(--mg);">Benefits:</b> 🎳 Bowling flat ₹199 &nbsp; 🍕 Food 10% off</div>
      </div>
    </div>`,
    [
      {label:'Top-Up Card',cls:'btn-cy',fn:()=>{ closeM(); topUpMemberCard(id); }},
      {label:'Renew',cls:'btn-go',fn:()=>{ closeM(); renewMembership(id); }},
      {label:'Edit',cls:'btn-gh',fn:()=>{ closeM(); editMember(id); }},
      {label:'Close',cls:'btn-gh',fn:closeM}
    ],
    true
  );
}

function topUpMemberCard(id) {
  const m = members.find(x=>x.id===id); if(!m) return;
  const linked = cards.find(c=>c.rfid&&c.rfid.toUpperCase()===m.cardId.toUpperCase());
  if(!linked){ toast('Card '+m.cardId+' not found in RFID system. Issue it first at Reception.',true); return; }
  openM('💳 Top-Up — '+m.name,
    `<div style="font-size:0.85rem;">
      <div style="margin-bottom:10px;color:var(--mu);">Current: Cash <b style="color:var(--cy);">${fmt(linked.cashBalance)}</b> · Bonus <b style="color:var(--go);">${fmt(linked.bonusBalance)}</b></div>
      <label class="f">Amount (₹)</label>
      <input type="number" id="mbr-topup-amt" placeholder="e.g. 2000" style="margin-bottom:10px;">
      <label class="f">Wallet Type</label>
      <select id="mbr-topup-type" style="margin-bottom:10px;">
        <option value="cash">Cash Wallet</option>
        <option value="bonus">Bonus Wallet</option>
      </select>
      <label class="f">Payment Method</label>
      <select id="mbr-topup-pay" style="margin-bottom:0;">
        <option value="cash">💵 Cash</option>
        <option value="upi">📱 UPI</option>
        <option value="bank">🏦 Bank Transfer</option>
      </select>
    </div>`,
    [{label:'Top-Up',cls:'btn-cy',fn:()=>{
      const amt = parseFloat((document.getElementById('mbr-topup-amt')||{}).value)||0;
      const wtype = (document.getElementById('mbr-topup-type')||{}).value;
      const pay   = (document.getElementById('mbr-topup-pay')||{}).value;
      if(amt<=0){ toast('Enter valid amount',true); return; }
      if(wtype==='cash') linked.cashBalance  += amt;
      else               linked.bonusBalance += amt;
      persist('cards');
      addTxnRecord(linked,'Member Top-Up','Member top-up ['+pay.toUpperCase()+'] — '+m.name,wtype==='cash'?amt:0,wtype==='bonus'?amt:0,'credit');
      closeM(); toast(fmt(amt)+' added to '+m.name+"'s card ✓");
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function renewMembership(id) {
  const m = members.find(x=>x.id===id); if(!m) return;
  const tc = MEMBER_TYPES[m.type]||MEMBER_TYPES.annual;
  openM('🔄 Renew — '+m.name,
    `<div style="font-size:0.85rem;">
      <div style="margin-bottom:10px;">Renewing <b>${tc.label}</b> membership (${tc.durationLabel}).<br>
      New join date will be today or the expiry date, whichever is later.</div>
      <label class="f">Fee Paid Via</label>
      <select id="ren-pay" style="margin-bottom:0;">
        <option value="cash">💵 Cash</option>
        <option value="upi">📱 UPI</option>
        <option value="bank">🏦 Bank Transfer</option>
        <option value="cheque">📄 Cheque</option>
      </select>
    </div>`,
    [{label:'Renew (₹'+tc.fee.toLocaleString('en-IN')+')',cls:'btn-go',fn:()=>{
      const oldExp = memberExpiry(m);
      const base = (oldExp && oldExp > new Date()) ? oldExp : new Date();
      m.joinDate = base.toISOString().slice(0,10);
      m.feePaidVia = (document.getElementById('ren-pay')||{}).value;
      m.renewedAt  = nowStr();
      lsSet(LS.members, members);
      if(db&&syncOk) db.ref('members/'+m.id).set(m);
      renderMembersList();
      closeM();
      toast(m.name+' renewed — new expiry '+memberExpiry(m).toLocaleDateString('en-IN'));
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function editMember(id) {
  const m = members.find(x=>x.id===id); if(!m) return;
  const isAdmin = me && me.role === 'admin';
  openM('✏️ Edit — '+m.name,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
      <div><label class="f">Name</label><input type="text" id="ed-name" value="${m.name||''}" style="margin-bottom:0;"></div>
      <div><label class="f">Mobile</label><input type="text" id="ed-mobile" value="${m.mobile||''}" style="margin-bottom:0;"></div>
      <div><label class="f">Card ID</label><input type="text" id="ed-card" value="${m.cardId||''}" style="margin-bottom:0;text-transform:uppercase;"></div>
      <div><label class="f">Type</label>
        <select id="ed-type" style="margin-bottom:0;">
          <option value="annual" ${m.type==='annual'?'selected':''}>Annual</option>
          <option value="half" ${m.type==='half'?'selected':''}>Half-Yearly</option>
          <option value="lifetime" ${m.type==='lifetime'?'selected':''}>Lifetime</option>
        </select>
      </div>
      <div><label class="f">Join Date</label><input type="date" id="ed-join" value="${m.joinDate||''}" style="margin-bottom:0;"></div>
      <div><label class="f">DOB</label><input type="date" id="ed-dob" value="${m.dob||''}" style="margin-bottom:0;"></div>
      <div style="grid-column:1/-1;"><label class="f">Address</label><input type="text" id="ed-addr" value="${m.address||''}" style="margin-bottom:0;"></div>
      <div><label class="f">Nominee</label><input type="text" id="ed-nominee" value="${m.nominee||''}" style="margin-bottom:0;"></div>
      <div><label class="f">Photo URL</label><input type="text" id="ed-photo" value="${m.photo||''}" style="margin-bottom:0;"></div>
    </div>`,
    [
      {label:'Save',cls:'btn-cy',fn:()=>{
        m.name    = (document.getElementById('ed-name')||{}).value.trim()||m.name;
        m.mobile  = (document.getElementById('ed-mobile')||{}).value.trim();
        m.cardId  = (document.getElementById('ed-card')||{}).value.trim().toUpperCase()||m.cardId;
        m.type    = (document.getElementById('ed-type')||{}).value;
        m.joinDate= (document.getElementById('ed-join')||{}).value||m.joinDate;
        m.dob     = (document.getElementById('ed-dob')||{}).value;
        m.address = (document.getElementById('ed-addr')||{}).value.trim();
        m.nominee = (document.getElementById('ed-nominee')||{}).value.trim();
        m.photo   = (document.getElementById('ed-photo')||{}).value.trim();
        m.editedBy = me ? me.name : ''; m.editedAt = nowStr();
        lsSet(LS.members, members);
        if(db&&syncOk) db.ref('members/'+m.id).set(m);
        renderMembersList(); closeM(); toast('Member updated ✓');
      }},
      ...(isAdmin ? [{label:'Delete Member',cls:'btn-rd',fn:()=>{
        if(!confirm('Delete '+m.name+'? This cannot be undone.')) return;
        members = members.filter(x=>x.id!==id);
        lsSet(LS.members, members);
        if(db&&syncOk) db.ref('members/'+m.id).remove();
        renderMembersList(); closeM(); toast('Member deleted');
      }}] : []),
      {label:'Cancel',cls:'btn-gh',fn:closeM}
    ],
    true
  );
}

// ── Member discounts applied at charging time ──────────────────

function getMemberDiscount(rfid) {
  // Returns {isMember, bowlingFlat, foodPct} for a card
  const m = isMember(rfid);
  if(!m) return {isMember:false, bowlingFlat:false, foodPct:0};
  const st = memberStatus(m);
  if(st==='expired') return {isMember:true, expired:true, bowlingFlat:false, foodPct:0};
  return {isMember:true, memberName:m.name, memberType:m.type, bowlingFlat:true, foodPct:10};
}

// ═══════════════════════════════════════════════════════════════════
//  COURT BOOKING MODULE
// ═══════════════════════════════════════════════════════════════════

const COURTS = {
  cricket:    { name:'Box Cricket',  icon:'🏏', color:'var(--cy)',  open:'07:00', close:'02:00', nextDay:true,
                price60:1000, price30:500, price90:1500, price120:2000, price180:3000 },
  badminton:  { name:'Badminton',    icon:'🏸', color:'var(--go)',  open:'10:00', close:'23:00', nextDay:false,
                price60:800,  price30:400, price90:1200, price120:1600, price180:2400 },
  pickleball: { name:'Pickleball',   icon:'🎾', color:'var(--mg)',  open:'07:00', close:'24:00', nextDay:false,
                price60:800,  price30:400, price90:1200, price120:1600, price180:2400,
                ownPaddle60:600, ownPaddle30:300, ownPaddle90:900, ownPaddle120:1200, ownPaddle180:1800 },
  bowling:    { name:'Bowling',      icon:'🎳', color:'#7c3aed',   open:'11:00', close:'23:00', nextDay:false,
                slotType:'bowling',
                price30:250, price60:250, price90:250, price120:250, price180:250 },
};

let activeCourt   = 'cricket';
let courtPayMode  = 'rfid';
let selectedSlot  = null; // {time, dur, label, price}
let ownPaddleMode = false; // Pickleball own-paddle discount

// Initialise date to today
function initCourtDate() {
  const el = document.getElementById('ct-date');
  if(el && !el.value) el.value = new Date().toISOString().slice(0,10);
}

function selectCourt(sport) {
  activeCourt = sport;
  document.querySelectorAll('.ct-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('ct-'+sport);
  if(tab) tab.classList.add('active');
  // Show own-paddle toggle only for pickleball
  const ow = document.getElementById('ct-own-paddle-wrap');
  if(ow) ow.style.display = sport==='pickleball' ? '' : 'none';
  // Reset own-paddle if switching away from pickleball
  // Hide own-paddle wrap for bowling (doesn't apply)
  const ow2 = document.getElementById('ct-own-paddle-wrap');
  if(ow2) ow2.style.display = sport==='pickleball' ? '' : 'none';
  if(sport !== 'pickleball' && ownPaddleMode) {
    ownPaddleMode = false;
    const dot  = document.getElementById('paddle-dot');
    const knob = document.getElementById('paddle-knob');
    if(dot)  dot.style.background = '#bfdbfe';
    if(knob) knob.style.left = '2px';
  }
  clearCourtSel();
  renderCourtSlots();
  renderCourtInfoBar();
}

function setCourtPayMode(mode) {
  courtPayMode = mode;
  ['rfid','cash','upi','later'].forEach(m => {
    const el = document.getElementById('ct-pm-'+m); if(!el) return;
    if(m===mode){ el.style.background='rgba(78,203,138,0.15)'; el.style.border='1.5px solid var(--cy)'; el.style.color='var(--cy)'; }
    else        { el.style.background='rgba(255,255,255,0.05)'; el.style.border='1px solid rgba(255,255,255,0.15)'; el.style.color='var(--mu)'; }
  });
  const tap = document.getElementById('ct-tap');
  const wc  = document.getElementById('ct-wc');
  if(mode==='rfid'){ if(tap) tap.style.display=''; }
  else { if(tap) tap.style.display='none'; if(wc) wc.style.display='none'; zoneCards.ct=null; }
  // Update confirm panel price if slot selected
  if(selectedSlot) updateSlotPrice();
}

function toggleOwnPaddle() {
  ownPaddleMode = !ownPaddleMode;
  const dot  = document.getElementById('paddle-dot');
  const knob = document.getElementById('paddle-knob');
  if(dot)  dot.style.background  = ownPaddleMode ? '#1d4ed8' : '#bfdbfe';
  if(knob) knob.style.left       = ownPaddleMode ? '20px' : '2px';
  if(selectedSlot) updateSlotPrice();
  renderCourtInfoBar();
}

function getCourtPrice(sport, dur) {
  const c = COURTS[sport];
  if(sport === 'pickleball' && ownPaddleMode) {
    if(dur===30)  return c.ownPaddle30;
    if(dur===60)  return c.ownPaddle60;
    if(dur===90)  return c.ownPaddle90;
    if(dur===120) return c.ownPaddle120;
    if(dur===180) return c.ownPaddle180;
    return c.ownPaddle60;
  }
  if(dur===30)  return c.price30;
  if(dur===60)  return c.price60;
  if(dur===90)  return c.price90||c.price60*1.5;
  if(dur===120) return c.price120||c.price60*2;
  if(dur===180) return c.price180||c.price60*3;
  return c.price60;
}

function updateSlotPrice() {
  if(!selectedSlot) return;
  selectedSlot.price = getCourtPrice(activeCourt, selectedSlot.dur);
  const priceEl = document.getElementById('ct-sel-price');
  if(priceEl) {
    if(courtPayMode === 'later') {
      priceEl.innerHTML = `<span style="color:var(--go);">₹${selectedSlot.price.toLocaleString('en-IN')}</span> <span style="font-size:0.75rem;color:var(--mu);">(collect later)</span>`;
    } else {
      priceEl.textContent = '₹'+selectedSlot.price.toLocaleString('en-IN');
    }
  }
}

function renderCourtInfoBar() {
  const el = document.getElementById('ct-info-bar'); if(!el) return;
  const c = COURTS[activeCourt];
  const closeLabel = c.nextDay ? c.close+' (next day)' : c.close;
  if(activeCourt === 'bowling') {
    const tier = autoTier();
    const price = prices[tier] || 250;
    const tierLabel = tier==='early'?'before 5pm':tier==='wknd'?'Weekend':'after 5pm';
    el.innerHTML = `<span style="color:#7c3aed;font-weight:700;">🎳 Bowling</span>
      &nbsp;·&nbsp; <span style="color:var(--mu);">Hours: ${c.open} – ${c.close}</span>
      &nbsp;·&nbsp; ₹${price.toLocaleString('en-IN')}/person/game &nbsp;<span style="color:var(--mu);font-size:0.75rem;">[${tierLabel}]</span>`;
    return;
  }
  const p30 = getCourtPrice(activeCourt,30);
  const p60 = getCourtPrice(activeCourt,60);
  const p120= getCourtPrice(activeCourt,120);
  const paddleNote = (activeCourt==='pickleball'&&ownPaddleMode) ? ' <span style="color:#1d4ed8;font-size:0.75rem;">🏓 Own Paddle Rate</span>' : '';
  el.innerHTML = `<span style="color:${c.color};font-weight:700;">${c.icon} ${c.name}</span>
    &nbsp;·&nbsp; <span style="color:var(--mu);">Hours: ${c.open} – ${closeLabel}</span>
    &nbsp;·&nbsp; ₹${p60.toLocaleString('en-IN')}/hr &nbsp; ₹${p30.toLocaleString('en-IN')}/30min &nbsp; ₹${p120.toLocaleString('en-IN')}/2hr${paddleNote}`;
}

// Generate all 30-min slots for a sport on a given date
function generateSlots(sport, dateStr) {
  const c = COURTS[sport];
  const slots = [];
  // Parse open/close as minutes from midnight
  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  let startMin = toMin(c.open);
  let closeMin = toMin(c.close);
  if(c.nextDay || closeMin === 0) closeMin = 24*60; // 2am next day = 26*60? handle midnight+
  if(c.close === '02:00' && c.nextDay) closeMin = 26*60; // 2am next day
  if(c.close === '24:00') closeMin = 24*60;

  for(let m = startMin; m + 30 <= closeMin; m += 30) {
    const hh = String(Math.floor(m/60)%24).padStart(2,'0');
    const mm = String(m%60).padStart(2,'0');
    const endH= Math.floor((m+60)/60)%24; const endM= (m+60)%60;
    const endHH30= String(Math.floor((m+30)/60)%24).padStart(2,'0'); const endMM30=String((m+30)%60).padStart(2,'0');
    const timeKey = hh+':'+mm;
    // Can we fit 1hr?
    const canHr = m + 60 <= closeMin;
    slots.push({ timeKey, display: hh+':'+mm, canHr });
  }
  return slots;
}

// Check if a slot is booked (any booking overlaps)
function isSlotBooked(sport, dateStr, startTime, durMin) {
  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const sMin = toMin(startTime);
  const eMin = sMin + durMin;
  return courtBk.filter(b => b.sport===sport && b.date===dateStr && b.status!=='cancelled').some(b => {
    const bS = toMin(b.slot); const bE = bS + parseInt(b.dur);
    return sMin < bE && eMin > bS; // overlap check
  });
}

function renderCourtSlots() {
  initCourtDate();
  const dateEl = document.getElementById('ct-date'); if(!dateEl) return;
  const dateStr = dateEl.value || new Date().toISOString().slice(0,10);
  const grid = document.getElementById('ct-slot-grid'); if(!grid) return;
  const c = COURTS[activeCourt];

  // Bowling uses its own booking panel — not slot grid
  if (activeCourt === 'bowling') {
    renderBowlingBookingPanel(dateStr);
    return;
  }

  const slots = generateSlots(activeCourt, dateStr);
  if(!slots.length){ grid.innerHTML='<div class="empty">No slots available for this sport today</div>'; return; }

  grid.innerHTML = slots.map(s => {
    const booked30  = isSlotBooked(activeCourt, dateStr, s.timeKey, 30);
    const booked60  = s.canHr ? isSlotBooked(activeCourt, dateStr, s.timeKey, 60) : true;
    const booked120 = isSlotBooked(activeCourt, dateStr, s.timeKey, 120);
    const allBooked = booked30 && booked60 && booked120;
    const isSelected = selectedSlot && selectedSlot.time===s.timeKey;
    const cls = allBooked ? 'booked' : isSelected ? 'selected' : 'free';

    const avail = [];
    if(!booked30)  avail.push('30m');
    if(!booked60)  avail.push('1hr');
    if(!booked120) avail.push('2hr');
    if(!isSlotBooked(activeCourt, dateStr, s.timeKey, 180)) avail.push('3hr');

    const statusLabel = allBooked ? '✗ Booked' : isSelected ? '✓ Selected' : avail.join(' / ');
    const p30 = getCourtPrice(activeCourt,30), p60 = getCourtPrice(activeCourt,60);
    const price = !allBooked ? '₹'+p30+' / ₹'+p60 : '';
    const clickHandler = allBooked ? '' : `selectSlot('${s.timeKey}',${!booked60},${booked60},${booked120})`;
    return `<div class="slot ${cls}" onclick="${clickHandler}">
      <div class="slot-time">${s.display}</div>
      <div class="slot-status">${statusLabel}</div>
      ${price?`<div style="font-size:0.65rem;color:var(--mu);margin-top:3px;">${price}</div>`:''}
    </div>`;
  }).join('');

  renderCourtTodayBk();
  renderCourtInfoBar();
  const title = document.getElementById('ct-grid-title');
  if(title) title.textContent = c.icon+' '+c.name+' — '+new Date(dateStr+'T12:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
}

function selectSlot(time, canHr, booked60, booked120) {
  const c = COURTS[activeCourt];
  const dateEl = document.getElementById('ct-date');
  const dateStr = dateEl ? dateEl.value : new Date().toISOString().slice(0,10);
  // Build duration options
  const opts = [{dur:30, avail:true}];
  if(canHr) opts.push({dur:60, avail:!booked60});
  opts.push({dur:120, avail:!booked120});
  opts.push({dur:180, avail:!isSlotBooked(activeCourt, dateStr, time, 180)});
  const avail = opts.filter(o=>o.avail);
  // Default to longest available that is ≤60, else shortest
  const defaultDur = avail.find(o=>o.dur===60) ? 60 : avail[avail.length-1]?.dur || 30;
  const dur   = defaultDur;
  const price = getCourtPrice(activeCourt, dur);
  selectedSlot = { time, dur, price, availDurs: avail.map(o=>o.dur) };

  const panel   = document.getElementById('ct-sel-panel');
  const desc    = document.getElementById('ct-sel-desc');
  const priceEl = document.getElementById('ct-sel-price');
  if(panel) panel.style.display='block';

  const durLabel = dur<60?dur+'min':dur===60?'1 hr':dur===90?'1.5 hr':dur===120?'2 hr':'3 hr';
  const durBtns = avail.map(o=>{
    const lbl = o.dur<60?o.dur+'m':o.dur===60?'1hr':o.dur===90?'1.5hr':o.dur===120?'2hr':'3hr';
    const active = o.dur===dur;
    return `<button onclick="setSlotDur(${o.dur})" style="font-size:0.7rem;padding:2px 9px;border-radius:5px;cursor:pointer;
      background:${active?'var(--cy)':'rgba(255,255,255,0.08)'};
      border:1px solid ${active?'var(--cy)':'rgba(255,255,255,0.15)'};
      color:${active?'#fff':'var(--cy)'};transition:all 0.15s;" id="dur-btn-${o.dur}">${lbl}</button>`;
  }).join('');

  if(desc)  desc.innerHTML = COURTS[activeCourt].icon+' <b>'+COURTS[activeCourt].name+'</b> &nbsp;·&nbsp; '+time
    +'<br><div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap;">'+durBtns+'</div>';
  updateSlotPrice();
  renderCourtSlots();
}

function setSlotDur(dur) {
  if(!selectedSlot) return;
  selectedSlot.dur   = dur;
  selectedSlot.price = getCourtPrice(activeCourt, dur);
  // Update button states
  (selectedSlot.availDurs||[dur]).forEach(d => {
    const btn = document.getElementById('dur-btn-'+d);
    if(!btn) return;
    const active = d===dur;
    btn.style.background = active?'var(--cy)':'rgba(255,255,255,0.08)';
    btn.style.border     = active?'1px solid var(--cy)':'1px solid rgba(255,255,255,0.15)';
    btn.style.color      = active?'#fff':'var(--cy)';
  });
  updateSlotPrice();
}

function clearCourtSel() {
  selectedSlot = null;
  const panel = document.getElementById('ct-sel-panel');
  if(panel) panel.style.display='none';
  renderCourtSlots();
}

function confirmCourtBook() {
  if(!selectedSlot) { toast('Select a slot first',true); return; }
  const dateEl = document.getElementById('ct-date');
  const dateStr = dateEl ? dateEl.value : new Date().toISOString().slice(0,10);
  const custNameEl = document.getElementById('ct-cust-name');
  const card = zoneCards.ct;
  const walkinName = (custNameEl||{}).value.trim();

  // Double-check not booked in the meantime
  if(isSlotBooked(activeCourt, dateStr, selectedSlot.time, selectedSlot.dur)){
    toast('Slot just got booked — please pick another',true); clearCourtSel(); return;
  }

  if(courtPayMode==='rfid') {
    if(!card){ toast('Tap customer card first',true); return; }
    if(card.cashBalance < selectedSlot.price){ toast('Insufficient balance — card has '+fmt(card.cashBalance),true); return; }
  }

  const custName = card ? card.name : (walkinName || 'Walk-in');
  const c = COURTS[activeCourt];
  const endMin = selectedSlot.time.split(':').reduce((h,m,i)=>i===0?+m*60:h+m*1,0) + selectedSlot.dur;
  const endTime = String(Math.floor(endMin/60)%24).padStart(2,'0')+':'+String(endMin%60).padStart(2,'0');
  const durLabel = selectedSlot.dur<60?selectedSlot.dur+'min':selectedSlot.dur===60?'1 hr':selectedSlot.dur===90?'1.5 hr':selectedSlot.dur===120?'2 hr':'3 hr';
  const paddleNote = (activeCourt==='pickleball'&&ownPaddleMode) ? '<div style="color:#1d4ed8;font-size:0.78rem;">🏓 Own Paddle Rate</div>' : '';
  const payLaterNote = courtPayMode==='later' ? '<div style="color:var(--go);font-size:0.78rem;margin-top:4px;">🕐 Payment to be collected later</div>' : '';

  openM('✓ Confirm Court Booking',
    `<div style="font-size:0.86rem;line-height:1.9;">
     <div style="background:rgba(91,191,255,0.08);border:1px solid rgba(91,191,255,0.2);border-radius:9px;padding:11px;margin-bottom:10px;">
       <div style="font-weight:700;font-size:0.92rem;">${c.icon} ${c.name}</div>
       <div style="color:var(--mu);">📅 ${new Date(dateStr+'T12:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</div>
       <div>⏰ ${selectedSlot.time} – ${endTime} &nbsp;(${durLabel})</div>
       <div>👤 ${custName}</div>
       ${paddleNote}
       <div style="color:var(--cy);font-family:'JetBrains Mono',monospace;font-size:1rem;margin-top:6px;">₹${selectedSlot.price.toLocaleString('en-IN')}</div>
       ${payLaterNote}
     </div>
     ${card&&courtPayMode==='rfid'?`Cash after: <span style="color:var(--cy);">${fmt(card.cashBalance-selectedSlot.price)}</span>`:''}
    </div>`,
    [{label:'✓ Confirm',cls:'btn-mg',fn:()=>{ doCourtBook(card, custName, dateStr, endTime); closeM(); }},
     {label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

function doCourtBook(card, custName, dateStr, endTime) {
  const bk = {
    id: Date.now(),
    sport: activeCourt,
    date: dateStr,
    slot: selectedSlot.time,
    endTime,
    dur: selectedSlot.dur,
    customer: custName,
    rfid: card ? card.rfid : 'WALKIN',
    payMethod: courtPayMode,
    amt: selectedSlot.price,
    ownPaddle: (activeCourt==='pickleball' && ownPaddleMode),
    status: courtPayMode==='later' ? 'pending_payment' : 'confirmed',
    bookedAt: nowStr(),
    bookedBy: me ? me.name : 'Staff',
  };
  courtBk.unshift(bk);
  if(courtBk.length>500) courtBk=courtBk.slice(0,500);
  lsSet(LS.courtBk, courtBk);
  if(db&&syncOk) db.ref('court_bk/'+bk.id).set(bk);

  if(courtPayMode !== 'later') {
    if(card && courtPayMode==='rfid') {
      card.cashBalance -= selectedSlot.price;
      card.spent += selectedSlot.price;
      persist('cards');
      addTxnRecord(card, COURTS[activeCourt].name, selectedSlot.dur+'min slot '+selectedSlot.time+(bk.ownPaddle?' [Own Paddle]':''), selectedSlot.price, 0, 'debit');
      const wc = document.getElementById('ct-wc'); if(wc) wc.innerHTML = walletHTML(card);
    } else {
      const wt = {id:bk.id,time:nowStr(),customer:custName,rfid:card?card.rfid:'WALKIN',counter:COURTS[activeCourt].name,
        desc:selectedSlot.dur+'min slot '+selectedSlot.time+' ['+courtPayMode.toUpperCase()+']'+(bk.ownPaddle?' [Own Paddle]':''),
        cashAmt:selectedSlot.price,bonusAmt:0,type:'debit',cashBalAfter:0,bonusBalAfter:0,payMethod:courtPayMode};
      txns.unshift(wt); lsSet(LS.txns,txns);
      if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
    }
  }

  const payLabel = courtPayMode==='later'?'⏳ Pay Later':courtPayMode==='rfid'?'📡 RFID':courtPayMode==='cash'?'💵 Cash':'📱 UPI';
  toast(COURTS[activeCourt].name+' booked — '+selectedSlot.time+' · ₹'+selectedSlot.price.toLocaleString('en-IN')+' · '+payLabel);
  clearCourtSel();
  renderReceptionBookings(); renderTodaysSales();
}

function manualCourtBook() {
  const time = (document.getElementById('ct-manual-time')||{}).value;
  const dur  = parseInt((document.getElementById('ct-manual-dur')||{}).value)||60;
  const name = (document.getElementById('ct-manual-name')||{}).value.trim();
  const dateEl = document.getElementById('ct-date');
  const dateStr = dateEl ? dateEl.value : new Date().toISOString().slice(0,10);
  if(!time){ toast('Enter start time',true); return; }
  if(!name && !zoneCards.ct){ toast('Enter customer name or tap RFID card',true); return; }
  const price = getCourtPrice(activeCourt, dur);
  selectedSlot = { time, dur, price };
  const card = zoneCards.ct;
  const custName = card ? card.name : name;
  if(isSlotBooked(activeCourt, dateStr, time, dur)){
    toast('That slot overlaps an existing booking',true); return;
  }
  const endMin = time.split(':').reduce((h,m,i)=>i===0?+m*60:h+m*1,0)+dur;
  const endTime = String(Math.floor(endMin/60)%24).padStart(2,'0')+':'+String(endMin%60).padStart(2,'0');
  doCourtBook(card, custName, dateStr, endTime);
}

function cancelCourtBk(id) {
  const bk = courtBk.find(b=>b.id===id); if(!bk) return;
  openM('Cancel Booking?',
    `<div style="font-size:0.86rem;">${COURTS[bk.sport]?.icon||''} <b>${bk.customer}</b><br>${bk.slot}–${bk.endTime||''} · ${bk.dur}min<br><span style="color:var(--mu);">Refund handled manually.</span></div>`,
    [{label:'Yes, Cancel',cls:'btn-rd',fn:()=>{
      bk.status='cancelled';
      lsSet(LS.courtBk, courtBk);
      if(db&&syncOk) db.ref('court_bk/'+bk.id).set(bk);
      closeM(); toast('Booking cancelled'); renderCourtSlots();
    }},{label:'Back',cls:'btn-gh',fn:closeM}]
  );
}

// ═══════════════════════════════════════════
//  BOWLING BOOKING PANEL
// ═══════════════════════════════════════════
function renderBowlingBookingPanel(dateStr) {
  const grid = document.getElementById('ct-slot-grid'); if(!grid) return;
  const title = document.getElementById('ct-grid-title');
  if(title) title.textContent = '🎳 Bowling Lane Booking';

  const tier = autoTier();
  const pricePerGame = prices[tier] || 250;
  const tierLabel = tier==='early'?'Weekday before 5pm':tier==='wknd'?'Weekend/Holiday':'Weekday after 5pm';

  grid.innerHTML = `
    <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:16px;">
      <div style="font-size:0.75rem;font-weight:700;color:#7c3aed;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">🎳 New Bowling Booking</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div>
          <label class="f" style="margin-bottom:3px;">Persons</label>
          <input type="number" id="bowl-bk-persons" value="2" min="1" max="8" style="margin-bottom:0;" oninput="updateBowlBkTotal()">
        </div>
        <div>
          <label class="f" style="margin-bottom:3px;">Games</label>
          <input type="number" id="bowl-bk-games" value="1" min="1" max="10" style="margin-bottom:0;" oninput="updateBowlBkTotal()">
        </div>
      </div>

      <div style="background:#fff;border:1px solid #ddd6fe;border-radius:9px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:0.72rem;color:var(--mu);margin-bottom:3px;">${tierLabel} · ₹${pricePerGame}/person/game</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.3rem;font-weight:700;color:#7c3aed;" id="bowl-bk-total">₹${pricePerGame * 2}</div>
      </div>

      <label class="f" style="margin-bottom:3px;">Customer Name</label>
      <input type="text" id="bowl-bk-name" placeholder="Guest name or mobile" style="margin-bottom:10px;">

      <label class="f" style="margin-bottom:3px;">Time Slot (optional)</label>
      <input type="time" id="bowl-bk-time" style="margin-bottom:10px;">

      <label class="f" style="margin-bottom:3px;">Note (optional)</label>
      <input type="text" id="bowl-bk-note" placeholder="e.g. Birthday party, Lane 3" style="margin-bottom:12px;">

      <button class="btn btn-fw" style="background:#7c3aed;color:#fff;font-weight:700;" onclick="confirmBowlingBook()">✓ Confirm Bowling Booking</button>
    </div>`;

  renderCourtTodayBk();
  renderCourtInfoBar();
}

function updateBowlBkTotal() {
  const tier = autoTier();
  const price = prices[tier] || 250;
  const p = parseInt((document.getElementById('bowl-bk-persons')||{}).value)||1;
  const g = parseInt((document.getElementById('bowl-bk-games')||{}).value)||1;
  const el = document.getElementById('bowl-bk-total');
  if(el) el.textContent = '₹'+(p*g*price).toLocaleString('en-IN');
}

function confirmBowlingBook() {
  const tier = autoTier();
  const pricePerGame = prices[tier] || 250;
  const persons  = parseInt((document.getElementById('bowl-bk-persons')||{}).value)||1;
  const games    = parseInt((document.getElementById('bowl-bk-games')||{}).value)||1;
  const custName = (document.getElementById('bowl-bk-name')||{}).value.trim() || 'Walk-in';
  const timeVal  = (document.getElementById('bowl-bk-time')||{}).value || '';
  const note     = (document.getElementById('bowl-bk-note')||{}).value.trim();
  const total    = persons * games * pricePerGame;
  const card     = zoneCards.ct;
  const dateEl   = document.getElementById('ct-date');
  const dateStr  = dateEl ? dateEl.value : new Date().toISOString().slice(0,10);

  if(courtPayMode==='rfid') {
    if(!card){ toast('Tap customer card first',true); return; }
    if(card.cashBalance < total){ toast('Insufficient balance — card has '+fmt(card.cashBalance),true); return; }
  }

  const tierLabel = tier==='early'?'before 5pm':tier==='wknd'?'Weekend':'after 5pm';
  const payLabel  = courtPayMode==='rfid'?'📡 RFID':courtPayMode==='cash'?'💵 Cash':courtPayMode==='upi'?'📱 UPI':'🕐 Pay Later';
  const name      = card ? card.name : custName;

  openM('✓ Confirm Bowling Booking',
    `<div style="font-size:0.86rem;line-height:1.9;">
     <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:9px;padding:11px;margin-bottom:10px;">
       <div style="font-weight:700;">🎳 Bowling &nbsp;·&nbsp; ${new Date(dateStr+'T12:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</div>
       <div>👤 ${name}</div>
       <div>👥 ${persons} person${persons>1?'s':''} × ${games} game${games>1?'s':''} [${tierLabel}]</div>
       ${timeVal?`<div>⏰ Starting ${timeVal}</div>`:''}
       ${note?`<div style="color:var(--mu);font-size:0.8rem;">📝 ${note}</div>`:''}
       <div style="font-family:'JetBrains Mono',monospace;color:#7c3aed;font-size:1rem;margin-top:6px;">₹${total.toLocaleString('en-IN')}</div>
       <div style="font-size:0.78rem;color:var(--mu);">${payLabel}</div>
       ${courtPayMode==='later'?'<div style="color:var(--go);font-size:0.78rem;">Payment to be collected later</div>':''}
     </div>
     ${card&&courtPayMode==='rfid'?`<div>Cash after: <span style="color:var(--cy);">${fmt(card.cashBalance-total)}</span></div>`:''}
    </div>`,
    [{label:'✓ Confirm', cls:'btn-mg', fn:()=>{ doBowlingBook(card, name, dateStr, persons, games, total, timeVal, note, tier); closeM(); }},
     {label:'Cancel', cls:'btn-gh', fn:closeM}]
  );
}

function doBowlingBook(card, custName, dateStr, persons, games, total, timeVal, note, tier) {
  const bk = {
    id: Date.now(),
    sport: 'bowling',
    date: dateStr,
    slot: timeVal || '—',
    endTime: '',
    dur: 0,
    customer: custName,
    rfid: card ? card.rfid : 'WALKIN',
    payMethod: courtPayMode,
    amt: total,
    persons, games, tier,
    note: note || '',
    status: courtPayMode==='later' ? 'pending_payment' : 'confirmed',
    bookedAt: nowStr(),
    ownPaddle: false,
  };
  courtBk.push(bk);
  lsSet(LS.courtBk, courtBk);
  if(db&&syncOk) db.ref('court_bk/'+bk.id).set(bk);

  // Charge RFID wallet if selected
  if(card && courtPayMode==='rfid') {
    card.cashBalance -= total; card.spent += total;
    persist('cards');
    addTxnRecord(card, 'Bowling', persons+'p × '+games+'g ['+tier+'] '+(timeVal?'@ '+timeVal:'')+(note?' ('+note+')':''), total, 0, 'debit');
    const wc = document.getElementById('ct-wc'); if(wc) wc.innerHTML = walletHTML(card);
  }

  // Record non-RFID transaction for reports
  if(courtPayMode !== 'rfid') {
    const wt = {id:Date.now()+1,time:nowStr(),customer:custName,rfid:card?card.rfid:'WALKIN',
      counter:'Bowling',desc:persons+'p × '+games+'g ['+tier+'] '+courtPayMode.toUpperCase()+(timeVal?' @ '+timeVal:'')+(note?' ('+note+')':''),
      cashAmt:courtPayMode==='later'?0:total,bonusAmt:0,type:'debit',cashBalAfter:0,bonusBalAfter:0,payMethod:courtPayMode};
    txns.unshift(wt); lsSet(LS.txns,txns);
    if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
  }

  toast('🎳 Bowling booked — '+custName+' · '+persons+'p × '+games+'g · '+fmt(total)+(courtPayMode==='later'?' [Pay Later]':''));

  // Reset fields
  const nEl = document.getElementById('bowl-bk-name'); if(nEl) nEl.value='';
  const tEl = document.getElementById('bowl-bk-time'); if(tEl) tEl.value='';
  const noEl = document.getElementById('bowl-bk-note'); if(noEl) noEl.value='';
  renderBowlingBookingPanel(dateStr);
  renderReceptionBookings(); renderTodaysSales();
}

function renderCourtTodayBk() {
  const el = document.getElementById('ct-today-bk'); if(!el) return;
  const dateEl = document.getElementById('ct-date');
  const dateStr = dateEl ? dateEl.value : new Date().toISOString().slice(0,10);
  const bks = courtBk.filter(b=>b.date===dateStr && b.sport===activeCourt).sort((a,b)=>a.slot>b.slot?1:-1);
  if(!bks.length){ el.innerHTML='<div class="empty">No bookings for this date</div>'; return; }
  el.innerHTML = bks.map(b=>`
    <div class="hr" style="${b.status==='cancelled'?'opacity:0.45;':''}">
      <div>
        <div style="font-weight:600;font-size:0.85rem;">${b.customer}
          ${b.status==='cancelled'?'<span style="color:#f87171;font-size:0.68rem;">CANCELLED</span>':''}
          ${b.status==='pending_payment'?'<span style="color:var(--go);font-size:0.68rem;">⏳ PAY LATER</span>':''}
          ${b.ownPaddle?'<span style="color:#1d4ed8;font-size:0.68rem;">🏓 Own Paddle</span>':''}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--cy);">${b.slot}–${b.endTime||''}</div>
        <div style="font-size:0.65rem;color:var(--mu);">${b.sport==='bowling'?(b.persons+'p × '+b.games+'g'):b.dur+'min'} · ${b.payMethod==='upi'?'📱 UPI':b.payMethod==='cash'?'💵 Cash':b.payMethod==='later'?'🕐 Pay Later':'📡 RFID'} · ${b.bookedAt||''}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'JetBrains Mono',monospace;color:var(--cy);font-size:0.82rem;">₹${(b.amt||0).toLocaleString('en-IN')}</div>
        ${b.status==='pending_payment'?`<button onclick="markCourtPaid(${b.id})" style="font-size:0.65rem;padding:2px 7px;border-radius:5px;background:rgba(22,163,74,0.1);border:1px solid rgba(22,163,74,0.3);color:var(--gr);cursor:pointer;margin-top:3px;">✓ Mark Paid</button>`:''}
        ${b.status!=='cancelled'?`<button onclick="cancelCourtBk(${b.id})" style="font-size:0.65rem;padding:2px 7px;border-radius:5px;background:rgba(226,75,74,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;cursor:pointer;margin-top:3px;">Cancel</button>`:''}
      </div>
    </div>`).join('');
}

function markCourtPaid(id) {
  const bk = courtBk.find(b=>b.id===id); if(!bk) return;
  openM('✓ Mark as Paid',
    `<div style="font-size:0.86rem;line-height:1.9;">
      <b>${COURTS[bk.sport]?.icon} ${bk.customer}</b><br>
      ${bk.slot}–${bk.endTime||''} · ${bk.dur}min<br>
      Amount: <b style="color:var(--cy);">₹${(bk.amt||0).toLocaleString('en-IN')}</b>
      <div style="margin-top:10px;">
        <label class="f" style="margin-bottom:5px;">Payment Method</label>
        <select id="paid-method" style="margin-bottom:0;">
          <option value="cash">💵 Cash</option>
          <option value="upi">📱 UPI</option>
          <option value="rfid">📡 RFID</option>
        </select>
      </div>
    </div>`,
    [{label:'✓ Mark Paid',cls:'btn-gn',fn:()=>{
      const method = (document.getElementById('paid-method')||{}).value || 'cash';
      bk.status = 'confirmed';
      bk.payMethod = method;
      bk.paidAt = nowStr();
      lsSet(LS.courtBk, courtBk);
      if(db&&syncOk) db.ref('court_bk/'+bk.id).set(bk);
      // Record transaction
      const wt = {id:Date.now(),time:nowStr(),customer:bk.customer,rfid:bk.rfid||'WALKIN',counter:COURTS[bk.sport]?.name||'Court',
        desc:bk.dur+'min slot '+bk.slot+' ['+method.toUpperCase()+' — paid after]'+(bk.ownPaddle?' [Own Paddle]':''),
        cashAmt:bk.amt,bonusAmt:0,type:'debit',cashBalAfter:0,bonusBalAfter:0,payMethod:method};
      txns.unshift(wt); lsSet(LS.txns,txns);
      if(db&&syncOk) db.ref('txns/'+wt.id).set(wt);
      closeM(); toast(bk.customer+' — ₹'+bk.amt.toLocaleString('en-IN')+' marked as paid ✓');
      renderCourtTodayBk(); renderReceptionBookings(); renderTodaysSales();
    }},{label:'Cancel',cls:'btn-gh',fn:closeM}]
  );
}

// ─── TODAY'S SALES DASHBOARD ───────────────────────────────────────────────

let salesBreakdownOpen = true;
let guestSectionActive = 'all'; // 'all' | 'hotel' | 'gz' | 'walkin'
// Store last-computed guest rows for tab switching without re-querying
let _lastGuestRows = { all:[], hotel:[], gz:[], walkin:[] };

function toggleSalesBreakdown() {
  salesBreakdownOpen = !salesBreakdownOpen;
  const body = document.getElementById('sales-breakdown-body');
  const icon = document.getElementById('sales-breakdown-toggle-icon');
  if (body) body.style.display = salesBreakdownOpen ? '' : 'none';
  if (icon) icon.textContent = salesBreakdownOpen ? '\u25bc' : '\u25ba';
}

function getTodayPrefix() {
  const d = new Date();
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return String(d.getDate()).padStart(2,'0') + ' ' + months[d.getMonth()];
}
function getYesterdayPrefix() {
  const d = new Date(); d.setDate(d.getDate()-1);
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return String(d.getDate()).padStart(2,'0') + ' ' + months[d.getMonth()];
}
function txnMatchesFilter(t, filter) {
  if (filter === 'all') return true;
  const tl = (t.time||'').toLowerCase();
  if (filter === 'today') return tl.startsWith(getTodayPrefix());
  if (filter === 'yesterday') return tl.startsWith(getYesterdayPrefix());
  if (filter === '7d' || filter === '30d') {
    try {
      const parts = t.time.match(/(\d+)\s+(\w+)\s+(\d+)/);
      if (!parts) return false;
      const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
      const d = new Date(parseInt(parts[3]), months[parts[2].toLowerCase()], parseInt(parts[1]));
      const now = new Date(); now.setHours(0,0,0,0);
      const days = filter === '7d' ? 7 : 30;
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days + 1);
      return d >= cutoff;
    } catch(e) { return false; }
  }
  return false;
}

// Classify an RFID: 'hotel' | 'walkin' | 'gz' | 'card'
function classifyRfid(rfid, cardObj) {
  if (!rfid || rfid === 'WALKIN') return 'walkin';
  if (cardObj && cardObj.isGuest) return 'hotel';
  if (rfid && rfid.toUpperCase().startsWith('GZ')) return 'gz';
  if (cardObj && cardObj.cardType === 'gz') return 'gz';
  return 'card';
}

function showGuestSection(section) {
  guestSectionActive = section;
  // Update tab styles
  ['all','hotel','gz','walkin'].forEach(s => {
    const el = document.getElementById('gtab-'+s);
    if (!el) return;
    if (s === section) {
      el.style.borderBottomColor = 'var(--cy)';
      el.style.color = 'var(--cy)';
    } else {
      el.style.borderBottomColor = 'transparent';
      el.style.color = 'var(--mu)';
    }
  });
  _renderGuestTable(_lastGuestRows[section] || [], section);
}

function renderTodaysSales() {
  const filter = (document.getElementById('sales-date-filter')||{}).value || 'today';

  const debitTxns  = txns.filter(t => t.type === 'debit' && txnMatchesFilter(t, filter));
  const creditTxns = txns.filter(t => t.type === 'credit' && t.counter === 'Reception' && txnMatchesFilter(t, filter));

  // Walk-in txns = rfid is 'WALKIN' — actual cash/UPI collected at counter
  const walkinDebitTxns = debitTxns.filter(t => t.rfid === 'WALKIN');
  const rfidDebitTxns   = debitTxns.filter(t => t.rfid !== 'WALKIN');

  const walkinCash  = walkinDebitTxns.filter(t => (t.payMethod||'cash') === 'cash').reduce((s,t) => s + (t.cashAmt||0), 0);
  const walkinUPI   = walkinDebitTxns.filter(t => t.payMethod === 'upi').reduce((s,t) => s + (t.cashAmt||0), 0);
  const rfidCash    = rfidDebitTxns.reduce((s,t) => s + (t.cashAmt||0), 0);
  const rfidBonus   = rfidDebitTxns.reduce((s,t) => s + (t.bonusAmt||0), 0);

  const totalRevenue   = debitTxns.reduce((s,t) => s + (t.cashAmt||0) + (t.bonusAmt||0), 0);
  const totalCollected = creditTxns.reduce((s,t) => s + (t.cashAmt||0), 0);

  // Update KPIs
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('kpi-revenue',     fmt(totalRevenue));
  set('kpi-cash',        fmt(walkinCash));
  set('kpi-upi',         fmt(walkinUPI));
  set('kpi-rfid-wallet', fmt(rfidCash));
  set('kpi-bonus-used',  fmt(rfidBonus));
  set('dash-rev-preview', fmt(totalRevenue));
  set('kpi-txns-sub', debitTxns.length + ' transaction' + (debitTxns.length !== 1 ? 's' : ''));

  // kpi-pm-breakdown kept hidden for JS compat
  const pmBreak = document.getElementById('kpi-pm-breakdown');
  if (pmBreak) pmBreak.innerHTML = '';

  // ── Counter revenue bars ──
  const counterColors = {'Bowling':'#7c3aed','Game Zone':'#d97706','Food & Beverages':'#16a34a','Food':'#16a34a','Theatre':'#2563eb','Reception':'#1a7a5e'};
  const counterMap = {};
  debitTxns.forEach(t => {
    const key = t.counter || 'Other';
    if (!counterMap[key]) counterMap[key] = 0;
    counterMap[key] += (t.cashAmt||0) + (t.bonusAmt||0);
  });
  const counterEntries = Object.entries(counterMap).sort((a,b)=>b[1]-a[1]);
  const maxAmt = counterEntries.length ? counterEntries[0][1] : 1;
  const barsEl = document.getElementById('sales-counter-bars');
  if (barsEl) {
    if (!counterEntries.length) {
      barsEl.innerHTML = '<div style="font-size:0.78rem;color:var(--mu);padding:6px 0;">No activity yet</div>';
    } else {
      barsEl.innerHTML = counterEntries.map(([name, amt]) => {
        const col = counterColors[name] || '#64748b';
        const pct = Math.max(4, Math.round((amt / maxAmt) * 100));
        return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
          +'<div style="width:90px;font-size:0.72rem;font-weight:700;color:var(--tx);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+name+'</div>'
          +'<div style="flex:1;height:18px;background:#f1f5f9;border-radius:4px;overflow:hidden;">'
          +'<div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:4px;transition:width 0.3s;"></div>'
          +'</div>'
          +'<div style="width:60px;font-size:0.72rem;font-weight:800;color:'+col+';text-align:right;font-family:JetBrains Mono,monospace;">'+fmt(amt)+'</div>'
          +'</div>';
      }).join('');
    }
  }

  // ── Build guest maps ──
  const cardGuestMap   = {}; // RFID card (hotel + GZ + regular)
  const walkinTxns     = []; // WALKIN rfid

  debitTxns.forEach(t => {
    if (t.rfid === 'WALKIN') {
      walkinTxns.push(t);
      return;
    }
    const key = t.rfid || t.customer || 'unknown';
    if (!cardGuestMap[key]) {
      const cardObj = cards.find(c => c.rfid === key);
      cardGuestMap[key] = {
        name: t.customer, rfid: t.rfid||'',
        cardObj,
        type: classifyRfid(t.rfid, cardObj),
        cashSpent:0, bonusSpent:0, txnCount:0
      };
    }
    cardGuestMap[key].cashSpent  += (t.cashAmt||0);
    cardGuestMap[key].bonusSpent += (t.bonusAmt||0);
    cardGuestMap[key].txnCount++;
    // Track last transaction time for sort-by-recent
    const ts = t.ts || t.id || 0;
    if (!cardGuestMap[key].lastTxnTime || ts > cardGuestMap[key].lastTxnTime) {
      cardGuestMap[key].lastTxnTime = ts;
      cardGuestMap[key].lastTxnTimeStr = t.time || '';
    }
  });

  const allCardRows = Object.values(cardGuestMap).sort((a,b) => (b.cashSpent+b.bonusSpent)-(a.cashSpent+a.bonusSpent));
  const hotelRows   = allCardRows.filter(g => g.type === 'hotel');
  const gzRows      = allCardRows.filter(g => g.type === 'gz');

  // Group walk-ins
  const walkinMap = {};
  walkinTxns.forEach(t => {
    const key = (t.customer||'Walk-in') + '|' + (t.payMethod||'');
    if (!walkinMap[key]) walkinMap[key] = {name:t.customer||'Walk-in', payMethod:t.payMethod||'cash', cashSpent:0, txnCount:0};
    walkinMap[key].cashSpent += (t.cashAmt||0);
    walkinMap[key].txnCount++;
  });
  const walkinRows = Object.values(walkinMap).sort((a,b)=>b.cashSpent-a.cashSpent);

  // ── Segment KPIs ──
  const hotelRev  = hotelRows.reduce((s,g)=>s+g.cashSpent+g.bonusSpent,0);
  const gzRev     = gzRows.reduce((s,g)=>s+g.cashSpent+g.bonusSpent,0);
  const walkinRev = walkinRows.reduce((s,g)=>s+g.cashSpent,0);
  const cardRev   = allCardRows.reduce((s,g)=>s+g.cashSpent+g.bonusSpent,0);

  set('kpi-hotel-rev',   fmt(hotelRev));
  set('kpi-hotel-count', hotelRows.length + ' guest' + (hotelRows.length!==1?'s':''));
  set('kpi-walkin-rev',  fmt(walkinRev));
  set('kpi-walkin-count',walkinTxns.length + ' txn' + (walkinTxns.length!==1?'s':''));
  set('kpi-gz-rev',      fmt(gzRev));
  set('kpi-gz-count',    gzRows.length + ' guest' + (gzRows.length!==1?'s':''));
  set('kpi-card-rev',    fmt(cardRev));
  set('kpi-card-count',  allCardRows.length + ' guest' + (allCardRows.length!==1?'s':''));

  // Store for tab switching
  _lastGuestRows = { all: allCardRows, hotel: hotelRows, gz: gzRows, walkin: walkinRows };

  _renderGuestTable(_lastGuestRows[guestSectionActive] || [], guestSectionActive);
}

let guestSortBy = 'spend'; // 'spend' | 'recent' | 'name'
let guestTableExpanded = false;

function toggleGuestTable() {
  guestTableExpanded = !guestTableExpanded;
  const summary = document.getElementById('sales-guest-summary');
  const table   = document.getElementById('sales-breakdown-body');
  const icon    = document.getElementById('gtab-toggle');
  if (summary) summary.style.display = guestTableExpanded ? 'none' : '';
  if (table)   table.style.display   = guestTableExpanded ? '' : 'none';
  if (icon)    icon.textContent       = guestTableExpanded ? '▲' : '▼';
}

function _renderGuestTable(rows, section) {
  const chipsEl  = document.getElementById('sales-guest-chips');
  const emptyEl  = document.getElementById('sales-guest-empty');
  const tbl      = document.getElementById('sales-guest-tbl');
  if (!tbl) return;

  // Apply sort
  rows = [...rows].sort((a,b) => {
    const sortBy = guestSortBy || 'spend';
    if (sortBy === 'recent') return (b.lastTxnTime||0) - (a.lastTxnTime||0);
    if (sortBy === 'name')   return (a.name||'').localeCompare(b.name||'');
    return (b.cashSpent+b.bonusSpent) - (a.cashSpent+a.bonusSpent);
  });

  const isWalkin = section === 'walkin';
  const typeColors = {hotel:'#7c3aed', gz:'#d97706', card:'#2563eb'};
  const typeLabels = {hotel:'🏨', gz:'🎮', card:'💳'};

  if (!rows.length) {
    if (chipsEl)  chipsEl.innerHTML = '';
    if (emptyEl)  emptyEl.style.display = '';
    tbl.innerHTML = '<tr><td colspan="6" class="empty">No activity in this period</td></tr>';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // ── CHIPS (collapsed view) ──
  if (chipsEl) {
    chipsEl.innerHTML = rows.map((g, idx) => {
      const totalSpent = isWalkin ? g.cashSpent : g.cashSpent + g.bonusSpent;
      const col  = isWalkin ? '#16a34a' : (typeColors[g.type] || '#64748b');
      const icon = isWalkin ? (g.payMethod==='upi'?'📱':'💵') : (typeLabels[g.type]||'');
      const name = (g.name||'Walk-in').split(' ')[0]; // first name only on chip
      const roomTag = (!isWalkin && g.type==='hotel' && g.cardObj && g.cardObj.room) ? ' Rm'+g.cardObj.room : '';
      const action = isWalkin ? '' : ' onclick="quickChargeGuest('+idx+',\"'+section+'\")"';
      return '<div'+action+' style="display:inline-flex;align-items:center;gap:5px;background:#fff;border:1.5px solid '+col+'33;border-radius:20px;padding:5px 10px;cursor:'+(isWalkin?'default':'pointer')+';transition:border-color 0.15s;" '
        +'onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">'
        +'<span style="font-size:0.75rem;">'+icon+'</span>'
        +'<span style="font-size:0.78rem;font-weight:700;color:var(--tx);">'+name+roomTag+'</span>'
        +'<span style="font-size:0.72rem;font-weight:800;color:'+col+';font-family:JetBrains Mono,monospace;">'+fmt(totalSpent)+'</span>'
        +(isWalkin ? '' : '<span style="font-size:0.65rem;color:var(--cy);">⚡</span>')
        +'</div>';
    }).join('');
  }

  // ── TABLE (expanded view) ──
  if (isWalkin) {
    tbl.innerHTML = rows.map(g => {
      const pmLabel = g.payMethod==='upi' ? '📱 UPI' : '💵 Cash';
      return '<tr>'
        +'<td style="font-weight:700;">'+(g.name||'Walk-in')+'</td>'
        +'<td><span style="font-size:0.7rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:2px 6px;color:#16a34a;">'+pmLabel+'</span></td>'
        +'<td style="text-align:right;font-family:JetBrains Mono,monospace;font-weight:800;color:var(--cy);">'+fmt(g.cashSpent)+'</td>'
        +'<td style="text-align:right;color:var(--mu);">—</td>'
        +'<td style="text-align:right;color:var(--mu);">—</td>'
        +'<td style="text-align:center;color:var(--mu);">'+g.txnCount+'</td>'
        +'</tr>';
    }).join('');
  } else {
    tbl.innerHTML = rows.map((g, idx) => {
      const card = g.cardObj;
      const cashBal   = card ? fmt(card.cashBalance)  : '—';
      const bonusBal  = card ? fmt(card.bonusBalance) : '—';
      const totalSpent = g.cashSpent + g.bonusSpent;
      const col = typeColors[g.type] || '#64748b';
      const lbl = typeLabels[g.type] || '?';
      const roomTag = (g.type==='hotel' && card && card.room) ? ' <span style="font-size:0.65rem;color:var(--mu);">Rm '+card.room+'</span>' : '';
      return '<tr>'
        +'<td style="font-weight:700;">'+g.name+roomTag+'</td>'
        +'<td><span style="font-size:0.7rem;background:'+col+'18;border:1px solid '+col+'44;border-radius:4px;padding:2px 5px;color:'+col+';font-weight:700;">'+lbl+' '+g.rfid+'</span></td>'
        +'<td style="text-align:right;font-family:JetBrains Mono,monospace;font-weight:800;color:var(--cy);">'+fmt(totalSpent)+'</td>'
        +'<td style="text-align:right;font-family:JetBrains Mono,monospace;color:var(--gr);">'+cashBal+'</td>'
        +'<td style="text-align:right;font-family:JetBrains Mono,monospace;color:var(--go);">'+bonusBal+'</td>'
        +'<td style="text-align:center;">'
        +'<button class="btn btn-cy btn-xs" onclick="quickChargeGuest('+idx+',\"'+section+'\")" style="padding:3px 10px;font-size:0.72rem;">⚡ Charge</button>'
        +'</td>'
        +'</tr>';
    }).join('');
  }
}

// ── QUICK CHARGE MODAL ────────────────────────────────────────────────────
function quickChargeGuest(idx, section) {
  const rows = _lastGuestRows[section] || [];
  const g = rows[idx];
  if (!g || !g.cardObj) { toast('Card not found', true); return; }
  const card = g.cardObj;

  // Refresh card from live array
  const liveCard = cards.find(c => c.rfid === card.rfid);
  if (!liveCard) { toast('Card not found in system', true); return; }

  // Build counter options from active amenities
  const activeAms = amenities.filter(a => a.active && a.type !== 'theatre');

  openM('⚡ Quick Charge — '+liveCard.name,
    '<div style="font-size:0.86rem;">'
    // Wallet summary
    +'<div style="display:flex;gap:8px;margin-bottom:14px;">'
    +'<div style="flex:1;background:rgba(91,191,255,0.08);border:1px solid rgba(91,191,255,0.2);border-radius:8px;padding:8px 12px;text-align:center;">'
    +'<div style="font-size:0.65rem;color:var(--mu);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Cash</div>'
    +'<div style="font-size:1.1rem;font-weight:800;color:var(--cy);font-family:JetBrains Mono,monospace;">'+fmt(liveCard.cashBalance)+'</div>'
    +'</div>'
    +'<div style="flex:1;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:8px 12px;text-align:center;">'
    +'<div style="font-size:0.65rem;color:var(--mu);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Bonus ★</div>'
    +'<div style="font-size:1.1rem;font-weight:800;color:var(--go);font-family:JetBrains Mono,monospace;">'+fmt(liveCard.bonusBalance)+'</div>'
    +'</div>'
    +'</div>'
    // Counter picker
    +'<div style="font-size:0.74rem;font-weight:700;color:var(--mu);margin-bottom:8px;letter-spacing:0.04em;text-transform:uppercase;">Select Counter</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">'
    + activeAms.map((am,i) => {
        const col = am.type==='bowling'?'#7c3aed':am.type==='gamezone'?'#d97706':am.type==='food'?'#16a34a':'#2563eb';
        return '<button onclick="_qcDoCounter('+i+','+JSON.stringify(liveCard.rfid)+')" '
          +'style="padding:10px 6px;border-radius:8px;border:2px solid '+col+'33;background:'+col+'0d;color:'+col+';font-size:0.78rem;font-weight:700;cursor:pointer;text-align:center;">'
          +'<div style="font-size:1.2rem;">'+am.icon+'</div>'+am.name+'</button>';
      }).join('')
    +'</div>'
    +'</div>',
    [{label:'Cancel', cls:'btn-gh', fn:closeM}]
  );
}


let _qcAmCache = {};
function _qcDoCounter(i, rfid) {
  const am = _qcAmCache[i];
  const card = cards.find(c => c.rfid === rfid);
  if (!am || !card) return;
  quickChargeSelectCounter(am.id, am.type, am.name, rfid);
}
function quickChargeSelectCounter(amId, amType, amName, rfid) {
  const card = cards.find(c => c.rfid === rfid);
  if (!card) { toast('Card not found', true); return; }

  if (amType === 'bowling') {
    _quickChargeBowling(card);
  } else if (amType === 'gamezone') {
    _quickChargeGZ(card);
  } else if (amType === 'food') {
    _quickChargeFood(card);
  } else {
    // generic
    _quickChargeGeneric(card, amId, amName);
  }
}

function _quickChargeBowling(card) {
  const rate = prices[bowlTier] || 250;
  const disc = getMemberDiscount(card.rfid);
  const effectiveRate = disc.bowlingFlat ? 199 : rate;

  openM('🎳 Bowling — '+card.name,
    '<div style="font-size:0.86rem;">'
    +'<div style="font-size:0.72rem;color:var(--mu);margin-bottom:10px;">Rate: <b>'+fmt(effectiveRate)+'</b>/person/game ['+bowlTier+']'+(disc.bowlingFlat?' 👑 Member':'')+' · Bonus used first</div>'
    +'<div style="display:flex;gap:10px;margin-bottom:10px;">'
    +'<div style="flex:1;"><label class="f">Persons</label><input type="number" id="qc-bowl-p" value="1" min="1" max="20" style="font-size:1rem;" oninput="qcBowlCalc()"></div>'
    +'<div style="flex:1;"><label class="f">Games</label><input type="number" id="qc-bowl-g" value="1" min="1" max="10" style="font-size:1rem;" oninput="qcBowlCalc()"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px;">'
    +'<button class="disc-btn" id="qc-bd-none" onclick="qcSetBowlDisc(0)" style="background:rgba(255,255,255,0.08);border-color:var(--cy);color:var(--cy);">No Disc</button>'
    +'<button class="disc-btn" id="qc-bd-pct"  onclick="qcSetBowlDisc(1)">% Off</button>'
    +'<button class="disc-btn" id="qc-bd-flat" onclick="qcSetBowlDisc(2)">Flat ₹</button>'
    +'<input type="number" id="qc-bowl-dval" placeholder="Value" min="0" style="flex:1;display:none;font-size:0.85rem;" oninput="qcBowlCalc()">'
    +'</div>'
    +'<label class="f">Reference <span style="color:#ef4444;">*</span></label>'
    +'<input type="text" id="qc-bowl-ref" class="ref-required" placeholder="e.g. Manager, Birthday — required" style="margin-bottom:10px;">'
    +'<div id="qc-bowl-pb" style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:9px;font-size:0.82rem;">'
    +'<div style="color:var(--go);">★ Bonus: <span id="qc-b-bonus">—</span></div>'
    +'<div style="color:var(--cy);">Cash: <span id="qc-b-cash">—</span></div>'
    +'<div style="font-weight:700;border-top:1px solid rgba(0,0,0,0.08);margin-top:6px;padding-top:6px;">Total: <span id="qc-b-total">'+fmt(effectiveRate)+'</span></div>'
    +'</div>'
    +'</div>',
    [{label:'⚡ Charge', cls:'btn-cy', fn:()=>{
      const p = parseInt(document.getElementById('qc-bowl-p').value)||1;
      const g2 = parseInt(document.getElementById('qc-bowl-g').value)||1;
      const raw = p * g2 * effectiveRate;
      const {final:total, discAmt} = applyDiscount(raw, _qcBowlDiscMode, 'qc-bowl-dval', null);
      if (!requireRef('qc-bowl-ref', _qcBowlDiscMode !== 'none')) return;
      const ref = getRef('qc-bowl-ref');
      const {fromBonus, fromCash} = splitPay(card, total, true);
      if (fromCash > card.cashBalance) { toast('Insufficient balance!', true); return; }
      doChargeBowl(card, total, fromBonus, fromCash, p, g2,
        (discAmt>0?' [disc −'+fmt(discAmt)+']':'')+' | Ref: '+ref, discAmt);
      renderTodaysSales();
      closeM();
      toast('✓ Bowling charged for '+card.name);
    }},{label:'Back', cls:'btn-gh', fn:()=>quickChargeGuest(
      _lastGuestRows[guestSectionActive].findIndex(r=>r.rfid===card.rfid), guestSectionActive)}]
  );
  // init calc
  setTimeout(()=>{ _qcBowlDiscMode='none'; qcBowlCalc(effectiveRate); }, 50);
}

let _qcBowlDiscMode = 'none';
let _qcBowlRate = 250;
function qcSetBowlDisc(m) {
  const mode = m===0?'none':m===1?'pct':'flat'; _qcBowlDiscMode = mode;
  [0,1,2].forEach(m => {
    const el = document.getElementById('qc-bd-'+['none','pct','flat'][m]); if(!el) return;
    const mname=['none','pct','flat'][m];
    if(mname===mode){ el.style.borderColor='#d97706'; el.style.color='#d97706'; }
    else { el.style.borderColor=''; el.style.color=''; }
  });
  const dv = document.getElementById('qc-bowl-dval');
  if(dv) { dv.style.display = mode==='none'?'none':''; dv.value=''; }
  qcBowlCalc();
}
function qcBowlCalc(baseRate) {
  const rate = baseRate || _qcBowlRate || 250;
  _qcBowlRate = rate;
  const p = parseInt((document.getElementById('qc-bowl-p')||{}).value)||1;
  const g2 = parseInt((document.getElementById('qc-bowl-g')||{}).value)||1;
  const raw = p * g2 * rate;
  const {final:total} = applyDiscount(raw, _qcBowlDiscMode, 'qc-bowl-dval', null);
  const card = cards.find(c=>c.rfid===(document.getElementById('qc-bowl-ref')||{}).dataset?.rfid) || {cashBalance:9999,bonusBalance:9999};
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  // We can't easily get card here, just show total
  set('qc-b-total', fmt(total));
  set('qc-b-bonus', '—'); set('qc-b-cash', '—');
}

function _quickChargeGZ(card) {
  const tokenPrice = prices.token || 20;
  openM('🎮 Game Zone — '+card.name,
    '<div style="font-size:0.86rem;">'
    +'<div style="font-size:0.72rem;color:var(--mu);margin-bottom:10px;">₹'+tokenPrice+' per token · Bonus used first</div>'
    +'<label class="f">Amount (₹)</label>'
    +'<input type="number" id="qc-gz-amt" placeholder="e.g. 100" min="0" style="font-size:1rem;margin-bottom:6px;" oninput="qcGZCalc()">'
    +'<div id="qc-gz-tok" style="font-size:0.9rem;color:var(--go);font-weight:700;margin-bottom:8px;">0 tokens</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">'
    +'<button class="btn btn-gh btn-sm" onclick="qcGZSetAmt(100)">₹100</button>'    +'<button class="btn btn-gh btn-sm" onclick="qcGZSetAmt(200)">₹200</button>'    +'<button class="btn btn-gh btn-sm" onclick="qcGZSetAmt(500)">₹500</button>'    +'<button class="btn btn-gh btn-sm" onclick="qcGZSetAmt(1000)">₹1000</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px;">'
    +'<button class="disc-btn" id="qc-gd-none" onclick="qcSetGZDisc(0)" style="border-color:var(--cy);color:var(--cy);">No Disc</button>'
    +'<button class="disc-btn" id="qc-gd-pct"  onclick="qcSetGZDisc(1)">% Off</button>'
    +'<button class="disc-btn" id="qc-gd-flat" onclick="qcSetGZDisc(2)">Flat ₹</button>'
    +'<input type="number" id="qc-gz-dval" placeholder="Value" min="0" style="flex:1;display:none;font-size:0.85rem;" oninput="qcGZCalc()">'
    +'</div>'
    +'<label class="f">Reference <span style="color:#ef4444;">*</span></label>'
    +'<input type="text" id="qc-gz-ref" class="ref-required" placeholder="required" style="margin-bottom:10px;">'
    +'<div id="qc-gz-pb" style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:9px;font-size:0.82rem;">'
    +'<div style="color:var(--go);">★ Bonus: <span id="qc-gz-bonus">—</span></div>'
    +'<div style="color:var(--cy);">Cash: <span id="qc-gz-cash">—</span></div>'
    +'<div style="font-weight:700;border-top:1px solid rgba(0,0,0,0.08);margin-top:6px;padding-top:6px;">Total: <span id="qc-gz-total">—</span></div>'
    +'</div>'
    +'</div>',
    [{label:'⚡ Charge', cls:'btn-go', fn:()=>{
      const rawAmt = parseFloat((document.getElementById('qc-gz-amt')||{}).value)||0;
      if (!rawAmt) { toast('Enter amount', true); return; }
      const {final:amt, discAmt} = applyDiscount(rawAmt, _qcGZDiscMode, 'qc-gz-dval', null);
      if (!requireRef('qc-gz-ref', _qcGZDiscMode !== 'none')) return;
      const tokens = Math.floor(amt / tokenPrice);
      const ref = getRef('qc-gz-ref');
      const {fromBonus, fromCash} = splitPay(card, amt, true);
      if (fromCash > card.cashBalance) { toast('Insufficient balance!', true); return; }
      doChargeGZ(card, amt, tokens, fromBonus, fromCash, ref, discAmt);
      renderTodaysSales(); closeM();
      toast('✓ '+tokens+' tokens charged for '+card.name);
    }},{label:'Back', cls:'btn-gh', fn:()=>quickChargeGuest(
      _lastGuestRows[guestSectionActive].findIndex(r=>r.rfid===card.rfid), guestSectionActive)}]
  );
  setTimeout(()=>{ _qcGZDiscMode='none'; qcGZCalc(card); }, 50);
}

let _qcGZDiscMode = 'none';
let _qcGZCard = null;
function qcSetGZDisc(m) {
  const mode = m===0?'none':m===1?'pct':'flat'; _qcGZDiscMode = mode;
  [0,1,2].forEach(m => {
    const el = document.getElementById('qc-gd-'+['none','pct','flat'][m]); if(!el) return;
    const mname=['none','pct','flat'][m];
    if(mname===mode){ el.style.borderColor='#d97706'; el.style.color='#d97706'; }
    else { el.style.borderColor=''; el.style.color=''; }
  });
  const dv = document.getElementById('qc-gz-dval');
  if(dv) { dv.style.display = mode==='none'?'none':''; dv.value=''; }
  qcGZCalc();
}
function qcGZSetAmt(v) { const el=document.getElementById("qc-gz-amt"); if(el){el.value=v;} qcGZCalc(); }
function qcGZCalc(card) {
  if (card) _qcGZCard = card;
  const rawAmt = parseFloat((document.getElementById('qc-gz-amt')||{}).value)||0;
  const {final:amt} = applyDiscount(rawAmt, _qcGZDiscMode, 'qc-gz-dval', null);
  const tokenPrice = prices.token || 20;
  const tokens = Math.floor(amt / tokenPrice);
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('qc-gz-tok', tokens + ' token' + (tokens!==1?'s':''));
  set('qc-gz-total', amt>0?fmt(amt):'—');
  if (_qcGZCard && amt>0) {
    const {fromBonus,fromCash} = splitPay(_qcGZCard, amt, true);
    set('qc-gz-bonus', fmt(fromBonus)); set('qc-gz-cash', fmt(fromCash));
  }
}

function qcFoodSetAmt(v) { const el=document.getElementById("qc-food-amt"); if(el) el.value=v; }
function _quickChargeFood(card) {
  // Food is cash-only wallet, open simplified bill
  openM('🍔 Food — '+card.name,
    '<div style="font-size:0.86rem;">'
    +'<div style="font-size:0.72rem;color:var(--mu);margin-bottom:10px;">Cash balance only · Current: <b style="color:var(--cy);">'+fmt(card.cashBalance)+'</b></div>'
    +'<label class="f">Amount (₹)</label>'
    +'<input type="number" id="qc-food-amt" placeholder="Total bill amount" min="0" style="font-size:1rem;margin-bottom:8px;">'
    +'<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">'
    +'<button class="btn btn-gh btn-sm" onclick="qcFoodSetAmt(50)">₹50</button>'+'<button class="btn btn-gh btn-sm" onclick="qcFoodSetAmt(100)">₹100</button>'+'<button class="btn btn-gh btn-sm" onclick="qcFoodSetAmt(150)">₹150</button>'+'<button class="btn btn-gh btn-sm" onclick="qcFoodSetAmt(200)">₹200</button>'+'<button class="btn btn-gh btn-sm" onclick="qcFoodSetAmt(300)">₹300</button>'+'<button class="btn btn-gh btn-sm" onclick="qcFoodSetAmt(500)">₹500</button>'
    +'</div>'
    +'<label class="f">Item description</label>'
    +'<input type="text" id="qc-food-desc" placeholder="e.g. Burger + Fries" style="margin-bottom:8px;">'
    +'<label class="f">Reference <span style="color:#ef4444;">*</span></label>'
    +'<input type="text" id="qc-food-ref" class="ref-required" placeholder="required">'
    +'</div>',
    [{label:'⚡ Charge', cls:'btn-mg', fn:()=>{
      const amt = parseFloat((document.getElementById('qc-food-amt')||{}).value)||0;
      if (!amt) { toast('Enter amount', true); return; }
      if (card.cashBalance < amt) { toast('Insufficient cash balance!', true); return; }
      const desc = (document.getElementById('qc-food-desc')||{}).value||'Food';
      const ref  = getRef('qc-food-ref');
      doChargeFood(card, amt, desc+' | Ref: '+ref, 0);
      renderTodaysSales(); closeM();
      toast('✓ Food charged for '+card.name);
    }},{label:'Back', cls:'btn-gh', fn:()=>quickChargeGuest(
      _lastGuestRows[guestSectionActive].findIndex(r=>r.rfid===card.rfid), guestSectionActive)}]
  );
}

function _quickChargeGeneric(card, amId, amName) {
  const cfg = (prices.customAm && prices.customAm[amId]) || {};
  openM(amName+' — '+card.name,
    '<div style="font-size:0.86rem;">'
    +'<div style="font-size:0.72rem;color:var(--mu);margin-bottom:10px;">Cash: <b style="color:var(--cy);">'+fmt(card.cashBalance)+'</b> · Bonus: <b style="color:var(--go);">'+fmt(card.bonusBalance)+'</b></div>'
    +'<label class="f">Amount (₹)</label>'
    +'<input type="number" id="qc-gen-amt" value="'+(cfg.defaultAmt||'')+'" placeholder="Enter amount" min="0" style="font-size:1rem;margin-bottom:8px;">'
    +'<label class="f">Reference <span style="color:var(--mu);font-weight:400;">(optional)</span></label>'
    +'<input type="text" id="qc-gen-ref" placeholder="e.g. Birthday, Staff" style="margin-bottom:0;">'
    +'</div>',
    [{label:'⚡ Charge', cls:'btn-cy', fn:()=>{
      const amt = parseFloat((document.getElementById('qc-gen-amt')||{}).value)||0;
      if (!amt) { toast('Enter amount', true); return; }
      const ref = getRef('qc-gen-ref');
      const bonusOk = amenities.find(a=>a.id===amId)?.bonusOk || false;
      const {fromBonus,fromCash} = splitPay(card, amt, bonusOk);
      if (fromCash > card.cashBalance) { toast('Insufficient balance!', true); return; }
      card.cashBalance -= fromCash; card.bonusBalance -= fromBonus; card.spent += amt;
      persist('cards');
      addTxnRecord(card, amName, amName+(ref?' | Ref: '+ref:''), fromCash, fromBonus, 'debit');
      renderTodaysSales(); closeM();
      toast('✓ '+fmt(amt)+' charged for '+card.name);
    }},{label:'Back', cls:'btn-gh', fn:()=>quickChargeGuest(
      _lastGuestRows[guestSectionActive].findIndex(r=>r.rfid===card.rfid), guestSectionActive)}]
  );
}





function toggleDashboard() {
  const body = document.getElementById('dash-body');
  const icon = document.getElementById('dash-toggle-icon');
  const hidden = body && body.style.display === 'none';
  if (body) body.style.display = hidden ? '' : 'none';
  if (icon) icon.textContent   = hidden ? '▲' : '▼';
}

function toggleRecentCards() {
  const panel  = document.getElementById('rcards-panel');
  const btn    = document.getElementById('rcards-toggle');
  const hidden = panel && panel.style.display === 'none';
  if (panel) panel.style.display = hidden ? '' : 'none';
  if (btn)   btn.textContent     = hidden ? '▲ Hide' : '▼ Show';
}

function renderReceptionBookings() {
  const el = document.getElementById('reception-bk-content'); if(!el) return;
  const today = new Date().toISOString().slice(0,10);
  const sports = ['cricket','badminton','pickleball','bowling'];
  el.innerHTML = sports.map(sport => {
    const BOWL_COURT = {icon:'🎳', name:'Bowling', color:'#7c3aed'};
    const c = COURTS[sport] || BOWL_COURT;
    const bks = courtBk.filter(b=>b.date===today && b.sport===sport && b.status!=='cancelled')
      .sort((a,b)=>a.slot>b.slot?1:-1);
    const pending = bks.filter(b=>b.status==='pending_payment');
    return `<div style="background:#fff;border:1.5px solid var(--border);border-radius:10px;padding:12px;">
      <div style="font-size:0.82rem;font-weight:800;color:${c.color};margin-bottom:8px;">${c.icon} ${c.name}</div>
      ${!bks.length
        ? '<div style="font-size:0.78rem;color:var(--mu);text-align:center;padding:8px 0;">No bookings today</div>'
        : bks.map(b=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:0.78rem;">
            <div>
              <div style="font-weight:600;">${b.customer}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:var(--cy);">${b.slot}–${b.endTime||''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.68rem;color:var(--cy);font-family:'JetBrains Mono',monospace;">₹${b.amt.toLocaleString('en-IN')}</div>
              ${b.status==='pending_payment'?`<span style="font-size:0.62rem;color:var(--go);">⏳ Pay Later</span>`:`<span style="font-size:0.62rem;color:var(--gr);">✓ Paid</span>`}
            </div>
          </div>`).join('')
      }
      ${pending.length?`<button onclick="goTo('courts',document.getElementById('tab-courts'))" style="width:100%;margin-top:8px;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:var(--go);cursor:pointer;font-weight:700;">⏳ ${pending.length} awaiting payment →</button>`:''}
    </div>`;
  }).join('');
}

function renderCourtPage() {
  initCourtDate();
  setCourtPayMode('rfid');
  renderCourtInfoBar();
  renderCourtSlots();
  renderReceptionBookings(); renderTodaysSales();
}

// hook ct zone to applyCardToZone
(function init() {
  // Seed menuV2 immediately from localStorage or default — works offline too
  if (!menuV2) {
    menuV2 = lsGet('lc5_menu_v2') || DEFAULT_MENU_V2;
    // Sync flat menuItems for food counter
    menuItems = [];
    menuV2.forEach(cat => cat.items.forEach(it => menuItems.push({cat:cat.cat, name:it.name, price:it.price})));
  }
  initUsers();
  // Populate GZ001–GZ999 dropdown for issue card
  const sel = document.getElementById('r-card-select');
  if (sel) {
    for (let i = 1; i <= 999; i++) {
      const num = String(i).padStart(3,'0');
      const id  = 'GZ' + num;
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = id;
      sel.appendChild(opt);
    }
  }
  // Populate GZ dropdown for manual counter lookup
  const msel = document.getElementById('manual-card-sel');
  if (msel) {
    for (let i = 1; i <= 999; i++) {
      const num = String(i).padStart(3,'0');
      const id  = 'GZ' + num;
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = id;
      msel.appendChild(opt);
    }
  }
  refreshCardsTable();
  refreshGZDropdown();
  // Theatre seats init happens per-show when show is selected
  buildCounterTabs();
  bowlTier = autoTier();
  updateWelcomeNotice();
  // Apply saved court prices to COURTS object on load
  if (prices.courtPrices) {
    const cp = prices.courtPrices;
    if(cp.cricket)    { [30,60,90,120,180].forEach(d=>{ if(cp.cricket[d]) COURTS.cricket['price'+d]=cp.cricket[d]; }); }
    if(cp.badminton)  { [30,60,90,120,180].forEach(d=>{ if(cp.badminton[d]) COURTS.badminton['price'+d]=cp.badminton[d]; }); }
    if(cp.pickleball) { [30,60,90,120,180].forEach(d=>{ if(cp.pickleball[d]) COURTS.pickleball['price'+d]=cp.pickleball[d]; }); }
    if(cp.ownPaddle)  { [30,60,90,120,180].forEach(d=>{ if(cp.ownPaddle[d]) COURTS.pickleball['ownPaddle'+d]=cp.ownPaddle[d]; }); }
  }
  // Load menuV2 from localStorage if available (Firebase will update it after connect)
  const savedMenuV2 = lsGet('lc5_menu_v2');
  if (savedMenuV2 && Array.isArray(savedMenuV2) && savedMenuV2.length) {
    menuV2 = savedMenuV2;
    menuItems = [];
    menuV2.forEach(cat => cat.items.forEach(it => menuItems.push({cat:cat.cat,name:it.name,price:it.price})));
  }
  document.getElementById('login-bg').style.display = 'flex';
  initFirebase();
  renderReceptionBookings(); renderTodaysSales();
})();
