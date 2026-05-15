# API 介面規格
# 勞檢查核平台 — GAS Web App API
# Base URL: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec

---

## 通訊協定說明

所有 API 透過 GET/POST 呼叫 GAS Web App，參數以 QueryString 傳遞：

| 參數 | 說明 |
|------|------|
| `path` | API 路徑，例如 `/api/login` |
| `token` | 登入後取得的 session token（除 login 外必填）|
| `d` | Base64 編碼的 JSON payload（含 `_method` 欄位指定實際 HTTP method）|

---

## POST /api/login — 工號登入驗證

**Request**
```json
{
  "_method": "POST",
  "username": "09901009",
  "password": "09901009"
}
```

**Response 成功**
```json
{
  "token": "eyJpZCI6Ijk5MDEwMDkiLCJ1c2VybmFtZSI6Ijk5MDEwMDkiLCJleHAiOjE3...",
  "user": {
    "id": "09901009",
    "username": "09901009",
    "role": "inspector",
    "full_name": "王小明"
  }
}
```

**Response 失敗**
```json
{ "error": "工號不存在，請聯絡管理員", "status": 401 }
```

---

## GET /api/checklist — 取得點檢題目

**Request**
```
?path=/api/checklist&token=xxx&month=5&store_type=FC
```

**Response**
```json
[
  {
    "id": 10,
    "name": "0-3各店資料準備",
    "store_type": "FC",
    "item_no": 3,
    "sort_order": 3,
    "questions": [
      {
        "id": 42,
        "content": "0-3各店資料準備-工資清冊或個人薪資單",
        "sort_order": 1,
        "options": [
          { "id": 101, "label": "提供商行全店工資清冊或個人薪資單", "is_violation": false, "skip_items": [] },
          { "id": 102, "label": "無提供工資清冊或個人薪資單(第3、5項無需點檢)", "is_violation": false, "skip_items": [] }
        ]
      }
    ]
  }
]
```

---

## POST /api/inspections — 新增點檢記錄

**Request**
```json
{
  "_method": "POST",
  "store_code": "000001",
  "store_name": "台北東門店",
  "store_type": "RC",
  "audit_date": "2026-05-15",
  "audit_time": "14:30",
  "inspector_name": "王小明",
  "section": "北一課",
  "exec_status": "已完成",
  "has_violation": false,
  "answers": [
    {
      "question_id": 42,
      "opt_id": 101,
      "param": "111",
      "is_vio": 0,
      "skipped": 0,
      "note": ""
    }
  ]
}
```

**Response**
```json
{ "id": 25 }
```

---

## GET /api/inspections/:id — 取得單筆點檢記錄

**Response**
```json
{
  "id": 25,
  "store_name": "台北東門店",
  "audit_date": "2026-05-15",
  "audit_time": "14:30",
  "inspector_name": "王小明",
  "answers": [
    {
      "question_id": 42,
      "question_content": "0-3各店資料準備-工資清冊",
      "opt_id": 101,
      "option_label": "提供商行全店工資清冊",
      "is_vio": 0,
      "skipped": 0,
      "note": ""
    }
  ],
  "logs": [
    {
      "id": 3,
      "inspection_id": 25,
      "action": "edit",
      "changed_by": "Reyi945",
      "changed_at": "2026-05-15 21:27:58",
      "store_name": "台北東門店",
      "note": "修改記錄"
    }
  ]
}
```

---

## PUT /api/inspections/:id — 修改點檢記錄

**Request**
```json
{
  "_method": "PUT",
  "changer": "Reyi945",
  "exec_status": "已完成",
  "answers": [
    { "question_id": 42, "opt_id": 102, "param": "", "is_vio": 0, "skipped": 0, "note": "" }
  ]
}
```

**Response**
```json
{ "success": true }
```

---

## DELETE /api/inspections/:id — 刪除點檢記錄

**Request**
```json
{
  "_method": "DELETE",
  "changer": "Reyi945",
  "note": "點錯店"
}
```

**Response**
```json
{ "success": true }
```

---

## POST /api/personnel/import — 批次匯入人員資料

**Request**
```json
{
  "_method": "POST",
  "rows": [
    { "序號": 1, "部別": "一部", "課別": "北一課", "工號": "09901001", "姓名": "王小明", "職稱": "業務助理" },
    { "序號": 2, "部別": "一部", "課別": "北一課", "工號": "09901002", "姓名": "李小華", "職稱": "業務員" }
  ]
}
```

**Response**
```json
{ "count": 2 }
```

---

## POST /api/upload-photo — 上傳照片

**Request**
```json
{
  "_method": "POST",
  "filename": "台北東門店-工資清冊-無法判斷-1.jpg",
  "mimeType": "image/jpeg",
  "data": "BASE64_ENCODED_IMAGE_DATA"
}
```

**Response**
```json
{
  "url": "https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view"
}
```

---

## 錯誤代碼

| HTTP Status | 說明 |
|-------------|------|
| 200 | 成功 |
| 400 | 請求參數錯誤 |
| 401 | 未授權（token 無效或工號錯誤）|
| 404 | 資源不存在 |
| 500 | 伺服器內部錯誤 |
