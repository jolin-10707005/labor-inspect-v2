// ══════════════════════════════════════════════
// Setup.gs — 執行一次，初始化所有 Sheets 結構與預設資料
// 步驟：在 GAS 編輯器中執行 initializeAll()
// ══════════════════════════════════════════════

function initializeAll() {
  initSheets();
  seedUsers();
  seedCategories();
  seedQuestions();
  seedOptions();
  Logger.log('✅ 初始化完成！請確認 Google Sheets 內容。');
}

// ── 建立所有工作表 ──────────────────────────────

function initSheets() {
  const spreadsheet = SpreadsheetApp.openById(SS_ID);
  const definitions = {
    'users':              ['id', 'username', 'password', 'role', 'full_name', 'created_at'],
    'stores':             ['id', 'code', 'name', 'section', 'active'],
    'categories':         ['id', 'item_no', 'name', 'icon', 'sort_order', 'store_type'],
    'questions':          ['id', 'category_id', 'content', 'condition_note', 'deduction', 'sort_order'],
    'options':            ['id', 'question_id', 'param_code', 'label', 'is_violation', 'skip_items', 'sort_order'],
    'inspections':        ['id', 'store_code', 'store_name', 'store_type', 'audit_date', 'audit_time', 'inspector_name', 'section', 'exec_status', 'exec_other', 'has_violation', 'paper_photo', 'auditor_id', 'created_at'],
    'inspection_answers': ['id', 'inspection_id', 'question_id', 'opt_id', 'param_code', 'is_vio', 'skipped', 'note'],
    'audit_log':          ['id', 'inspection_id', 'action', 'changed_by', 'changed_at', 'note'],
    'assigned_stores':    ['id', 'month', 'store_code', 'store_name', 'section', 'note', 'created_at'],
  };

  Object.entries(definitions).forEach(([name, headers]) => {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      Logger.log('建立工作表: ' + name);
    }
    // 確保第一行是 header
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8f5f4');
    }
  });
}

// ── 預設使用者 ──────────────────────────────────

function seedUsers() {
  const s = getSheet('users');
  if (s.getLastRow() > 1) { Logger.log('users 已有資料，跳過'); return; }
  const t = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  s.appendRow([1, 'Reyi945', '879123', 'admin', '管理員', t]);
  s.appendRow([2, 'admin', 'admin123', 'admin', '系統管理員', t]);
  Logger.log('users 初始化完成');
}

// ── 查核大項 ────────────────────────────────────

function seedCategories() {
  const s = getSheet('categories');
  if (s.getLastRow() > 1) { Logger.log('categories 已有資料，跳過'); return; }
  const rows = [
    // RC 直營店
    [1,  '1', '排班規則',     '📅', 1,  'RC'],
    [2,  '2', '出勤紀錄',     '📝', 2,  'RC'],
    [3,  '3', '工時薪資作業', '⏱', 3,  'RC'],
    [4,  '4', '大夜規則',     '🌙', 4,  'RC'],
    [5,  '5', '外籍學生',     '🌏', 5,  'RC'],
    [6,  '0', '資料準備',     '📂', 0,  'RC'],
    // FC 加盟店
    [10, '0', '資料準備',     '📂', 1,  'FC'],  // sort_order=1（資料提供方式在前）
    [11, '1', '勞工名冊',     '📋', 2,  'FC'],
    [12, '2', '勞保明細資料', '🏥', 3,  'FC'],
    [13, '3', '工資清冊',     '💰', 4,  'FC'],
    [14, '4', '出勤紀錄',     '⏰', 5,  'FC'],
    [15, '5', '加班作業',     '⏱', 6,  'FC'],
    [16, '0', '資料提供方式', '📋', 0,  'FC'],  // Q20/Q21 移至此大項
  ];
  rows.forEach(r => s.appendRow(r));
  Logger.log('categories 初始化完成');
}

// ── 題目 ────────────────────────────────────────

