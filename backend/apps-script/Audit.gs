function auditChanges(session, entityType, entityId, action, before, after) {
  var keys = {};
  Object.keys(before || {}).concat(Object.keys(after || {})).forEach(function (key) { keys[key] = true; });
  Object.keys(keys).forEach(function (field) {
    if (field === 'updated_at' || field === 'payload_json') return;
    var oldValue = before ? before[field] : '';
    var newValue = after ? after[field] : '';
    if (String(oldValue === undefined ? '' : oldValue) === String(newValue === undefined ? '' : newValue)) return;
    appendRecord('AUDIT_LOG', {
      event_id: Utilities.getUuid(), created_at: nowIso(), user: session.user,
      entity_type: entityType, entity_id: entityId, action: action, field: field,
      old_value: oldValue === undefined ? '' : oldValue, new_value: newValue === undefined ? '' : newValue
    });
  });
}

function auditFor(entityId, limit) {
  return sortNewest(listRecords('AUDIT_LOG').filter(function (x) { return String(x.entity_id) === String(entityId); })).slice(0, limit || 50);
}
