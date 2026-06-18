# 勞檢查核平台 — 開發者技術手冊
> **Labor Inspection System v3**  
> 最後更新：2026-06-12 | 架構：GitHub Pages + Google Apps Script + Google Sheets

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

### 部署路徑
```
git push origin main
    └─→ GitHub Actions (.github/workflows/deploy.yml)
            └─→ GitHub Pages（public/ 目錄靜態發布）
                    URL: https://jolin-10707005.github.io/labor-inspect-v2/
```

---

## 2. 專案結構

```
labor-inspect-v2/
├── public/
│   ├── index.html              # ★ 主前端（全部 UI + JS，約 215KB）
│   ├── data-personnel.js       # 人員清單快取（window.DATA_PERSONNEL）
│   ├── data-stores.js          # 店舖主檔快取（window.DATA_STORES_MASTER）
│   └── data-calendar.js        # RC 行事曆（window.DATA_CALENDAR_RC）
├── gas/
│   ├── Code.gs                 # ★ GAS 主後端（路由 + 全部業務邏輯）
│   └── Setup.gs                # GAS 初始化腳本（首次建立 Sheets 結構）
├── openspec/                   # IT 交接技術文件包
│   ├── specs.md                # 系統規格書（SDD）
│   ├── api-interface.md        # API 介面規格
│   ├── data-model.sql          # 資料模型（PostgreSQL 參考版）
│   └── script.js               # 核心邏輯說明
├── migrations/                 # Sheets 初始化 SQL 參考
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions CI/CD
├── DEVELOP.md                  # ← 本文件（開發者技術手冊）
├── PROJECT_HANDOVER.md         # 專案交接文件
└── README.md                   # 對外說明文件
```

---

## 3. 環境設定（首次建置）

### 3.1 Google Sheets 建立
1. 建立新的 Google 試算表（或使用現有）
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
   ・存取權：所有人
6. 複製部署 URL
```

### 3.3 前端設定
打開 `public/index.html`，找到第一個 `<script>` 區塊頂端：
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID'; // 照片上傳資料夾
```
填入正確的 GAS URL 與 Drive 資料夾 ID。

### 3.4 GitHub Pages 啟用
```
GitHub Repo → Settings → Pages → Source 選「GitHub Actions」
```
首次 push main 後即自動發布。

---

## 4. 日常開發流程

### 前端修改
```bash
# 直接編輯 public/index.html
# 修改完成後語法檢查：
python -c "
import re; content=open('public/index.html',encoding='utf-8').read()
s=content.find('<script>'); e=content.rfind('</script>')
js=content[s+8:e]; open('temp.js','w',encoding='utf-8').write(js)
"
node --check temp.js  # 0 = 無語法錯誤

# 確認無誤後推送
git add public/index.html
git commit -m "fix: 說明變更"
git push origin main
# 約 1 分鐘後生效於 GitHub Pages
```

### GAS 後端修改
```
1. 編輯 gas/Code.gs
2. 開啟 GAS 編輯器（script.google.com）
3. 貼上新版內容
4. 部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署
   ⚠ 必須建立新版本，修改才會生效！URL 不變。
5. 同步更新本地 gas/Code.gs 並 commit
```

### 靜態資料更新
```bash
# 人員資料更新後：
# 1. 在 GAS 管理人員工號活頁
# 2. 匯出新的 data-personnel.js（window.DATA_PERSONNEL = [...]）
# 3. 替換 public/data-personnel.js
# 4. git push

# 店舖資料更新：替換 public/data-stores.js（window.DATA_STORES_MASTER = {...}）
```

---

## 5. 前端架構說明

### 5.1 關鍵全域變數
```javascript
const GAS_URL = '...';              // GAS Web App URL
const PERSONNEL = window.DATA_PERSONNEL || [];
const STORES_MASTER = window.DATA_STORES_MASTER || {};
const CALENDAR_RC = window.DATA_CALENDAR_RC || [];

// 登入狀態
let token = localStorage.getItem('ci_token');
let currentUser = null;             // { id, username, role, full_name }

// 點檢作業狀態
let selectedStore = null;           // { code, name }
let currentStoreType = 'RC';        // 'RC' | 'FC'
let categories = [];                // 當月題目資料
let answers = {};                   // { [question_id]: { opt_id, param, is_vio, skipped, note } }
let photosByQ = {};                 // { [question_id]: [url, ...] }
let paperPhotoData = null;          // 紙本點檢表照片 URL
let execStatus = null;              // 'yes'|'no-docs'|'no-transfer'|'other'
let mainStoreName = '';             // FC 主店店名（自由文字）
let mainStoreCode = '';             // FC 主店店號
let editingInspectionId = null;     // 編輯模式：記錄 ID；null = 新增模式
```