function seedQuestions() {
  const s = getSheet('questions');
  if (s.getLastRow() > 1) { Logger.log('questions 已有資料，跳過'); return; }
  // [id, category_id, content, condition_note, deduction, sort_order]
  const rows = [
    // RC 排班規則
    [1, 1, '預排班表並且公告有同仁', '', 10, 1],
    // RC 出勤紀錄
    [2, 2, '簽到退落實度', '', 10, 1],
    [3, 2, '店舖正職國定、例假及休息日每月天數有無符合規範（檢視確認原因的註記原因）', '', 10, 2],
    [4, 2, '店舖兼職國定、例假及休息日每週天數有無符合規範（檢視確認原因的註記原因）', '', 10, 3],
    // RC 工時薪資
    [5, 3, '實際出勤工時與計薪工時有無符合規範', '請依優先順序選擇最符合情況的選項', 20, 1],
    // RC 大夜規則
    [6, 4, '未滿18歲兼職值大夜班', '', 15, 1],
    // RC 外籍學生
    [7, 5, '外籍學生週工時', '', 15, 1],
    // RC 資料準備
    [8, 6, '班表準備', '', 0, 1],
    [9, 6, '出勤紀錄準備', '', 0, 2],
    // FC 資料提供方式（大項 ID=16）
    [20, 16, '單店/複數店', '', 0, 1],
    [21, 16, '複數店資料提供方式（無複數店無須填寫）', '', 0, 2],
    // FC 資料準備（大項 ID=10）
    [22, 10, '資料準備-勞工名冊或員工資料表', '', 0, 1],
    [23, 10, '資料準備-勞保明細', '', 0, 4],
    [24, 10, '資料準備-工資清冊或個人薪資單', '', 0, 5],
    [25, 10, '資料準備-出勤紀錄或個人工時表', '', 0, 6],
    // FC 勞工名冊
    [26, 11, '有勞工名冊或員工資料表', '現場須提供紙本核對，名冊項目至少具備9項：姓名、性別、出生日、本籍、學歷、住址、身分證、到職日、勞保投保日', 0, 1],
    // FC 勞保明細
    [27, 12, '勞工保險開辦及加保狀況', '現場須提供最新一期(前一個月)的勞保紙本核對', 0, 1],
    // FC 工資清冊
    [28, 13, '有工資清冊或員工薪資單', '現場須提供紙本核對，項目至少具備6項：薪資項目、加班項目、特休未休工資、應扣項目、薪資總額、實領薪資', 0, 1],
    // FC 出勤紀錄
    [29, 14, '有出勤紀錄或個人工時表', '現場須提供紙本核對，項目至少具備3項：實際出勤簽到/簽退、加班時數欄位、員工確認欄位', 0, 1],
    // FC 加班作業
    [30, 15, '國定假日', '確認原因欄位判斷', 0, 1],
    [31, 15, '休息日加班', '備註或確認原因欄位判斷', 0, 2],
    [32, 15, '平日加班（每日出勤>8H）', '', 0, 3],
  ];
  rows.forEach(r => s.appendRow(r));
  Logger.log('questions 初始化完成');
}

// ── 選項 ────────────────────────────────────────

