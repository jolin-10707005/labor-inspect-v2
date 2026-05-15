-- ═══ 更新題目文字（完全按照 Excel 檔案內容）═══

-- 資料準備題目
UPDATE questions SET content='資料準備－班表準備' WHERE id=8;
UPDATE questions SET content='資料準備－出勤紀錄準備' WHERE id=9;

-- 排班規則
UPDATE questions SET content='預排班表並且公告有同仁' WHERE id=1;

-- 出勤紀錄
UPDATE questions SET content='簽到退落實度' WHERE id=2;
UPDATE questions SET content='店舖正職國定、例假及休息日每月天數有無符合規範（檢視確認原因的註記原因）' WHERE id=3;
UPDATE questions SET content='店舖兼職國定、例假及休息日每週天數有無符合規範（檢視確認原因的註記原因）' WHERE id=4;

-- 工時薪資
UPDATE questions SET content='實際出勤工時與計薪工時有無符合規範' WHERE id=5;

-- 大夜規則
UPDATE questions SET content='未滿18歲兼職值大夜班' WHERE id=6;

-- 外籍學生
UPDATE questions SET content='外籍學生週工時' WHERE id=7;

-- ═══ 更新選項文字 ═══

-- 班表準備選項
DELETE FROM options WHERE question_id=8;
INSERT INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (8, '001', '班表現場有提供', 0, '[]', 1),
  (8, '002', '班表現場無提供（第1項排班規則無需點檢）', 0, '[1]', 2);

-- 出勤紀錄準備選項
DELETE FROM options WHERE question_id=9;
INSERT INTO options (question_id, param_code, label, is_violation, skip_items, sort_order) VALUES
  (9, '011', '出勤紀錄現場有提供', 0, '[]', 1),
  (9, '012', '出勤紀錄現場無提供（第2、3、4、5項無需點檢）', 0, '[2,3,4,5]', 2);

-- 排班規則
DELETE FROM options WHERE question_id=1;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (1, '211', '預排七天（含）班表以上。', 0, 1),
  (1, '212', '預排少於七天班。', 1, 2);

-- 簽到退落實度
DELETE FROM options WHERE question_id=2;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (2, '121', '確實簽到退。', 0, 1),
  (2, '122', '未確實簽到退（單月未簽到退≧5天）。', 1, 2);

-- 正職例假
DELETE FROM options WHERE question_id=3;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (3, '131', '正職確認原因註記每月例假及休息日天數符合規範。', 0, 1),
  (3, '132', '正職確認原因註記每月例假及休息日天數不符合規範。', 1, 2);

-- 兼職例假
DELETE FROM options WHERE question_id=4;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (4, '141', '兼職確認原因註記每週例假及休息日天數符合規範（每週1例1休）。', 0, 1),
  (4, '142', '兼職確認原因註記每週例假及休息日天數不符合規範（每週1例1休）。', 1, 2);

-- 工時薪資（依優先順序）
DELETE FROM options WHERE question_id=5;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (5, '322', '（第一優先）實際出勤工時與計薪工時不同，確認原因欄位無註記或無簽名。', 1, 1),
  (5, '323', '（第二優先）工時不同，確認原因為「預作薪資」有提供補薪/追款佐證（拍照上傳）。', 0, 2),
  (5, '324', '（第三優先）實際與計薪工時加總不同，確認原因欄位註記且簽名。', 0, 3),
  (5, '325', '（第四優先）實際與計薪工時加總不同，工時差異小於0.5H（緩衝時間內）。', 0, 4),
  (5, '321', '（最後）實際出勤工時與計薪工時一致。', 0, 5),
  (5, '329', '※無法判斷（請填寫說明並拍照記錄）', 0, 6);

-- 大夜規則
DELETE FROM options WHERE question_id=6;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (6, '411', '無未滿18歲兼職員工。', 0, 1),
  (6, '412', '未滿18歲兼職員工無值大夜班（每日大夜工時<1小時）。', 0, 2),
  (6, '413', '未滿18歲兼職員工有值大夜班（每日大夜工時>1小時）。', 1, 3);

-- 外籍學生
DELETE FROM options WHERE question_id=7;
INSERT INTO options (question_id, param_code, label, is_violation, sort_order) VALUES
  (7, '511', '本次不查核。', 0, 1),
  (7, '512', '無外籍學生。', 0, 2),
  (7, '513', '外籍工讀生週工時未超過20小時。', 0, 3),
  (7, '514', '外籍工讀生週工時超過20小時（違規）。', 1, 4);

-- 加一欄儲存紙本照片
ALTER TABLE inspections ADD COLUMN paper_photo TEXT DEFAULT '';
