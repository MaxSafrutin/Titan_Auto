var DB_SCHEMA = {
  VEHICLES: ['vehicle_id','created_at','updated_at','status','public_status','brand','model','generation','year','vin','mileage','engine_volume','engine_power','fuel_type','transmission','drive_type','body_type','color','owners_count','registration_plate','category','vehicle_type','engine_number','chassis_number','body_number','pts_number','pts_issued','sts_number','sts_issued','special_notes','seller_name','seller_phone','owner_id','source','source_url','acquisition_type','manager','responsible_manager','seller_price','market_price','buyout_price','purchase_price','sale_price','estimated_investments','commission','location','description','notes','cover_file_id','payload_json'],
  LEADS: ['lead_id','created_at','updated_at','vehicle_id','status','seller_name','phone','source','source_url','brand','model','year','seller_price','listing_date','listing_age','lead_channel','call_sequence','previous_outcome','previous_agreement','previous_objection','previous_contact','previous_notes','market_position','listing_restriction','pre_call_accent','need','objection','readiness','meet_at','meeting_place','next_contact_at','next_contact_type','manager','notes','post_call_text','payload_json'],
  CONTACTS: ['contact_id','vehicle_id','lead_id','created_at','type','manager','result','summary','agreement','objection','comment','next_action','next_action_at','channel','message','payload_json'],
  VALUATIONS: ['valuation_id','vehicle_id','created_at','market_price','recommended_price','buyout_price','trade_in_price','commission_price','estimated_investments','mileage_adjustment','demand_level','market_min','market_max','agreed_option','comment','manager','payload_json'],
  SALES: ['sale_id','vehicle_id','sale_date','purchase_price','sale_price','owner_amount','commission','credit_commission','expenses','tax','profit','margin','deal_type','participation','accepted_by','sold_by','responsible_manager','avito_days','actual_buyer_payment','actual_owner_payment','actual_manager_payment','actual_director_payment','manager','comment','payload_json'],
  DEALS: ['deal_id','number','type','status','seller_id','buyer_id','vehicle_id','contract_date','city','selected_documents','terms_json','document_dates_json','template_name','created_at','updated_at','payload_json'],
  COUNTERPARTIES: ['counterparty_id','kind','name','inn','birth_date','passport_series','passport_number','passport_issue_date','passport_issued_by','division_code','address','phone','kpp','ogrn','director','bank_name','bank_account','correspondent_account','bik','is_own_company','created_at','updated_at','payload_json'],
  FILES: ['file_id','vehicle_id','type','drive_file_id','filename','mime_type','size','created_at','created_by','description','version','folder_id'],
  TASKS: ['task_id','vehicle_id','lead_id','created_at','updated_at','status','title','due_at','assignee','priority','comment'],
  AUDIT_LOG: ['event_id','created_at','user','entity_type','entity_id','action','field','old_value','new_value'],
  SETTINGS: ['key','value','description','updated_at']
};

var DATABASE_RUNTIME = { spreadsheet: null, sheets: {} };

function getSpreadsheet() {
  if (DATABASE_RUNTIME.spreadsheet) return DATABASE_RUNTIME.spreadsheet;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw apiError('SETUP_REQUIRED', 'Не задан SPREADSHEET_ID. Запустите configureProject() и setupProject().');
  DATABASE_RUNTIME.spreadsheet = SpreadsheetApp.openById(id);
  return DATABASE_RUNTIME.spreadsheet;
}

function setupDatabase() {
  var spreadsheet = getSpreadsheet();
  var created = [];
  Object.keys(DB_SCHEMA).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) { sheet = spreadsheet.insertSheet(name); created.push(name); }
    var headers = DB_SCHEMA[name];
    var current = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    headers.forEach(function (header) {
      if (current.indexOf(header) === -1) current.push(header);
    });
    if (current.length) {
      sheet.getRange(1, 1, 1, current.length).setValues([current]).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#f5f5f5');
      sheet.setFrozenRows(1);
    }
  });
  return { created_sheets: created, sheets: Object.keys(DB_SCHEMA) };
}

