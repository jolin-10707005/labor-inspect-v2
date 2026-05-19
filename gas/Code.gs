// ══════════════════════════════════════════════
// 勞檢查核平台 — Google Apps Script 後端
// ══════════════════════════════════════════════

const SS_ID = '1zf5bHOAYGrgHzJATFlhH-PdvFRMJVrqzfXjQqpCeHmM';
const FOLDER_ID = '1xRWeAIsBkJKJ4quJ5-xmahPxcxsYMFBY';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ── Sheet 工具 ──────────────────────────────────

function ss() {
  return SpreadsheetApp.openById(SS_ID);
}
function getSheet(name) {
  return ss().getSheetByName(name);
}

// 補齊店號為 6 碼字串（Sheets 會把純數字字串自動轉為 number）
function pad6(v) {
  if (v === null || v === undefined || v === '') return '';
  return String(v).padStart(6, '0');
}

// Sheets 會把日期字串自動轉為 Date 物件，統一轉回 yyyy-MM-dd 字串
function toDateStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// Sheets 會把時間字串轉為 Date 物件（年份 1899），統一轉回 HH:mm 字串
function toTimeStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  return String(v).slice(0, 5); // "11:33:00" → "11:33"
}

function sheetToObjects(sheetName) {
  const s = getSheet(sheetName);
  if (!s) return [];
  const data = s.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getNextId(sheetName) {
  const s = getSheet(sheetName);
  const lastRow = s.getLastRow();
  if (lastRow < 2) return 1;
  const val = s.getRange(lastRow, 1).getValue();
  return (parseInt(val) || 0) + 1;
}

function appendObj(sheetName, headers, obj) {
  const s = getSheet(sheetName);
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  s.appendRow(row);
  return obj.id;
}

function findRowIndex(sheetName, id) {
  const s = getSheet(sheetName);
  const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function updateSheetRow(sheetName, id, updates) {
  const s = getSheet(sheetName);
  const data = s.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      Object.keys(updates).forEach(k => {
        const col = headers.indexOf(k);
        if (col >= 0) s.getRange(i + 1, col + 1).setValue(updates[k]);
      });
      return true;
    }
  }
  return false;
}

function deleteSheetRow(sheetName, id) {
  const s = getSheet(sheetName);
  const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      s.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function deleteRowsByField(sheetName, field, value) {
  const s = getSheet(sheetName);
  const data = s.getDataRange().getValues();
  const headers = data[0];
  const col = headers.indexOf(field);
  if (col < 0) return;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]) === String(value)) s.deleteRow(i + 1);
  }
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
}

// ── 認證 ────────────────────────────────────────

function makeToken(user) {
  const payload = JSON.stringify({ id: user.id, username: user.username, role: user.role, full_name: user.full_name, exp: Date.now() + TOKEN_EXPIRY_MS });
  return Utilities.base64Encode(Utilities.newBlob(payload).getBytes());
}

function parseToken(token) {
  try {
    const bytes = Utilities.base64Decode(token);
    const p = JSON.parse(Utilities.newBlob(bytes).getDataAsString());
    return p && p.exp > Date.now() ? p : null;
  } catch (e) {
    return null;
  }
}

function getUser(e) {
  const t = e.parameter.token || '';
  if (!t) return null;
  return parseToken(t);
}

// ── HTTP 回應 ────────────────────────────────────

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function fail(msg, code) {
  return ContentService.createTextOutput(JSON.stringify({ error: msg, code: code || 400 })).setMimeType(ContentService.MimeType.JSON);
}

// ── 路由 ─────────────────────────────────────────

function doGet(e) { return route(e, 'GET'); }
function doPost(e) { return route(e, 'POST'); }