function seedOptions() {
  const s = getSheet('options');
  if (s.getLastRow() > 1) { Logger.log('options 已有資料，跳過'); return; }
  // [id, question_id, param_code, label, is_violation, skip_items, sort_order]
  let id = 1;
  const rows = [
    // Q1 排班規則
    [id++, 1, '211', '預排七天（含）班表以上', 0, '[]', 1],
    [id++, 1, '212', '預排少於七天班（違規）', 1, '[]', 2],
    [id++, 1, '213', '班表現場無提供', 0, '[]', 3],
    // Q2 簽到退
    [id++, 2, '121', '確實簽到退', 0, '[]', 1],
    [id++, 2, '122', '未確實簽到退（單月未簽到退 ≥5 天，違規）', 1, '[]', 2],
    [id++, 2, '123', '出勤紀錄現場無提供', 0, '[]', 3],
    // Q3 正職例假
    [id++, 3, '131', '正職確認原因註記每月例假及休息日天數符合規範', 0, '[]', 1],
    [id++, 3, '132', '正職確認原因註記每月例假及休息日天數不符合規範（違規）', 1, '[]', 2],
    [id++, 3, '133', '出勤紀錄現場無提供', 0, '[]', 3],
    // Q4 兼職例假
    [id++, 4, '141', '兼職確認原因註記每週例假及休息日天數符合規範（每週1例1休）', 0, '[]', 1],
    [id++, 4, '142', '兼職確認原因註記每週例假及休息日天數不符合規範（違規）', 1, '[]', 2],
    [id++, 4, '143', '出勤紀錄現場無提供', 0, '[]', 3],
    // Q5 工時薪資（依優先順序）
    [id++, 5, '322', '【第一優先】實際出勤工時與計薪工時不同，確認原因欄位無註記或無簽名（違規）', 1, '[]', 1],
    [id++, 5, '323', '【第二優先】工時不同，確認原因為「預作薪資」有提供補薪/追款佐證', 0, '[]', 2],
    [id++, 5, '324', '【第三優先】實際與計薪工時加總不同，確認原因欄位有註記且有簽名', 0, '[]', 3],
    [id++, 5, '325', '【第四優先】實際與計薪工時加總不同，工時差異小於 0.5H（緩衝時間內）', 0, '[]', 4],
    [id++, 5, '321', '實際出勤工時與計薪工時一致', 0, '[]', 5],
    [id++, 5, '326', '出勤紀錄現場無提供', 0, '[]', 6],
    [id++, 5, '329', '※ 無法判斷（請填寫說明並拍照記錄）', 0, '[]', 7],
    // Q6 大夜規則
    [id++, 6, '411', '無未滿18歲兼職員工', 0, '[]', 1],
    [id++, 6, '412', '未滿18歲兼職員工無值大夜班（每日大夜工時 < 1小時）', 0, '[]', 2],
    [id++, 6, '413', '未滿18歲兼職員工有值大夜班（每日大夜工時 > 1小時，違規）', 1, '[]', 3],
    // Q7 外籍學生
    [id++, 7, '511', '無外籍學生', 0, '[]', 1],
    [id++, 7, '512', '外籍工讀生週工時未超過20小時', 0, '[]', 2],
    [id++, 7, '513', '外籍工讀生週工時超過20小時（違規）', 1, '[]', 3],
    // Q8 班表準備
    [id++, 8, '001', '班表現場有提供', 0, '[]', 1],
    [id++, 8, '002', '班表現場無提供', 0, '[1,2,3,4,5,6,7]', 2],
    // Q9 出勤紀錄準備
    [id++, 9, '011', '出勤紀錄現場有提供', 0, '[]', 1],
    [id++, 9, '012', '出勤紀錄現場無提供', 0, '[2,3,4,5]', 2],
    // Q20 單店/複數店
    [id++, 20, 'FC-01', '無複數店', 0, '[]', 1],
    [id++, 20, 'FC-02', '有複數店', 0, '[]', 2],
    // Q21 複數店資料提供方式
    [id++, 21, 'FC-11', '以單店各別提供單店查核資料', 0, '[]', 1],
    [id++, 21, 'FC-12', '以商行集中提供全部查核資料，本店集中提供', 0, '[]', 2],
    [id++, 21, 'FC-13', '以商行集中提供部分資料，其他以各店自行提供', 0, '[]', 3],
    [id++, 21, 'FC-14', '以商行集中提供全部查核資料，他店集中提供本店不提供（查核結束）', 0, '[26,27,28,29,30,31,32]', 4],
    // Q22 勞工名冊準備
    [id++, 22, 'FC-21', '本店提供商行全店勞工名冊或員工資料表', 0, '[]', 1],
    [id++, 22, 'FC-22', '僅提供勞工名冊或員工資料表', 0, '[]', 2],
    [id++, 22, 'FC-23', '無提供勞工名冊或員工資料（第1項無需點檢）', 0, '[26]', 3],
    // Q23 勞保明細準備
    [id++, 23, 'FC-31', '提供商行全店勞保明細', 0, '[]', 1],
    [id++, 23, 'FC-32', '僅提供勞保明細', 0, '[]', 2],
    [id++, 23, 'FC-33', '無提供勞保明細（第2項無需點檢）', 0, '[27]', 3],
    // Q24 工資清冊準備
    [id++, 24, 'FC-41', '提供商行全店工資清冊或個人薪資單', 0, '[]', 1],
    [id++, 24, 'FC-42', '僅提供工資清冊或個人薪資單', 0, '[]', 2],
    [id++, 24, 'FC-43', '無提供工資清冊或個人薪資單（第3、5項無需點檢）', 0, '[28,30,31,32]', 3],
    // Q25 出勤紀錄準備
    [id++, 25, 'FC-51', '提供商行全店出勤紀錄或個人工時表', 0, '[]', 1],
    [id++, 25, 'FC-52', '僅提供出勤紀錄或個人工時表', 0, '[]', 2],
    [id++, 25, 'FC-53', '無提供出勤紀錄或個人工時表（第4、5項無需點檢）', 0, '[29,30,31,32]', 3],
    // Q26 勞工名冊
    [id++, 26, 'FC-61', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 26, 'FC-62', '紙本/系統公版-項目填寫完整', 0, '[]', 2],
    [id++, 26, 'FC-63', '紙本/系統公版-項目填寫不完整', 1, '[]', 3],
    [id++, 26, 'FC-64', '自製版本-項目填寫完整', 0, '[]', 4],
    [id++, 26, 'FC-65', '自製版本-項目填寫不完整', 1, '[]', 5],
    // Q27 勞保明細
    [id++, 27, 'FC-71', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 27, 'FC-72', '已開辦勞工保險並全員加保', 0, '[]', 2],
    [id++, 27, 'FC-73', '已開辦勞工保險但未全員加保', 1, '[]', 3],
    // Q28 工資清冊
    [id++, 28, 'FC-81', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 28, 'FC-82', '紙本/系統公版-項目完整，且員工人數符合', 0, '[]', 2],
    [id++, 28, 'FC-83', '紙本/系統公版-項目完整，但員工人數不符合/人數無法判斷', 1, '[]', 3],
    [id++, 28, 'FC-84', '自製版本-項目完整，且員工人數符合', 0, '[]', 4],
    [id++, 28, 'FC-85', '自製版本-項目完整，但員工人數不符合/人數無法判斷', 1, '[]', 5],
    [id++, 28, 'FC-86', '自製版本-項目不完整，但員工人數符合', 1, '[]', 6],
    [id++, 28, 'FC-87', '自製版本-項目不完整，且員工人數不符合/人數無法判斷', 1, '[]', 7],
    // Q29 出勤紀錄
    [id++, 29, 'FC-91', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 29, 'FC-92', '紙本/系統公版-項目完整，且員工人數符合', 0, '[]', 2],
    [id++, 29, 'FC-93', '紙本/系統公版-項目完整，但員工人數不符合/人數無法判斷', 1, '[]', 3],
    [id++, 29, 'FC-94', '自製版本-項目完整，且員工人數符合', 0, '[]', 4],
    [id++, 29, 'FC-95', '自製版本-項目完整，但員工人數不符合/人數無法判斷', 1, '[]', 5],
    [id++, 29, 'FC-96', '自製版本-項目不完整，但員工人數符合', 1, '[]', 6],
    [id++, 29, 'FC-97', '自製版本-項目不完整，且員工人數不符合/人數無法判斷', 1, '[]', 7],
    // Q30 國定假日
    [id++, 30, 'FC-A1', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 30, 'FC-A2', '全數員工給予國定假日休假', 0, '[]', 2],
    [id++, 30, 'FC-A3', '部分員工未給予國定假日-有給付薪資且有薪資明細', 1, '[]', 3],
    [id++, 30, 'FC-A4', '部分員工未給予國定假日-有給付薪資但無薪資明細', 1, '[]', 4],
    [id++, 30, 'FC-A5', '部分員工未給予國定假日-未給付薪資', 1, '[]', 5],
    // Q31 休息日加班
    [id++, 31, 'FC-B1', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 31, 'FC-B2', '全數員工無休息日加班情形', 0, '[]', 2],
    [id++, 31, 'FC-B3', '部分員工休息日加班-有給付加班費且有薪資明細', 1, '[]', 3],
    [id++, 31, 'FC-B4', '部分員工休息日加班-有給付加班費但無薪資明細', 1, '[]', 4],
    [id++, 31, 'FC-B5', '部分員工休息日加班-無給付加班費', 1, '[]', 5],
    // Q32 平日加班
    [id++, 32, 'FC-C1', '資料無法判斷 ※現場無法判斷（請拍照記錄）', 0, '[]', 1],
    [id++, 32, 'FC-C2', '全數員工無平日加班情形', 0, '[]', 2],
    [id++, 32, 'FC-C3', '部分員工平日加班-有給付加班費且有薪資明細', 1, '[]', 3],
    [id++, 32, 'FC-C4', '部分員工平日加班-有給付加班費但無薪資明細', 1, '[]', 4],
    [id++, 32, 'FC-C5', '部分員工平日加班-無給付加班費', 1, '[]', 5],
  ];
  rows.forEach(r => s.appendRow(r));
  Logger.log('options 初始化完成，共 ' + rows.length + ' 筆');
}

