function leadList(filters) {
  var q = String((filters || {}).q || '').toLowerCase().replace(/\s/g, '');
  return sortNewest(listRecords('LEADS').filter(function (row) {
    return !q || ['lead_id','seller_name','phone','brand','model','source_url'].some(function (key) { return String(row[key] || '').toLowerCase().replace(/\s/g, '').indexOf(q) >= 0; });
  }));
}

function leadGet(id) {
  var lead = findRecord('LEADS', 'lead_id', id);
  if (!lead) throw apiError('LEAD_NOT_FOUND', 'Лид не найден.');
  return { lead: lead, contacts: contactList({ lead_id: id }) };
}

function leadCreate(payload, session) {
  requireFields(payload, ['brand','model','phone']);
  var timestamp = nowIso();
  var data = cleanObject(payload);
  data.lead_id = nextId('LEAD', 'LEAD');
  data.created_at = timestamp; data.updated_at = timestamp; data.status = data.status || 'new';
  data.seller_price = normalizeNumber(data.seller_price);
  appendRecord('LEADS', data);
  auditChanges(session, 'LEAD', data.lead_id, 'CREATE', {}, data);
  return data;
}

function leadUpdate(id, changes, session) {
  var before = findRecord('LEADS', 'lead_id', id);
  if (!before) throw apiError('LEAD_NOT_FOUND', 'Лид не найден.');
  var data = cleanObject(changes); delete data.lead_id; delete data.created_at; data.updated_at = nowIso();
  var after = updateRecord('LEADS','lead_id',id,data);
  auditChanges(session,'LEAD',id,'UPDATE',before,after);
  return after;
}