function route(e, httpMethod) {
  try {
    const path = e.parameter.path || '';
    let body = {};
    // 先嘗試 POST body
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (_) {}
    }
    // 備援：從 URL 參數 d 讀取（解決 GAS 302 轉址後 POST body 遺失的問題）
    if (!Object.keys(body).length && e.parameter.d) {
      try {
        const decoded = decodeURIComponent(escape(Utilities.newBlob(Utilities.base64Decode(e.parameter.d)).getDataAsString()));
        body = JSON.parse(decoded);
      } catch (_) {}
    }
    const method = body._method ? body._method.toUpperCase() : httpMethod;

    // ── 不需驗證 ──
    if (path === '/api/login' && method === 'POST') return handleLogin(body);
    if (path === '/api/checklist' && method === 'GET') return handleChecklist(e.parameter);
    if (path === '/api/active-store-type' && method === 'GET') return handleGetActiveStoreType();

    // ── 需驗證 ──
    const user = getUser(e);
    if (!user) return fail('未授權', 401);

    // 照片上傳
    if (path === '/api/upload-photo' && method === 'POST') return handleUploadPhoto(body);

    // 店鋪
    if (path === '/api/stores') {
      if (method === 'GET') return handleGetStores();
      if (method === 'POST') return handleAddStore(body);
      if (method === 'PUT') return handleBatchStores(body);
    }

    // 應查店舖
    if (path === '/api/assigned-stores') {
      if (method === 'GET') return handleGetAssigned(e.parameter);
      if (method === 'POST') return handleSetAssigned(body);
    }

    // 防重複
    if (path === '/api/inspections/check' && method === 'POST') return handleCheckDuplicate(body);

    // 查核記錄
    if (path === '/api/inspections') {
      if (method === 'GET') return handleGetInspections(e.parameter);
      if (method === 'POST') return handleCreateInspection(body, user);
    }
    // 批次取得多筆記錄的答案（供匯出加速用，避免 N 次逐筆呼叫）
    if (path === '/api/inspections/batch-answers' && method === 'POST') return handleGetBatchAnswers(body);
    const insMatch = path.match(/^\/api\/inspections\/(\d+)$/);
    if (insMatch) {
      const id = parseInt(insMatch[1]);
      if (method === 'GET') return handleGetInspection(id);
      if (method === 'PUT') return handleEditInspection(id, body, user);
      if (method === 'DELETE') return handleDeleteInspection(id, body, user);
    }

    // 使用者
    if (path === '/api/users') {
      if (method === 'GET') return handleGetUsers();
      if (method === 'POST') return handleAddUser(body);
    }

    // schema 修補（補齊缺少的欄位）
    if (path === '/api/fix-schema' && method === 'POST') {
      ensureMonthColumn();
      ensureAnswersNoteColumn();
      return ok({ success: true, message: 'schema patched' });
    }

    // 月份題目匯入
    if (path === '/api/personnel/import' && method === 'POST') return handleImportPersonnel(body);
    if (path === '/api/questions/import-month' && method === 'POST') return handleImportMonthQuestions(body);

    // 題目重置（RC / FC 標準題組）
    if (path === '/api/reset-questions' && method === 'POST') {
      const t = (body.store_type || '').toUpperCase();
      if (t === 'FC') return ok({ success: true, message: resetFCQuestionsAndOptions() });
      return fail('目前僅支援 FC 重置，RC 請洽管理員');
    }

    // 題目管理
    if (path === '/api/questions' && method === 'POST') return handleAddQuestion(body);
    if (path === '/api/questions/reorder' && method === 'POST') return handleReorderQuestions(body);
    if (path === '/api/options/update-labels' && method === 'POST') return handleUpdateOptionLabels(body);
    // 選項單筆 CRUD
    if (path === '/api/options' && method === 'POST') return handleAddOption(body);
    const optMatch = path.match(/^\/api\/options\/(\d+)$/);
    if (optMatch) {
      const optId = parseInt(optMatch[1]);
      if (method === 'PUT') return handleEditOption(optId, body);
      if (method === 'DELETE') return handleDeleteOption(optId);
    }
    const qMatch = path.match(/^\/api\/questions\/(\d+)$/);
    if (qMatch) {
      const id = parseInt(qMatch[1]);
      if (method === 'PUT') return handleEditQuestion(id, body);
      if (method === 'DELETE') return handleDeleteQuestion(id);
    }

    return fail('Not Found', 404);
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ══════════════════════════════════════════════
// Handler 實作
// ══════════════════════════════════════════════

// ── 登入 ──
function handleLogin(body) {
  const { username, password } = body;
  function normId(v) { return String(v).replace(/^0+/, '') || '0'; }

  // 參數長度限制（依 CheckUserId API 規格）
  const userId = String(username || '').substring(0, 15);
  const psw    = String(password || '').substring(0, 30);
  if (!userId || !psw) return fail('請輸入帳號和密碼', 400);

  // ① 呼叫日翊 CheckUserId AD 驗證 API
  let adVerified = false;
  try {
    const resp = UrlFetchApp.fetch('https://eip.fme.com.tw/FMEIP/AasApi/CheckUserId', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ USER_ID: userId, PSW: psw }),
      muteHttpExceptions: true
    });
    const text = resp.getContentText();
    let data;
    try { data = JSON.parse(text); } catch (e) { return fail('AD 驗證回應格式錯誤', 500); }
    const code = String(data.MSG || '').split(' ')[0];

    if (code === '000') {
      adVerified = true;
    } else {
      const errMap = {
        '100': '帳號或密碼錯誤',
        '200': 'AD 認證錯誤',
        '998': '系統暫時無法使用，請稍後再試',
        '999': '系統發生錯誤，請聯絡管理員'
      };
      return fail(errMap[code] || ('AD 驗證失敗（' + code + '）'), 401);
    }
  } catch (e) {
    return fail('無法連線至日翊 AD 認證系統：' + e.message, 500);
  }

  if (!adVerified) return fail('AD 驗證失敗', 401);

  // ② AD 驗證通過後，從人員工號 sheet 取得姓名等附加資訊
  let safe = { id: userId, username: userId, role: 'inspector', full_name: '' };
  const personnelSheet = getSheet('人員工號');
  if (personnelSheet) {
    const sdata = personnelSheet.getDataRange().getValues();
    const headers = sdata[0];
    const idxEmpid = headers.indexOf('工號');
    const idxName  = headers.indexOf('姓名');
    if (idxEmpid >= 0) {
      const match = sdata.slice(1).find(row => normId(row[idxEmpid]) === normId(userId));
      if (match) {
        const empid = String(match[idxEmpid]).replace(/\.0$/, '');
        const name  = idxName >= 0 ? String(match[idxName]) : '';
        safe = { id: empid, username: empid, role: 'inspector', full_name: name };
      }
    }
  }
  return ok({ token: makeToken(safe), user: safe });
}

// ── inspection_answers.note 欄位自動補齊 ──
function ensureAnswersNoteColumn() {
  const s = getSheet('inspection_answers');
  if (!s) return;
  const lastCol = s.getLastColumn();
  if (lastCol < 1) return;
  const headers = s.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!headers.includes('note')) {
    s.getRange(1, lastCol + 1).setValue('note');
  }
}

// ── 月份欄位輔助 ──
function ensureMonthColumn() {
  ['categories', 'categories_FC'].forEach(function(sheetName) {
    const s = getSheet(sheetName);
    if (!s) return;
    const lastCol = s.getLastColumn();
    if (lastCol < 1) return;
    const headers = s.getRange(1, 1, 1, lastCol).getValues()[0];
    if (!headers.includes('month')) {
      s.getRange(1, lastCol + 1).setValue('month');
    }
  });
}

function detectStoreTypeFromName(name) {
  if (!name) return 'RC';
  const n = String(name);
  if (n.includes('加盟') || n.includes('FC')) return 'FC';
  return 'RC';
}

// ── RC / FC 分開活頁（直營用 categories/questions/options，加盟用 _FC 後綴）──
function catSN(st) { return (st||'').toUpperCase()==='FC' ? 'categories_FC' : 'categories'; }
function qSN(st)   { return (st||'').toUpperCase()==='FC' ? 'questions_FC'  : 'questions'; }
function optSN(st) { return (st||'').toUpperCase()==='FC' ? 'options_FC'    : 'options'; }

// 跨兩張表取全域最大 ID（確保 RC / FC 的 ID 不衝突）
function getNextIdGlobal(sheetNames) {
  var maxId = 0;
  sheetNames.forEach(function(n) {
    var s = getSheet(n); if (!s) return;
    var lr = s.getLastRow(); if (lr < 2) return;
    var v = parseInt(s.getRange(lr, 1).getValue()) || 0;
    if (v > maxId) maxId = v;
  });
  return maxId + 1;
}

// 若 FC 三張活頁不存在，自動建立
function ensureFCSheets() {
  var sp = ss();
  if (!sp.getSheetByName('categories_FC')) {
    sp.insertSheet('categories_FC').appendRow(['id','store_type','name','item_no','sort_order','month']);
  }
  if (!sp.getSheetByName('questions_FC')) {
    sp.insertSheet('questions_FC').appendRow(['id','category_id','content','condition_note','deduction','sort_order']);
  }
  if (!sp.getSheetByName('options_FC')) {
    sp.insertSheet('options_FC').appendRow(['id','question_id','param_code','label','is_violation','skip_items','sort_order']);
  }
}