// ── 一次性修復：新增 FC「資料提供方式」大項，並將 Q20/Q21 移至該大項 ──
// 執行方式：在 GAS 編輯器直接執行（不需重新部署）
function addFCResourceCategory() {
  const ss = SpreadsheetApp.openById(SS_ID);

  // 1. 新增 categories 大項（若尚不存在）
  const catSheet = getSheet('categories');
  const cats = sheetToObjects('categories');
  if (!cats.find(c => String(c.id) === '16')) {
    catSheet.appendRow([16, '0', '資料提供方式', '📋', 0, 'FC']);
    Logger.log('新增 categories: 資料提供方式 (id=16)');
  } else {
    Logger.log('categories id=16 已存在，跳過');
  }

  // 2. 將 FC 資料準備（id=10）的 sort_order 改為 1
  const catData = catSheet.getDataRange().getValues();
  const catHeaders = catData[0];
  const catIdCol = catHeaders.indexOf('id');
  const catSortCol = catHeaders.indexOf('sort_order');
  for (let i = 1; i < catData.length; i++) {
    if (String(catData[i][catIdCol]) === '10') {
      catSheet.getRange(i + 1, catSortCol + 1).setValue(1);
      Logger.log('categories id=10 sort_order 更新為 1');
      break;
    }
  }

  // 3. 將 Q20/Q21 的 category_id 改為 16（資料提供方式）
  const qSheet = getSheet('questions');
  const qData = qSheet.getDataRange().getValues();
  const qHeaders = qData[0];
  const qIdCol = qHeaders.indexOf('id');
  const qCatCol = qHeaders.indexOf('category_id');
  const qSortCol = qHeaders.indexOf('sort_order');
  let moved = 0;
  for (let i = 1; i < qData.length; i++) {
    const qid = String(qData[i][qIdCol]);
    if (qid === '20') {
      qSheet.getRange(i + 1, qCatCol + 1).setValue(16);
      qSheet.getRange(i + 1, qSortCol + 1).setValue(1);
      moved++;
    } else if (qid === '21') {
      qSheet.getRange(i + 1, qCatCol + 1).setValue(16);
      qSheet.getRange(i + 1, qSortCol + 1).setValue(2);
      moved++;
    } else if (qid === '22') {
      qSheet.getRange(i + 1, qSortCol + 1).setValue(1); // 資料準備從 1 開始
    }
  }
  Logger.log(`✅ 完成：移動 ${moved} 題至資料提供方式大項`);
}

