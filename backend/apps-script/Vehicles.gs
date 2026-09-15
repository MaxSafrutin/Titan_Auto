function nextId(entity, prefix) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'SEQUENCE_' + entity;
    var value = Number(props.getProperty(key) || 0) + 1;
    props.setProperty(key, String(value));
    return prefix + '-' + ('000000' + value).slice(-6);
  } finally { lock.releaseLock(); }
}

function vehicleList(filters) {
  var q = String((filters || {}).q || '').toLowerCase().replace(/\s/g, '');
  return sortNewest(listRecordsLite('VEHICLES').filter(function (row) {
    if (row.status === 'archived' && !(filters || {}).include_archived) return false;
    return !q || containsVehicle(row, q);
  }));
}

function containsVehicle(row, q) {
  return ['vehicle_id','brand','model','generation','vin','seller_phone','registration_plate','source_url'].some(function (field) {
    return String(row[field] || '').toLowerCase().replace(/\s/g, '').indexOf(q) >= 0;
  });
}

function publicVehicleList(filters) {
  var q = String((filters || {}).q || '').toLowerCase().replace(/\s/g, '');
  return sortNewest(listRecordsLite('VEHICLES').filter(function (row) {
    return row.public_status === 'published' && row.status !== 'sold' && row.status !== 'archived' && (!q || containsVehicle(row, q));
  })).map(publicVehicle);
}

function publicVehicleGet(id) {
  var row = findRecordLite('VEHICLES', 'vehicle_id', id);
  if (!row || row.public_status !== 'published' || ['sold','archived'].indexOf(String(row.status)) >= 0) throw apiError('PUBLIC_VEHICLE_NOT_FOUND', 'Автомобиль не опубликован или уже снят с продажи.');
  var vehicle = publicVehicle(row);
  vehicle.photos = sortNewest(listRecordsLite('FILES').filter(function (file) {
    return String(file.vehicle_id) === String(id) && file.type === 'photos' && String(file.description || '').indexOf('[DELETED]') !== 0;
  })).slice(0, 12).map(function (file) { return 'https://drive.google.com/thumbnail?id=' + file.drive_file_id + '&sz=w1600'; });
  var company = companySettingsGet().company || {};
  return { vehicle: vehicle, company: { legal_name: company.legal_name || 'ТИТАН АВТО', phone: company.phone || '', address: company.address || '' } };
}

function syncPublicPhotoAccess(vehicleId, isPublic) {
  listRecordsLite('FILES').filter(function (file) { return String(file.vehicle_id) === String(vehicleId) && file.type === 'photos'; }).forEach(function (file) {
    try { DriveApp.getFileById(file.drive_file_id).setSharing(isPublic ? DriveApp.Access.ANYONE_WITH_LINK : DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW); }
    catch (error) { console.warn('Не удалось изменить доступ к фото ' + file.drive_file_id + ': ' + error.message); }
  });
}

function vehicleGet(id) {
  var vehicle = findRecordLite('VEHICLES', 'vehicle_id', id);
  if (!vehicle) throw apiError('VEHICLE_NOT_FOUND', 'Автомобиль не найден.');
  return {
    vehicle: vehicle,
    contacts: contactList({ vehicle_id: id }),
    valuations: valuationList({ vehicle_id: id }),
    files: fileList({ vehicle_id: id }),
    tasks: taskList({ vehicle_id: id }),
    audit: auditFor(id, 50)
  };
}

function vehicleCreate(payload, session) {
  requireFields(payload, ['brand','model']);
  var timestamp = nowIso();
  var data = cleanObject(payload);
  data.vehicle_id = nextId('VEHICLE', 'TA');
  data.created_at = timestamp;
  data.updated_at = timestamp;
  data.status = data.status || 'new';
  data.public_status = data.public_status || 'private';
  ['year','mileage','engine_volume','engine_power','owners_count','seller_price','market_price','buyout_price','purchase_price','sale_price','estimated_investments','commission'].forEach(function (key) { if (data[key] !== undefined) data[key] = normalizeNumber(data[key]); });
  appendRecord('VEHICLES', data);
  ensureVehicleFolders(data.vehicle_id);
  auditChanges(session, 'VEHICLE', data.vehicle_id, 'CREATE', {}, data);
  return data;
}

