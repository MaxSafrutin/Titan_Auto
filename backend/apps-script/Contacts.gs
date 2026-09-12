function contactList(filters) {
  return sortNewest(listRecords('CONTACTS').filter(function (x) {
    return (!(filters || {}).vehicle_id || String(x.vehicle_id) === String(filters.vehicle_id)) && (!(filters || {}).lead_id || String(x.lead_id) === String(filters.lead_id));
  }));
}

function contactCreate(payload, session) {
  requireFields(payload, ['result']);
  if (!payload.vehicle_id && !payload.lead_id) throw apiError('VALIDATION_ERROR','Контакт должен быть связан с автомобилем или лидом.');
  var data = cleanObject(payload); data.contact_id = nextId('CONTACT','CONTACT'); data.created_at = nowIso(); data.manager = data.manager || session.user;
  appendRecord('CONTACTS', data);
  auditChanges(session,'CONTACT',data.contact_id,'CREATE',{},data);
  if (data.lead_id && data.next_action_at) leadUpdate(data.lead_id, { next_contact_at: data.next_action_at, next_contact_type: data.next_action || data.type }, session);
  return data;
}