// ── 一次性修復：將孤立選項的 question_id 更新為現行題目 ID ──
// 情境：題目曾被重建導致 ID 改變，選項的 question_id 對應到舊 ID
// 執行方式：在 GAS 編輯器直接執行此函數（不需重新部署）
function fixOptionLinks() {
  const qs = sheetToObjects('questions');
  const s  = getSheet('options');
  const data = s.getDataRange().getValues();
  if (data.length < 2) { Logger.log('options 工作表無資料'); return; }
  const headers = data[0];
  const qidCol  = headers.indexOf('question_id');

  // 以關鍵字找出目前資料庫中的題目 ID
  function findQId(keywords) {
    const q = qs.find(q => keywords.some(k => String(q.content).includes(k)));
    return q ? q.id : null;
  }

  // 舊 question_id → 關鍵字（對應 RC 題目 1-9、FC 題目 20-32）
  const keyMap = {
    1:  ['預排班表','排班規則'],
    2:  ['簽到退落實'],
    3:  ['店舖正職','正職國定'],
    4:  ['店舖兼職','兼職國定'],
    5:  ['計薪工時','工時薪資'],
    6:  ['未滿18歲兼職值大夜'],
    7:  ['外籍學生週工時'],
    8:  ['班表準備'],
    9:  ['出勤紀錄準備'],
    20: ['單店','複數店'],
    21: ['複數店資料提供'],
    22: ['勞工名冊','員工資料表'],
    23: ['勞保明細'],
    24: ['工資清冊','薪資單'],
    25: ['出勤紀錄或個人工時'],
    26: ['有勞工名冊'],
    27: ['勞工保險開辦'],
    28: ['有工資清冊'],
    29: ['有出勤紀錄'],
    30: ['國定假日'],
    31: ['休息日加班'],
    32: ['平日加班'],
  };

  // 建立舊 ID → 新 ID 對照表
  const idMap = {};
  Object.entries(keyMap).forEach(([oldId, keywords]) => {
    const newId = findQId(keywords);
    if (newId) idMap[String(oldId)] = newId;
  });
  Logger.log('ID 對照表: ' + JSON.stringify(idMap));

  // 逐列更新 question_id
  let fixed = 0, skipped = 0;
  for (let i = 1; i < data.length; i++) {
    const oldQid = String(data[i][qidCol]);
    const newQid = idMap[oldQid];
    if (newQid && String(newQid) !== oldQid) {
      s.getRange(i + 1, qidCol + 1).setValue(newQid);
      fixed++;
    } else {
      skipped++;
    }
  }
  Logger.log(`✅ 修復完成：更新 ${fixed} 筆，跳過 ${skipped} 筆`);
}

