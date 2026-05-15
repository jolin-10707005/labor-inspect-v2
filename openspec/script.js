// ============================================================
// 勞檢查核平台 — 核心邏輯模組 script.js
// 功能模組：登入驗證 / 點檢作答 / 跳題邏輯 / 記錄查詢 / 人員管理
// 版本：v2.0  |  日期：2026-05-15
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec';

// ── 全域狀態 ──────────────────────────────────────────────
let token = localStorage.getItem('ci_token') || '';
let currentUser = JSON.parse(localStorage.getItem('ci_user') || 'null');

// ── 工具函數 ──────────────────────────────────────────────

/** HTML 跳脫，防 XSS */
function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s || '')));
  return d.innerHTML;
}

/** 中文數字智慧排序（北一課 < 北二課 < 北三課） */
function _cnSort(a, b) {
  const m = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
  const k = s => s.replace(/[一二三四五六七八九十]/g, c => String(m[c]||c).padStart(2,'0'));
  return k(a).localeCompare(k(b), undefined, { numeric: true });
}

// ── API 通訊層 ────────────────────────────────────────────

/**
 * 呼叫 GAS 後端 API
 * @param {string} path   - API 路徑，例如 '/api/inspections'
 * @param {object} opts   - { method, body }
 * @returns {Promise<any>}
 */
async function api(path, opts = {}) {
  const method = opts.method || 'GET';
  const url = new URL(GAS_URL);
  url.searchParams.set('path', path);
  if (token) url.searchParams.set('token', token);

  const fetchOpts = { method: 'POST', redirect: 'follow' };
  const payload = { _method: method, ...(opts.body || {}) };

  if (token) payload.token = token;
  url.searchParams.set('d', btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  fetchOpts.body = JSON.stringify(payload);

  const res = await fetch(url.toString(), fetchOpts);
  if (res.status === 401) { doLogout(); throw new Error('Session expired'); }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ── 登入模組 ──────────────────────────────────────────────

/** 初始化登入表單（填充部別選項） */
function initLoginForm() {
  const deptSel = document.getElementById('login-dept');
  if (!deptSel) return;
  const depts = [...new Set(PERSONNEL.map(p => p.dept))].sort(_cnSort);
  depts.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    deptSel.appendChild(o);
  });
}

/** 部別異動：更新課別選單 */
function onLoginDeptChange() {
  const dept = document.getElementById('login-dept').value;
  const secSel = document.getElementById('login-section');
  const perSel = document.getElementById('login-person');
  secSel.innerHTML = '<option value="">-- 選擇課別 --</option>';
  perSel.innerHTML = '<option value="">-- 先選課別 --</option>';
  perSel.disabled = true;
  if (!dept) { secSel.disabled = true; return; }
  const secs = [...new Set(PERSONNEL.filter(p => p.dept === dept).map(p => p.section))].sort(_cnSort);
  secs.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    secSel.appendChild(o);
  });
  secSel.disabled = false;
}

/** 課別異動：更新人員選單 */
function onLoginSectionChange() {
  const sec = document.getElementById('login-section').value;
  const perSel = document.getElementById('login-person');
  perSel.innerHTML = '<option value="">-- 選擇人員 --</option>';
  if (!sec) { perSel.disabled = true; return; }
  PERSONNEL.filter(p => p.section === sec).forEach(p => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.name;
    perSel.appendChild(o);
  });
  perSel.disabled = false;
}

/**
 * 執行登入
 * 驗證邏輯：以工號為帳密，對比 GAS 人員工號活頁
 */
