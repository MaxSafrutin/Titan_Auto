function routeAction(action, payload, token) {
  if (action === 'health') return { service: 'TITAN AUTO API', time: nowIso() };
  if (action === 'auth.login') return login(payload);
  if (action === 'vehicle.publicList') return publicVehicleList(payload);
  var session = requireSession(token);
  if (action === 'auth.check') return { user: session.user };
  if (action === 'auth.logout') return logout(token);
  var routes = {
    'dashboard.stats': function () { return dashboardStats(); },
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
    'file.list': function () { return fileList(payload); },
    'file.upload': function () { return fileUpload(payload, session); },
    'file.delete': function () { return fileDelete(payload.file_id, session); },
    'file.getDownload': function () { return fileGetDownload(payload.file_id); },
    'task.list': function () { return taskList(payload); },
    'task.create': function () { return taskCreate(payload, session); },
    'task.update': function () { return taskUpdate(payload.task_id, payload.data, session); }
  };
  if (!routes[action]) throw apiError('UNKNOWN_ACTION', 'Неизвестное действие API: ' + action);
  return routes[action]();
}