// ── 診斷：確認選項連結是否正確 ──
// 執行方式：在 GAS 編輯器直接執行 diagnoseOptions()
function diagnoseOptions() {
  const qs = sheetToObjects('questions');
  const opts = sheetToObjects('options');

  Logger.log('=== 所有題目 ===');
  qs.forEach(q => {
    const myOpts = opts.filter(o => String(o.question_id) === String(q.id));
    Logger.log(`Q${q.id} [cat=${q.category_id}] 「${String(q.content).substring(0,20)}」→ 選項 ${myOpts.length} 個`);
  });

  Logger.log('\n=== 孤立選項（question_id 找不到對應題目）===');
  const qIds = new Set(qs.map(q => String(q.id)));
  const orphans = opts.filter(o => !qIds.has(String(o.question_id)));
  if (orphans.length === 0) {
    Logger.log('無孤立選項 ✅');
  } else {
    orphans.forEach(o => Logger.log(`選項 id=${o.id} param=${o.param_code} question_id=${o.question_id} ← 找不到對應題目`));
  }

  Logger.log('\n=== RC 類別檢查 ===');
  const rcCats = sheetToObjects('categories').filter(c => c.store_type === 'RC');
  rcCats.forEach(c => {
    const catQs = qs.filter(q => String(q.category_id) === String(c.id));
    Logger.log(`大項 id=${c.id} 「${c.name}」→ ${catQs.length} 題`);
    catQs.forEach(q => {
      const cnt = opts.filter(o => String(o.question_id) === String(q.id)).length;
      Logger.log(`  Q${q.id}: ${cnt} 個選項`);
    });
  });
}