async function doLogin() {
  const personId = document.getElementById('login-person').value;
  const empid = document.getElementById('login-empid').value.trim();
  const errEl = document.getElementById('login-err');
  if (!personId) { errEl.textContent = '請先選擇人員'; errEl.style.display = 'block'; return; }
  const person = PERSONNEL.find(p => p.id === personId);
  if (!person) { errEl.textContent = '找不到人員資料'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  try {
    // TODO: IT 工程師請在此串接後端 API 邏輯（GAS /api/login）
    const url = new URL(GAS_URL);
    url.searchParams.set('path', '/api/login');
    const payload = { username: empid, password: empid, _method: 'POST' };
    url.searchParams.set('d', btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    const r = await fetch(url.toString(), { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
    const d = await r.json();
    if (!d.token) { errEl.textContent = '工號驗證失敗'; errEl.style.display = 'block'; return; }
    token = d.token;
  } catch (e) {
    errEl.textContent = '無法連線至伺服器'; errEl.style.display = 'block'; return;
  }

  currentUser = { id: person.id, name: person.name, dept: person.dept, section: person.section };
  localStorage.setItem('ci_token', token);
  localStorage.setItem('ci_user', JSON.stringify(currentUser));
  initApp();
}

/** 登出並清除 session */
function doLogout() {
  token = ''; currentUser = null;
  localStorage.removeItem('ci_token');
  localStorage.removeItem('ci_user');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// ── 跳題邏輯模組 ──────────────────────────────────────────

/**
 * 計算應跳過的題目 ID 集合
 * 支援：(第N、M項無需點檢)、skip_items、(→填X) 語意跳題
 * @returns {Set<number>}
 */
function calcSkippedQIds() {
  const skipped = new Set();
  const skippedItemNos = new Set();

  categories.forEach(cat => cat.questions.forEach(q => {
    if (isDescQ(q)) return;
    const ans = answers[q.id];
    if (!ans?.opt_id) return;
    const opt = q.options.find(o => o.id === ans.opt_id);

    // skip_items 個別跳題
    if (opt?.skip_items?.length) opt.skip_items.forEach(sid => skipped.add(Number(sid)));

    // 「第N、M項無需點檢」多項目跳題
    const m = opt?.label?.match(/第([\d、,，]+)項(?:無需點檢|不需點檢)/);
    if (m) m[1].split(/[、,，]/).forEach(n => {
      const num = Number(n.trim());
      if (!isNaN(num) && num > 0) skippedItemNos.add(num);
    });
  }));

  // 展開項目號 → 題目 ID
  if (skippedItemNos.size > 0) {
    categories.forEach(cat => {
      if (skippedItemNos.has(Number(cat.item_no))) {
        cat.questions.forEach(q => { if (!isDescQ(q)) skipped.add(q.id); });
      }
    });
  }
  return skipped;
}

// ── 人員匯入模組 ──────────────────────────────────────────

/**
 * 匯入人員名單 Excel → 上傳至 GAS 人員工號活頁
 * Excel 格式：序號 / 部別 / 課別 / 工號（8碼）/ 姓名 / 職稱
 */
async function handlePersonnelUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      if (!data.length) { alert('沒有有效資料'); return; }

      const headers = data[0].map(h => String(h || ''));
      const ci = {
        name:    _findCol(headers, ['姓名','name']),
        dept:    _findCol(headers, ['部別','dept']),
        section: _findCol(headers, ['課別','section']),
        title:   _findCol(headers, ['職稱','title']),
        empid:   _findCol(headers, ['工號','employee_id'])
      };
      if (ci.name < 0) { alert(`找不到姓名欄位`); return; }

      const rows = []; let seq = 1;
      data.forEach((row, i) => {
        if (i === 0) return;
        const name = String(row[ci.name] || '').trim();
        if (!name) return;
        const section = ci.section >= 0 ? String(row[ci.section] || '').trim() : '';
        const empid = (ci.empid >= 0 ? String(row[ci.empid] || '').trim() : '').replace(/\.0$/, '').padStart(8, '0');
        let dept = ci.dept >= 0 ? String(row[ci.dept] || '').trim() : '';
        if (!dept) dept = PERSONNEL.find(p => p.section === section)?.dept || '';
        rows.push({ '序號': seq++, '部別': dept, '課別': section, '工號': empid, '姓名': name, '職稱': ci.title >= 0 ? String(row[ci.title] || '') : '' });
      });

      // TODO: IT 工程師請在此串接後端 API 邏輯（GAS /api/personnel/import）
      await api('/api/personnel/import', { method: 'POST', body: { rows } });
      PERSONNEL.length = 0;
      rows.forEach(r => PERSONNEL.push({ dept: r['部別'], section: r['課別'], id: r['工號'], name: r['姓名'], title: r['職稱'] }));
      alert(`✅ 已上傳 ${rows.length} 筆人員資料`);
    } catch (err) { alert('失敗：' + err.message); }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
}
