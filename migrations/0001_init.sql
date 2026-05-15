-- 新版資料庫結構（咖啡點檢平台 v2）
-- inspections 改用 store_code/store_name 直接儲存，不依賴 stores 表

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  full_name TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_no TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📋',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  condition_note TEXT,
  deduction INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  param_code TEXT,
  label TEXT NOT NULL,
  is_violation INTEGER DEFAULT 0,
  skip_items TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_code TEXT NOT NULL,
  store_name TEXT NOT NULL,
  audit_date TEXT NOT NULL,
  audit_time TEXT DEFAULT '',
  inspector_name TEXT NOT NULL,
  section TEXT DEFAULT '',
  exec_status TEXT DEFAULT 'yes',
  exec_other TEXT DEFAULT '',
  has_violation INTEGER DEFAULT 0,
  auditor_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS inspection_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  opt_id INTEGER,
  param_code TEXT,
  is_vio INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  note TEXT,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id)
);

-- ═══ 預設使用者 ═══
INSERT OR IGNORE INTO users (username, password, role, full_name) VALUES
  ('Reyi945', '879123', 'admin', '管理員'),
  ('admin', 'admin123', 'admin', '系統管理員');

-- ═══ 查核大項 ═══
INSERT OR IGNORE INTO categories (id, item_no, name, icon, sort_order) VALUES
  (1, '1', '排班規則', '📅', 1),
  (2, '2', '出勤紀錄', '📝', 2),
  (3, '3', '工時薪資作業', '⏱', 3),
  (4, '4', '大夜規則', '🌙', 4),
  (5, '5', '外籍學生', '🌏', 5);

-- ═══ 題目 ═══

-- 排班規則
INSERT OR IGNORE INTO questions (id, category_id, content, deduction, sort_order) VALUES
  (1, 1, '預排班表並且公告有同仁', 10, 1);

-- 出勤紀錄
INSERT OR IGNORE INTO questions (id, category_id, content, deduction, sort_order) VALUES
  (2, 2, '簽到退落實度', 10, 1),
  (3, 2, '店舖正職國定、例假及休息日每月天數有無符合規範（檢視確認原因的註記原因）', 10, 2),
  (4, 2, '店舖兼職國定、例假及休息日每週天數有無符合規範（檢視確認原因的註記原因）', 10, 3);

-- 工時薪資作業
INSERT OR IGNORE INTO questions (id, category_id, content, condition_note, deduction, sort_order) VALUES
  (5, 3, '實際出勤工時與計薪工時有無符合規範', '請依優先順序選擇最符合情況的選項', 20, 1);

-- 大夜規則
INSERT OR IGNORE INTO questions (id, category_id, content, deduction, sort_order) VALUES
  (6, 4, '未滿18歲兼職值大夜班', 15, 1);

-- 外籍學生
INSERT OR IGNORE INTO questions (id, category_id, content, deduction, sort_order) VALUES
  (7, 5, '外籍學生週工時', 15, 1);

-- ═══ 選項 ═══

-- Q1: 排班規則
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (1, '211', '預排七天（含）班表以上', 0, 1),
  (1, '212', '預排少於七天班（違規）', 1, 2),
  (1, '213', '班表現場無提供', 0, 3);

-- Q2: 簽到退落實度
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (2, '121', '確實簽到退', 0, 1),
  (2, '122', '未確實簽到退（單月未簽到退 ≥5 天，違規）', 1, 2),
  (2, '123', '出勤紀錄現場無提供', 0, 3);

-- Q3: 正職例假休息日
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (3, '131', '正職確認原因註記每月例假及休息日天數符合規範', 0, 1),
  (3, '132', '正職確認原因註記每月例假及休息日天數不符合規範（違規）', 1, 2),
  (3, '133', '出勤紀錄現場無提供', 0, 3);

-- Q4: 兼職例假休息日
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (4, '141', '兼職確認原因註記每週例假及休息日天數符合規範（每週1例1休）', 0, 1),
  (4, '142', '兼職確認原因註記每週例假及休息日天數不符合規範（違規）', 1, 2),
  (4, '143', '出勤紀錄現場無提供', 0, 3);

-- Q5: 工時薪資作業（依優先順序）
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (5, '322', '【第一優先】實際出勤工時與計薪工時不同，確認原因欄位無註記或無簽名（違規）', 1, 1),
  (5, '323', '【第二優先】工時不同，確認原因為「預作薪資」有提供補薪/追款佐證', 0, 2),
  (5, '324', '【第三優先】實際與計薪工時加總不同，確認原因欄位有註記且有簽名', 0, 3),
  (5, '325', '【第四優先】實際與計薪工時加總不同，工時差異小於 0.5H（緩衝時間內）', 0, 4),
  (5, '321', '實際出勤工時與計薪工時一致', 0, 5),
  (5, '326', '出勤紀錄現場無提供', 0, 6),
  (5, '329', '※ 無法判斷（請填寫說明並拍照記錄）', 0, 7);

-- Q6: 大夜規則
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (6, '411', '無未滿18歲兼職員工', 0, 1),
  (6, '412', '未滿18歲兼職員工無值大夜班（每日大夜工時 < 1小時）', 0, 2),
  (6, '413', '未滿18歲兼職員工有值大夜班（每日大夜工時 > 1小時，違規）', 1, 3);

-- Q7: 外籍學生
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (7, '511', '無外籍學生', 0, 1),
  (7, '512', '外籍工讀生週工時未超過20小時', 0, 2),
  (7, '513', '外籍工讀生週工時超過20小時（違規）', 1, 3);
