var PUBLIC_PHOTO_MARKER = '[PUBLIC]';

function isPublicPhoto(file) {
  return file && file.type === 'photos' && String(file.description || '').indexOf(PUBLIC_PHOTO_MARKER) === 0;
}

function photoDescription(description, isPublic) {
  var value = String(description || '').replace(/^\[PUBLIC\]\s*/, '');
  return isPublic ? PUBLIC_PHOTO_MARKER + ' ' + value : value;
}

function isPublishableImage(file) {
  var mime = String(file.mime_type || '').toLowerCase();
  var name = String(file.filename || '').toLowerCase();
  return ['image/jpeg','image/png','image/webp'].indexOf(mime) >= 0 && /\.(jpe?g|png|webp)$/.test(name);
}

function isPublishedVehicle(vehicle) {
  return vehicle.public_status === 'published' && ['sold','archived'].indexOf(String(vehicle.status)) < 0;
}

function publicPhotosForVehicle(vehicleId) {
  return listRecordsLite('FILES').filter(function (file) {
    return String(file.vehicle_id) === String(vehicleId) && isPublicPhoto(file);
  });
}

function syncPhotoSharing(file, published) {
  try {
    DriveApp.getFileById(file.drive_file_id).setSharing(published && isPublicPhoto(file) ? DriveApp.Access.ANYONE_WITH_LINK : DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  } catch (error) {
    throw apiError('PHOTO_SHARING_FAILED', 'Не удалось обновить доступ к фото ' + file.filename + ': ' + error.message);
  }
}

function fileList(filters) {
  return sortNewest(listRecordsLite('FILES').filter(function (file) {
    return (!(filters || {}).vehicle_id || String(file.vehicle_id) === String(filters.vehicle_id)) && String(file.description || '').indexOf('[DELETED]') !== 0;
  })).map(function (file) {
    file.public_photo = isPublicPhoto(file);
    return file;
  });
}

function fileUpload(payload, session) {
  requireFields(payload, ['vehicle_id','type','filename','data_url']);
  if (VEHICLE_FOLDERS.indexOf(payload.type) < 0) throw apiError('VALIDATION_ERROR', 'Неизвестный тип файла.');
  var vehicle = findRecordLite('VEHICLES', 'vehicle_id', payload.vehicle_id);
  if (!vehicle) throw apiError('VEHICLE_NOT_FOUND', 'Автомобиль не найден.');
  var match = String(payload.data_url).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw apiError('INVALID_FILE', 'Некорректный файл.');
  var bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 8 * 1024 * 1024) throw apiError('FILE_TOO_LARGE', 'Размер файла ограничен 8 МБ.');
  var wantsPublic = payload.type === 'photos' && payload.public_photo === true;
  if (wantsPublic && !isPublishableImage({ filename: payload.filename, mime_type: payload.mime_type || match[1] })) {
    throw apiError('UNSUPPORTED_PUBLIC_IMAGE', 'Для публичного каталога используйте JPG, PNG или WebP. Другие фото можно хранить внутри карточки.');
  }
  var folders = ensureVehicleFolders(payload.vehicle_id);
  var blob = Utilities.newBlob(bytes, payload.mime_type || match[1], payload.filename);
  var driveFile = DriveApp.getFolderById(folders[payload.type]).createFile(blob);
  var version = listRecordsLite('FILES').filter(function (file) {
    return file.vehicle_id === payload.vehicle_id && file.type === payload.type && file.filename === payload.filename;
  }).length + 1;
  var data = {
    file_id: nextId('FILE','FILE'), vehicle_id: payload.vehicle_id, type: payload.type,
    drive_file_id: driveFile.getId(), filename: payload.filename,
    mime_type: payload.mime_type || match[1], size: bytes.length,
    created_at: nowIso(), created_by: session.user,
    description: payload.type === 'photos' ? photoDescription(payload.description, wantsPublic) : payload.description || '',
    version: version, folder_id: folders[payload.type]
  };
  if (payload.type === 'photos') {
    try {
      syncPhotoSharing(data, false);
    } catch (error) {
      driveFile.setTrashed(true);
      throw error;
    }
  }
  appendRecord('FILES', data);
  if (isPublicPhoto(data) && isPublishedVehicle(vehicle)) {
    try {
      syncPhotoSharing(data, true);
    } catch (error) {
      updateRecord('FILES', 'file_id', data.file_id, { description: photoDescription(data.description, false) });
      throw error;
    }
  }
  if (isPublicPhoto(data) && !publicPhotosForVehicle(payload.vehicle_id).some(function (file) { return String(file.drive_file_id) === String(vehicle.cover_file_id); })) {
    vehicleUpdate(payload.vehicle_id, { cover_file_id: data.drive_file_id }, session);
  }
  auditChanges(session, 'FILE', data.file_id, 'CREATE', {}, data);
  data.public_photo = isPublicPhoto(data);
  return data;
}

