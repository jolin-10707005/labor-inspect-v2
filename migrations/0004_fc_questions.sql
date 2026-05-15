-- Add store_type to categories
ALTER TABLE categories ADD COLUMN store_type TEXT DEFAULT 'RC';
-- Update existing RC categories
UPDATE categories SET store_type='RC' WHERE id IN (1,2,3,4,5,6);
-- ═══ v4：加盟店題目 + store_type + 審計記錄 ═══

-- 1. inspections 新增 store_type
ALTER TABLE inspections ADD COLUMN store_type TEXT DEFAULT 'RC';

-- 2. 新增審計記錄表
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL,
  action TEXT NOT NULL,         -- 'edit' | 'delete'
  changed_by TEXT NOT NULL,
  changed_at TEXT DEFAULT (datetime('now','localtime')),
  note TEXT,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id)
);

-- 3. assigned_stores 月份化
CREATE TABLE IF NOT EXISTS assigned_stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL,        -- 1-12
  store_code TEXT NOT NULL,
  store_name TEXT NOT NULL,
  section TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(month, store_code)
);

-- 4. FC 加盟店大項
INSERT OR IGNORE INTO categories (id, item_no, name, icon, sort_order, store_type) VALUES
  (10, '0', '資料準備', '📂', 0, 'FC'),
  (11, '1', '勞工名冊', '📋', 1, 'FC'),
  (12, '2', '勞保明細資料', '🏥', 2, 'FC'),
  (13, '3', '工資清冊', '💰', 3, 'FC'),
  (14, '4', '出勤紀錄', '⏰', 4, 'FC'),
  (15, '5', '加班作業', '⏱', 5, 'FC');

-- 5. FC 題目
INSERT OR IGNORE INTO questions (id, category_id, content, condition_note, deduction, sort_order) VALUES
  -- 資料準備
  (20, 10, '單店/複數店', '', 0, 1),
  (21, 10, '複數店資料提供方式（無複數店無須填寫）', '', 0, 2),
  (22, 10, '資料準備-勞工名冊或員工資料表', '', 0, 3),
  (23, 10, '資料準備-勞保明細', '', 0, 4),
  (24, 10, '資料準備-工資清冊或個人薪資單', '', 0, 5),
  (25, 10, '資料準備-出勤紀錄或個人工時表', '', 0, 6),
  -- 勞工名冊
  (26, 11, '有勞工名冊或員工資料表', '現場須提供紙本核對，名冊項目至少具備9項：姓名、性別、出生日、本籍、學歷、住址、身分證、到職日、勞保投保日', 0, 1),
  -- 勞保明細
  (27, 12, '勞工保險開辦及加保狀況', '現場須提供最新一期(前一個月)的勞保紙本核對', 0, 1),
  -- 工資清冊
  (28, 13, '有工資清冊或員工薪資單', '現場須提供紙本核對，項目至少具備6項：薪資項目、加班項目、特休未休工資、應扣項目、薪資總額、實領薪資', 0, 1),
  -- 出勤紀錄
  (29, 14, '有出勤紀錄或個人工時表', '現場須提供紙本核對，項目至少具備3項：實際出勤簽到/簽退、加班時數欄位、員工確認欄位', 0, 1),
  -- 加班作業
  (30, 15, '國定假日', '確認原因欄位判斷', 0, 1),
  (31, 15, '休息日加班', '備註或確認原因欄位判斷', 0, 2),
  (32, 15, '平日加班（每日出勤>8H）', '', 0, 3);

-- 6. FC 選項
-- Q20: 單店/複數店
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (20, 'FC-01', '無複數店', 0, '[]', 1),
  (20, 'FC-02', '有複數店', 0, '[]', 2);

-- Q21: 複數店資料提供方式
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (21, 'FC-11', '以單店各別提供單店查核資料', 0, '[]', 1),
  (21, 'FC-12', '以商行集中提供全部查核資料，本店集中提供', 0, '[]', 2),
  (21, 'FC-13', '以商行集中提供部分資料，其他以各店自行提供', 0, '[]', 3),
  (21, 'FC-14', '以商行集中提供全部查核資料，他店集中提供本店不提供（查核結束）', 0, '[26,27,28,29,30,31,32]', 4);

-- Q22: 勞工名冊準備
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (22, 'FC-21', '本店提供商行全店勞工名冊或員工資料表', 0, '[]', 1),
  (22, 'FC-22', '僅提供勞工名冊或員工資料表', 0, '[]', 2),
  (22, 'FC-23', '無提供勞工名冊或員工資料（第1項無需點檢）', 0, '[26]', 3);

-- Q23: 勞保明細準備
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (23, 'FC-31', '提供商行全店勞保明細', 0, '[]', 1),
  (23, 'FC-32', '僅提供勞保明細', 0, '[]', 2),
  (23, 'FC-33', '無提供勞保明細（第2項無需點檢）', 0, '[27]', 3);