### 5.2 頁籤架構（4 個主 Tab）
| Tab ID | 功能 | 說明 |
|--------|------|------|
| `basic` | 基本資料 | 選擇店鋪、設定點檢時間、查核作業狀態 |
| `inspect` | 點檢作業 | 逐題作答、照片上傳、跳題邏輯 |
| `records` | 查詢記錄 | 歷史記錄查詢、編輯、刪除 |
| `summary` | 彙整專區 | Excel 匯出（週彙總表、請款明細） |

### 5.3 核心流程
```
登入
  └─ initLoginForm()          部別/課別/人員 下拉選單建立
  └─ doLogin()                工號驗證，取得 token
  └─ initApp()                載入題目、店舖資料

新增點檢
  └─ onStoreSelect()          選擇店鋪，判斷 RC/FC
  └─ initAnswers()            初始化答案物件
  └─ renderAllQuestions()     渲染題目 UI
  └─ computeSkipped()         計算跳題集合
  └─ submitInspection()       POST /api/inspections

編輯點檢（editingInspectionId != null）
  └─ editRecord(id)           載入現有資料
  └─ goToInspectEdit(data)    還原題目狀態，顯示編輯橫幅
  └─ submitInspection()       PUT /api/inspections/:id

匯出 Excel
  └─ exportWeekly()           週彙總表（RC + FC 分頁）
  └─ exportPayClient()        請款明細（客戶版）
  └─ exportPayInternal()      請款明細（內部版）
  └─ fetchAllDetails()        批次取得所有答案
```

### 5.4 跳題邏輯實作
```javascript
function computeSkipped() {
  // 1. 解析選項 label 中的「第N、M項無需點檢」
  // 2. 比對 category.item_no 加入 skippedItemNos
  // 3. 渲染時 opacity:0.45 + pointer-events:none
}
// 觸發時機：每次選項變動時呼叫
```

### 5.5 API 通訊（api() 函式）
```javascript
async function api(path, method='GET', body=null) {
  const url = new URL(GAS_URL);
  url.searchParams.set('path', cleanPath);
  url.searchParams.set('token', token);
  // GET: 查詢參數附加到 URL
  // POST/PUT/DELETE: body = JSON.stringify({ ...payload, _method: method })
  //   payload < 1500 字元時同時寫入 URL param d（base64）作為備援
  const r = await fetch(url.toString(), opts);
  const data = await r.json();
  if (data.code === 401) { doLogout(); throw new Error('連線已過期'); }
  if (data.error && data.code >= 400) throw new Error(data.error);
  return data;
}
```

### 5.6 編輯/刪除權限控制
```javascript
function checkEditPermission(r, action) {
  if (isToday(r.audit_date)) {
    // 當日：auditor_id 比對，備援用 inspector_name 比對
    // （auditor_id 若因 appendObj bug 存成時間戳，fallback 至姓名）
    const idOk = String(r.auditor_id) === String(currentUser?.id);
    const nameOk = r.inspector_name && currentUser?.username &&
                   String(r.inspector_name) === String(currentUser.username);
    if (!idOk && !nameOk) {
      alert(`當日點檢紀錄只能由上傳者本人（${r.inspector_name}）${action}`);
      return false;
    }
    return true;
  } else {
    // 跨日：任何人輸入密碼 9588
    const pw = prompt(`跨日${action}需輸入密碼：`);
    return pw === '9588';
  }
}
```

### 5.7 防重複送出鎖（_isSubmitting）
網路不穩時，使用者可能在 GAS 回應前再次點「送出」，造成重複寫入。
```javascript
let _isSubmitting = false; // 全域鎖

async function submitInspection() {
  if (_isSubmitting) { return; }  // 送出中直接忽略重複點擊
  // ...驗證邏輯...
  _isSubmitting = true;
  showLoading('送出記錄中…');
  try {
    // ...API 呼叫...
  } catch(e) {
    _isSubmitting = false; // 失敗時解鎖，允許重試
    // ...錯誤提示...
  }
  // 成功後 clearInspectForm() 會透過流程結束，鎖不需手動解（頁面重置）
}
```