function sheetContext(name) {
  if (DATABASE_RUNTIME.sheets[name]) return DATABASE_RUNTIME.sheets[name];
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw apiError('DATABASE_NOT_READY', 'Лист ' + name + ' не найден. Запустите setupProject().');
  var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  DATABASE_RUNTIME.sheets[name] = { sheet: sheet, headers: headers };
  return DATABASE_RUNTIME.sheets[name];
}

function listRecords(name) {
  var ctx = sheetContext(name);
  var lastRow = ctx.sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = ctx.sheet.getRange(2, 1, lastRow - 1, ctx.headers.length).getValues();
  return values.map(function (row) {
    var item = {};
    ctx.headers.forEach(function (header, index) { item[header] = row[index]; });
    return item;
  });
}

// Списки для интерфейса не должны читать тяжёлый payload_json. Полный архив
// остаётся в таблице и используется только в специализированных операциях.
function listRecordsLite(name) {
  var ctx = sheetContext(name);
  var lastRow = ctx.sheet.getLastRow();
  if (lastRow < 2) return [];
  var payloadIndex = ctx.headers.indexOf('payload_json');
  var width = payloadIndex === ctx.headers.length - 1 ? payloadIndex : ctx.headers.length;
  var headers = ctx.headers.slice(0, width);
  var values = ctx.sheet.getRange(2, 1, lastRow - 1, width).getValues();
  return values.map(function (row) {
    var item = {};
    headers.forEach(function (header, index) { item[header] = row[index]; });
    return item;
  });
}

function findRecordLite(name, idField, id) {
  var rows = listRecordsLite(name);
  for (var i = 0; i < rows.length; i += 1) if (String(rows[i][idField]) === String(id)) return rows[i];
  return null;
}

function appendRecord(name, data) {
  var ctx = sheetContext(name);
  ctx.sheet.appendRow(ctx.headers.map(function (header) { return data[header] === undefined ? '' : safeCellValue(data[header]); }));
  return data;
}

function safeCellValue(value) {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function findRecord(name, idField, id) {
  var rows = listRecords(name);
  for (var i = 0; i < rows.length; i += 1) if (String(rows[i][idField]) === String(id)) return rows[i];
  return null;
}

function updateRecord(name, idField, id, changes) {
  var ctx = sheetContext(name);
  var idIndex = ctx.headers.indexOf(idField);
  if (idIndex < 0) throw apiError('DATABASE_SCHEMA_ERROR', 'Не найдено поле ' + idField);
  var lastRow = ctx.sheet.getLastRow();
  if (lastRow < 2) return null;
  var ids = ctx.sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) !== String(id)) continue;
    var rowNumber = i + 2;
    var current = ctx.sheet.getRange(rowNumber, 1, 1, ctx.headers.length).getValues()[0];
    Object.keys(changes || {}).forEach(function (key) {
      var index = ctx.headers.indexOf(key);
      if (index >= 0 && changes[key] !== undefined) current[index] = safeCellValue(changes[key]);
    });
    ctx.sheet.getRange(rowNumber, 1, 1, ctx.headers.length).setValues([current]);
    var result = {}; ctx.headers.forEach(function (header, index) { result[header] = current[index]; });
    return result;
  }
  return null;
}

function generateSequentialId(entity, prefix) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'SEQUENCE_' + entity;
    var current = Number(props.getProperty(key) || 0) + 1;
    props.setProperty(key, String(current));
    return prefix + '-' + ('000000' + current).slice(-6);
  } finally { lock.releaseLock(); }
}

function containsQuery(row, query, fields) {
  if (!query) return true;
  var q = String(query).toLowerCase().replace(/\s/g, '');
  return fields.some(function (field) { return String(row[field] || '').toLowerCase().replace(/\s/g, '').indexOf(q) >= 0; });
}
