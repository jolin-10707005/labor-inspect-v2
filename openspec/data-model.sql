-- ============================================================
-- 勞檢查核平台 — PostgreSQL 資料庫設計
-- Data Model v2.0 | 2026-05-15
-- 注意：本系統目前以 Google Sheets 為資料庫
--       此腳本為未來遷移至 PostgreSQL 的標準設計
-- ============================================================

-- ── 人員工號 ─────────────────────────────────────────────
-- [EXTERNAL] 來源：人資提供，透過 Excel 匯入功能批次覆寫
CREATE TABLE personnel (
  id          SERIAL PRIMARY KEY,
  seq_no      INTEGER NOT NULL,                        -- 序號
  dept        TEXT NOT NULL,                           -- 部別（如：一部）
  section     TEXT NOT NULL,                           -- 課別（如：北一課）
  emp_id      TEXT NOT NULL UNIQUE,                    -- 工號（8碼，補前導零）
  name        TEXT NOT NULL,                           -- 姓名
  title       TEXT DEFAULT '',                         -- 職稱
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_personnel_emp_id  ON personnel(emp_id);
CREATE INDEX idx_personnel_section ON personnel(section);

-- ── 店舖主檔 ─────────────────────────────────────────────
-- [INTERNAL] 使用者於本系統自行維護
CREATE TABLE stores (
  id           SERIAL PRIMARY KEY,
  store_code   TEXT NOT NULL UNIQUE,                   -- 店號（6碼，補前導零）
  store_name   TEXT NOT NULL,                          -- 店名
  store_type   TEXT NOT NULL DEFAULT 'RC'              -- RC=直營店, FC=加盟店
                CHECK (store_type IN ('RC','FC')),
  region       TEXT DEFAULT '',                        -- 區域
  address      TEXT DEFAULT '',                        -- 地址
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stores_type ON stores(store_type);

-- ── 點檢題目分類 ─────────────────────────────────────────
-- [INTERNAL] 使用者於本系統自行維護
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                           -- 分類名稱
  store_type  TEXT NOT NULL DEFAULT 'RC'
                CHECK (store_type IN ('RC','FC')),
  item_no     INTEGER,                                 -- 項目編號（跳題用）
  month       INTEGER CHECK (month BETWEEN 1 AND 12), -- 適用月份（NULL=全年）
  sort_order  INTEGER DEFAULT 99,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 點檢題目 ─────────────────────────────────────────────
-- [INTERNAL] 使用者於本系統自行維護
CREATE TABLE questions (
  id              SERIAL PRIMARY KEY,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,                       -- 題目內容
  condition_note  TEXT DEFAULT '',                     -- 條件說明
  deduction       NUMERIC(5,1) DEFAULT 0,              -- 扣分
  sort_order      INTEGER DEFAULT 99,
  is_desc         BOOLEAN DEFAULT FALSE,               -- 是否為說明型（非作答）
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questions_category ON questions(category_id);

-- ── 選項 ─────────────────────────────────────────────────
-- [INTERNAL] 使用者於本系統自行維護
CREATE TABLE options (
  id           SERIAL PRIMARY KEY,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,                          -- 選項文字
  param_code   TEXT DEFAULT '',                        -- 參數代碼
  is_violation BOOLEAN DEFAULT FALSE,                  -- 是否為違規選項
  skip_items   JSONB DEFAULT '[]',                     -- 跳題題目ID列表 [COMPUTED]
  sort_order   INTEGER DEFAULT 99,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_options_question ON options(question_id);

-- ── 點檢記錄主檔 ──────────────────────────────────────────
-- [INTERNAL] 使用者於本系統產生
CREATE TABLE inspections (
  id              SERIAL PRIMARY KEY,
  store_code      TEXT NOT NULL,                       -- 店號
  store_name      TEXT NOT NULL,                       -- 店名（冗餘存放，查詢用）
  store_type      TEXT NOT NULL DEFAULT 'RC'
                    CHECK (store_type IN ('RC','FC')),
  audit_date      DATE NOT NULL,                       -- 點檢日期
  audit_time      TIME,                                -- 點檢時間
  inspector_name  TEXT NOT NULL,                       -- 點檢人員姓名
  section         TEXT DEFAULT '',                     -- 點檢人員課別
  exec_status     TEXT DEFAULT '',                     -- 執行狀態
  exec_other      TEXT DEFAULT '',                     -- 其他說明
  has_violation   BOOLEAN DEFAULT FALSE,
  paper_photo     TEXT DEFAULT '',                     -- 書面資料照片 URL
  auditor_id      TEXT DEFAULT '',                     -- 點檢人員工號
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inspections_date       ON inspections(audit_date);
CREATE INDEX idx_inspections_store      ON inspections(store_code);
CREATE INDEX idx_inspections_inspector  ON inspections(inspector_name);
CREATE INDEX idx_inspections_type_date  ON inspections(store_type, audit_date);

-- ── 點檢答題記錄 ──────────────────────────────────────────
-- [INTERNAL] 使用者於本系統產生
CREATE TABLE inspection_answers (
  id             SERIAL PRIMARY KEY,
  inspection_id  INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL REFERENCES questions(id),
  opt_id         INTEGER REFERENCES options(id),
  param_code     TEXT DEFAULT '',
  is_vio         BOOLEAN DEFAULT FALSE,
  skipped        BOOLEAN DEFAULT FALSE,                -- 是否被跳過
  note           TEXT DEFAULT '',                      -- 缺失說明
  photo_urls     JSONB DEFAULT '[]',                   -- 照片 URL 列表
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_answers_inspection ON inspection_answers(inspection_id);
CREATE INDEX idx_answers_question   ON inspection_answers(question_id);

-- ── 異動稽核記錄 ──────────────────────────────────────────
-- [COMPUTED] 公式：每次編輯/刪除點檢記錄時自動寫入
CREATE TABLE audit_log (
  id             SERIAL PRIMARY KEY,
  inspection_id  INTEGER NOT NULL,                     -- 被異動的點檢記錄 ID
  action         TEXT NOT NULL CHECK (action IN ('edit','delete')),
  changed_by     TEXT NOT NULL,                        -- 操作人員工號或姓名
  changed_at     TIMESTAMPTZ DEFAULT NOW(),
  store_name     TEXT DEFAULT '',                      -- [COMPUTED] 異動時自動從 inspections 取得
  note           TEXT DEFAULT ''                       -- 操作備註（刪除原因等）
);
CREATE INDEX idx_audit_log_inspection ON audit_log(inspection_id);

-- ============================================================
-- INSERT 假資料（開發測試用）
-- ============================================================

INSERT INTO personnel (seq_no, dept, section, emp_id, name, title) VALUES
  (1, '一部', '北一課', '09901001', '王小明', '業務助理'),
  (2, '一部', '北一課', '09901002', '李小華', '業務員'),
  (3, '一部', '北二課', '09901003', '陳大文', '課長');

INSERT INTO stores (store_code, store_name, store_type, region) VALUES
  ('000001', '台北東門店', 'RC', '北區'),
  ('000002', '新竹竹北店', 'RC', '中區'),
  ('000003', '台中加盟店A', 'FC', '中區');

INSERT INTO categories (name, store_type, item_no, sort_order) VALUES
  ('基本資料確認', 'RC', 1, 1),
  ('工資清冊查核', 'FC', 3, 3),
  ('出勤紀錄查核', 'FC', 4, 4);

INSERT INTO questions (category_id, content, sort_order) VALUES
  (1, '店舖勞動條件公告是否張貼？', 1),
  (2, '各店資料準備-工資清冊或個人薪資單', 1),
  (3, '各店資料準備-出勤紀錄或個人工時表', 1);

INSERT INTO options (question_id, label, is_violation, skip_items) VALUES
  (1, '已張貼', FALSE, '[]'),
  (1, '未張貼', TRUE, '[]'),
  (1, '現場無法判斷(請拍照記錄)', FALSE, '[]'),
  (2, '提供商行全店工資清冊或個人薪資單', FALSE, '[]'),
  (2, '無提供工資清冊或個人薪資單(第3、5項無需點檢)', FALSE, '[]'),
  (3, '提供商行全店出勤紀錄或個人工時表', FALSE, '[]'),
  (3, '無提出勤紀錄或個人工時表(第4、5項無需點檢)', FALSE, '[]');
