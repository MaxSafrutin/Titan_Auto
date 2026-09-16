function routeAction(action, payload, token) {
  if (action === 'health') return { service: 'TITAN AUTO API', time: nowIso() };
  if (action === 'auth.login') return login(payload);
  if (action === 'vehicle.publicList') return publicVehicleList(payload);
  if (action === 'vehicle.publicGet') return publicVehicleGet(payload.vehicle_id);
  var session = requireSession(token);
  if (action === 'auth.check') return { user: publicSessionUser(session) };
  if (action === 'auth.logout') return logout(token);
  authorizeAction(action, session);
  var routes = {
    'dashboard.stats': function () { return dashboardStats(session); },
    'workspace.snapshot': function () { return workspaceSnapshot(session); },
    'documents.snapshot': function () { return documentsSnapshot(); },
    'settings.get': function () { return companySettingsGet(); },
    'settings.update': function () { return companySettingsUpdate(payload, session); },
    'user.list': function () { return staffUserList(session); },
    'user.upsert': function () { return staffUserUpsert(payload, session); },
    'counterparty.list': function () { return counterpartyList(payload); },
    'counterparty.create': function () { return counterpartyCreate(payload, session); },
    'counterparty.update': function () { return counterpartyUpdate(payload.counterparty_id, payload.data, session); },
    'deal.list': function () { return dealList(payload); },
    'deal.create': function () { return dealCreate(payload, session); },
    'deal.update': function () { return dealUpdate(payload.deal_id, payload.data, session); },
    'template.list': function () { return templateList(payload); },
    'vehicle.list': function () { return vehicleList(payload); },
    'vehicle.get': function () { return vehicleGet(payload.vehicle_id); },
    'vehicle.create': function () { return vehicleCreate(payload, session); },
    'vehicle.update': function () { return vehicleUpdate(payload.vehicle_id, payload.data, session); },
    'vehicle.archive': function () { return vehicleUpdate(payload.vehicle_id, { status: 'archived', public_status: 'private' }, session); },
    'vehicle.markSold': function () { return vehicleMarkSold(payload, session); },
    'lead.list': function () { return leadList(payload); },
    'lead.get': function () { return leadGet(payload.lead_id); },
    'lead.create': function () { return leadCreate(payload, session); },
    'lead.update': function () { return leadUpdate(payload.lead_id, payload.data, session); },
    'contact.list': function () { return contactList(payload); },
    'contact.create': function () { return contactCreate(payload, session); },
    'valuation.list': function () { return valuationList(payload); },
    'valuation.create': function () { return valuationCreate(payload, session); },
    'sale.list': function () { return saleList(payload); },
    'sale.create': function () { return saleCreate(payload, session); },
    'sale.update': function () { return saleUpdate(payload.sale_id, payload.data, session); },
    'file.list': function () { return fileList(payload); },
    'file.upload': function () { return fileUpload(payload, session); },
    'file.publicSet': function () { return filePublicSet(payload.file_id, payload, session); },
    'file.reconcilePhotoAccess': function () { return reconcilePhotoAccess(session); },
    'file.delete': function () { return fileDelete(payload.file_id, session); },
    'file.getDownload': function () { return fileGetDownload(payload.file_id); },
    'task.list': function () { return taskList(payload); },
    'task.create': function () { return taskCreate(payload, session); },
    'task.update': function () { return taskUpdate(payload.task_id, payload.data, session); }
  };
  if (!routes[action]) throw apiError('UNKNOWN_ACTION', 'Неизвестное действие API: ' + action);
  return routes[action]();
}

function workspaceSnapshot(session) {
  var financialAccess = ['admin','director'].indexOf((session && session.role) || 'admin') >= 0;
  return {
    vehicles: vehicleList({ include_archived: true }),
    leads: leadList({}),
    sales: financialAccess ? saleList({}) : [],
    valuations: valuationList({}),
    tasks: taskList({})
  };
}

function documentsSnapshot() {
  return {
    vehicles: vehicleList({ include_archived: true }),
    counterparties: counterpartyList({}),
    deals: dealList({}),
    settings: companySettingsGet(),
    templates: templateList({ include_content: true })
  };
}