---

## 6. 後端 GAS 架構說明

### 6.1 路由機制
```javascript
function route(e, httpMethod) {
  const path = e.parameter.path;
  const body = JSON.parse(e.postData?.contents || '{}');
  const method = body._method || httpMethod;  // PUT/DELETE 透過 _method 模擬
  const user = getUser(e);                    // Token 驗證
  // switch/if-else 依 path + method 路由到各 handler
}
```

### 6.2 關鍵工具函式

| 函式 | 說明 |
|------|------|
| `sheetToObjects(name)` | 讀取工作表，回傳 `[{col: value, ...}]` |
| `appendObj(name, headers, obj)` | 新增一列（⚠ 依 Sheet 第一列實際欄位順序寫入）|
| `updateSheetRow(name, id, updates)` | 依 id 更新指定欄位 |
| `deleteSheetRow(name, id)` | 刪除指定 id 的列 |
| `getNextId(sheetName)` | 取得下一個自動遞增 ID |
| `pad6(v)` | 店號補前導零至 6 碼 |
| `toDateStr(v)` | Sheets Date 物件 → yyyy-MM-dd 字串 |
| `toTimeStr(v)` | Sheets Time 物件 → HH:mm 字串 |
| `makeToken(user)` | 產生 JWT-like Token（7 天有效）|
| `now()` | 回傳台北時間字串（UTC+8）|

### 6.3 appendObj 重要說明
```javascript
// ⚠ 以 Sheet 第一列實際欄位名稱決定寫入位置
// 避免程式碼 headers 陣列順序與試算表欄位順序不一致
function appendObj(sheetName, headers, obj) {
  const s = getSheet(sheetName);
  const sheetHeaders = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  const row = sheetHeaders.map(h => (obj[h] !== undefined ? obj[h] : ''));
  s.appendRow(row);
}
```

### 6.4 批次答案查詢（效能優化）
```
POST /api/inspections/batch-answers
  → handleGetBatchAnswers()
  → 一次讀取 inspection_answers / questions / options 全表
  → 以 inspection_id 分組回傳
  → 避免 N 次逐筆 API 呼叫（匯出 10 筆 → 從 N+10 次降為 1 次）
```

---

## 7. Google Sheets 資料結構

### 7.1 inspections（點檢記錄主表）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | 整數 | 自動遞增主鍵 |
| store_code | 文字 | 店號（6碼，含前導零） |
| store_name | 文字 | 店名 |
| store_type | 文字 | RC 或 FC |
| audit_date | 日期 | 點檢日期（yyyy-MM-dd）|
| audit_time | 時間 | 點檢時間（HH:mm）|
| inspector_name | 文字 | 點檢人員姓名 |
| section | 文字 | 課別 |
| exec_status | 文字 | yes / no-docs / no-transfer / other |
| exec_other | 文字 | 「其他」時的說明 |
| has_violation | 0/1 | 是否有違規項目 |
| paper_photo | 文字 | 紙本點檢表照片 URL |
| main_store_name | 文字 | FC 提供資料的主店（「店號 店名」格式）|
| auditor_id | 文字 | 上傳者工號（用於編輯權限比對）|
| created_at | 文字 | 建立時間（UTC+8，yyyy-MM-dd HH:mm:ss）|

### 7.2 inspection_answers（答題記錄）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | 整數 | 自動遞增 |
| inspection_id | 整數 | 關聯 inspections.id |
| question_id | 整數 | 關聯 questions.id |
| opt_id | 整數 | 關聯 options.id |
| param_code | 文字 | 選項附帶參數 |
| is_vio | 0/1 | 是否違規 |
| skipped | 0/1 | 是否跳題 |
| note | 文字 | 說明＋照片（格式：`文字|||url1|||url2`）|

### 7.3 categories / questions / options（RC 題目）
### categories_FC / questions_FC / options_FC（FC 題目）

| 工作表 | 關鍵欄位 |
|--------|---------|
| categories | id / name / store_type / item_no / sort_order |
| questions | id / category_id / content / condition_note / sort_order |
| options | id / question_id / label / is_violation / param_code / skip_items |

