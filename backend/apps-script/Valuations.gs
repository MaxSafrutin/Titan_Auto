function valuationList(filters) {
  return sortNewest(listRecords('VALUATIONS').filter(function (row) {
    return !(filters || {}).vehicle_id || String(row.vehicle_id) === String(filters.vehicle_id);
  }));
}

function valuationCreate(payload, session) {
  requireFields(payload, ['vehicle_id']);
  if (!findRecord('VEHICLES', 'vehicle_id', payload.vehicle_id)) throw apiError('VEHICLE_NOT_FOUND', 'Автомобиль не найден.');
  var data = cleanObject(payload);
  data.valuation_id = nextId('VALUATION', 'VAL');
  data.created_at = nowIso();
  data.manager = data.manager || session.user;
  ['market_price','recommended_price','buyout_price','trade_in_price','commission_price','estimated_investments','mileage_adjustment','market_min','market_max'].forEach(function (key) {
    if (data[key] !== undefined) data[key] = normalizeNumber(data[key]);
  });
  appendRecord('VALUATIONS', data);
  var changes = {};
  ['market_price','buyout_price','estimated_investments'].forEach(function (key) { if (data[key] !== '' && data[key] !== undefined) changes[key] = data[key]; });
  if (data.recommended_price !== '' && data.recommended_price !== undefined) changes.sale_price = data.recommended_price;
  vehicleUpdate(data.vehicle_id, changes, session);
  auditChanges(session, 'VALUATION', data.valuation_id, 'CREATE', {}, data);
  return data;
}
