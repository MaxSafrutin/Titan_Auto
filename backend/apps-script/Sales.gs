function saleList(filters) {
  return sortNewest(listRecordsLite('SALES').filter(function (x) { return !(filters || {}).vehicle_id || String(x.vehicle_id) === String(filters.vehicle_id); }));
}
function saleCreate(payload, session) {
  requireFields(payload,['vehicle_id']);
  var data=cleanObject(payload); data.sale_id=nextId('SALE','SALE'); data.sale_date=data.sale_date||nowIso().slice(0,10); data.manager=data.manager||session.user;
  ['purchase_price','sale_price','owner_amount','commission','credit_commission','expenses','tax','profit','margin','actual_buyer_payment','actual_owner_payment','actual_manager_payment','actual_director_payment'].forEach(function(k){if(data[k]!==undefined)data[k]=normalizeNumber(data[k]);});
  if(data.profit===''||data.profit===undefined) data.profit=Number(data.sale_price||0)-Number(data.purchase_price||data.owner_amount||0)-Number(data.expenses||0)-Number(data.commission||0)-Number(data.tax||0)+Number(data.credit_commission||0);
  if(data.margin===''||data.margin===undefined) data.margin=Number(data.sale_price||0)-Number(data.purchase_price||data.owner_amount||0);
  data.payload_json=JSON.stringify(cleanObject(payload));
  appendRecord('SALES',data); auditChanges(session,'SALE',data.sale_id,'CREATE',{},data); return data;
}

function saleUpdate(id, changes, session) {
  var before = findRecord('SALES', 'sale_id', id);
  if (!before) throw apiError('SALE_NOT_FOUND', 'Продажа не найдена.');
  var data = cleanObject(changes);
  delete data.sale_id;
  delete data.created_at;
  ['purchase_price','sale_price','owner_amount','commission','credit_commission','expenses','tax','profit','margin','actual_buyer_payment','actual_owner_payment','actual_manager_payment','actual_director_payment'].forEach(function (key) {
    if (data[key] !== undefined) data[key] = normalizeNumber(data[key]);
  });
  var storedPayload = jsonParse(before.payload_json, {});
  var nextPayload = typeof data.payload_json === 'string' ? jsonParse(data.payload_json, {}) : (data.payload_json || {});
  delete data.payload_json;
  data.payload_json = JSON.stringify(Object.assign({}, storedPayload, nextPayload));
  var after = updateRecord('SALES', 'sale_id', id, data);
  auditChanges(session, 'SALE', id, 'UPDATE', before, after);
  return after;
}