### 7.4 audit_log（異動稽核）
| 欄位 | 說明 |
|------|------|
| id | 自動遞增 |
| inspection_id | 關聯 inspections.id |
| action | edit / delete |
| changed_by | 操作人員（username）|
| changed_at | 操作時間 |
| store_name | 店名（刪除前先快取）|
| note | 操作備註 |

---

## 8. API 端點總覽

| Method | Path | Handler | 說明 |
|--------|------|---------|------|
| POST | /api/login | handleLogin | 工號登入 |
| GET | /api/checklist | handleChecklist | 取得月份題目（?store_type=RC\|FC&month=6）|
| POST | /api/upload-photo | handleUploadPhoto | 照片 base64 → Drive URL |
| GET | /api/stores | handleGetStores | 店舖清單 |
| POST | /api/stores | handleAddStore | 新增店舖 |
| POST | /api/stores/batch | handleBatchStores | 批次新增/更新店舖 |
| GET | /api/assigned-stores | handleGetAssigned | 取得應查店舖 |
| POST | /api/assigned-stores | handleSetAssigned | 設定應查店舖 |
| POST | /api/inspections/check | handleCheckDuplicate | 防重複建檔檢查 |
| GET | /api/inspections | handleGetInspections | 查詢列表（?start_date&end_date&section）|
| POST | /api/inspections | handleCreateInspection | 新增點檢記錄 |
| GET | /api/inspections/:id | handleGetInspection | 取得單筆（含答案與 log）|
| PUT | /api/inspections/:id | handleEditInspection | 修改點檢記錄 |
| DELETE | /api/inspections/:id | handleDeleteInspection | 刪除點檢記錄 |
| POST | /api/inspections/batch-answers | handleGetBatchAnswers | 批次取得答案（匯出用）|
| GET | /api/users | handleGetUsers | 取得帳號列表 |
| POST | /api/users | handleAddUser | 新增帳號 |
| POST | /api/personnel/import | handleImportPersonnel | 批次匯入人員 |
| POST | /api/questions | handleAddQuestion | 新增題目 |
| PUT | /api/questions/:id | handleEditQuestion | 編輯題目 |
| DELETE | /api/questions/:id | handleDeleteQuestion | 刪除題目 |
| POST | /api/options | handleAddOption | 新增選項 |
| PUT | /api/options/:id | handleEditOption | 編輯選項 |
| DELETE | /api/options/:id | handleDeleteOption | 刪除選項 |

> **PUT / DELETE 模擬**：GAS 只支援 GET/POST。PUT/DELETE 以 POST 傳遞 `_method` 欄位實現。

---

## 9. 業務規則與邏輯

### 9.1 登入機制
- username = password = **工號（8碼，不足補前導零）**
- GAS 比對「人員工號」活頁，`normId(工號)` 去除前導零後比對
- 成功後回傳 token（7天有效），存於 `localStorage['ci_token']`
- 401 自動登出並清除 token

### 9.2 店型判定
```javascript
// 自動依店名判定 RC / FC
function detectStoreType(name) {
  if (/加盟|FC/.test(name)) return 'FC';
  return 'RC';  // 預設直營
}
```

### 9.3 月份題目
- 以**點檢日期**（非當日）判定月份，確保歷史記錄對應正確題組
- `getInspectMonth(dateStr)` → 若超過 25 日，視為下個月的點檢

### 9.4 FC 跳題邏輯
```
Q4 選項 label 含「第N、M項無需點檢」
  → 解析 N, M（數字）
  → 找出 category.item_no = N 或 M 的所有 question
  → 這些 question 全部加入 skippedQids
  → 渲染時灰化顯示，答案設為 skipped=1
```

### 9.5 FC 照片強制規則
- 選項 label 含「現場無法判斷」→ 必須上傳照片才可提交
- 提交前逐一檢查，缺少照片的題目標紅框並阻擋

### 9.6 note 欄位格式（複合欄位）
```
inspection_answers.note = "缺失說明文字|||https://photo1.url|||https://photo2.url"
                          ↑ 文字部分          ↑ 照片 URL（以 ||| 分隔）
```
前端讀取時：`note.split('|||')` → `[textNote, ...photoUrls]`