// ── 題目清單 ──
function handleChecklist(params) {
  const storeType = params.store_type || null;
  const month = params.month !== undefined ? parseInt(params.month) : null;
  const st = storeType ? storeType.toUpperCase() : null;

  // 讀取 categories：指定 store_type → 單一活頁；無指定 → 合併 RC + FC
  let cats, qs, opts;
  if (st) {
    cats = sheetToObjects(catSN(st)).filter(c => String(c.store_type).toUpperCase() === st);
    qs   = sheetToObjects(qSN(st)).sort((a, b) => (a.category_id - b.category_id) || (a.sort_order - b.sort_order));
    opts = sheetToObjects(optSN(st)).sort((a, b) => (a.question_id - b.question_id) || (a.sort_order - b.sort_order));
  } else {
    // 維護頁：無 store_type 參數時合併兩張活頁，確保 RC/FC 都顯示正確 badge
    cats = [...sheetToObjects('categories'), ...sheetToObjects('categories_FC')];
    qs   = [...sheetToObjects('questions'),  ...sheetToObjects('questions_FC')]
             .sort((a, b) => (a.category_id - b.category_id) || (a.sort_order - b.sort_order));
    opts = [...sheetToObjects('options'),    ...sheetToObjects('options_FC')]
             .sort((a, b) => (a.question_id - b.question_id) || (a.sort_order - b.sort_order));
  }

  if (month !== null) cats = cats.filter(c => parseInt(c.month) === month);
  cats = cats.sort((a, b) => (Number(a.sort_order)||0) - (Number(b.sort_order)||0));

  const result = cats.map(c => ({
    ...c,
    questions: qs.filter(q => String(q.category_id) === String(c.id)).map(q => ({
      ...q,
      options: opts.filter(o => String(o.question_id) === String(q.id)).map(o => ({
        ...o,
        skip_items: o.skip_items ? (typeof o.skip_items === 'string' ? JSON.parse(o.skip_items) : o.skip_items) : []
      }))
    }))
  }));
  return ok(result);
}

// 月份題目匯入（完整替換該月所有類別/題目/選項，RC / FC 各用自己的活頁）
function handleImportMonthQuestions(body) {
  const { month, categories: catData, store_type: importStoreType } = body;
  if (!month || !catData || !catData.length) return fail('month and categories required');
  const st = (importStoreType || 'RC').toUpperCase();
  if (st === 'FC') ensureFCSheets(); // 確保 FC 活頁存在
  ensureMonthColumn();
  SpreadsheetApp.flush();
  const m = parseInt(month);

  // ── 讀取對應活頁（RC → categories/questions/options；FC → *_FC）──
  const catSheetObj = getSheet(catSN(st));
  const qSheetObj   = getSheet(qSN(st));
  const optSheetObj = getSheet(optSN(st));
  const catData2D   = catSheetObj.getDataRange().getValues();
  const qData2D     = qSheetObj.getDataRange().getValues();
  const optData2D   = optSheetObj.getDataRange().getValues();

  // 找出該月要刪除的 category ids（FC 活頁內只需比對 month，無需再篩 store_type）
  const catHeaders  = catData2D[0];
  const catMonthCol = catHeaders.indexOf('month');
  const catIdCol    = catHeaders.indexOf('id');
  const oldCatIds   = new Set();
  for (let i = 1; i < catData2D.length; i++) {
    if (parseInt(catData2D[i][catMonthCol]) !== m) continue;
    oldCatIds.add(String(catData2D[i][catIdCol]));
  }

  // 找出要刪除的 question ids
  const qHeaders = qData2D[0];
  const qCatCol  = qHeaders.indexOf('category_id');
  const qIdCol   = qHeaders.indexOf('id');
  const oldQIds  = new Set();
  for (let i = 1; i < qData2D.length; i++) {
    if (oldCatIds.has(String(qData2D[i][qCatCol]))) oldQIds.add(String(qData2D[i][qIdCol]));
  }

  const optHeaders = optData2D[0];
  const optQCol    = optHeaders.indexOf('question_id');

  // 由下往上刪：options → questions → categories
  for (let i = optData2D.length - 1; i >= 1; i--) {
    if (oldQIds.has(String(optData2D[i][optQCol]))) optSheetObj.deleteRow(i + 1);
  }
  for (let i = qData2D.length - 1; i >= 1; i--) {
    if (oldCatIds.has(String(qData2D[i][qCatCol]))) qSheetObj.deleteRow(i + 1);
  }
  for (let i = catData2D.length - 1; i >= 1; i--) {
    if (parseInt(catData2D[i][catMonthCol]) === m) catSheetObj.deleteRow(i + 1);
  }
  SpreadsheetApp.flush();

  // 插入新資料（ID 跨 RC+FC 全域唯一，避免答案查詢時衝突）
  let catCount = 0, qCount = 0, optCount = 0;
  const catInsertHeaders = catSheetObj.getRange(1, 1, 1, catSheetObj.getLastColumn()).getValues()[0];
  let nextCatId = getNextIdGlobal(['categories', 'categories_FC']);
  let nextQId   = getNextIdGlobal(['questions',   'questions_FC']);
  let nextOptId = getNextIdGlobal(['options',      'options_FC']);

  catData.forEach((c, ci) => {
    const catId = nextCatId++;
    appendObj(catSN(st), catInsertHeaders, {
      id: catId,
      store_type: st,
      name: c.name, item_no: c.item_no !== undefined ? c.item_no : String(ci),
      sort_order: ci, month: m
    });
    catCount++;
    (c.questions || []).forEach((q, qi) => {
      const qId = nextQId++;
      appendObj(qSN(st), ['id', 'category_id', 'content', 'condition_note', 'deduction', 'sort_order'], {
        id: qId, category_id: catId, content: q.content,
        condition_note: q.condition_note || '', deduction: 0, sort_order: qi
      });
      qCount++;
      (q.options || []).forEach((o, oi) => {
        const optId = nextOptId++;
        appendObj(optSN(st), ['id', 'question_id', 'param_code', 'label', 'is_violation', 'skip_items', 'sort_order'], {
          id: optId, question_id: qId,
          param_code: o.param_code || ('m' + m + '_' + qId + '_' + optId),
          label: o.label, is_violation: o.is_violation ? 1 : 0,
          skip_items: '[]', sort_order: oi
        });
        optCount++;
      });
    });
  });

  SpreadsheetApp.flush();
  return ok({ success: true, month: m, categories: catCount, questions: qCount, options: optCount });
}

// ── 偵測當月應點店型（RC 和 FC 各自查自己的活頁）──
function handleGetActiveStoreType() {
  const now = new Date();
  const d = now.getDate();
  const m = d >= 2 ? now.getMonth() + 1 : (now.getMonth() === 0 ? 12 : now.getMonth());
  // 分別讀取 RC 與 FC 活頁
  const rcCats = sheetToObjects('categories').filter(c => parseInt(c.month) === m);
  const fcCats = sheetToObjects('categories_FC').filter(c => parseInt(c.month) === m);
  const rcCount = rcCats.length;
  const fcCount = fcCats.length;
  if (rcCount > 0 || fcCount > 0) {
    const storeType = fcCount > rcCount ? 'FC' : 'RC';
    return ok({ store_type: storeType, active_month: m, has_questions: true, rc_count: rcCount, fc_count: fcCount });
  }
  return ok({ store_type: null, active_month: m, has_questions: false });
}

