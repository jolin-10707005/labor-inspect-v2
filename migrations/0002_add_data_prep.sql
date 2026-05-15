-- 新增「資料準備」大項（排在最前面）
INSERT OR IGNORE INTO categories (id, item_no, name, icon, sort_order) VALUES
  (6, '0', '資料準備', '📂', 0);

-- 更新其他大項排序
UPDATE categories SET sort_order=1 WHERE id=1;
UPDATE categories SET sort_order=2 WHERE id=2;
UPDATE categories SET sort_order=3 WHERE id=3;
UPDATE categories SET sort_order=4 WHERE id=4;
UPDATE categories SET sort_order=5 WHERE id=5;

-- 新增資料準備的兩個題目
INSERT OR IGNORE INTO questions (id, category_id, content, deduction, sort_order) VALUES
  (8, 6, '資料準備－班表準備', 0, 1),
  (9, 6, '資料準備－出勤紀錄準備', 0, 2);

-- 班表準備選項（有提供 / 無提供→跳過Q1排班規則）
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (8, '001', '班表現場有提供', 0, '[]', 1),
  (8, '002', '班表現場無提供（第1項排班規則無需點檢）', 0, '[1]', 2);

-- 出勤紀錄準備選項（有提供 / 無提供→跳過Q2Q3Q4Q5）
INSERT OR IGNORE INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (9, '011', '出勤紀錄現場有提供', 0, '[]', 1),
  (9, '012', '出勤紀錄現場無提供（第2、3、4、5項無需點檢）', 0, '[2,3,4,5]', 2);

-- 移除各題目原本的「現場無提供」選項（改由資料準備統一控制）
DELETE FROM options WHERE param_code IN ('213','123','133','143','326');