### 9.7 main_store_name 格式（FC 主店）
```
main_store_name = "012345 台北東門店"  （店號 + 空格 + 店名）
前端讀取：split(' ') → [code, ...nameParts]
```

### 9.8 Excel 匯出欄位對照

**RC 週彙總表（RC_HEADERS，19 欄）**
A: 上傳時間 / B: 店號 / C: 店名 / D: 點檢日期 / E: 點檢人員 / F: 課別 /
G: 查核作業是否執行 / H-N: 各題答案 / O: 無法判斷說明 / P: 紀錄照片（URL）/
Q: 未滿18歲 / R: 外籍週工時 / S: 完成照片

**FC 週彙總表（FC_HEADERS，36 欄）**
A-F: 基本資料 / G: 查核作業 / H-J: 0-1~0-3 / K-N: 各項資料準備 /
O-AJ: 各點檢項目（主答案 + 無法判斷原因 + 照片）

---

## 10. 重要函式索引

### 前端（index.html）
| 函式 | 用途 |
|------|------|
| `initLoginForm()` | 登入頁部別/課別/人員下拉初始化 |
| `doLogin()` | 執行工號登入驗證 |
| `initApp()` | 登入後載入基礎資料 |
| `onStoreSelect(code, name)` | 選擇店鋪，觸發題目載入 |
| `renderAllQuestions()` | 渲染點檢題目 UI |
| `computeSkipped()` | 計算跳題集合 |
| `selectOpt(qid, optId)` | 選擇答案，觸發跳題/照片判斷 |
| `submitInspection()` | 提交或更新點檢記錄 |
| `editRecord(id)` | 載入既有記錄進入編輯模式 |
| `goToInspectEdit(data)` | 還原點檢狀態至 inspect tab |
| `cancelEdit()` | 取消編輯模式 |
| `checkEditPermission(r, action)` | 當日本人/跨日密碼 權限檢查 |
| `delRecord(id)` | 刪除點檢記錄（含權限檢查）|
| `fetchAllDetails(execOnly)` | 批次取得所有答案（匯出用）|
| `exportWeekly()` | 匯出週彙總表 Excel |
| `exportPayClient()` | 匯出請款明細（客戶）|
| `exportPayInternal()` | 匯出請款明細（內部）|
| `buildWeeklyRow(r, ansMap, ...)` | 建立 RC 週彙總列 |
| `buildFCRow(r, fcAns)` | 建立 FC 週彙總列 |
| `searchMainStore(val)` | FC 主店搜尋（需從 STORES_MASTER 選取）|
| `toTaipei(utcStr)` | UTC 字串 → 台北時間顯示（無效日期回傳空字串）|
| `api(path, method, body)` | 統一 GAS API 呼叫 |

### 後端（Code.gs）
| 函式 | 用途 |
|------|------|
| `route(e, httpMethod)` | 主路由函式 |
| `handleLogin(body)` | 工號登入驗證 |
| `handleGetInspections(params)` | 查詢點檢列表 |
| `handleCreateInspection(body, user)` | 新增點檢記錄 |
| `handleEditInspection(id, body, user)` | 修改點檢記錄 |
| `handleDeleteInspection(id, body, user)` | 刪除點檢記錄 |
| `handleGetBatchAnswers(body)` | 批次取得答案（效能優化）|
| `appendObj(sheetName, headers, obj)` | 寫入列（依 Sheet 實際欄位順序）|
| `sheetToObjects(sheetName)` | 讀取工作表為物件陣列 |
| `ensureAnswersNoteColumn()` | 確保 note 欄位存在 |

---

## 11. 常見問題 FAQ

### Q: 部別下拉是空的，無法登入
**A**: 通常是 JavaScript 語法錯誤導致 `<script>` 整塊無法解析，
`initLoginForm()` 未執行。排查步驟：
1. 用 Node.js 語法檢查：`node --check temp_check.js`
2. 確認 `const PERSONNEL = window.DATA_PERSONNEL || []` 非空
3. 確認無 `const r` 重複宣告（`SyntaxError: Identifier already been declared`）

### Q: GAS 修改後沒有生效
**A**: 必須在 GAS 編輯器「部署 → 管理部署作業 → 新版本 → 部署」，
僅儲存不會更新 Web App。