// ── 完整重建 RC 題目與選項（完全對應匯入表格）──
// 執行方式：在 GAS 編輯器直接執行 resetRCQuestionsAndOptions()
function resetRCQuestionsAndOptions() {
  Logger.log('▶ 開始重置 RC 題目與選項...');

  // 1. 找出所有 RC 大項 ID
  const cats = sheetToObjects('categories');
  const rcCats = cats.filter(c => String(c.store_type) === 'RC');
  const rcCatIds = new Set(rcCats.map(c => String(c.id)));

  function getCatId(name) {
    const c = rcCats.find(c => String(c.name) === name);
    if (!c) Logger.log('⚠ 找不到大項: ' + name);
    return c ? c.id : null;
  }
  const CAT_PREP    = getCatId('資料準備');
  const CAT_SCHED   = getCatId('排班規則');
  const CAT_ATTEND  = getCatId('出勤紀錄');
  const CAT_WAGE    = getCatId('工時薪資作業');
  const CAT_NIGHT   = getCatId('大夜規則');
  const CAT_FOREIGN = getCatId('外籍學生');

  if (!CAT_PREP || !CAT_SCHED || !CAT_ATTEND || !CAT_WAGE || !CAT_NIGHT || !CAT_FOREIGN) {
    Logger.log('❌ 大項分類不齊，請先確認 categories 工作表'); return;
  }

  // 2. 收集現有 RC 題目 ID，刪除其選項
  const qSheet = getSheet('questions');
  let qData = qSheet.getDataRange().getValues();
  const qH = qData[0];
  const qCatC = qH.indexOf('category_id'), qIdC = qH.indexOf('id');
  const rcQIds = new Set();
  for (let i = 1; i < qData.length; i++) {
    if (rcCatIds.has(String(qData[i][qCatC]))) rcQIds.add(String(qData[i][qIdC]));
  }
  Logger.log('找到 RC 題目: ' + [...rcQIds].join(', '));

  const optSheet = getSheet('options');
  let optData = optSheet.getDataRange().getValues();
  const optH = optData[0];
  const optQidC = optH.indexOf('question_id');
  for (let i = optData.length - 1; i >= 1; i--) {
    if (rcQIds.has(String(optData[i][optQidC]))) optSheet.deleteRow(i + 1);
  }
  Logger.log('已刪除 RC 選項');

  // 3. 刪除 RC 題目
  qData = qSheet.getDataRange().getValues();
  for (let i = qData.length - 1; i >= 1; i--) {
    if (rcCatIds.has(String(qData[i][qH.indexOf('category_id')]))) qSheet.deleteRow(i + 1);
  }
  Logger.log('已刪除 RC 題目');

  // 4. 新增題目
  // [cat_id, content, condition_note, deduction, sort_order]
  const qDefs = [
    [CAT_PREP,    '資料準備-班表準備',   '', 0,  1],
    [CAT_PREP,    '資料準備-出勤紀錄準備', '', 0,  2],
    [CAT_SCHED,   '預排班表並且公告有同仁', '', 10, 1],
    [CAT_ATTEND,  '簽到退落實度', '', 10, 1],
    [CAT_ATTEND,  '店舖正職國定、例假及休息日每月天數有無符合規範（檢視確認原因的註記原因）', '', 10, 2],
    [CAT_ATTEND,  '店舖兼職國定、例假及休息日每週天數有無符合規範（檢視確認原因的註記原因）（國定4/4、4/5）', '', 10, 3],
    [CAT_WAGE,    '實際出勤工時與計薪工時有無符合規範', '請依優先順序選擇最符合情況的選項', 20, 1],
    [CAT_NIGHT,   '未滿18歲兼職值大夜班', '', 15, 1],
    [CAT_FOREIGN, '外籍學生週工時', '', 15, 1],
  ];

  let nextQId = getNextId('questions');
  const qIdMap = {};
  qDefs.forEach(([catId, content, note, ded, sort]) => {
    appendObj('questions', ['id','category_id','content','condition_note','deduction','sort_order'],
      {id: nextQId, category_id: catId, content, condition_note: note, deduction: ded, sort_order: sort});
    qIdMap[content] = nextQId;
    nextQId++;
  });
  Logger.log('題目 ID 對照: ' + JSON.stringify(qIdMap));

  const QA = qIdMap['資料準備-班表準備'];
  const QB = qIdMap['資料準備-出勤紀錄準備'];
  const Q1 = qIdMap['預排班表並且公告有同仁'];
  const Q2 = qIdMap['簽到退落實度'];
  const Q3 = qIdMap['店舖正職國定、例假及休息日每月天數有無符合規範（檢視確認原因的註記原因）'];
  const Q4 = qIdMap['店舖兼職國定、例假及休息日每週天數有無符合規範（檢視確認原因的註記原因）（國定4/4、4/5）'];
  const Q5 = qIdMap['實際出勤工時與計薪工時有無符合規範'];
  const Q6 = qIdMap['未滿18歲兼職值大夜班'];
  const Q7 = qIdMap['外籍學生週工時'];

  // 5. 新增選項 [question_id, param_code, label, is_violation, skip_items, sort_order]
  const skip1 = JSON.stringify([Q1]);
  const skip2345 = JSON.stringify([Q2, Q3, Q4, Q5, Q6, Q7]);

  const optDefs = [
    // QA 班表準備
    [QA, '001', '班表現場有提供',                      0, '[]',     1],
    [QA, '002', '班表現場無提供（第1項無需點驗）',      0, skip1,   2],
    // QB 出勤紀錄準備
    [QB, '011', '出勤紀錄現場有提供',                   0, '[]',     1],
    [QB, '012', '出勤紀錄現場無提供（第2、3、4、5項無需點檢）', 0, skip2345, 2],
    // Q1 排班規則
    [Q1, '211', '預排七天（含）班表以上。',             0, '[]', 1],
    [Q1, '212', '預排少於七天班。',                     1, '[]', 2],
    // Q2 簽到退
    [Q2, '121', '確實簽到退',                           0, '[]', 1],
    [Q2, '122', '未確實簽到退（單月未簽到退≥5天）。',   1, '[]', 2],
    // Q3 正職例假
    [Q3, '131', '正職確認原因註記每月例假及休息日天數符合規範（4月2國4例4休）',   0, '[]', 1],
    [Q3, '132', '正職確認原因註記每月例假及休息日天數不符合規範（4月2國4例4休）', 1, '[]', 2],
    // Q4 兼職例假
    [Q4, '141', '兼職確認原因註記每週例假及休息日天數符合規範（每週1例1休、4月2圖）',   0, '[]', 1],
    [Q4, '142', '兼職確認原因註記每週例假及休息日天數不符合規範（每週1例1休、4月2圖）', 1, '[]', 2],
    // Q5 工時薪資
    [Q5, '322', '（第一優先）實際出勤工時與計薪工時不同，確認原因欄位無註記或無簽名',                                          1, '[]', 1],
    [Q5, '323', '（第二優先）實際出勤計薪工時不同，確認原因為「預作薪資」有提供已完成預計工月份薪資工資表或追款補薪性銀行拍照上傳', 0, '[]', 2],
    [Q5, '324', '（第三優先）實際與計薪工時加總不同，確認原因欄位有註記且有簽名',                                              0, '[]', 3],
    [Q5, '325', '（第四優先）實際與計薪工時加總不同，工時差異小於0.5H（緩衝時間內）',                                          0, '[]', 4],
    [Q5, '321', '（最後）實際出勤工時與計薪工時一致。',                                                                        0, '[]', 5],
    [Q5, '329', '※無法判斷（請拍照記錄）',                                                                                     0, '[]', 6],
    // Q6 大夜規則
    [Q6, '411', '無未滿18歲兼職員工',                                       0, '[]', 1],
    [Q6, '412', '未滿18歲兼職員工無值大夜班（每日大夜工時<1小時或0小時）', 0, '[]', 2],
    [Q6, '413', '未滿18歲兼職員工有值大夜班（每日大夜工時>1小時）',        1, '[]', 3],
    // Q7 外籍學生
    [Q7, '511', '無外籍學生',                           0, '[]', 1],
    [Q7, '512', '外籍工讀生週工時未超過20小時',         0, '[]', 2],
    [Q7, '513', '外籍工讀生週工時超過20小時（違規）',   1, '[]', 3],
  ];

  let nextOptId = getNextId('options');
  const optHdr = ['id','question_id','param_code','label','is_violation','skip_items','sort_order'];
  optDefs.forEach(([qid, param, label, isVio, skip, sort]) => {
    appendObj('options', optHdr, {id: nextOptId, question_id: qid, param_code: param, label, is_violation: isVio, skip_items: skip, sort_order: sort});
    nextOptId++;
  });

  Logger.log(`✅ 完成！新增 ${qDefs.length} 道題目，${optDefs.length} 個選項`);
  Logger.log('題目 ID: QA=' + QA + ' QB=' + QB + ' Q1=' + Q1 + ' Q2=' + Q2 + ' Q3=' + Q3 + ' Q4=' + Q4 + ' Q5=' + Q5 + ' Q6=' + Q6 + ' Q7=' + Q7);
}