// ── 照片上傳 (base64 → Drive) ──
function handleUploadPhoto(body) {
  const { data, name, type } = body;
  if (!data) return fail('No image data');
  try {
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, type || 'image/jpeg', name || ('photo_' + Date.now() + '.jpg'));
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    // uc?export=view 已被 Google 限制（403）；改用 thumbnail API，不需登入即可存取
    const url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
    return ok({ url, fileId });
  } catch (err) {
    return fail('上傳失敗: ' + err.message);
  }
}

// ── 店鋪 ──
function handleGetStores() {
  const stores = sheetToObjects('stores')
    .filter(s => String(s.active) === '1')
    .map(s => ({ ...s, code: pad6(s.code) }))
    .sort((a, b) => a.code.localeCompare(b.code));
  return ok(stores);
}
function handleAddStore(body) {
  const { code, name, section } = body;
  const stores = sheetToObjects('stores');
  const existing = stores.find(s => s.code === code);
  if (existing) {
    updateSheetRow('stores', existing.id, { name, section: section || '', active: 1 });
    return ok({ id: existing.id, code, name });
  }
  const id = getNextId('stores');
  appendObj('stores', ['id', 'code', 'name', 'section', 'active'], { id, code, name, section: section || '', active: 1 });
  return ok({ id, code, name });
}
function handleBatchStores(body) {
  const { stores } = body;
  if (!stores || !stores.length) return ok({ success: true, count: 0 });

  const sheet = getSheet('stores');
  if (!sheet) return fail('找不到 stores 工作表');

  // 一次讀入全部資料
  const sheetData = sheet.getDataRange().getValues();
  if (!sheetData.length) return fail('stores 工作表格式錯誤');

  const headers  = sheetData[0];
  const idCol      = headers.indexOf('id');
  const codeCol    = headers.indexOf('code');
  const nameCol    = headers.indexOf('name');
  const sectionCol = headers.indexOf('section');
  const activeCol  = headers.indexOf('active');

  // 正規化店號：Sheets 把 "024324" 存成數字 24324，統一去前導零比對
  function normCode(v) { return String(parseInt(String(v), 10) || 0); }

  // 建立 code → 列索引 Map（0=header，1=第一筆資料）
  const codeToIdx = {};
  let nextId = 1;
  for (let i = 1; i < sheetData.length; i++) {
    codeToIdx[normCode(sheetData[i][codeCol])] = i;
    const v = Number(sheetData[i][idCol]) || 0;
    if (v >= nextId) nextId = v + 1;
  }

  // 在 memory 中直接更新或新增列（不呼叫任何 sheet API）
  stores.forEach(s => {
    const key = normCode(s.code);
    if (codeToIdx.hasOwnProperty(key)) {
      // 更新現有列
      const ri = codeToIdx[key];
      if (nameCol >= 0)    sheetData[ri][nameCol] = s.name;
      if (sectionCol >= 0) sheetData[ri][sectionCol] = s.section || '';
      if (activeCol >= 0)  sheetData[ri][activeCol] = 1;
    } else {
      // 新增列（填入空白列後設值）
      const newRow = new Array(headers.length).fill('');
      if (idCol >= 0)      newRow[idCol] = nextId;
      if (codeCol >= 0)    newRow[codeCol] = s.code;
      if (nameCol >= 0)    newRow[nameCol] = s.name;
      if (sectionCol >= 0) newRow[sectionCol] = s.section || '';
      if (activeCol >= 0)  newRow[activeCol] = 1;
      sheetData.push(newRow);
      codeToIdx[key] = sheetData.length - 1;
      nextId++;
    }
  });

  // 一次性寫回（原本 500 筆 appendRow = 500 次 API call，現在只需 2 次）
  sheet.clearContents();
  sheet.getRange(1, 1, sheetData.length, sheetData[0].length).setValues(sheetData);

  return ok({ success: true, count: stores.length });
}

// ── 應查店舖 ──
function handleGetAssigned(params) {
  const month = params.month ? parseInt(params.month) : null;
  const section = params.section || '';
  let list = sheetToObjects('assigned_stores').map(r => ({ ...r, store_code: pad6(r.store_code) }));
  if (month) list = list.filter(r => parseInt(r.month) === month);
  if (section) list = list.filter(r => r.section === section);
  list.sort((a, b) => String(a.section).localeCompare(String(b.section)) || a.store_code.localeCompare(b.store_code));
  return ok(list);
}
function handleSetAssigned(body) {
  const { month, stores } = body;
  if (!month || !stores) return fail('month and stores required');
  deleteRowsByField('assigned_stores', 'month', month);
  const t = now();
  stores.forEach(s => {
    const id = getNextId('assigned_stores');
    appendObj('assigned_stores', ['id', 'month', 'store_code', 'store_name', 'section', 'note', 'created_at'], {
      id, month: parseInt(month),
      store_code: s.code || s.store_code,
      store_name: s.name || s.store_name,
      section: s.section || '',
      note: s.note || '',
      created_at: t
    });
  });
  return ok({ success: true, count: stores.length, month });
}

// ── 防重複 ──
function handleCheckDuplicate(body) {
  const { store_code, audit_date } = body;
  const list = sheetToObjects('inspections');
  const existing = list.find(r => r.store_code === store_code && r.audit_date === audit_date);
  return ok({ exists: !!existing, id: existing ? existing.id : null });
}

// ── 查核記錄 ──
function handleGetInspections(params) {
  const start = params.start_date || '';
  const end = params.end_date || '';
  const section = params.section || '';
  const store_type = params.store_type || '';
  let list = sheetToObjects('inspections').map(r => ({
    ...r,
    store_code: pad6(r.store_code),
    audit_date: toDateStr(r.audit_date),   // Sheets 自動轉 Date 物件
    audit_time: toTimeStr(r.audit_time)    // 同上，時間也會被轉成 1899 年 Date
  }));
  if (start) list = list.filter(r => r.audit_date >= start);
  if (end) list = list.filter(r => r.audit_date <= end);
  if (section) list = list.filter(r => r.section === section);
  if (store_type) list = list.filter(r => r.store_type === store_type);
  list.sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date)));
  return ok(list);
}

