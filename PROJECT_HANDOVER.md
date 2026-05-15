# 勞檢查核平台 v3 — 專案交接文件
> 架構已從 Cloudflare Workers + D1 遷移至 Google Apps Script + Sheets + GitHub Pages

---

## 目前部署資訊
| 項目 | 網址 |
|------|------|
| 前端（GitHub Pages） | 推送至 main 後自動部署，URL 見 GitHub → Settings → Pages |
| 後端（GAS Web App） | 部署後貼於 `public/index.html` 第一行 `GAS_URL` |
| 帳號 | Reyi945 / 879123（管理員） |
| 維護密碼 | 9588 |

---

## 技術架構
| 項目 | 現況 |
|------|------|
| 前端 | 單頁 HTML（public/index.html） |
| 後端 | Google Apps Script Web App（gas/Code.gs） |
| 資料庫 | Google Sheets（試算表 ID：1zf5bHOAYGrgHzJATFlhH-PdvFRMJVrqzfXjQqpCeHmM） |
| 照片儲存 | Google Drive（資料夾 ID：1xRWeAIsBkJKJ4quJ5-xmahPxcxsYMFBY） |
| 部署 | GitHub Actions → GitHub Pages（push main 自動觸發） |

---

## 首次部署步驟（全新環境）

### Step 1：建立 Google Apps Script 專案
1. 開啟 [Google Sheets 試算表](https://docs.google.com/spreadsheets/d/1zf5bHOAYGrgHzJATFlhH-PdvFRMJVrqzfXjQqpCeHmM/edit)
2. 上方選單 → 「擴充功能」→「Apps Script」
3. 將 `gas/Code.gs` 內容貼入（取代預設的 `function myFunction(){}`）
4. 新增檔案 → 貼入 `gas/Setup.gs` 內容
5. 執行 `initializeAll()`（第一次執行需授權）→ 所有 Sheets 工作表自動建立

### Step 2：部署 GAS Web App
1. 右上角「部署」→「新增部署作業」
2. 類型選「網頁應用程式」
3. 設定：
   - 執行身分：**我**
   - 存取權：**所有人**
4. 複製產生的 URL（格式：`https://script.google.com/macros/s/XXXXX/exec`）

### Step 3：填入 GAS URL
開啟 `public/index.html`，第一行找到：
```javascript
const GAS_URL='YOUR_GAS_URL_HERE';
```
替換為剛才複製的 URL。

### Step 4：推送至 GitHub
```bash
git init
git add .
git commit -m "init: labor inspect v3"
git remote add origin https://github.com/YOUR_USERNAME/labor-inspect.git
git push -u origin main
```

### Step 5：啟用 GitHub Pages
GitHub → Settings → Pages → Source 選「GitHub Actions」

---

## 日常部署（程式更新）
```bash
git add .
git commit -m "update: 說明變更內容"
git push origin main
# GitHub Actions 自動部署，約 1 分鐘完成
```

---

## GAS 重新部署注意事項
> 每次修改 GAS 程式碼後，必須重新部署才會生效

1. GAS 編輯器 → 「部署」→「管理部署作業」
2. 選現有版本 → 編輯 → 版本選「新版本」→ 部署
3. URL 不變（同一個部署 ID）

---

## Google Sheets 工作表結構
| 工作表名稱 | 說明 |
|-----------|------|
| `users` | 帳號密碼 |
| `stores` | 店鋪主檔 |
| `categories` | 查核大項（RC/FC） |
| `questions` | 查核題目 |
| `options` | 選項 |
| `inspections` | 查核記錄主表 |
| `inspection_answers` | 查核答案明細 |
| `audit_log` | 修改/刪除記錄 |
| `assigned_stores` | 每月應查店舖 |

---

## 前端資料（嵌入 JS 檔）
| 檔案 | 說明 | 筆數 |
|------|------|------|
| public/data-personnel.js | 人員名單 | 194人 |
| public/data-calendar.js | RC店行事曆 | 436筆 |
| public/data-stores.js | 店鋪主檔 | 4553筆 |

---

## API 端點對照
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/login | 登入 |
| GET | /api/checklist | 題目清單（?store_type=RC\|FC） |
| POST | /api/upload-photo | 照片上傳至 Drive（base64） |
| GET/POST/PUT | /api/stores | 店鋪管理 |
| GET/POST | /api/assigned-stores | 應查店舖 |
| POST | /api/inspections/check | 防重複查詢 |
| GET/POST | /api/inspections | 查核記錄 |
| GET/PUT/DELETE | /api/inspections/:id | 單筆操作 |
| GET/POST | /api/users | 帳號管理 |
| POST/PUT/DELETE | /api/questions | 題目管理 |

> GAS 限制：PUT/DELETE 均以 POST 加 `_method` 欄位傳送

---

## 已知注意事項
- GAS 每次執行上限 6 分鐘（日常操作遠低於此限制）
- 照片上傳為 base64 → Drive，大圖自動壓縮至 800px
- GAS 修改後須重新部署（新版本），URL 不變
- `data-personnel.js`、`data-stores.js` 若需更新，直接替換檔案後 push

---

## 待辦事項（未來優化）
1. 點檢題目 Excel 匯入「後蓋前」邏輯（目前新增不刪舊題）
2. 查詢記錄「修改」功能（Tab 3 詳情頁加入編輯按鈕）
3. 效能優化：Sheets 資料量大時考慮快取機制