// ── 修正 RC 跳題邏輯（skip_items 對應新題目 ID）──
// 執行方式：在 GAS 編輯器直接執行 fixSkipItems()
function fixSkipItems() {
  const qs = sheetToObjects('questions');

  // 動態查出目前的題目 ID
  function findId(keyword) {
    const q = qs.find(q => String(q.content).includes(keyword));
    if (!q) { Logger.log('找不到題目: ' + keyword); return null; }
    return q.id;
  }

  // RC 主題目
  const Q1  = findId('預排班表');           // 排班規則
  const Q2  = findId('簽到退落實');         // 出勤紀錄
  const Q3  = findId('店舖正職');           // 正職例假
  const Q4  = findId('店舖兼職');           // 兼職例假
  const Q5  = findId('計薪工時');           // 工時薪資
  const Q6  = findId('未滿18歲兼職值大夜'); // 大夜規則
  const Q7  = findId('外籍學生週工時');     // 外籍學生

  if (!Q1||!Q2||!Q3||!Q4||!Q5||!Q6||!Q7) {
    Logger.log('❌ 部分題目找不到，請先確認題目存在');
    return;
  }

  // 正確的跳題對應：
  //   param_code '002'（班表現場無提供）→ 只跳過 第1項（排班規則 = Q1）
  //   param_code '012'（出勤紀錄現場無提供）→ 跳過 第2~5項（Q2~Q7）
  const fixes = [
    { param: '002', skip: [Q1] },
    { param: '012', skip: [Q2, Q3, Q4, Q5, Q6, Q7] },
  ];

  const s = getSheet('options');
  const data = s.getDataRange().getValues();
  const headers = data[0];
  const paramCol = headers.indexOf('param_code');
  const skipCol  = headers.indexOf('skip_items');

  let fixed = 0;
  fixes.forEach(({ param, skip }) => {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][paramCol]) === param) {
        const newVal = JSON.stringify(skip);
        s.getRange(i + 1, skipCol + 1).setValue(newVal);
        Logger.log(`✅ 更新 param=${param} skip_items → ${newVal}`);
        fixed++;
        break;
      }
    }
  });

  Logger.log(`完成，共修正 ${fixed} 筆跳題邏輯`);
}