function handleCreateInspection(body, user) {
  ensureAnswersNoteColumn(); // 確保 note 欄位存在
  const { store_code, store_name, store_type, audit_date, audit_time, inspector_name, section, exec_status, exec_other, has_violation, paper_photo, answers } = body;
  const id = getNextId('inspections');
  const t = now();
  appendObj('inspections',
    ['id', 'store_code', 'store_name', 'store_type', 'audit_date', 'audit_time', 'inspector_name', 'section', 'exec_status', 'exec_other', 'has_violation', 'paper_photo', 'auditor_id', 'created_at'],
    { id, store_code, store_name, store_type: store_type || 'RC', audit_date, audit_time: audit_time || '', inspector_name, section: section || '', exec_status, exec_other: exec_other || '', has_violation: has_violation ? 1 : 0, paper_photo: paper_photo || '', auditor_id: user.id, created_at: t }
  );
  if (answers && answers.length > 0) {
    answers.forEach(a => {
      const aid = getNextId('inspection_answers');
      appendObj('inspection_answers',
        ['id', 'inspection_id', 'question_id', 'opt_id', 'param_code', 'is_vio', 'skipped', 'note'],
        { id: aid, inspection_id: id, question_id: a.question_id, opt_id: a.opt_id || '', param_code: a.param || '', is_vio: a.is_vio ? 1 : 0, skipped: a.skipped ? 1 : 0, note: a.note || '' }
      );
    });
  }
  return ok({ id, has_violation: has_violation ? 1 : 0 });
}

function handleGetInspection(id) {
  const list = sheetToObjects('inspections');
  const ins = list.find(r => String(r.id) === String(id));
  if (!ins) return fail('找不到', 404);

  const answers = sheetToObjects('inspection_answers').filter(a => String(a.inspection_id) === String(id));
  // 合併 RC + FC 活頁，ID 已全域唯一
  const qs   = [...sheetToObjects('questions'),   ...sheetToObjects('questions_FC')];
  const cats = [...sheetToObjects('categories'),  ...sheetToObjects('categories_FC')];
  const opts = [...sheetToObjects('options'),     ...sheetToObjects('options_FC')];

  const enriched = answers.map(a => {
    const q = qs.find(r => String(r.id) === String(a.question_id)) || {};
    const c = cats.find(r => String(r.id) === String(q.category_id)) || {};
    const o = opts.find(r => String(r.id) === String(a.opt_id)) || {};
    return { ...a, question_content: q.content || '', category_name: c.name || '', item_no: c.item_no || '', option_label: o.label || '', is_violation: o.is_violation || 0, option_param: o.param_code || '' };
  });

  const logs = sheetToObjects('audit_log').filter(l => String(l.inspection_id) === String(id)).sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)));

  return ok({ ...ins, audit_date: toDateStr(ins.audit_date), audit_time: toTimeStr(ins.audit_time), answers: enriched, logs });
}

// 批次取得多筆點檢記錄的答案
// body: { ids: [1,2,3,...] }
// 回傳: { "1": [{question_content,option_label,...}], "2": [...], ... }
// 只讀一次各工作表，效率遠高於逐筆呼叫 /api/inspections/:id
function handleGetBatchAnswers(body) {
  const { ids } = body;
  if (!ids || !ids.length) return ok({});
  const idSet = new Set(ids.map(String));

  // 一次讀取所有需要的工作表（RC + FC 合併，ID 已全域唯一）
  const allAnswers = sheetToObjects('inspection_answers').filter(a => idSet.has(String(a.inspection_id)));
  const qs   = [...sheetToObjects('questions'),   ...sheetToObjects('questions_FC')];
  const cats = [...sheetToObjects('categories'),  ...sheetToObjects('categories_FC')];
  const opts = [...sheetToObjects('options'),     ...sheetToObjects('options_FC')];

  // 建立快速查詢 Map，避免在迴圈中反覆 find()
  const qMap   = {};  qs.forEach(q   => { qMap[String(q.id)]   = q; });
  const catMap = {}; cats.forEach(c  => { catMap[String(c.id)] = c; });
  const optMap = {}; opts.forEach(o  => { optMap[String(o.id)] = o; });

  // 依 inspection_id 分組
  const result = {};
  ids.forEach(id => { result[String(id)] = []; });

  allAnswers.forEach(a => {
    const key = String(a.inspection_id);
    if (!result[key]) return;
    const q   = qMap[String(a.question_id)]   || {};
    const c   = catMap[String(q.category_id)] || {};
    const o   = optMap[String(a.opt_id)]      || {};
    result[key].push({
      question_id:      a.question_id,
      opt_id:           a.opt_id,
      param_code:       a.param_code   || '',
      is_vio:           a.is_vio,
      skipped:          a.skipped,
      note:             a.note         || '',
      question_content: q.content        || '',
      condition_note:   q.condition_note || '',
      category_name:    c.name           || '',
      item_no:          c.item_no        || '',
      option_label:     o.label          || '',
      is_violation:     o.is_violation   || 0,
      option_param:     o.param_code     || ''
    });
  });

  return ok(result);
}

function handleEditInspection(id, body, user) {
  const { exec_status, exec_other, note, answers } = body;
  updateSheetRow('inspections', id, { exec_status, exec_other: exec_other || '', note: note || '' });
  if (answers && answers.length > 0) {
    deleteRowsByField('inspection_answers', 'inspection_id', id);
    answers.forEach(a => {
      const aid = getNextId('inspection_answers');
      appendObj('inspection_answers',
        ['id', 'inspection_id', 'question_id', 'opt_id', 'param_code', 'is_vio', 'skipped', 'note'],
        { id: aid, inspection_id: id, question_id: a.question_id, opt_id: a.opt_id || '', param_code: a.param || '', is_vio: a.is_vio ? 1 : 0, skipped: a.skipped ? 1 : 0, note: a.note || '' }
      );
    });
  }
  ensureAuditLogStoreName();
  const storeName = getInspectionStoreName(id);
  const lid = getNextId('audit_log');
  appendObj('audit_log', ['id', 'inspection_id', 'action', 'changed_by', 'changed_at', 'note', 'store_name'],
    { id: lid, inspection_id: id, action: 'edit', changed_by: body.changer || user.username, changed_at: now(), note: '修改記錄', store_name: storeName }
  );
  return ok({ success: true });
}

function handleDeleteInspection(id, body, user) {
  ensureAuditLogStoreName();
  const storeName = getInspectionStoreName(id); // 必須在刪除 inspection 前取得店名
  deleteRowsByField('inspection_answers', 'inspection_id', id);
  deleteSheetRow('inspections', id);
  const lid = getNextId('audit_log');
  appendObj('audit_log', ['id', 'inspection_id', 'action', 'changed_by', 'changed_at', 'note', 'store_name'],
    { id: lid, inspection_id: id, action: 'delete', changed_by: body.changer || user.username, changed_at: now(), note: body.note || '', store_name: storeName }
  );
  return ok({ success: true });
}