### Q: 匯出週彙總表失敗（匯出失敗：a.note.includes is not a function）
**A**: Google Sheets 某些 note 欄位被儲存為數字格式。
前端 `fetchAllDetails()` 已使用 `String(a.note||'')` 強制轉型，
確認已使用最新版 `index.html`。

### Q: 上傳時間顯示員工 ID（如 10305002）
**A**: 舊資料的 `created_at` 欄位與 `auditor_id` 欄位對調（歷史資料問題）。
`toTaipei()` 已修正為遇到無效日期值時回傳空字串。
永久修法：在 Google Sheet 手動對調那幾筆的欄位值。
新資料不會再發生（`appendObj` 已改為依 Sheet 實際欄位順序寫入）。

### Q: appendObj 寫入欄位順序錯誤
**A**: 程式碼的 `headers` 陣列順序若與試算表實際欄位順序不符，資料會寫到錯欄。
已修正 `appendObj` 改用 `s.getRange(1,1,1,lastCol).getValues()[0]`
讀取 Sheet 第一列實際欄位名稱決定寫入位置。

### Q: 網路不穩時同一家店出現兩筆重複記錄
**A**: 送出時網路延遲，使用者再次點「送出」，兩個請求都在 GAS 寫入前通過重複檢查，
導致兩筆資料落入 Sheets。
已修正：`submitInspection()` 加入 `_isSubmitting` 鎖，送出期間忽略所有重複點擊。
若已發生重複資料，由管理員輸入密碼（`9588`）刪除多餘那筆。

### Q: 本人刪除自己當日記錄，卻顯示「只有本人才能刪除」
**A**: `checkEditPermission()` 比對 `auditor_id` 時，若該欄位因 `appendObj` 欄位錯置
而存入時間戳記（非員工 ID），比對必然失敗。
已修正：加入 `inspector_name` 備援比對，`auditor_id` 或 `inspector_name` 任一吻合即可通過。
根本修法：在 GAS 編輯器重新部署 `appendObj` 修正版，確保新資料寫入正確欄位。

### Q: 如何新增應查店舖
**A**: 維護專區 → 應查店舖分頁 → 設定應查店舖，
或直接在 `assigned_stores` 工作表維護。

### Q: 照片無法上傳
**A**: 確認 `FOLDER_ID` 設定正確，且 GAS 執行帳號有該資料夾寫入權限。
照片以 base64 傳給 GAS，GAS 寫入 Drive 後回傳 URL 儲存於 note 欄位。

---

## 12. 版本異動記錄

### v3.x（2026-06）
- ✅ 修正 `submitInspection()` 加入 `_isSubmitting` 防重複送出鎖，解決網路不穩造成重複建檔
- ✅ 修正 `checkEditPermission()` 加入 `inspector_name` 備援比對，修正本人無法刪除自身紀錄的矛盾
- ✅ 修正 `appendObj` 依 Sheet 實際欄位順序寫入（防止欄位錯置）
- ✅ 修正 `toTaipei()` 對無效日期值（如員工 ID）回傳空字串
- ✅ 修正 `a.note.includes is not a function`（note 可能為數字，強制轉字串）
- ✅ `exportWeekly()` 加入 showLoading 與 try/catch 錯誤提示
- ✅ 修正 `saveRecordAnswers()` 重複宣告 `const r`（SyntaxError）
- ✅ 修正 `editRecord()` 使用未定義的 `pad6()`，改為 `padStart(6,'0')`
- ✅ 新增 no-cache meta tag，防止瀏覽器快取舊版前端

### v3.0（2026-05）
- ✅ FC 主店店名改為從 STORES_MASTER 選取（必須為真實店舖）
- ✅ 新增完整編輯流程（editRecord → goToInspectEdit → PUT submitInspection）
- ✅ 新增編輯/刪除權限控制（當日本人 / 跨日密碼 9588）
- ✅ FC 匯出新增「提供資料的主店店名」欄（J 欄，index 9）
- ✅ FC 照片欄索引更新（因 J 欄插入後位移 +1）
- ✅ 修正 FC 匯出「加班作業」分類關鍵字（RC `外籍` → FC `加班`）

### v2.0（2026-05初）
- ✅ 初始版本：RC/FC 雙題型點檢
- ✅ 批次答案 API（batch-answers）
- ✅ 週彙總表/請款明細匯出
- ✅ 異動稽核（audit_log）
- ✅ GitHub Pages 自動部署
