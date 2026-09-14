var COMPANY_SETTING_KEYS = {
  legal_name: 'company_legal_name',
  ogrn: 'company_ogrn',
  inn: 'company_inn',
  kpp: 'company_kpp',
  director: 'company_director',
  address: 'company_address',
  phone: 'company_phone',
  bank_name: 'company_bank_name',
  bank_account: 'company_bank_account',
  correspondent_account: 'company_correspondent_account',
  bik: 'company_bank_bik'
};

function companySettingsGet() {
  var values = {};
  listRecords('SETTINGS').forEach(function (row) { values[String(row.key)] = row.value; });
  var company = {};
  Object.keys(COMPANY_SETTING_KEYS).forEach(function (field) { company[field] = values[COMPANY_SETTING_KEYS[field]] || ''; });
  company.managers = jsonParse(values.company_managers_json, []);
  if (!Array.isArray(company.managers)) company.managers = [];
  return { company: company };
}

function companySettingsUpdate(payload, session) {
  var company = (payload || {}).company || {};
  var before = companySettingsGet().company;
  Object.keys(COMPANY_SETTING_KEYS).forEach(function (field) {
    if (company[field] !== undefined) upsertSetting(COMPANY_SETTING_KEYS[field], String(company[field] || ''), 'Реквизиты компании');
  });
  if (company.managers !== undefined) {
    var managers = Array.isArray(company.managers) ? company.managers.map(function (item) {
      return { name: String((item || {}).name || '').trim(), phone: String((item || {}).phone || '').trim() };
    }).filter(function (item) { return item.name || item.phone; }) : [];
    upsertSetting('company_managers_json', JSON.stringify(managers), 'Менеджеры для документов и ценников');
  }
  var after = companySettingsGet().company;
  auditChanges(session, 'SETTINGS', 'company', 'UPDATE', before, after);
  return { company: after };
}

function upsertSetting(key, value, description) {
  var existing = findRecord('SETTINGS', 'key', key);
  var data = { value: value, description: description || (existing && existing.description) || '', updated_at: nowIso() };
  if (existing) return updateRecord('SETTINGS', 'key', key, data);
  return appendRecord('SETTINGS', { key: key, value: value, description: data.description, updated_at: data.updated_at });
}