function vehicleUpdate(id, changes, session) {
  var before = findRecord('VEHICLES', 'vehicle_id', id);
  if (!before) throw apiError('VEHICLE_NOT_FOUND', 'Автомобиль не найден.');
  var allowed = DB_SCHEMA.VEHICLES.reduce(function (result, key) { result[key] = true; return result; }, {});
  var data = {};
  Object.keys(changes || {}).forEach(function (key) { if (allowed[key] && ['vehicle_id','created_at'].indexOf(key) < 0) data[key] = changes[key]; });
  ['year','mileage','engine_volume','engine_power','owners_count','seller_price','market_price','buyout_price','purchase_price','sale_price','estimated_investments','commission'].forEach(function (key) { if (data[key] !== undefined) data[key] = normalizeNumber(data[key]); });
  data.updated_at = nowIso();
  var after = updateRecord('VEHICLES', 'vehicle_id', id, data);
  if (data.public_status !== undefined && data.public_status !== before.public_status) syncPublicPhotoAccess(id, data.public_status === 'published');
  auditChanges(session, 'VEHICLE', id, 'UPDATE', before, after);
  return after;
}

function vehicleMarkSold(payload, session) {
  var id = payload.vehicle_id;
  var vehicle = vehicleUpdate(id, { status: 'sold', public_status: 'private', sale_price: payload.sale_price, purchase_price: payload.purchase_price, commission: payload.commission }, session);
  var salePayload = cleanObject(payload);
  salePayload.vehicle_id = id;
  salePayload.sale_date = salePayload.sale_date || nowIso().slice(0,10);
  salePayload.purchase_price = salePayload.purchase_price || vehicle.purchase_price || vehicle.buyout_price;
  salePayload.sale_price = salePayload.sale_price || vehicle.sale_price;
  salePayload.commission = salePayload.commission === undefined ? vehicle.commission : salePayload.commission;
  salePayload.manager = salePayload.manager || vehicle.manager;
  var sale = saleCreate(salePayload, session);
  return { vehicle: vehicle, sale: sale };
}

function dashboardStats() {
  var vehicles = listRecordsLite('VEHICLES');
  var leads = listRecordsLite('LEADS');
  var tasks = listRecordsLite('TASKS');
  var sales = listRecordsLite('SALES');
  var valuations = listRecordsLite('VALUATIONS');
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var month = today.slice(0, 7);
  var valued = {};
  valuations.forEach(function (x) { valued[x.vehicle_id] = true; });
  var activeLead = function (x) { return ['won','lost','archived'].indexOf(String(x.status)) < 0; };
  var upcoming = tasks.filter(function (x) { return x.status !== 'done' && x.due_at; }).concat(leads.filter(function (x) { return activeLead(x) && x.next_contact_at; }).map(function (x) { return { lead_id: x.lead_id, title: 'Связаться: ' + [x.brand,x.model].filter(Boolean).join(' '), due_at: x.next_contact_at }; }));
  upcoming.sort(function (a,b) { return String(a.due_at).localeCompare(String(b.due_at)); });
  return {
    active_vehicles: vehicles.filter(function (x) { return ['sold','archived'].indexOf(x.status) < 0; }).length,
    new_leads: leads.filter(function (x) { return x.status === 'new'; }).length,
    callbacks_today: leads.filter(function (x) { return activeLead(x) && String(x.next_contact_at).slice(0,10) === today; }).length,
    meetings_upcoming: leads.filter(function (x) { return activeLead(x) && String(x.meet_at) >= today; }).length,
    without_valuation: vehicles.filter(function (x) { return ['sold','archived'].indexOf(x.status) < 0 && !valued[x.vehicle_id]; }).length,
    sold_this_month: sales.filter(function (x) { return String(x.sale_date).slice(0,7) === month; }).length,
    margin_this_month: sales.filter(function (x) { return String(x.sale_date).slice(0,7) === month; }).reduce(function (sum,x) { return sum + Number(x.profit || x.margin || 0); }, 0),
    tasks_today: tasks.filter(function (x) { return x.status !== 'done' && String(x.due_at).slice(0,10) === today; }).length,
    upcoming_actions: upcoming.slice(0, 8),
    recent_vehicles: sortNewest(vehicles).slice(0, 6)
  };
}
