/**
 * ═══════════════════════════════════════════════════════════════
 *  MSO Digital Operations — Google Apps Script Backend v3
 * ═══════════════════════════════════════════════════════════════
 *
 *  DEPLOY:
 *  Extensions → Apps Script → Deploy → New deployment
 *    Type:           Web App
 *    Execute as:     Me
 *    Who has access: Anyone
 *
 *  After EVERY code change → Deploy → Manage deployments → New version.
 */

var SHEET_ID_MSO = '1W8GSLLS-HXmrUYydannBXnZbFkfhAAKAZWyO50v47nc';
var SHEET_ID_MRS = '1oECM6zM_iRHEFdkXksfR6-N1OoQ6QZhGFWfoQisVXTw';

/* ─────────────────────────────────────────────────────────────
   STAFF CREDENTIALS
───────────────────────────────────────────────────────────── */
var STAFF = {
  'owner':    { password:'owner123',   name:'Momoh Sunday Omotayo', role:'owner',     station:null,  pick:true  },
  'gm.mso':  { password:'gm2025',     name:'MSO Manager',          role:'gm',        station:'mso', pick:false },
  'gm.mrs':  { password:'gmm2025',    name:'MRS Manager',          role:'gm',        station:'mrs', pick:false },
  'harrison': { password:'harrison01', name:'Harrison',             role:'supervisor',station:'mso', pick:false },
  'tony':     { password:'tony01',     name:'Tony',                 role:'supervisor',station:'mso', pick:false },
  'wale':     { password:'wale01',     name:'Wale',                 role:'supervisor',station:'mrs', pick:false },
  'paul':     { password:'paul01',     name:'Paul',                 role:'supervisor',station:'mrs', pick:false },
  'tobi':     { password:'tobi01',     name:'Tobi',                 role:'supervisor',station:'mso', pick:false },
  'joseph':   { password:'joseph01',   name:'Joseph',               role:'supervisor',station:'mso', pick:false },
};

/* ─────────────────────────────────────────────────────────────
   SALESLOG COLUMN MAP
   Sheet name: SalesLog
   Columns: A  B     C        D     E     F       G        H       I          J       K          L            M        N
            Date Time Station Tank  Pump  Nozzle  Product  Litres  PricePerL  Amount  PayMethod  Attendant    Handover Notes
───────────────────────────────────────────────────────────── */
var SL = {
  DATE:0, TIME:1, STATION:2, TANK:3, PUMP:4, NOZZLE:5,
  PRODUCT:6, LITRES:7, PRICE_PER_L:8, AMOUNT:9,
  PAY_METHOD:10, ATTENDANT:11, HANDOVER:12, NOTES:13
};

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(station) {
  var id = station === 'mrs' ? SHEET_ID_MRS : SHEET_ID_MSO;
  try { return SpreadsheetApp.openById(id); }
  catch(e) { return null; }
}

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function dateToStr(d) {
  if (!d) return '';
  try { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
  catch(e) { return ''; }
}

function timeToStr(d) {
  if (!d) return '';
  try { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'HH:mm'); }
  catch(e) { return String(d); }
}

/* ─────────────────────────────────────────────────────────────
   ENSURE SalesLog SHEET EXISTS (call once to set up)
───────────────────────────────────────────────────────────── */
function ensureSalesLogSheet(ss) {
  var tab = ss.getSheetByName('SalesLog');
  if (!tab) {
    tab = ss.insertSheet('SalesLog');
    var headers = ['Date','Time','Station','Tank','Pump','Nozzle','Product',
                   'Litres','PricePerL','Amount','PayMethod','Attendant','Handover','Notes'];
    tab.appendRow(headers);
    tab.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
    tab.setFrozenRows(1);
    tab.setColumnWidth(1, 100); // Date
    tab.setColumnWidth(2, 70);  // Time
    tab.setColumnWidth(3, 60);  // Station
    tab.setColumnWidth(9, 90);  // PricePerL
    tab.setColumnWidth(10, 100); // Amount
  }
  return tab;
}

/* ─────────────────────────────────────────────────────────────
   ROUTER
───────────────────────────────────────────────────────────── */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    switch(body.action) {
      case 'login':           return login(body);
      case 'saveDailyReport': return saveDailyReport(body);
      case 'saveExpense':     return saveExpense(body);
      case 'saveSale':        return saveSale(body);
      case 'savePumpMetre':   return savePumpMetre(body);
      case 'savePrice':       return savePrice(body);
      case 'saveEditRequest': return saveEditRequest(body);
      default: return out({ ok:false, error:'Unknown action: '+body.action });
    }
  } catch(err) {
    return out({ ok:false, error:'Script error: '+err.message });
  }
}

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  switch(p.action) {
    case 'login':             return login(p);
    case 'getDashboard':      return getDashboard(p);
    case 'getRecords':        return getRecords(p);
    case 'getDailyReport':    return getDailyReport(p);
    case 'getSalesLog':       return getSalesLog(p);
    case 'getCurrentPrices':  return getCurrentPrices(p);
    case 'getEditRequests':   return getEditRequests(p);
    case 'approveEditRequest':return approveEditRequest(p);
    case 'getWeeklySummary':  return getWeeklySummary(p);
    case 'getMonthlySummary': return getMonthlySummary(p);
    case 'setupSalesLog':     return setupSalesLogForBothSheets();
    case 'setupAllSheets':    return setupAllSheets();
    default: return out({ ok:true, status:'MSO Digital Operations API v3 running.' });
  }
}

/* ─────────────────────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────────────────────── */
function login(params) {
  var username = String(params.username || '').trim().toLowerCase();
  var password = String(params.password || '').trim();
  if (!username) return out({ ok:false, error:'Please enter your username.' });
  if (!password) return out({ ok:false, error:'Please enter your password.' });
  var user = STAFF[username];
  if (!user || user.password !== password) {
    writeLog('mso', username, 'LOGIN_FAIL', 'Invalid credentials');
    return out({ ok:false, error:'Incorrect username or password.' });
  }
  writeLog('mso', username, 'LOGIN', 'Success');
  return out({ ok:true, user:{ u:username, name:user.name, role:user.role, station:user.station, pick:user.pick } });
}