-- Q24: 工資清冊準備
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (24, 'FC-41', '提供商行全店工資清冊或個人薪資單', 0, '[]', 1),
  (24, 'FC-42', '僅提供工資清冊或個人薪資單', 0, '[]', 2),
  (24, 'FC-43', '無提供工資清冊或個人薪資單（第3、5項無需點檢）', 0, '[28,30,31,32]', 3);

-- Q25: 出勤紀錄準備
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (25, 'FC-51', '提供商行全店出勤紀錄或個人工時表', 0, '[]', 1),
  (25, 'FC-52', '僅提供出勤紀錄或個人工時表', 0, '[]', 2),
  (25, 'FC-53', '無提供出勤紀錄或個人工時表（第4、5項無需點檢）', 0, '[29,30,31,32]', 3);

-- Q26: 勞工名冊
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (26, 'FC-61', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (26, 'FC-62', '紙本/系統公版-項目填寫完整', 0, 2),
  (26, 'FC-63', '紙本/系統公版-項目填寫不完整', 1, 3),
  (26, 'FC-64', '自製版本-項目填寫完整', 0, 4),
  (26, 'FC-65', '自製版本-項目填寫不完整', 1, 5);

-- Q27: 勞保明細
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (27, 'FC-71', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (27, 'FC-72', '已開辦勞工保險並全員加保', 0, 2),
  (27, 'FC-73', '已開辦勞工保險但未全員加保', 1, 3);

-- Q28: 工資清冊
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (28, 'FC-81', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (28, 'FC-82', '紙本/系統公版-項目完整，且員工人數符合', 0, 2),
  (28, 'FC-83', '紙本/系統公版-項目完整，但員工人數不符合/人數無法判斷', 1, 3),
  (28, 'FC-84', '自製版本-項目完整，且員工人數符合', 0, 4),
  (28, 'FC-85', '自製版本-項目完整，但員工人數不符合/人數無法判斷', 1, 5),
  (28, 'FC-86', '自製版本-項目不完整，但員工人數符合', 1, 6),
  (28, 'FC-87', '自製版本-項目不完整，且員工人數不符合/人數無法判斷', 1, 7);

-- Q29: 出勤紀錄
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (29, 'FC-91', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (29, 'FC-92', '紙本/系統公版-項目完整，且員工人數符合', 0, 2),
  (29, 'FC-93', '紙本/系統公版-項目完整，但員工人數不符合/人數無法判斷', 1, 3),
  (29, 'FC-94', '自製版本-項目完整，且員工人數符合', 0, 4),
  (29, 'FC-95', '自製版本-項目完整，但員工人數不符合/人數無法判斷', 1, 5),
  (29, 'FC-96', '自製版本-項目不完整，但員工人數符合', 1, 6),
  (29, 'FC-97', '自製版本-項目不完整，且員工人數不符合/人數無法判斷', 1, 7);

-- Q30: 國定假日
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (30, 'FC-A1', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (30, 'FC-A2', '全數員工給予國定假日休假（所有勞工遇國定假日皆以排休處理）', 0, 2),
  (30, 'FC-A3', '部分員工未給予國定假日休假-遇國定假日未給予休假，應休未休部分給付薪資且有薪資明細', 1, 3),
  (30, 'FC-A4', '部分員工未給予國定假日休假-遇國定假日未給予休假，應休未休部分給付薪資但無薪資明細', 1, 4),
  (30, 'FC-A5', '部分員工未給予國定假日休假-遇國定假日未給予休假，應休未休部分未給付薪資', 1, 5);

-- Q31: 休息日加班
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (31, 'FC-B1', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (31, 'FC-B2', '全數員工無休息日加班情形（所有勞工皆無休息日加班情形）', 0, 2),
  (31, 'FC-B3', '部分員工休息日有加班情形-休息日加班有給付加班費且有薪資明細', 1, 3),
  (31, 'FC-B4', '部分員工休息日有加班情形-休息日加班有給付加班費但無薪資明細', 1, 4),
  (31, 'FC-B5', '部分員工休息日有加班情形-休息日加班無給付加班費', 1, 5);

-- Q32: 平日加班
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (32, 'FC-C1', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, 1),
  (32, 'FC-C2', '全數員工無平日加班情形', 0, 2),
  (32, 'FC-C3', '部分員工平日有加班情形-平日加班有給付加班費且有薪資明細', 1, 3),
  (32, 'FC-C4', '部分員工平日有加班情形-平日加班有給付加班費但無薪資明細', 1, 4),
  (32, 'FC-C5', '部分員工平日有加班情形-平日加班無給付加班費', 1, 5);