// ── 使用者 ──
function handleGetUsers() {
  const users = sheetToObjects('users').map(u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role }));
  return ok(users);
}
function handleAddUser(body) {
  const { username, password, full_name, role } = body;
  const id = getNextId('users');
  appendObj('users', ['id', 'username', 'password', 'role', 'full_name', 'created_at'],
    { id, username, password, role: role || 'user', full_name: full_name || '', created_at: now() }
  );
  return ok({ id });
}

// ── audit_log 輔助 ──
function ensureAuditLogStoreName() {
  const s = getSheet('audit_log');
  if (!s) return;
  const lastCol = s.getLastColumn();
  const headers = lastCol > 0 ? s.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (!headers.includes('store_name')) {
    s.getRange(1, lastCol + 1).setValue('store_name');
  }
}
function getInspectionStoreName(id) {
  const s = getSheet('inspections');
  if (!s) return '';
  const data = s.getDataRange().getValues();
  const h = data[0];
  const ci = h.indexOf('id'), cs = h.indexOf('store_name');
  if (ci < 0 || cs < 0) return '';
  const row = data.slice(1).find(r => String(r[ci]) === String(id));
  return row ? String(row[cs]) : '';
}

// ── 人員工號匯入（清空活頁再寫入）──
function handleImportPersonnel(body) {
  const { rows } = body;
  if (!Array.isArray(rows) || rows.length === 0) return fail('rows 必須是非空陣列', 400);
  const s = getSheet('人員工號');
  if (!s) return fail('找不到「人員工號」活頁，請先建立此分頁', 404);
  // 保留第一列標題，刪除其餘資料列
  const lastRow = s.getLastRow();
  if (lastRow > 1) s.deleteRows(2, lastRow - 1);
  // 寫入新資料
  const headers = ['序號', '部別', '課別', '工號', '姓名', '職稱'];
  const values = rows.map(r => headers.map(h => r[h] !== undefined ? r[h] : ''));
  s.getRange(2, 1, values.length, headers.length).setValues(values);
  return ok({ count: rows.length });
}

// ── 題目管理 ──
function handleAddQuestion(body) {
  const { category_id, content } = body;
  const id = getNextId('questions');
  appendObj('questions', ['id', 'category_id', 'content', 'condition_note', 'deduction', 'sort_order'],
    { id, category_id, content, condition_note: '', deduction: 0, sort_order: 99 }
  );
  return ok({ id });
}
function handleEditQuestion(id, body) {
  const updates = { content: body.content };
  if (body.condition_note !== undefined) updates.condition_note = body.condition_note;
  updateSheetRow('questions', id, updates);
  return ok({ success: true });
}
function handleDeleteQuestion(id) {
  deleteRowsByField('options', 'question_id', id);
  deleteSheetRow('questions', id);
  return ok({ success: true });
}
// 依 param_code 批次更新/新增選項（每月換版用）
// updates: [{param_code, label, question_id?, is_violation?, sort_order?}]
// 找到 param_code → 更新 label 及 question_id（修正孤立選項）
// 找不到且有 question_id → 新增選項
function handleUpdateOptionLabels(body) {
  const { updates } = body;
  if (!updates || !updates.length) return ok({ success: true, updated: 0, created: 0 });
  const s = getSheet('options');
  const data = s.getDataRange().getValues();
  const headers = data[0];
  const paramCol  = headers.indexOf('param_code');
  const labelCol  = headers.indexOf('label');
  const qidCol    = headers.indexOf('question_id');
  let updated = 0, created = 0;

  updates.forEach(u => {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][paramCol]) === String(u.param_code)) {
        // 更新 label
        s.getRange(i + 1, labelCol + 1).setValue(u.label);
        // 若 question_id 有提供且與現行不同 → 一併修正（修正孤立選項）
        if (u.question_id && String(data[i][qidCol]) !== String(u.question_id)) {
          s.getRange(i + 1, qidCol + 1).setValue(u.question_id);
        }
        updated++;
        found = true;
        break;
      }
    }
    // 找不到且有 question_id → 新增
    if (!found && u.question_id) {
      const newId = getNextId('options');
      appendObj('options', headers, {
        id:          newId,
        question_id: u.question_id,
        param_code:  u.param_code,
        label:       u.label,
        is_violation: u.is_violation || 0,
        skip_items:  '[]',
        sort_order:  u.sort_order || 99
      });
      created++;
    }
  });
  return ok({ success: true, updated, created });
}

// ── 選項單筆 CRUD ──
function handleAddOption(body) {
  const { question_id, label, is_violation, param_code, skip_items } = body;
  if (!question_id || !label) return fail('question_id and label required');
  const id = getNextId('options');
  // 自動產生 param_code（若未提供）
  const pCode = param_code || ('opt_' + question_id + '_' + id);
  // 取得此題目現有選項數，決定 sort_order
  const existOpts = sheetToObjects('options').filter(o => String(o.question_id) === String(question_id));
  const sortOrder = existOpts.length > 0 ? Math.max(...existOpts.map(o => Number(o.sort_order) || 0)) + 1 : 1;
  appendObj('options', ['id', 'question_id', 'param_code', 'label', 'is_violation', 'skip_items', 'sort_order'], {
    id, question_id, param_code: pCode, label,
    is_violation: is_violation ? 1 : 0,
    skip_items: JSON.stringify(skip_items || []),
    sort_order: sortOrder
  });
  return ok({ id });
}

function handleEditOption(id, body) {
  const updates = {};
  if (body.label !== undefined) updates.label = body.label;
  if (body.is_violation !== undefined) updates.is_violation = body.is_violation ? 1 : 0;
  if (body.param_code !== undefined) updates.param_code = body.param_code;
  if (body.skip_items !== undefined) updates.skip_items = JSON.stringify(body.skip_items);
  updateSheetRow('options', id, updates);
  return ok({ success: true });
}

function handleDeleteOption(id) {
  deleteSheetRow('options', id);
  return ok({ success: true });
}

function handleReorderQuestions(body) {
  const { id1, order1, id2, order2 } = body;
  updateSheetRow('questions', id1, { sort_order: order1 });
  updateSheetRow('questions', id2, { sort_order: order2 });
  return ok({ success: true });
}

