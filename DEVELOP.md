# 勞檢查核平台 — 開發者技術手冊
> **Labor Inspection System v3**
> 最後更新：2026-06-30 | 架構：GitHub Pages + Google Apps Script + Google Sheets

---

## 目錄
1. [系統架構總覽](#1-系統架構總覽)
2. [專案結構](#2-專案結構)
3. [環境設定（首次建置）](#3-環境設定首次建置)
4. [日常開發流程](#4-日常開發流程)
5. [前端架構說明](#5-前端架構說明)
6. [後端 GAS 架構說明](#6-後端-gas-架構說明)
7. [Google Sheets 資料結構](#7-google-sheets-資料結構)
8. [API 端點總覽](#8-api-端點總覽)
9. [業務規則與邏輯](#9-業務規則與邏輯)
10. [重要函式索引](#10-重要函式索引)
11. [常見問題 FAQ](#11-常見問題-faq)
12. [版本異動記錄](#12-版本異動記錄)

---

## 1. 系統架構總覽

### 主要部署（GitHub Pages + GAS）
```
瀏覽器（使用者）
    │
    ▼
┌─────────────────────────────────────────────┐
│  前端：public/index.html                     │
│  · 純 HTML / CSS / 原生 JS（單一檔案）       │
│  · 外部依賴：SheetJS（xlsx.full.min.js）     │
│  · 靜態資料：data-personnel.js              │
│              data-stores.js                 │
│              data-calendar.js               │
└───────────────────┬─────────────────────────┘
                    │ HTTPS Fetch（GAS Web App URL）
                    │ GET  → path, token, 查詢參數
                    │ POST → path, token, body(JSON), _method
                    ▼
┌─────────────────────────────────────────────┐
│  後端：Google Apps Script（gas/Code.gs）     │
│  · doGet / doPost → route()                 │
│  · Token JWT（HS256-like，自製）             │
│  · 照片：base64 → Google Drive              │
└───────────────────┬─────────────────────────┘
                    │ Sheets API（SpreadsheetApp）
                    ▼
┌─────────────────────────────────────────────┐
│  資料庫：Google Sheets                       │
│  試算表 ID：1zf5bHOAYGrgHzJATFlhH-PdvF...   │
│  工作表：inspections / inspection_answers    │
│          categories / questions / options    │
│          categories_FC / questions_FC        │
│          options_FC / stores / audit_log     │
│          assigned_stores / 人員工號           │
└─────────────────────────────────────────────┘
```

### 備用部署（Cloud Run + Cloudflare Workers + D1）
```
瀏覽器
    │
    ▼
Cloud Run URL: https://labor-inspect-403438157899.asia-east1.run.app/
    │
    ├─ 靜態檔案：public/ 目錄（同一套前端）
    └─ API：src/worker.js（Cloudflare Workers 語法）
                    │
                    ▼
             Cloudflare D1（SQLite）
             · users / stores / assigned_stores
             · categories / questions / options
             · inspections / inspection_answers / audit_log
```

> ⚠ 兩套部署使用**不同資料庫**，資料不互通。
> 前端 token 以 URL 參數 `?token=xxx` 傳送，worker.js 同時接受 URL 參數與 Authorization Header。

### 部署路徑
```
git push origin main
    ├─→ GitHub Actions (.github/workflows/deploy.yml)
    │       └─→ GitHub Pages（public/ 靜態發布）
    │               URL: https://jolin-10707005.github.io/labor-inspect-v2/
    │
    └─→ Cloud Run（需 IT 手動部署，無自動化流程）
            URL: https://labor-inspect-403438157899.asia-east1.run.app/
```

---

## 2. 專案結構

```
labor-inspect-v2/
├── public/
│   ├── index.html              # ★ 主前端（全部 UI + JS，約 197KB）
│   ├── data-personnel.js       # 人員清單快取（window.DATA_PERSONNEL）
│   ├── data-stores.js          # 店舖主檔快取（window.DATA_STORES_MASTER）
│   └── data-calendar.js        # RC 行事曆（window.DATA_CALENDAR_RC）
├── gas/
│   ├── Code.gs                 # ★ GAS 主後端（路由 + 全部業務邏輯）
│   └── Setup.gs                # GAS 初始化腳本（首次建立 Sheets 結構）
├── src/
│   └── worker.js               # Cloudflare Workers 後端（Cloud Run 部署用）
├── openspec/                   # IT 交接技術文件包
├── migrations/                 # Sheets 初始化 SQL 參考
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions CI/CD（僅 Pages）
├── wrangler.toml               # Cloudflare Workers 設定
├── DEVELOP.md                  # ← 本文件（開發者技術手冊）
├── PROJECT_HANDOVER.md         # 專案交接文件
└── README.md                   # 對外說明文件
```

---

## 3. 環境設定（首次建置）

### 3.1 Google Sheets 建立
1. 建立新的 Google 試算表
2. 記錄試算表 ID（URL 中的長字串）
3. 在 `gas/Code.gs` 頂端設定 `SPREADSHEET_ID`

### 3.2 Google Apps Script 部署
```
1. 開啟試算表 → 擴充功能 → Apps Script
2. 將 gas/Code.gs 全部內容貼入
3. 新增檔案 → 貼入 gas/Setup.gs
4. 執行 initializeAll()（首次需授權）
5. 部署 → 新增部署作業
   ・類型：網頁應用程式
   ・執行身份：我
   ・存取權：所有人（含匿名使用者）
6. 複製部署 URL
```

> ⚠ **GAS 版本管理重要事項**：
> - 每次修改 Code.gs 後，必須「管理部署 → 建立新版本 → 部署」才會生效
> - 可從「管理部署」切換回舊版本（如穩定的 v51）
> - 建議在確認新版本穩定前，先記錄目前穩定版本號

### 3.3 前端設定
打開 `public/index.html`，找到第一個 `<script>` 區塊頂端：
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID'; // 照片上傳資料夾
```

### 3.4 GitHub Pages 啟用
```
GitHub Repo → Settings → Pages → Source 選「GitHub Actions」
```

---

## 4. 日常開發流程

### 前端修改
```bash
git add public/index.html
git commit -m "fix: 說明變更"
git push origin main
# 約 1 分鐘後生效於 GitHub Pages
```

### GAS 後端修改
```
1. 編輯 gas/Code.gs（本地）
2. 開啟 GAS 編輯器（script.google.com）→ 全選貼上新版內容
3. 部署 → 管理部署 → 建立新版本 → 部署
   ⚠ 必須建立新版本才生效！URL 不變。
4. git commit gas/Code.gs 並 push
```

### GAS 版本回退
```
管理部署 → 選擇舊版本號 → 部署
（無需改 Code.gs，只是切換已部署的版本）
```

---

## 5. 前端架構說明

### 5.1 關鍵全域變數
```javascript
const GAS_URL = '...';              // GAS Web App URL
let token = localStorage.getItem('ci_token');
let currentUser = null;             // { id, username, role, full_name }
let selectedStore = null;           // { code, name }
let currentStoreType = 'RC';        // 'RC' | 'FC'
let categories = [];                // 當月題目資料
let answers = {};                   // { [question_id]: { opt_id, param, is_vio, skipped, note } }
let photosByQ = {};                 // { [question_id]: [url, ...] }
let execStatus = null;              // 'yes'|'no-docs'|'no-transfer'|'other'
let editingInspectionId = null;     // 編輯模式 ID；null = 新增模式
let _isSubmitting = false;          // 防重複送出鎖
```

### 5.2 頁籤架構（4 個主 Tab）
| Tab | 功能 |
|-----|------|
| `basic` | 基本資料：選店、設定點檢時間、查核狀態 |
| `inspect` | 點檢作業：逐題作答、照片上傳、跳題 |
| `records` | 查詢記錄：歷史查詢、編輯、刪除 |
| `summary` | 彙整專區：Excel 匯出 |

### 5.3 API 通訊（api() 函式）
```javascript
async function api(path, method='GET', body=null) {
  const url = new URL(GAS_URL);
  url.searchParams.set('path', cleanPath);
  url.searchParams.set('token', token);   // token 放 URL 參數

  // 30 秒逾時保護：避免 GAS 無回應時畫面永久卡住
  const _ctrl = new AbortController();
  const _tid = setTimeout(() => _ctrl.abort(), 30000);
  opts.signal = _ctrl.signal;
  try {
    r = await fetch(url.toString(), opts);
  } catch(e) {
    clearTimeout(_tid);
    if(e.name === 'AbortError') throw new Error('請求逾時（30s），請檢查網路或稍後再試');
    throw e;
  }
  clearTimeout(_tid);

  const data = await r.json();
  if (data.code === 401) { doLogout(); throw new Error('連線已過期'); }
  if (data.error && data.code >= 400) throw new Error(data.error);
  return data;
}
```

> **GAS 冷啟動說明**：GAS 伺服器有休眠機制，切換版本或長時間未使用後，
> 第一次請求可能超過 30 秒觸發逾時。等 1 分鐘後再試，或在 GAS 編輯器手動執行任意函數強制熱機。

### 5.4 展開明細（唯讀）
`toggleRecordDetail()` 展開的明細面板為**純查詢**，任何人均可查看但不可修改：
```javascript
// 唯讀顯示：顯示 option_label 文字與照片，無 <select> 與儲存按鈕
const ansLabel = a.skipped ? '（跳過）' : (a.option_label || '—');
```

### 5.5 編輯/刪除權限控制（checkEditPermission）
```javascript
function checkEditPermission(r, action) {
  if (isToday(r.audit_date)) {
    const idOk = String(r.auditor_id) === String(currentUser?.id);
    const nameOk = r.inspector_name && currentUser?.username &&
                   String(r.inspector_name) === String(currentUser.username);
    if (idOk || nameOk) return true;  // 本人直接通過
    // 非本人：輸入密碼
    const pw = prompt(`非上傳者操作，請輸入密碼（上傳者：${r.inspector_name || '未知'}）：`);
    if (pw !== '9588') { alert('密碼錯誤'); return false; }
    return true;
  } else {
    // 跨日：任何人輸入密碼
    const pw = prompt(`跨日${action}需輸入密碼：`);
    if (pw !== '9588') { alert('密碼錯誤'); return false; }
    return true;
  }
}
```

**密碼說明**：`9588` 為固定管理密碼，用於非上傳者操作當日記錄，或任何人操作跨日記錄。

### 5.6 防重複送出鎖（_isSubmitting）
```javascript
let _isSubmitting = false;

async function submitInspection() {
  if (_isSubmitting) { return; }   // 送出中忽略重複點擊
  _isSubmitting = true;
  showLoading(editingInspectionId ? '儲存修改中…' : '送出記錄中…');
  try {
    // ...API 呼叫...
  } catch(e) {
    hideLoading();
    _isSubmitting = false;  // 失敗解鎖允許重試
  }
}
```

---

## 6. 後端 GAS 架構說明

### 6.1 路由機制
```javascript
function route(e, httpMethod) {
  const path = e.parameter.path;
  const body = JSON.parse(e.postData?.contents || '{}');
  const method = body._method || httpMethod;  // PUT/DELETE 以 _method 模擬
  const user = getUser(e);                    // Token 驗證
}
```

### 6.2 關鍵工具函式

| 函式 | 說明 |
|------|------|
| `sheetToObjects(name)` | 讀取工作表，回傳物件陣列 |
| `appendObj(name, headers, obj)` | 新增一列（依 Sheet 第一列實際欄位順序）|
| `getNextIdLocked(sheetName)` | 加鎖取得下一個 ID（防重複）|
| `updateSheetRow(name, id, updates)` | 依 id 更新指定欄位 |
| `makeToken(user)` | 產生 JWT-like Token（7 天有效）|

### 6.3 appendObj 重要說明
```javascript
function appendObj(sheetName, headers, obj) {
  const s = getSheet(sheetName);
  const lastCol = s.getLastColumn();
  // 空 Sheet 防呆：lastCol=0 時 getRange 會報錯
  const sheetHeaders = lastCol > 0
    ? s.getRange(1, 1, 1, lastCol).getValues()[0]
    : headers;  // 備援使用傳入 headers
  const row = sheetHeaders.map(h => (obj[h] !== undefined ? obj[h] : ''));
  s.appendRow(row);
  return obj.id;
}
```

### 6.4 防重複 ID（getNextIdLocked）
```javascript
// 高並發時兩個請求同時讀取 lastRow，會取得相同 ID
// 使用 LockService 串行化 ID 生成，解決重複 ID 問題
function getNextIdLocked(sheetName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return getNextId(sheetName); }
  finally { lock.releaseLock(); }
}
```

### 6.5 GAS 活頁名稱（不可隨意改名）
以下工作表名稱硬寫在 Code.gs 中，改名需同步更新程式碼並重新部署：

| 活頁名稱 | 說明 |
|---------|------|
| `inspections` | 點檢主記錄 |
| `inspection_answers` | 點檢答案 |
| `categories` / `categories_FC` | RC/FC 類別 |
| `questions` / `questions_FC` | RC/FC 題目 |
| `options` / `options_FC` | RC/FC 選項 |
| `stores` | 店鋪清單 |
| `assigned_stores` | 應查名單 |
| `audit_log` | 操作日誌 |
| `users` | 帳號 |
| `人員工號` | 人員清單（已是中文，勿改）|

---

## 7. Google Sheets 資料結構

### inspections（點檢主表）
| 欄位 | 說明 |
|------|------|
| id | 自動遞增主鍵 |
| store_code | 店號（6碼）|
| store_name | 店名 |
| store_type | RC / FC |
| audit_date | 點檢日期（yyyy-MM-dd）|
| audit_time | 點檢時間（HH:mm）|
| inspector_name | 點檢人姓名 |
| section | 課別 |
| exec_status | yes / no-docs / no-transfer / other |
| exec_other | 其他說明 |
| has_violation | 0/1 |
| paper_photo | 紙本點檢表照片 URL |
| main_store_name | FC 主店（「店號 店名」格式）|
| auditor_id | 上傳者工號 |
| created_at | 建立時間（UTC+8）|

### inspection_answers（答題記錄）
| 欄位 | 說明 |
|------|------|
| id | 自動遞增 |
| inspection_id | 關聯 inspections.id |
| question_id | 關聯 questions.id |
| opt_id | 關聯 options.id |
| is_vio | 是否違規 |
| skipped | 是否跳題 |
| note | `文字|||url1|||url2`（複合格式）|

### exec_status 欄位說明
| 值 | 意義 |
|----|------|
| `yes` | 有執行查核作業 |
| `no-docs` | 無相關資料（未備置點檢所需文件）|
| `no-transfer` | 當日轉換、未執行（非上傳失敗）|
| `other` | 其他原因 |

---

## 8. API 端點總覽

| Method | Path | 說明 |
|--------|------|------|
| POST | /api/login | 工號登入 |
| GET | /api/checklist | 取得月份題目 |
| POST | /api/upload-photo | 照片 → Drive URL |
| GET | /api/stores | 店鋪清單 |
| POST | /api/stores | 新增店鋪 |
| POST | /api/stores/batch | 批次新增/更新店鋪 |
| GET | /api/assigned-stores | 取得應查店鋪 |
| POST | /api/assigned-stores | 設定應查店鋪 |
| POST | /api/inspections/check | 防重複建檔 |
| GET | /api/inspections | 查詢列表 |
| POST | /api/inspections | 新增點檢 |
| GET | /api/inspections/:id | 取得單筆（含答案）|
| PUT | /api/inspections/:id | 修改點檢 |
| DELETE | /api/inspections/:id | 刪除點檢 |
| POST | /api/inspections/batch-answers | 批次取得答案（匯出用）|

> PUT/DELETE 透過 POST + `_method` 欄位模擬（GAS 不支援 PUT/DELETE）

---

## 9. 業務規則與邏輯

### 9.1 登入機制
- 帳號 = 密碼 = 工號（比對「人員工號」活頁）
- Token 7 天有效，存於 `localStorage['ci_token']`
- 401 自動登出

### 9.2 照片壓縮規格
```
目標大小：800KB ~ 1200KB
最大尺寸：1920px（長邊等比縮放）
初始品質：0.92（JPEG）
降品質步距：-0.1（超過 1200KB 時逐步降，最低 0.3）
```

### 9.3 note 複合欄位格式
```
"缺失說明文字|||https://photo1.url|||https://photo2.url"
split('|||') → [文字, ...照片URLs]
```

### 9.4 店鋪清單顯示邏輯
```
loadCalendarStores()
  1. 呼叫 /api/assigned-stores?month=X&section=Y
  2. 若有資料 → 顯示應查名單店鋪
  3. 若無資料 → 備援使用 CALENDAR_RC 過濾 section
  4. CALENDAR_RC 以「課」為 section（北一課、北二課...）
     若使用者 section 不在其中（如「業務課」），備援也會是 0 間
  → 解法：從維護 → 匯入應查名單
```

---

## 10. 重要函式索引

### 前端
| 函式 | 用途 |
|------|------|
| `api(path, method, body)` | 統一 API 呼叫（含 30s timeout）|
| `doLogin()` | 工號登入 |
| `initApp()` | 登入後載入基礎資料 |
| `autoDetectStoreType()` | 依當月題目自動判斷 RC/FC |
| `loadCalendarStores()` | 載入應查店鋪清單 |
| `submitInspection()` | 提交/更新點檢（含防重複鎖）|
| `checkEditPermission(r, action)` | 編輯/刪除權限檢查 |
| `toggleRecordDetail(id)` | 展開唯讀明細 |
| `exportWeekly()` | 匯出週彙總表 |
| `fetchAllDetails(execOnly)` | 批次取得答案（匯出前置）|

### 後端（Code.gs）
| 函式 | 用途 |
|------|------|
| `route(e, httpMethod)` | 主路由 |
| `appendObj(sheetName, headers, obj)` | 寫入列（空 sheet 防呆）|
| `getNextIdLocked(sheetName)` | 加鎖取得 ID（防重複）|
| `sheetToObjects(sheetName)` | 讀取工作表 |
| `handleCreateInspection(body, user)` | 新增點檢 |
| `handleGetBatchAnswers(body)` | 批次答案（匯出優化）|

---

## 11. 常見問題 FAQ

### Q: 部別下拉是空的，無法登入
**A**: JavaScript 語法錯誤導致整個 `<script>` 無法解析。
排查：`node --check temp_check.js`，常見原因是 `const r` 重複宣告。

### Q: GAS 修改後沒有生效
**A**: 必須「管理部署 → 建立新版本 → 部署」，僅儲存不會更新 Web App。

### Q: 載入店鋪時一直轉圈（30 秒後出現逾時提示）
**A**: GAS 冷啟動問題，切換版本後第一次請求特別慢。
解法：等 1 分鐘後再試，或進 GAS 編輯器手動執行任意函數強制熱機。

### Q: 部署新版 GAS 後平台閃退（自動回到登入頁）
**A**: 新版 Code.gs 有語法或執行期錯誤，GAS 回傳 HTML 錯誤頁，
前端解析 JSON 失敗或收到 401 → 自動登出。
解法：在 GAS 管理部署切回穩定的舊版本號。

### Q: Cloud Run 版本登入後自動跳出
**A**: `worker.js` 的 `auth()` 原本只讀 Authorization Header，
但前端送 token 是 URL 參數 `?token=xxx`，導致所有需驗證的 API 回傳 401。
已修正（2026-06-30）：`auth()` 現在優先讀 URL 參數，找不到才讀 Header。
需請 IT 重新部署 Cloud Run。

### Q: 應查店鋪清單顯示 0 間
**A**: 有兩個可能：
1. 該月份的應查名單尚未匯入 → 到維護 → 匯入應查名單
2. 使用者的 section（如「業務課」）不在 CALENDAR_RC 的備援清單中
   → 只要匯入應查名單即可解決

### Q: 本人刪除自己當日記錄，卻顯示「只有本人才能刪除」
**A**: `auditor_id` 因舊版 `appendObj` 欄位錯置，存入時間戳記而非工號。
已修正：`checkEditPermission` 加入 `inspector_name` 備援比對，
`auditor_id` 或 `inspector_name` 任一吻合即可通過。

### Q: 匯出週彙總表失敗（a.note.includes is not a function）
**A**: Sheets 的 note 欄位可能被儲存為數字。
已修正：使用 `String(a.note || '')` 強制轉字串。

### Q: 重複記錄（同一家店出現兩筆）
**A**: 網路不穩時重複點擊送出。已修正：`_isSubmitting` 鎖防止重複送出。
若已有重複資料，由管理員（密碼 9588）刪除多餘那筆。

---

## 12. 版本異動記錄

### v3.3（2026-06-30）
- ✅ `api()` 加入 30 秒 AbortController timeout，GAS 無回應時顯示逾時提示而非永久卡住
- ✅ `appendObj()` 加入空 Sheet 防呆（`lastCol=0` 時使用傳入 headers 備援）
- ✅ `worker.js auth()` 修正：同時接受 URL 參數 `?token=` 與 Authorization Header
- ✅ GAS v54 準備：修正 `appendObj` 空 sheet 崩潰，待 IT 部署

### v3.2（2026-06-18）
- ✅ `toggleRecordDetail()` 展開明細改為純唯讀（移除 select 與儲存按鈕）
- ✅ `checkEditPermission()` 開放非上傳者以密碼 9588 操作當日記錄
- ✅ `checkEditPermission()` 加入 `inspector_name` 備援比對
- ✅ `submitInspection()` 加入 `_isSubmitting` 防重複送出鎖
- ✅ 新增 025968 中和員美店至 data-stores.js

### v3.1（2026-06-12）
- ✅ 修正 `submitInspection()` 防重複送出
- ✅ 修正 `appendObj` 依 Sheet 實際欄位順序寫入（防 auditor_id/created_at 對調）
- ✅ `getNextIdLocked()` 以 LockService 防並發重複 ID
- ✅ 修正 `saveRecordAnswers()` 重複宣告 `const r`（SyntaxError）
- ✅ 修正 `toTaipei()` 無效日期值回傳空字串

### v3.0（2026-05）
- ✅ FC 點檢完整支援
- ✅ 完整編輯/刪除流程（含跨日密碼）
- ✅ Excel 週彙總表/請款明細匯出
- ✅ GitHub Pages 自動部署
- ✅ 批次答案 API（匯出效能優化）
