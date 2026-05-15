# 勞檢查核平台 Labor Inspection System v2.0

> 勞動條件點檢查核管理平台，支援直營店（RC）與加盟店（FC）雙題型點檢、人員工號驗證登入、跳題邏輯、照片記錄與異動稽核。

---

## 核心功能

| 功能 | 說明 |
|------|------|
| 🔐 工號登入 | 部別→課別→人員三層選單，工號為密碼，驗證對比 Google Sheets |
| 📋 RC 點檢 | 直營店標準題組，支援月份切換 |
| 📋 FC 點檢 | 加盟店題組，含跳題邏輯（第N、M項無需點檢）|
| 📷 照片上傳 | 僅「現場無法判斷」選項觸發，強制填寫缺失說明 |
| 🔍 記錄查詢 | 依日期/店別/人員篩選，支援修改與刪除（含原因）|
| 📝 異動稽核 | 每次編輯/刪除自動記錄操作人員、時間、店名 |
| 👥 人員管理 | 單筆新增或 Excel 批次匯入（同步至 Google Sheets）|
| 🏪 店舖管理 | RC/FC 店舖主檔維護 |
| ❓ 題目維護 | 依月份維護 RC/FC 題目與選項 |

---

## 技術架構

```
┌─────────────────────────────────────┐
│  前端：index.html（純 HTML/CSS/JS）   │
│  ・XLSX.js（Excel 解析）             │
│  ・原生 Fetch API                    │
└──────────────┬──────────────────────┘
               │ HTTPS POST（GAS Web App）
┌──────────────▼──────────────────────┐
│  後端：Google Apps Script（Code.gs）  │
│  ・RESTful 路由（doGet/doPost）       │
│  ・Token 身份驗證                    │
│  ・工號驗證（人員工號活頁）           │
└──────────────┬──────────────────────┘
               │ Sheets API
┌──────────────▼──────────────────────┐
│  資料庫：Google Sheets               │
│  ・inspections / inspection_answers  │
│  ・categories / questions / options  │
│  ・stores / personnel / audit_log    │
└─────────────────────────────────────┘
```

---

## 專案結構

```
labor-inspect-v2/
├── public/
│   ├── index.html          # 主前端應用（所有 UI + JS）
│   ├── data-personnel.js   # 人員清單本地快取（131筆）
│   ├── data-stores.js      # 店舖清單本地快取
│   └── data-calendar.js    # 行事曆資料
├── gas/
│   ├── Code.gs             # GAS 主後端（路由 + 業務邏輯）
│   └── Setup.gs            # GAS 初始化設定腳本
├── openspec/               # 技術文件包（IT 交接用）
│   ├── script.js           # 核心邏輯模組說明
│   ├── specs.md            # 系統技術規格書（SDD）
│   ├── data-model.sql      # PostgreSQL 資料庫設計
│   ├── api-interface.md    # API 介面規格
│   └── README.md           # 本文件
├── migrations/             # Sheets 初始化 SQL 參考
└── .github/workflows/      # CI/CD 設定
```

---

## 快速開始

### 前端啟動
直接用瀏覽器開啟：
```
public/index.html
```

### GAS 後端設定
1. 開啟 [Google Apps Script](https://script.google.com)
2. 建立新專案，貼上 `gas/Code.gs` 與 `gas/Setup.gs` 內容
3. 部署為 Web App：**執行身份 = 我**，**存取 = 所有人**
4. 複製部署 URL，更新 `public/index.html` 中的 `GAS_URL` 常數

### Google Sheets 設定
Sheets ID：`1zf5bHOAYGrgHzJATFlhH-PdvFRMJVrqzfXjQqpCeHmM`

需建立以下活頁分頁：

| 活頁名稱 | 用途 |
|----------|------|
| 人員工號 | 序號/部別/課別/工號/姓名/職稱 |
| inspections | 點檢記錄主檔 |
| inspection_answers | 答題記錄 |
| categories | 題目分類 |
| questions | 題目 |
| options | 選項 |
| stores | 店舖主檔 |
| audit_log | 異動稽核記錄 |

---

## API 端點總覽

| Method | Path | 說明 |
|--------|------|------|
| POST | /api/login | 工號登入驗證 |
| GET | /api/checklist | 取得題目清單 |
| GET | /api/stores | 取得店舖清單 |
| POST | /api/inspections | 新增點檢記錄 |
| GET | /api/inspections | 查詢點檢記錄列表 |
| GET | /api/inspections/:id | 取得單筆點檢記錄（含答案與 log）|
| PUT | /api/inspections/:id | 修改點檢記錄 |
| DELETE | /api/inspections/:id | 刪除點檢記錄 |
| POST | /api/personnel/import | 批次匯入人員資料 |
| POST | /api/upload-photo | 上傳照片至 Google Drive |

完整 API 規格詳見 `openspec/api-interface.md`

---

## 重要業務規則

1. **工號格式**：一律 8 碼，不足補前導零（如 `09901009`）
2. **登入密碼**：工號即密碼（username = password = 工號）
3. **FC 照片**：選「現場無法判斷」必填缺失說明 + 上傳照片才可提交
4. **跳題邏輯**：Q4 選「無提供工資清冊（第3、5項無需點檢）」→ 第3、5項全部跳過
5. **人員匯入**：全量覆寫（先清空「人員工號」活頁，再寫入新資料）
6. **異動稽核**：刪除時必須在刪除 inspection 前先讀取 store_name

---

## 開發者注意事項（IT 交接）

- GAS 每次修改後須**重新部署**（新版本），舊 URL 不會自動更新
- `data-personnel.js` 為本地快取，與 Sheets「人員工號」活頁同步時需重新匯出
- Token 有效期 7 天，存於 localStorage `ci_token`
- 照片存放於 Google Drive，Folder ID：`1xRWeAIsBkJKJ4quJ5-xmahPxcxsYMFBY`
- `audit_log` 的 `store_name` 欄位由 GAS 自動新增（首次操作時 `ensureAuditLogStoreName()` 建立欄位）

---

## 維護聯絡

- **系統負責人**：盤點本部
- **GitHub Repo**：https://github.com/jolin-10707005/labor-inspect-v2（Private）
- **Google Sheets**：https://docs.google.com/spreadsheets/d/1zf5bHOAYGrgHzJATFlhH-PdvFRMJVrqzfXjQqpCeHmM