/* ─────────────────────────────────────────────────────────────
   GET DASHBOARD — today's KPI totals, tanks, payments, chart
───────────────────────────────────────────────────────────── */
function getDashboard(params) {
  var station = String((params && params.station) || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var today = todayStr();
  var result = { ok:true, date:today, noData:false };

  var dsSheet = ss.getSheetByName('DailySales');
  if (!dsSheet) return out({ ok:true, noData:true, message:'DailySales sheet not found. Run setupAllSheets first.' });

  var rows = dsSheet.getDataRange().getValues();
  var todayRow = null;
  var yesterdayTotal = 0;

  /* Yesterday string */
  var yd = new Date(); yd.setDate(yd.getDate()-1);
  var yesterdayStr = Utilities.formatDate(yd, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  /* Collect last 7 days for weekly chart */
  var weeklyData = [];

  for (var i = rows.length - 1; i >= 1; i--) {
    var rowDate = dateToStr(rows[i][0]);
    if (!rowDate) continue;
    if (rowDate === today && !todayRow) todayRow = rows[i];
    if (rowDate === yesterdayStr) yesterdayTotal = Number(rows[i][COL.GRAND_TOTAL]) || 0;
    if (weeklyData.length < 7) {
      weeklyData.unshift({
        date: rowDate,
        pms:  Number(rows[i][COL.PMS_LITRES]) || 0,
        ago:  Number(rows[i][COL.AGO_LITRES]) || 0,
        total: Number(rows[i][COL.GRAND_TOTAL]) || 0
      });
    }
  }

  if (!todayRow) {
    result.noData = true;
    result.message = 'No dip readings submitted yet today.';
    result.weekly = buildWeeklyChart(weeklyData);
    return out(result);
  }

  /* Check if only opening was saved (no closing yet) */
  var tk1Open = Number(todayRow[COL.TK1_OPEN]) || 0;
  var tk1Close = Number(todayRow[COL.TK1_CLOSE]) || 0;
  var hasOpening = tk1Open > 0;
  var hasClosing = tk1Close > 0;
  result.hasOpening = hasOpening;
  result.hasClosing = hasClosing;

  /* If opening saved but no closing → still show opening data but flag it */
  if (hasOpening && !hasClosing) {
    result.openingOnly = true;
    result.message = 'Opening stock submitted. Waiting for closing readings.';
    /* Return opening readings so supervisor dashboard can show them */
    result.tanks = {
      pms: [
        { id:'TK 1', opening:Number(todayRow[COL.TK1_OPEN])||0, closing:0, diff:0, margin:0 },
        { id:'TK 2', opening:Number(todayRow[COL.TK2_OPEN])||0, closing:0, diff:0, margin:0 },
        { id:'TK 3', opening:Number(todayRow[COL.TK3_OPEN])||0, closing:0, diff:0, margin:0 },
      ],
      ago: { opening:Number(todayRow[COL.TK4_OPEN])||0, closing:0, diff:0, margin:0, capacity:3200 }
    };
    result.tankLevels = [
      { id:'TK 1', product:'PMS', pumps:'P5 P6', vol:Number(todayRow[COL.TK1_OPEN])||0, cap:19600 },
      { id:'TK 2', product:'PMS', pumps:'P1 P2', vol:Number(todayRow[COL.TK2_OPEN])||0, cap:19600 },
      { id:'TK 3', product:'PMS', pumps:'P3 P4', vol:Number(todayRow[COL.TK3_OPEN])||0, cap:19600 },
      { id:'TK 4', product:'AGO', pumps:'P1 N1', vol:Number(todayRow[COL.TK4_OPEN])||0, cap:3200  },
    ];
    result.pmsPrice = Number(todayRow[COL.PMS_PRICE]) || 1269;
    result.agoPrice = Number(todayRow[COL.AGO_PRICE]) || 1799;
    result.weekly = buildWeeklyChart(weeklyData);
    result.submittedBy = todayRow[COL.SUBMITTED_BY];
    result.recentTransactions = [];
    return out(result);
  }

  var r = todayRow;
  var gt = Number(r[COL.GRAND_TOTAL]) || 0;

  /* ── Core KPIs ── */
  result.grandTotal   = gt;
  result.totalChange  = yesterdayTotal > 0 ? Math.round((gt - yesterdayTotal) / yesterdayTotal * 1000) / 10 : null;
  result.pmsLitres    = Number(r[COL.PMS_LITRES])    || 0;
  result.pmsRevenue   = Number(r[COL.PMS_REVENUE])   || 0;
  result.pmsPrice     = Number(r[COL.PMS_PRICE])     || 0;
  result.pmsMargin    = Number(r[COL.PMS_MARGIN])    || 0;
  result.agoLitres    = Number(r[COL.AGO_LITRES])    || 0;
  result.agoRevenue   = Number(r[COL.AGO_REVENUE])   || 0;
  result.agoPrice     = Number(r[COL.AGO_PRICE])     || 0;
  result.agoMargin    = Number(r[COL.AGO_MARGIN])    || 0;
  result.cashToBank   = Number(r[COL.TO_BANK])        || 0;
  result.expenses     = Number(r[COL.TOTAL_EXPENSES]) || 0;
  result.posMP        = Number(r[COL.POS_MP])         || 0;
  result.posZM        = Number(r[COL.POS_ZM])         || 0;
  result.trfMP        = Number(r[COL.TRF_MP])         || 0;
  result.cash         = Number(r[COL.CASH])            || 0;
  result.posMPCharge  = Number(r[COL.POS_MP_CHARGE])  || 0;
  result.posZMCharge  = Number(r[COL.POS_ZM_CHARGE])  || 0;
  result.submittedBy  = r[COL.SUBMITTED_BY];

  /* ── Tank data ── */
  result.tanks = {
    pms: [
      { id:'TK 1', opening:Number(r[COL.TK1_OPEN])||0, closing:Number(r[COL.TK1_CLOSE])||0, diff:Number(r[COL.TK1_DIFF])||0, margin:Number(r[COL.TK1_MARGIN])||0 },
      { id:'TK 2', opening:Number(r[COL.TK2_OPEN])||0, closing:Number(r[COL.TK2_CLOSE])||0, diff:Number(r[COL.TK2_DIFF])||0, margin:Number(r[COL.TK2_MARGIN])||0 },
      { id:'TK 3', opening:Number(r[COL.TK3_OPEN])||0, closing:Number(r[COL.TK3_CLOSE])||0, diff:Number(r[COL.TK3_DIFF])||0, margin:Number(r[COL.TK3_MARGIN])||0 },
    ],
    ago: {
      opening:  Number(r[COL.TK4_OPEN])  || 0,
      closing:  Number(r[COL.TK4_CLOSE]) || 0,
      diff:     Number(r[COL.TK4_DIFF])  || 0,
      margin:   Number(r[COL.TK4_MARGIN])|| 0,
      capacity: 3200
    }
  };

  /* ── Tank levels (for dashboard bars) ── */
  result.tankLevels = [
    { id:'TK 1', product:'PMS', pumps:'P5 P6', vol:Number(r[COL.TK1_CLOSE])||0, cap:19600 },
    { id:'TK 2', product:'PMS', pumps:'P1 P2', vol:Number(r[COL.TK2_CLOSE])||0, cap:19600 },
    { id:'TK 3', product:'PMS', pumps:'P3 P4', vol:Number(r[COL.TK3_CLOSE])||0, cap:19600 },
    { id:'TK 4', product:'AGO', pumps:'P1 N1', vol:Number(r[COL.TK4_CLOSE])||0, cap:3200  },
  ];

  /* ── Payment breakdown ── */
  var payments = [];
  if (result.posMP  > 0) payments.push({ name:'POS (MP Terminal)', amount:result.posMP,  color:'#179DD0' });
  if (result.posZM  > 0) payments.push({ name:'POS (ZM Terminal)', amount:result.posZM,  color:'#7C3AED' });
  if (result.trfMP  > 0) payments.push({ name:'Bank Transfer',      amount:result.trfMP,  color:'#06091A' });
  if (result.cash   > 0) payments.push({ name:'Cash',               amount:result.cash,   color:'#22C55E' });
  result.payments = payments;

  /* ── Weekly chart ── */
  result.weekly = buildWeeklyChart(weeklyData);

  /* ── Recent transactions from SalesLog ── */
  var slSheet = ss.getSheetByName('SalesLog');
  if (slSheet) {
    var slRows = slSheet.getDataRange().getValues();
    var txns = [];
    for (var j = slRows.length - 1; j >= 1 && txns.length < 10; j--) {
      var sr = slRows[j];
      var sDate = dateToStr(sr[SL.DATE]);
      if (!sDate) continue;
      txns.push({
        date:      sDate,
        time:      timeToStr(sr[SL.TIME]),
        tank:      String(sr[SL.TANK]       || ''),
        pump:      String(sr[SL.PUMP]       || ''),
        product:   String(sr[SL.PRODUCT]    || ''),
        litres:    Number(sr[SL.LITRES]     || 0),
        amount:    Number(sr[SL.AMOUNT]     || 0),
        payMethod: String(sr[SL.PAY_METHOD] || ''),
        attendant: String(sr[SL.ATTENDANT]  || ''),
      });
    }
    result.recentTransactions = txns;
  } else {
    result.recentTransactions = [];
  }

  return out(result);
}

function buildWeeklyChart(weeklyData) {
  /* Pad to 7 days if needed */
  while (weeklyData.length < 7) weeklyData.unshift({ date:'', pms:0, ago:0, total:0 });
  var days = [], pmsArr = [], agoArr = [];
  var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  weeklyData.forEach(function(w, i) {
    var label = i === weeklyData.length - 1 ? 'Today' : (w.date ? dayNames[new Date(w.date).getDay()] : '—');
    days.push(label);
    pmsArr.push(w.pms);
    agoArr.push(w.ago);
  });
  return { days:days, pms:pmsArr, ago:agoArr };
}


/* ─────────────────────────────────────────────────────────────
   GET SALES LOG — filtered transactions (for Records / Sales pages)
   Params: station, date (specific day), from, to, pump, attendant, limit
───────────────────────────────────────────────────────────── */
function getSalesLog(params) {
  var station   = String(params.station || 'mso').toLowerCase();
  var filterDate= params.date || '';      // single date filter
  var from      = params.from || '';
  var to        = params.to   || todayStr();
  var pump      = params.pump || '';      // e.g. 'P2' to filter by pump
  var attendant = params.attendant || ''; // filter by staff name
  var limit     = parseInt(params.limit) || 50;

  // If specific date given, use it as both from and to
  if (filterDate) { from = filterDate; to = filterDate; }

  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var slSheet = ss.getSheetByName('SalesLog');
  if (!slSheet) return out({ ok:true, transactions:[], message:'SalesLog sheet not found. Call ?action=setupSalesLog to create it.' });

  var rows = slSheet.getDataRange().getValues();
  var txns = [];

  for (var i = rows.length - 1; i >= 1; i--) {
    var r = rows[i];
    var rowDate = dateToStr(r[SL.DATE]);
    if (!rowDate) continue;
    if (from && rowDate < from) continue;
    if (to   && rowDate > to)   continue;
    if (pump      && String(r[SL.PUMP]).toUpperCase()      !== pump.toUpperCase())      continue;
    if (attendant && String(r[SL.ATTENDANT]).toLowerCase() !== attendant.toLowerCase()) continue;

    txns.push({
      rowIndex:  i + 1, // 1-based for editing later
      date:      rowDate,
      time:      timeToStr(r[SL.TIME]),
      tank:      String(r[SL.TANK]      || ''),
      pump:      String(r[SL.PUMP]      || ''),
      nozzle:    String(r[SL.NOZZLE]    || ''),
      product:   String(r[SL.PRODUCT]   || ''),
      litres:    Number(r[SL.LITRES]    || 0),
      pricePerL: Number(r[SL.PRICE_PER_L]|| 0),
      amount:    Number(r[SL.AMOUNT]    || 0),
      payMethod: String(r[SL.PAY_METHOD]|| ''),
      attendant: String(r[SL.ATTENDANT] || ''),
      handover:  r[SL.HANDOVER] ? true : false,
      notes:     String(r[SL.NOTES]     || ''),
    });
    if (txns.length >= limit) break;
  }

  // Totals for the filtered set
  var totals = txns.reduce(function(acc, t) {
    acc.litres += t.litres;
    acc.amount += t.amount;
    acc.count++;
    return acc;
  }, { litres:0, amount:0, count:0 });

  return out({ ok:true, station:station, from:from, to:to, transactions:txns, totals:totals });
}

/* ─────────────────────────────────────────────────────────────
   SAVE SALE — records one pump transaction to SalesLog
   Called from the sales entry page on staff phones
───────────────────────────────────────────────────────────── */
function saveSale(body) {
  var station = String(body.station || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var tab = ensureSalesLogSheet(ss);

  var now = new Date();
  var row = [
    body.date       || todayStr(),           // A - Date
    body.time       || Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm'), // B - Time
    station.toUpperCase(),                    // C - Station
    body.tank       || '',                    // D - Tank (e.g. TK1)
    body.pump       || '',                    // E - Pump (e.g. P2)
    body.nozzle     || '',                    // F - Nozzle (e.g. N1)
    body.product    || '',                    // G - Product (PMS/AGO)
    Number(body.litres)    || 0,              // H - Litres
    Number(body.pricePerL) || 0,              // I - Price per litre
    Number(body.amount)    || 0,              // J - Amount (₦)
    body.payMethod  || '',                    // K - Payment method (POS/Cash/TRF)
    body.attendant  || body.username || '',   // L - Attendant name
    body.handover   ? 'YES' : '',             // M - Handover flag
    body.notes      || '',                    // N - Notes
  ];

  tab.appendRow(row);
  writeLog(station, body.username || body.attendant, 'SAVE_SALE',
    (body.product||'') + ' ' + (body.litres||0) + 'L on ' + (body.pump||'') + ' ₦' + (body.amount||0));

  return out({ ok:true, action:'saved', date:row[0], time:row[1] });
}

/* ─────────────────────────────────────────────────────────────
   SETUP — creates SalesLog sheet in both workbooks
   Call once: visit ?action=setupSalesLog in browser
───────────────────────────────────────────────────────────── */
function setupSalesLogForBothSheets() {
  try {
    var mso = getSheet('mso');
    var mrs = getSheet('mrs');
    if (mso) ensureSalesLogSheet(mso);
    if (mrs) ensureSalesLogSheet(mrs);
    return out({ ok:true, message:'SalesLog sheet created in both workbooks.' });
  } catch(e) {
    return out({ ok:false, error:e.message });
  }
}

/* ─────────────────────────────────────────────────────────────
   GET RECORDS — daily summary list for Records page
───────────────────────────────────────────────────────────── */
function getRecords(params) {
  var station = String(params.station || 'mso').toLowerCase();
  var from    = params.from || '';
  var to      = params.to   || todayStr();
  var limit   = parseInt(params.limit) || 30;

  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('DailySales');
  if (!sheet) return out({ ok:true, records:[], message:'DailySales sheet not found.' });

  var rows    = sheet.getDataRange().getValues();
  var records = [];

  for (var i = rows.length - 1; i >= 1; i--) {
    var rowDate = dateToStr(rows[i][0]);
    if (!rowDate) continue;
    if (from && rowDate < from) continue;
    if (to   && rowDate > to)   continue;
    var r = rows[i];
    var tk1Open = Number(r[COL.TK1_OPEN]) || 0;
    var tk1Close = Number(r[COL.TK1_CLOSE]) || 0;
    records.push({
      date:        rowDate,
      day:         r[COL.DAY],
      submittedBy: r[COL.SUBMITTED_BY],
      grandTotal:  Number(r[COL.GRAND_TOTAL])   || 0,
      pmsLitres:   Number(r[COL.PMS_LITRES])    || 0,
      pmsRevenue:  Number(r[COL.PMS_REVENUE])   || 0,
      agoLitres:   Number(r[COL.AGO_LITRES])    || 0,
      agoRevenue:  Number(r[COL.AGO_REVENUE])   || 0,
      cashToBank:  Number(r[COL.TO_BANK])        || 0,
      expenses:    Number(r[COL.TOTAL_EXPENSES]) || 0,
      tk1_open:    tk1Open,
      tk1_close:   tk1Close,
      hasOpening:  tk1Open > 0,
      hasClosing:  tk1Close > 0,
      status:      tk1Open > 0 && tk1Close > 0 && Number(r[COL.GRAND_TOTAL]) > 0
                   ? 'complete'
                   : tk1Open > 0 && tk1Close === 0
                   ? 'opening_only'
                   : 'partial',
    });
    if (records.length >= limit) break;
  }

  return out({ ok:true, station:station, records:records });
}

/* ─────────────────────────────────────────────────────────────
   GET DAILY REPORT — full detail for one date
───────────────────────────────────────────────────────────── */
function getDailyReport(params) {
  var station = String(params.station || 'mso').toLowerCase();
  var date    = params.date || todayStr();

  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('DailySales');
  if (!sheet) return out({ ok:false, error:'DailySales sheet not found.' });

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (dateToStr(rows[i][0]) !== date) continue;
    var r = rows[i];

    /* Build report with friendly names matching the dip page */
    var report = {
      /* Tank stock readings */
      tk1_opening: Number(r[COL.TK1_OPEN])  || 0,
      tk1_closing: Number(r[COL.TK1_CLOSE]) || 0,
      tk1_diff:    Number(r[COL.TK1_DIFF])  || 0,
      tk1_margin:  Number(r[COL.TK1_MARGIN])|| 0,
      tk2_opening: Number(r[COL.TK2_OPEN])  || 0,
      tk2_closing: Number(r[COL.TK2_CLOSE]) || 0,
      tk2_diff:    Number(r[COL.TK2_DIFF])  || 0,
      tk2_margin:  Number(r[COL.TK2_MARGIN])|| 0,
      tk3_opening: Number(r[COL.TK3_OPEN])  || 0,
      tk3_closing: Number(r[COL.TK3_CLOSE]) || 0,
      tk3_diff:    Number(r[COL.TK3_DIFF])  || 0,
      tk3_margin:  Number(r[COL.TK3_MARGIN])|| 0,
      tk4_opening: Number(r[COL.TK4_OPEN])  || 0,
      tk4_closing: Number(r[COL.TK4_CLOSE]) || 0,
      tk4_diff:    Number(r[COL.TK4_DIFF])  || 0,
      tk4_margin:  Number(r[COL.TK4_MARGIN])|| 0,
      /* Totals */
      pms_margin:  Number(r[COL.PMS_MARGIN]) || 0,
      pms_litres:  Number(r[COL.PMS_LITRES]) || 0,
      pms_price:   Number(r[COL.PMS_PRICE])  || 1269,
      pms_revenue: Number(r[COL.PMS_REVENUE])|| 0,
      ago_margin:  Number(r[COL.AGO_MARGIN]) || 0,
      ago_litres:  Number(r[COL.AGO_LITRES]) || 0,
      ago_price:   Number(r[COL.AGO_PRICE])  || 1799,
      ago_revenue: Number(r[COL.AGO_REVENUE])|| 0,
      grand_total: Number(r[COL.GRAND_TOTAL])|| 0,
      /* Cash */
      pos_mp:      Number(r[COL.POS_MP])     || 0,
      pos_zm:      Number(r[COL.POS_ZM])     || 0,
      cash:        Number(r[COL.CASH])        || 0,
      total_expenses: Number(r[COL.TOTAL_EXPENSES]) || 0,
      to_bank:     Number(r[COL.TO_BANK])    || 0,
      pos_mp_charge: Number(r[COL.POS_MP_CHARGE]) || 0,
      pos_zm_charge: Number(r[COL.POS_ZM_CHARGE]) || 0,
      submitted_by: r[COL.SUBMITTED_BY] || '',
    };

    /* Status flags */
    report.hasOpening = report.tk1_opening > 0;
    report.hasClosing = report.tk1_closing > 0;
    report.status = report.hasOpening && report.hasClosing && report.grand_total > 0
      ? 'complete' : report.hasOpening ? 'opening_only' : 'partial';

    /* Pump metre readings from PumpMetres tab */
    var pmSheet = ss.getSheetByName('PumpMetres');
    var pumpMetres = {};
    if (pmSheet) {
      var pmRows = pmSheet.getDataRange().getValues();
      for (var j = 1; j < pmRows.length; j++) {
        if (dateToStr(pmRows[j][0]) !== date) continue;
        var pumpId = String(pmRows[j][2] || ''); /* Pump column */
        if (!pumpId) continue;
        if (!pumpMetres[pumpId]) pumpMetres[pumpId] = {sessions:[]};
        pumpMetres[pumpId].sessions.push({
          open:    Number(pmRows[j][5]) || 0,  /* OpeningMetre */
          close:   Number(pmRows[j][6]) || 0,  /* ClosingMetre */
          diff:    Number(pmRows[j][7]) || 0,  /* Difference */
          price:   Number(pmRows[j][8]) || 0,  /* Price */
          amount:  Number(pmRows[j][9]) || 0,  /* Amount */
          sessNum: Number(pmRows[j][10])|| 1,  /* SessionNum */
        });
      }
      /* Also check SalesLog for pump opening metres */
      var slSheet2 = ss.getSheetByName('SalesLog');
      if (slSheet2 && Object.keys(pumpMetres).length === 0) {
        var slRows2 = slSheet2.getDataRange().getValues();
        for (var k2 = 1; k2 < slRows2.length; k2++) {
          if (dateToStr(slRows2[k2][SL.DATE]) !== date) continue;
          var pid = String(slRows2[k2][SL.PUMP] || '');
          if (!pid) continue;
          if (!pumpMetres[pid]) pumpMetres[pid] = {sessions:[]};
          /* SalesLog stores litres dispensed, not metres — use as reference */
          pumpMetres[pid].litres = (pumpMetres[pid].litres||0) + (Number(slRows2[k2][SL.LITRES])||0);
        }
      }
    }
    report.pumpMetres = pumpMetres;

    /* Expenses */
    var expSheet = ss.getSheetByName('Expenses');
    var expenses = [];
    if (expSheet) {
      var expRows = expSheet.getDataRange().getValues();
      for (var j2 = 1; j2 < expRows.length; j2++) {
        if (dateToStr(expRows[j2][0]) === date) {
          expenses.push({ description: expRows[j2][2], amount: expRows[j2][3] });
        }
      }
    }
    report.expense_items = expenses;

    return out({ ok:true, date:date, station:station, report:report });
  }

  return out({ ok:false, error:'No report found for '+date+'.' });
}

/* ─────────────────────────────────────────────────────────────
   WEEKLY / MONTHLY SUMMARY
───────────────────────────────────────────────────────────── */
function getWeeklySummary(params) {
  var station = String(params.station || 'mso').toLowerCase();
  var now = new Date();
  var day = now.getDay();
  var diff = (day === 0 ? -6 : 1 - day);
  var monday = new Date(now); monday.setDate(now.getDate() + diff);
  var sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  var from = Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var to   = Utilities.formatDate(sunday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return aggregateRecords(station, from, to, 'week');
}

function getMonthlySummary(params) {
  var station = String(params.station || 'mso').toLowerCase();
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var from = year + '-' + month + '-01';
  var lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  var to = year + '-' + month + '-' + String(lastDay).padStart(2, '0');
  return aggregateRecords(station, from, to, 'month');
}

function aggregateRecords(station, from, to, period) {
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });
  var sheet = ss.getSheetByName('DailySales');
  if (!sheet) return out({ ok:true, period:period, totals:{} });

  var rows = sheet.getDataRange().getValues();
  var totals = { grandTotal:0, pmsLitres:0, pmsRevenue:0, agoLitres:0, agoRevenue:0, cashToBank:0, expenses:0, posMP:0, trfMP:0, cash:0, days:0 };

  for (var i = 1; i < rows.length; i++) {
    var rowDate = dateToStr(rows[i][0]);
    if (!rowDate || rowDate < from || rowDate > to) continue;
    var r = rows[i];
    totals.grandTotal  += Number(r[COL.GRAND_TOTAL])   || 0;
    totals.pmsLitres   += Number(r[COL.PMS_LITRES])    || 0;
    totals.pmsRevenue  += Number(r[COL.PMS_REVENUE])   || 0;
    totals.agoLitres   += Number(r[COL.AGO_LITRES])    || 0;
    totals.agoRevenue  += Number(r[COL.AGO_REVENUE])   || 0;
    totals.cashToBank  += Number(r[COL.TO_BANK])        || 0;
    totals.expenses    += Number(r[COL.TOTAL_EXPENSES]) || 0;
    totals.posMP       += Number(r[COL.POS_MP])         || 0;
    totals.trfMP       += Number(r[COL.TRF_MP])         || 0;
    totals.cash        += Number(r[COL.CASH])           || 0;
    totals.days++;
  }
  return out({ ok:true, period:period, from:from, to:to, station:station, totals:totals });
}

/* ─────────────────────────────────────────────────────────────
   SAVE DAILY REPORT
───────────────────────────────────────────────────────────── */
function saveDailyReport(body) {
  var station = String(body.station || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('DailySales');
  if (!sheet) return out({ ok:false, error:'DailySales sheet not found.' });

  var date = body.date || todayStr();
  var d    = body.data || {};
  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (dateToStr(rows[i][0]) === date) { targetRow = i + 1; break; }
  }

  var dayName = new Date(date).toLocaleDateString('en-NG', { weekday:'long' });
  var row = [
    date,                      // 0  - Date
    dayName,                   // 1  - Day
    station.toUpperCase(),     // 2  - Station
    body.username || '',       // 3  - SubmittedBy
    d.tk1_opening||0,          // 4  - TK1_Opening
    d.tk1_closing||0,          // 5  - TK1_Closing
    d.tk1_diff||0,             // 6  - TK1_Diff
    d.tk1_margin||0,           // 7  - TK1_Margin
    d.tk2_opening||0,          // 8  - TK2_Opening
    d.tk2_closing||0,          // 9  - TK2_Closing
    d.tk2_diff||0,             // 10 - TK2_Diff
    d.tk2_margin||0,           // 11 - TK2_Margin
    d.tk3_opening||0,          // 12 - TK3_Opening
    d.tk3_closing||0,          // 13 - TK3_Closing
    d.tk3_diff||0,             // 14 - TK3_Diff
    d.tk3_margin||0,           // 15 - TK3_Margin
    d.tk4_opening||0,          // 16 - TK4_Opening
    d.tk4_closing||0,          // 17 - TK4_Closing
    d.tk4_diff||0,             // 18 - TK4_Diff
    d.tk4_margin||0,           // 19 - TK4_Margin
    d.pms_margin||0,           // 20 - PMS_Margin
    d.pms_litres||0,           // 21 - PMS_Litres
    d.pms_price||0,            // 22 - PMS_Price
    d.pms_revenue||0,          // 23 - PMS_Revenue
    d.ago_margin||0,           // 24 - AGO_Margin
    d.ago_litres||0,           // 25 - AGO_Litres
    d.ago_price||0,            // 26 - AGO_Price
    d.ago_revenue||0,          // 27 - AGO_Revenue
    d.grand_total||0,          // 28 - Grand_Total
    d.pos_mp||0,               // 29 - POS_MP
    d.pos_zm||0,               // 30 - POS_ZM  ← was missing!
    d.trf_mp||0,               // 31 - TRF_MP
    d.trf_zb_amelia||0,        // 32 - TRF_ZB
    d.trf_fcmb_truck||0,       // 33 - TRF_Truck
    d.trf_fcmb_md||0,          // 34 - TRF_MD
    d.cash||0,                 // 35 - Cash
    d.total_expenses||0,       // 36 - Total_Expenses
    d.to_bank||0,              // 37 - To_Bank
    d.pos_mp_charge||0,        // 38 - POS_MP_Charge
    d.pos_zm_charge||0,        // 39 - POS_ZM_Charge
    d.emtl_counts||0,          // 40 - EMTL
    d.lubricant_rev||0,        // 41 - Lubricant_Revenue
    d.lpg_kg||0,               // 42 - LPG_KG
    d.lpg_price||0,            // 43 - LPG_Price
    d.lpg_revenue||0,          // 44 - LPG_Revenue
    d.lpg_remitted||0,         // 45 - LPG_Remitted
    d.pms_cash_summary||0,     // 46 - PMS_Cash_Summary
    d.oil_cash_summary||0,     // 47 - Oil_Cash_Summary
    d.gas_cash_summary||0,     // 48 - Gas_Cash_Summary
    d.total_cash_summary||0,   // 49 - Total_Cash_Summary
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    writeLog(station, body.username, 'UPDATE_REPORT', date);
    return out({ ok:true, action:'updated', date:date });
  } else {
    sheet.appendRow(row);
    writeLog(station, body.username, 'SAVE_REPORT', date);
    return out({ ok:true, action:'saved', date:date });
  }
}

/* ─────────────────────────────────────────────────────────────
   SAVE PUMP METRE — opening and closing metre per pump per day
───────────────────────────────────────────────────────────── */
function savePumpMetre(body) {
  var station = String(body.station || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('PumpMetres');
  if (!sheet) {
    sheet = ss.insertSheet('PumpMetres');
    sheet.appendRow(['Date','Station','Pump','Product','Tank','OpeningMetre','ClosingMetre','Difference','Price','Amount','SessionNum','SubmittedBy','Timestamp']);
    sheet.getRange(1,1,1,13).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
  }

  var date = body.date || todayStr();

  /* Check if row already exists for this pump+date+session — update it */
  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (dateToStr(rows[i][0]) === date &&
        String(rows[i][2]) === String(body.pump||'') &&
        Number(rows[i][10]) === Number(body.sessionNum||1)) {
      targetRow = i + 1;
      break;
    }
  }

  var row = [
    date,
    station.toUpperCase(),
    body.pump        || '',
    body.product     || '',
    body.tank        || '',
    Number(body.openingMetre) || 0,
    Number(body.closingMetre) || 0,
    Number(body.diff)         || 0,
    Number(body.price)        || 0,
    Number(body.amount)       || 0,
    Number(body.sessionNum)   || 1,
    body.username    || '',
    new Date().toISOString(),
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  writeLog(station, body.username, 'SAVE_PUMP_METRE', body.pump + ' session ' + (body.sessionNum||1));
  return out({ ok:true });
}


/* ─────────────────────────────────────────────────────────────
   SAVE EXPENSE
───────────────────────────────────────────────────────────── */
function saveExpense(body) {
  var station = String(body.station || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });
  var sheet = ss.getSheetByName('Expenses');
  if (!sheet) return out({ ok:false, error:'Expenses sheet not found.' });
  sheet.appendRow([body.date||todayStr(), station.toUpperCase(), body.description||'', Number(body.amount)||0, body.username||'', new Date()]);
  writeLog(station, body.username, 'SAVE_EXPENSE', body.description);
  return out({ ok:true });
}

/* ─────────────────────────────────────────────────────────────
   COLUMN INDEX MAP — DailySales sheet
───────────────────────────────────────────────────────────── */
var COL = {
  DATE:0, DAY:1, STATION:2, SUBMITTED_BY:3,
  TK1_OPEN:4, TK1_CLOSE:5, TK1_DIFF:6, TK1_MARGIN:7,
  TK2_OPEN:8, TK2_CLOSE:9, TK2_DIFF:10, TK2_MARGIN:11,
  TK3_OPEN:12,TK3_CLOSE:13,TK3_DIFF:14, TK3_MARGIN:15,
  TK4_OPEN:16,TK4_CLOSE:17,TK4_DIFF:18, TK4_MARGIN:19,
  PMS_MARGIN:20, PMS_LITRES:21, PMS_PRICE:22, PMS_REVENUE:23,
  AGO_MARGIN:24, AGO_LITRES:25, AGO_PRICE:26, AGO_REVENUE:27,
  GRAND_TOTAL:28,
  POS_MP:29, POS_ZM:30, TRF_MP:31, TRF_ZB:32, TRF_TRUCK:33, TRF_MD:34, CASH:35,
  TOTAL_EXPENSES:36, TO_BANK:37,
  POS_MP_CHARGE:38, POS_ZM_CHARGE:39, EMTL:40,
  LUBRICANT_REV:41,
  LPG_KG:42, LPG_PRICE:43, LPG_REVENUE:44, LPG_REMITTED:45,
  PMS_CASH_SUM:46, OIL_CASH_SUM:47, GAS_CASH_SUM:48, TOTAL_CASH_SUM:49,
};

/* ─────────────────────────────────────────────────────────────
   ACTIVITY LOG
───────────────────────────────────────────────────────────── */
function writeLog(station, username, action, detail) {
  try {
    var ss = getSheet(station);
    if (!ss) return;
    var tab = ss.getSheetByName('ActivityLog');
    if (!tab) {
      tab = ss.insertSheet('ActivityLog');
      tab.appendRow(['Timestamp','Username','Action','Detail']);
      tab.getRange(1,1,1,4).setFontWeight('bold');
    }
    tab.appendRow([new Date(), username, action, detail]);
  } catch(_) {}
}

/* ─────────────────────────────────────────────────────────────
   SAVE PRICE — called from price-mso.html (GM/Owner only)
   Writes to Pricing sheet. Minimum 2 records per day enforced.
───────────────────────────────────────────────────────────── */
function savePrice(body) {
  var station = String(body.station || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('Pricing');
  if (!sheet) return out({ ok:false, error:'Pricing sheet not found.' });

  var date    = body.date || todayStr();
  var time    = body.time || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  var product = String(body.product || '').toUpperCase(); // PMS or AGO
  var price   = Number(body.price) || 0;
  var note    = body.note || '';

  if (!price || price <= 0) return out({ ok:false, error:'Invalid price.' });
  if (product !== 'PMS' && product !== 'AGO') return out({ ok:false, error:'Product must be PMS or AGO.' });

  sheet.appendRow([date, time, station.toUpperCase(), product, price, body.username || '', note, new Date()]);

  writeLog(station, body.username, 'PRICE_CHANGE', product + ' → ₦' + price + '/L by ' + body.username);
  return out({ ok:true, product:product, price:price, date:date, time:time });
}

/* ─────────────────────────────────────────────────────────────
   GET CURRENT PRICES — latest PMS and AGO price from Pricing sheet
   Also returns today's price history
───────────────────────────────────────────────────────────── */
function getCurrentPrices(params) {
  var station = String((params && params.station) || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('Pricing');
  if (!sheet) return out({ ok:true, pmsPrice:1272, agoPrice:1819, history:[] });

  var rows = sheet.getDataRange().getValues();
  var today = todayStr();
  var latestPMS = null, latestAGO = null;
  var history = [];

  /* Read newest first */
  for (var i = rows.length - 1; i >= 1; i--) {
    var r = rows[i];
    var rowDate = dateToStr(r[0]);
    var product = String(r[3] || '').toUpperCase();
    var price   = Number(r[4]) || 0;
    var by      = String(r[5] || '');
    var time    = r[1] ? String(r[1]).substring(0,5) : '';

    if (!latestPMS && product === 'PMS' && price > 0) {
      latestPMS = { price:price, since:rowDate === today ? 'today '+time : rowDate };
    }
    if (!latestAGO && product === 'AGO' && price > 0) {
      latestAGO = { price:price, since:rowDate === today ? 'today '+time : rowDate };
    }
    if (rowDate === today) {
      history.push({ product:product, price:price, by:by, time:time });
    }
  }

  return out({
    ok:      true,
    pmsPrice: latestPMS ? latestPMS.price : 1272,
    pmsSince: latestPMS ? latestPMS.since : 'default',
    agoPrice: latestAGO ? latestAGO.price : 1819,
    agoSince: latestAGO ? latestAGO.since : 'default',
    history:  history.reverse(), /* chronological */
  });
}

/* ─────────────────────────────────────────────────────────────
   SAVE EDIT REQUEST — supervisor requests to edit a submitted record
───────────────────────────────────────────────────────────── */
function saveEditRequest(body) {
  var station = String(body.station || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('EditRequests');
  if (!sheet) {
    sheet = ss.insertSheet('EditRequests');
    sheet.appendRow(['Date','RequestedBy','Name','Message','RequestedAt','Status','ReviewedBy','ReviewedAt']);
    sheet.getRange(1,1,1,8).setFontWeight('bold');
  }

  sheet.appendRow([
    body.date || todayStr(),
    body.username || '',
    body.name || '',
    body.message || '',
    body.requestedAt || new Date().toISOString(),
    'PENDING',
    '',
    ''
  ]);

  writeLog(station, body.username, 'EDIT_REQUEST', body.date + ' — ' + body.message);
  return out({ ok:true, message:'Edit request saved. GM will be notified.' });
}

/* ─────────────────────────────────────────────────────────────
   GET EDIT REQUESTS — for GM/Owner approvals dashboard
───────────────────────────────────────────────────────────── */
function getEditRequests(params) {
  var station = String((params && params.station) || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('EditRequests');
  if (!sheet) return out({ ok:true, requests:[] });

  var rows = sheet.getDataRange().getValues();
  var requests = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    var r = rows[i];
    if (r[5] === 'PENDING') {
      requests.push({
        rowIndex: i + 1,
        date:        r[0],
        requestedBy: r[1],
        name:        r[2],
        message:     r[3],
        requestedAt: r[4],
        status:      r[5],
      });
    }
  }
  return out({ ok:true, station:station, requests:requests });
}

/* ─────────────────────────────────────────────────────────────
   APPROVE / REJECT EDIT REQUEST
───────────────────────────────────────────────────────────── */
function approveEditRequest(params) {
  var station   = String((params && params.station) || 'mso').toLowerCase();
  var rowIndex  = parseInt(params.rowIndex) || 0;
  var action    = String(params.action || 'approve').toLowerCase(); /* approve or reject */
  var reviewer  = String(params.username || '');

  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('EditRequests');
  if (!sheet || rowIndex < 2) return out({ ok:false, error:'Request not found.' });

  var status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  sheet.getRange(rowIndex, 6).setValue(status);
  sheet.getRange(rowIndex, 7).setValue(reviewer);
  sheet.getRange(rowIndex, 8).setValue(new Date().toISOString());

  writeLog(station, reviewer, 'EDIT_REQUEST_'+status, 'Row '+rowIndex);

  /* Broadcast approval via a flag the supervisor page can pick up */
  return out({ ok:true, status:status, rowIndex:rowIndex });
}

/* ═══════════════════════════════════════════════════════════════
   SETUP ALL SHEETS
   Visit: ?action=setupAllSheets
   Creates all required tabs with correct headers in both workbooks.
   Safe to run multiple times — skips tabs that already exist.
═══════════════════════════════════════════════════════════════ */
function setupAllSheets() {
  try {
    var results = [];
    var stations = ['mso', 'mrs'];
    stations.forEach(function(station) {
      var ss = getSheet(station);
      if (!ss) { results.push(station.toUpperCase() + ': Sheet not found'); return; }
      results.push('=== ' + station.toUpperCase() + ' ===');

      /* 1. DailySales */
      var ds = ss.getSheetByName('DailySales');
      if (!ds) {
        ds = ss.insertSheet('DailySales');
        var dsHeaders = [
          'Date','Day','Station','SubmittedBy',
          'TK1_Opening','TK1_Closing','TK1_Diff','TK1_Margin',
          'TK2_Opening','TK2_Closing','TK2_Diff','TK2_Margin',
          'TK3_Opening','TK3_Closing','TK3_Diff','TK3_Margin',
          'TK4_Opening','TK4_Closing','TK4_Diff','TK4_Margin',
          'PMS_Margin','PMS_Litres','PMS_Price','PMS_Revenue',
          'AGO_Margin','AGO_Litres','AGO_Price','AGO_Revenue',
          'Grand_Total',
          'POS_MP','POS_ZM','TRF_MP','TRF_ZB','TRF_Truck','TRF_MD',
          'Cash','Total_Expenses','To_Bank',
          'POS_MP_Charge','POS_ZM_Charge','EMTL',
          'Lubricant_Revenue',
          'LPG_KG','LPG_Price','LPG_Revenue','LPG_Remitted',
          'PMS_Cash_Summary','Oil_Cash_Summary','Gas_Cash_Summary','Total_Cash_Summary'
        ];
        ds.appendRow(dsHeaders);
        ds.getRange(1,1,1,dsHeaders.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        ds.setFrozenRows(1);
        ds.setColumnWidth(1, 110);
        results.push('  DailySales: CREATED ('+dsHeaders.length+' columns)');
      } else {
        /* Verify POS_ZM column exists — add if missing */
        var headers = ds.getRange(1,1,1,ds.getLastColumn()).getValues()[0];
        if (headers.indexOf('POS_ZM') === -1) {
          /* Insert POS_ZM after POS_MP (col 30, index 29) */
          ds.insertColumnAfter(30);
          ds.getRange(1,31).setValue('POS_ZM').setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
          results.push('  DailySales: EXISTS — added missing POS_ZM column');
        } else {
          results.push('  DailySales: EXISTS (ok)');
        }
      }

      /* 2. PumpMetres */
      var pm = ss.getSheetByName('PumpMetres');
      if (!pm) {
        pm = ss.insertSheet('PumpMetres');
        var pmH = ['Date','Station','Pump','Product','Tank','OpeningMetre','ClosingMetre','Difference','Price','Amount','SessionNum','SubmittedBy','Timestamp'];
        pm.appendRow(pmH);
        pm.getRange(1,1,1,pmH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        pm.setFrozenRows(1);
        results.push('  PumpMetres: CREATED');
      } else { results.push('  PumpMetres: EXISTS (ok)'); }

      /* 3. SalesLog */
      var sl = ss.getSheetByName('SalesLog');
      if (!sl) {
        ensureSalesLogSheet(ss);
        results.push('  SalesLog: CREATED');
      } else { results.push('  SalesLog: EXISTS (ok)'); }

      /* 4. Expenses */
      var ex = ss.getSheetByName('Expenses');
      if (!ex) {
        ex = ss.insertSheet('Expenses');
        var exH = ['Date','Station','Description','Amount','SubmittedBy','Timestamp'];
        ex.appendRow(exH);
        ex.getRange(1,1,1,exH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        ex.setFrozenRows(1);
        results.push('  Expenses: CREATED');
      } else { results.push('  Expenses: EXISTS (ok)'); }

      /* 5. Pricing */
      var pr = ss.getSheetByName('Pricing');
      if (!pr) {
        pr = ss.insertSheet('Pricing');
        var prH = ['Date','Time','Station','Product','Price','ChangedBy','Note','Timestamp'];
        pr.appendRow(prH);
        pr.getRange(1,1,1,prH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        pr.setFrozenRows(1);
        /* Seed default prices */
        pr.appendRow([todayStr(),'00:00',station.toUpperCase(),'PMS',1269,'system','Default price','']);
        pr.appendRow([todayStr(),'00:00',station.toUpperCase(),'AGO',1799,'system','Default price','']);
        results.push('  Pricing: CREATED (seeded with PMS ₦1,269 and AGO ₦1,799)');
      } else { results.push('  Pricing: EXISTS (ok)'); }

      /* 6. Discharge */
      var di = ss.getSheetByName('Discharge');
      if (!di) {
        di = ss.insertSheet('Discharge');
        var diH = ['Date','Station','Tank','Product','LitresReceived','TruckNumber','DriverName','OpeningStock','ClosingStock','SubmittedBy','Notes','Timestamp'];
        di.appendRow(diH);
        di.getRange(1,1,1,diH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        di.setFrozenRows(1);
        results.push('  Discharge: CREATED');
      } else { results.push('  Discharge: EXISTS (ok)'); }

      /* 7. Staff */
      var st = ss.getSheetByName('Staff');
      if (!st) {
        st = ss.insertSheet('Staff');
        var stH = ['Username','Name','Role','Station','Phone','Status','JoinDate'];
        st.appendRow(stH);
        st.getRange(1,1,1,stH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        st.setFrozenRows(1);
        /* Seed staff from STAFF object */
        Object.keys(STAFF).forEach(function(u) {
          var s = STAFF[u];
          if (!s.station || s.station === station || s.pick) {
            st.appendRow([u, s.name, s.role, s.station||'both', '', 'active', todayStr()]);
          }
        });
        results.push('  Staff: CREATED (seeded with '+Object.keys(STAFF).length+' staff)');
      } else { results.push('  Staff: EXISTS (ok)'); }

      /* 8. Payroll */
      var pay = ss.getSheetByName('Payroll');
      if (!pay) {
        pay = ss.insertSheet('Payroll');
        var payH = ['Month','Station','StaffName','Role','BasicSalary','Allowances','Deductions','NetPay','PreparedBy','ApprovedBy','Status','Timestamp'];
        pay.appendRow(payH);
        pay.getRange(1,1,1,payH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        pay.setFrozenRows(1);
        results.push('  Payroll: CREATED');
      } else { results.push('  Payroll: EXISTS (ok)'); }

      /* 9. EditRequests */
      var er = ss.getSheetByName('EditRequests');
      if (!er) {
        er = ss.insertSheet('EditRequests');
        var erH = ['Date','RequestedBy','Name','Message','RequestedAt','Status','ReviewedBy','ReviewedAt'];
        er.appendRow(erH);
        er.getRange(1,1,1,erH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        er.setFrozenRows(1);
        results.push('  EditRequests: CREATED');
      } else { results.push('  EditRequests: EXISTS (ok)'); }

      /* 10. Incidents */
      var inc = ss.getSheetByName('Incidents');
      if (!inc) {
        inc = ss.insertSheet('Incidents');
        var incH = ['Date','Time','Station','Type','Description','ReportedBy','Status','ResolvedBy','ResolvedAt','Timestamp'];
        inc.appendRow(incH);
        inc.getRange(1,1,1,incH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        inc.setFrozenRows(1);
        results.push('  Incidents: CREATED');
      } else { results.push('  Incidents: EXISTS (ok)'); }

      /* 11. ActivityLog */
      var al = ss.getSheetByName('ActivityLog');
      if (!al) {
        al = ss.insertSheet('ActivityLog');
        al.appendRow(['Timestamp','Username','Action','Detail']);
        al.getRange(1,1,1,4).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        al.setFrozenRows(1);
        results.push('  ActivityLog: CREATED');
      } else { results.push('  ActivityLog: EXISTS (ok)'); }

      /* 12. LPG */
      var lpg = ss.getSheetByName('LPG');
      if (!lpg) {
        lpg = ss.insertSheet('LPG');
        var lpgH = ['Date','Station','KG','UnitPrice','TotalSales','Remitted','SubmittedBy','Timestamp'];
        lpg.appendRow(lpgH);
        lpg.getRange(1,1,1,lpgH.length).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
        lpg.setFrozenRows(1);
        results.push('  LPG: CREATED');
      } else { results.push('  LPG: EXISTS (ok)'); }

    }); /* end stations loop */

    return out({
      ok: true,
      message: 'Setup complete for both workbooks.',
      details: results
    });

  } catch(e) {
    return out({ ok: false, error: 'Setup error: ' + e.message });
  }
}

/* ─────────────────────────────────────────────────────────────
   DEBUG — returns actual sheet headers and first data row
───────────────────────────────────────────────────────────── */
function debugSheet(params) {
  var station = String((params && params.station) || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('DailySales');
  if (!sheet) return out({ ok:false, error:'DailySales not found.' });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];

  /* Return all data rows with column mapping */
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function(h, j) {
      row[j + '_' + h] = data[i][j];
    });
    rows.push(row);
  }

  return out({
    ok: true,
    totalRows: data.length - 1,
    headers: headers,
    colCount: headers.length,
    rows: rows,
  });
}