function filePublicSet(id, payload, session) {
  var before = findRecord('FILES', 'file_id', id);
  if (!before || String(before.description || '').indexOf('[DELETED]') === 0) throw apiError('FILE_NOT_FOUND', 'Файл не найден.');
  if (before.type !== 'photos') throw apiError('VALIDATION_ERROR', 'Публиковать можно только фотографии.');
  var vehicle = findRecordLite('VEHICLES', 'vehicle_id', before.vehicle_id);
  if (!vehicle) throw apiError('VEHICLE_NOT_FOUND', 'Автомобиль не найден.');
  var publicPhoto = payload.public_photo === true;
  var after = cleanObject(before);
  after.description = photoDescription(before.description, publicPhoto);
  if (publicPhoto && !isPublishableImage(after)) throw apiError('UNSUPPORTED_PUBLIC_IMAGE', 'Для публичного каталога используйте JPG, PNG или WebP.');
  if (!publicPhoto) syncPhotoSharing(after, false);
  after = updateRecord('FILES', 'file_id', id, { description: after.description });
  if (publicPhoto) syncPhotoSharing(after, isPublishedVehicle(vehicle));
  var coverId = vehicle.cover_file_id;
  if (publicPhoto && (payload.set_cover === true || !publicPhotosForVehicle(vehicle.vehicle_id).some(function (file) { return String(file.drive_file_id) === String(coverId); }))) coverId = after.drive_file_id;
  if (!publicPhoto && String(coverId) === String(after.drive_file_id)) {
    var replacement = publicPhotosForVehicle(vehicle.vehicle_id).filter(function (file) { return String(file.file_id) !== String(id); })[0];
    coverId = replacement ? replacement.drive_file_id : '';
  }
  if (coverId !== vehicle.cover_file_id) vehicleUpdate(vehicle.vehicle_id, { cover_file_id: coverId }, session);
  auditChanges(session, 'FILE', id, 'PUBLIC_ACCESS', before, after);
  after.public_photo = isPublicPhoto(after);
  return after;
}

function reconcilePhotoAccess(session) {
  requireRole(session, ['admin']);
  var published = {};
  listRecordsLite('VEHICLES').forEach(function (vehicle) {
    published[vehicle.vehicle_id] = isPublishedVehicle(vehicle);
  });
  var checked = 0, closed = 0;
  listRecordsLite('FILES').forEach(function (file) {
    if (file.type !== 'photos' || String(file.description || '').indexOf('[DELETED]') === 0) return;
    checked += 1;
    var shouldBePublic = published[file.vehicle_id] === true && isPublicPhoto(file);
    syncPhotoSharing(file, published[file.vehicle_id] === true);
    if (!shouldBePublic) closed += 1;
  });
  return { checked: checked, kept_private: closed };
}

function fileDelete(id, session) {
  var record = findRecord('FILES', 'file_id', id);
  if (!record) throw apiError('FILE_NOT_FOUND', 'Файл не найден.');
  DriveApp.getFileById(record.drive_file_id).setTrashed(true);
  updateRecord('FILES', 'file_id', id, { description: '[DELETED] ' + (record.description || '') });
  if (record.type === 'photos') {
    var vehicle = findRecordLite('VEHICLES', 'vehicle_id', record.vehicle_id);
    if (vehicle && String(vehicle.cover_file_id) === String(record.drive_file_id)) {
      var replacement = publicPhotosForVehicle(vehicle.vehicle_id).filter(function (file) { return String(file.file_id) !== String(id); })[0];
      vehicleUpdate(vehicle.vehicle_id, { cover_file_id: replacement ? replacement.drive_file_id : '' }, session);
    }
  }
  auditChanges(session, 'FILE', id, 'DELETE', record, {});
  return { deleted: true };
}

function fileGetDownload(id) {
  var record = findRecord('FILES', 'file_id', id);
  if (!record || String(record.description || '').indexOf('[DELETED]') === 0) throw apiError('FILE_NOT_FOUND', 'Файл не найден.');
  var blob = DriveApp.getFileById(record.drive_file_id).getBlob();
  return { filename: record.filename, mime_type: record.mime_type, data_url: 'data:' + (record.mime_type || blob.getContentType()) + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}