// ══════════════════════════════════════════════════════════
// FC 加盟店題目重置（依「全家勞檢FC店日翊查核」PDF 建立）
// 在 GAS 編輯器手動執行此函數，或透過維護API呼叫
// ══════════════════════════════════════════════════════════
function resetFCQuestionsAndOptions() {
  // ── 1. 清除舊 FC 活頁的所有資料（保留標題列）──
  ensureFCSheets();
  ['options_FC', 'questions_FC', 'categories_FC'].forEach(function(sn) {
    const sh = getSheet(sn);
    if (!sh || sh.getLastRow() < 2) return;
    sh.deleteRows(2, sh.getLastRow() - 1);
  });
  SpreadsheetApp.flush();

  // ── 2. 輔助函數 ──
  const CAT_HDR = ['id', 'store_type', 'name', 'item_no', 'sort_order'];
  const Q_HDR   = ['id', 'category_id', 'content', 'condition_note', 'deduction', 'sort_order'];
  const OPT_HDR = ['id', 'question_id', 'param_code', 'label', 'is_violation', 'skip_items', 'sort_order'];

  function addCat(name, itemNo, sortOrder) {
    const id = getNextIdGlobal(['categories', 'categories_FC']);
    appendObj('categories_FC', CAT_HDR, { id, store_type: 'FC', name, item_no: itemNo, sort_order: sortOrder });
    return id;
  }
  function addQ(catId, content, condNote, sortOrder) {
    const id = getNextIdGlobal(['questions', 'questions_FC']);
    appendObj('questions_FC', Q_HDR, { id, category_id: catId, content, condition_note: condNote || '', deduction: 0, sort_order: sortOrder });
    return id;
  }
  function addOpt(qId, label, paramCode, isVio, skipIds, sortOrder) {
    const id = getNextIdGlobal(['options', 'options_FC']);
    appendObj('options_FC', OPT_HDR, {
      id, question_id: qId, param_code: paramCode, label,
      is_violation: isVio ? 1 : 0,
      skip_items: JSON.stringify(skipIds || []),
      sort_order: sortOrder
    });
    return id;
  }

  // ── 3. 建立類別與題目（先取得 ID，後設 skip_items）──

  // ─ 類別 0：資料提供方式 ─
  const cat0 = addCat('資料提供方式', '0', 0);
  const q01  = addQ(cat0, '0-1 單店/複數店',
    '查核資料共4項：勞工名冊或員工資料表、勞保明細、工資清冊或個人薪資單、出勤紀錄或個人工時表。', 1);
  const q02  = addQ(cat0, '0-2 複數店資料提供方式（無複數店無須填寫）', '', 2);
  const q03a = addQ(cat0, '0-3 勞工名冊或員工資料表', '', 3);
  const q03b = addQ(cat0, '0-3 勞保明細', '', 4);
  const q03c = addQ(cat0, '0-3 工資清冊或個人薪資單', '', 5);
  const q03d = addQ(cat0, '0-3 出勤紀錄或個人工時表', '', 6);

  // ─ 類別 1：勞工名冊 ─
  const cat1 = addCat('勞工名冊', '1', 1);
  const q1a  = addQ(cat1, '勞工名冊（紙本/系統公版）',
    '現場須提供紙本核對，名冊項目至少具備9項：姓名、性別、出生日、本籍、學歷、住址、身分證、到職日、勞保投保日', 1);
  const q1b  = addQ(cat1, '勞工名冊（自製版本）', '', 2);

  // ─ 類別 2：勞保明細資料 ─
  const cat2 = addCat('勞保明細資料', '2', 2);
  const q2   = addQ(cat2, '勞工保險開辦及加保狀況',
    '現場須提供最新一期（前一個月）的勞保紙本核對，勞工名卡（冊）人員清單需在明細內', 1);

  // ─ 類別 3：工資清冊 ─
  const cat3 = addCat('工資清冊', '3', 3);
  const q3a  = addQ(cat3, '工資清冊（紙本/系統公版）',
    '現場須提供紙本核對，項目至少具備6項：薪資項目(月薪/時薪)、加班項目(平日加班、休假出勤、休息日加班)、特休未休工資、應扣項目(勞保自付額、健保自付額、缺勤扣款)、薪資總額、實領薪資', 1);
  const q3b  = addQ(cat3, '工資清冊（自製版本）', '', 2);

  // ─ 類別 4：出勤紀錄 ─
  const cat4 = addCat('出勤紀錄', '4', 4);
  const q4a  = addQ(cat4, '出勤紀錄（紙本/系統公版）',
    '現場須提供紙本核對，項目至少具備3項：實際出勤簽到/簽退、加班時數欄位(平日/休息日/休假出勤加班)、員工確認欄位，實際簽到簽退計算到分鐘', 1);
  const q4b  = addQ(cat4, '出勤紀錄（自製版本）', '', 2);

  // ─ 類別 5：加班作業 ─
  const cat5 = addCat('加班作業', '5', 5);
  const q5a  = addQ(cat5, '國定假日（確認原因欄位判斷）',
    '現場須提供紙本核對，核對出勤紀錄每日工時、休假日出勤工時、休息日加班工時比對工資清冊（員工薪資單），比對有無對應欄位及金額。', 1);
  const q5b  = addQ(cat5, '休息日加班（備註或確認原因欄位判斷）', '', 2);
  const q5c  = addQ(cat5, '平日加班（每日出勤>8H）', '', 3);

  // ── 4. 建立選項（含 skip_items）──

  // Q01：0-1 單店/複數店
  addOpt(q01, '無複數店（→填0-3）',   'fc_01_1', false, [q02],  1);
  addOpt(q01, '有複數店（→填0-2）',   'fc_01_2', false, [],     2);

  // Q02：0-2 複數店資料提供方式
  addOpt(q02, '以單店各別提供單店查核資料（→填0-3）',                                                                  'fc_02_1', false, [], 1);
  addOpt(q02, '以商行集中提供全部查核資料，本店集中提供（→填0-3）',                                                    'fc_02_2', false, [], 2);
  addOpt(q02, '以商行集中提供部分資料，其他以各店自行提供（→填0-3）',                                                  'fc_02_3', false, [], 3);
  addOpt(q02, '以商行集中提供全部查核資，他店集中提供本店不提供（查核結束）',
    'fc_02_4', true, [q03a, q03b, q03c, q03d, q1a, q1b, q2, q3a, q3b, q4a, q4b, q5a, q5b, q5c], 4);

  // Q03a：勞工名冊或員工資料表 準備情況
  addOpt(q03a, '本店提供商行全店勞工名冊或員工資料表',           'fc_03a_1', false, [],       1);
  addOpt(q03a, '僅提供勞工名冊或員工資料表',                     'fc_03a_2', false, [],       2);
  addOpt(q03a, '無提供勞工名冊或員工資料（第1項無需點檢）',       'fc_03a_3', false, [q1a, q1b], 3);

  // Q03b：勞保明細 準備情況
  addOpt(q03b, '提供商行全店勞保明細',                           'fc_03b_1', false, [],   1);
  addOpt(q03b, '僅提供勞保明細',                                 'fc_03b_2', false, [],   2);
  addOpt(q03b, '無提供勞保明細（第2項無需點檢）',                 'fc_03b_3', false, [q2], 3);

  // Q03c：工資清冊 準備情況
  addOpt(q03c, '提供商行全店工資清冊或個人薪資單',                'fc_03c_1', false, [],               1);
  addOpt(q03c, '僅提供工資清冊或個人薪資單',                      'fc_03c_2', false, [],               2);
  addOpt(q03c, '無提供工資清冊或個人薪資單（第3、5項無需點檢）',  'fc_03c_3', false, [q3a, q3b, q5a, q5b, q5c], 3);

  // Q03d：出勤紀錄 準備情況
  addOpt(q03d, '提供商行全店出勤紀錄或個人工時表',               'fc_03d_1', false, [],               1);
  addOpt(q03d, '僅提供出勤紀錄或個人工時表',                     'fc_03d_2', false, [],               2);
  addOpt(q03d, '無提出勤紀錄或個人工時表（第4、5項無需點檢）',   'fc_03d_3', false, [q4a, q4b, q5a, q5b, q5c], 3);

  // Q1a：勞工名冊（紙本/系統公版）
  addOpt(q1a, '資料無法判斷 ※現場無法判斷(請拍照記錄)', 'fc_1a_0', false, [], 0);
  addOpt(q1a, '項目填寫完整',                           'fc_1a_1', false, [], 1);
  addOpt(q1a, '項目填寫不完整',                         'fc_1a_2', true,  [], 2);

  // Q1b：勞工名冊（自製版本）
  addOpt(q1b, '資料無法判斷 ※現場無法判斷(請拍照記錄)', 'fc_1b_0', false, [], 0);
  addOpt(q1b, '項目填寫完整',                           'fc_1b_1', false, [], 1);
  addOpt(q1b, '項目或填寫不完整',                       'fc_1b_2', true,  [], 2);

  // Q2：勞工保險開辦及加保狀況
  addOpt(q2, '資料無法判斷 ※現場無法判斷(請拍照記錄)', 'fc_2_0', false, [], 0);
  addOpt(q2, '已開辦勞工保險並全員加保',               'fc_2_1', false, [], 1);
  addOpt(q2, '已開辦勞工保險但未全員加保',             'fc_2_2', true,  [], 2);

  // Q3a：工資清冊（紙本/系統公版）
  addOpt(q3a, '資料無法判斷 ※現場無法判斷(請拍照記錄)',           'fc_3a_0', false, [], 0);
  addOpt(q3a, '項目完整，且員工人數符合',                         'fc_3a_1', false, [], 1);
  addOpt(q3a, '項目完整，但員工人數不符合/人數無法判斷',           'fc_3a_2', true,  [], 2);

  // Q3b：工資清冊（自製版本）
  addOpt(q3b, '資料無法判斷 ※現場無法判斷(請拍照記錄)',           'fc_3b_0', false, [], 0);
  addOpt(q3b, '項目完整，且員工人數符合',                         'fc_3b_1', false, [], 1);
  addOpt(q3b, '項目完整，但員工人數不符合/人數無法判斷',           'fc_3b_2', true,  [], 2);
  addOpt(q3b, '項目不完整，但員工人數符合',                       'fc_3b_3', true,  [], 3);
  addOpt(q3b, '項目不完整，且員工人數不符合/人數無法判斷',         'fc_3b_4', true,  [], 4);

  // Q4a：出勤紀錄（紙本/系統公版）
  addOpt(q4a, '資料無法判斷 ※現場無法判斷(請拍照記錄)',           'fc_4a_0', false, [], 0);
  addOpt(q4a, '項目完整，且員工人數符合',                         'fc_4a_1', false, [], 1);
  addOpt(q4a, '項目完整，但員工人數不符合/人數無法判斷',           'fc_4a_2', true,  [], 2);

  // Q4b：出勤紀錄（自製版本）
  addOpt(q4b, '資料無法判斷 ※現場無法判斷(請拍照記錄)',           'fc_4b_0', false, [], 0);
  addOpt(q4b, '項目完整，且員工人數符合',                         'fc_4b_1', false, [], 1);
  addOpt(q4b, '項目完整，但員工人數不符合/人數無法判斷',           'fc_4b_2', true,  [], 2);
  addOpt(q4b, '項目不完整，但員工人數符合',                       'fc_4b_3', true,  [], 3);
  addOpt(q4b, '項目不完整，且員工人數不符合/人數無法判斷',         'fc_4b_4', true,  [], 4);

  // Q5a：國定假日
  addOpt(q5a, '資料無法判斷 ※現場無法判斷(請拍照記錄)',                               'fc_5a_0', false, [], 0);
  addOpt(q5a, '全數員工給予國定假日休假',                                             'fc_5a_1', false, [], 1);
  addOpt(q5a, '部分員工未給予國定假日休假－應休未休給付薪資且有薪資明細',             'fc_5a_2', true,  [], 2);
  addOpt(q5a, '部分員工未給予國定假日休假－應休未休給付薪資但無薪資明細',             'fc_5a_3', true,  [], 3);
  addOpt(q5a, '部分員工未給予國定假日休假－應休未休未給付薪資',                       'fc_5a_4', true,  [], 4);

  // Q5b：休息日加班
  addOpt(q5b, '資料無法判斷 ※現場無法判斷(請拍照記錄)', 'fc_5b_0', false, [], 0);
  addOpt(q5b, '全數員工無休息日加班情形',               'fc_5b_1', false, [], 1);
  addOpt(q5b, '休息日加班有給付加班費且有薪資明細',     'fc_5b_2', true,  [], 2);
  addOpt(q5b, '休息日加班有給付加班費但無薪資明細',     'fc_5b_3', true,  [], 3);
  addOpt(q5b, '休息日加班無給付加班費',                 'fc_5b_4', true,  [], 4);

  // Q5c：平日加班
  addOpt(q5c, '資料無法判斷 ※現場無法判斷(請拍照記錄)',                                        'fc_5c_0', false, [], 0);
  addOpt(q5c, '全數員工無平日加班情形',                                                        'fc_5c_1', false, [], 1);
  addOpt(q5c, '平日加班有給付加班費且有薪資明細',                                              'fc_5c_2', true,  [], 2);
  addOpt(q5c, '平日加班有給付加班費但無薪資明細',                                              'fc_5c_3', true,  [], 3);
  addOpt(q5c, '平日加班無給付加班費',                                                          'fc_5c_4', true,  [], 4);

  return 'FC 加盟店題目已成功建立，共 6 類別 14 題目。';
}
