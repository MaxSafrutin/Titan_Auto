function doGet() {
  return responseJson({ ok: true, data: { service: 'TITAN AUTO API', time: nowIso() }, error: null });
}

function doPost(event) {
  try {
    var request = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    enforceRateLimit(request.session);
    checkAllowedOrigin(request.origin);
    var data = routeAction(request.action, request.payload || {}, request.session || '');
    return responseJson({ ok: true, data: data === undefined ? null : data, error: null });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return responseJson({ ok: false, data: null, error: { code: error.code || 'INTERNAL_ERROR', message: error.code ? error.message : 'Внутренняя ошибка TITAN AUTO.' } });
  }
}

function responseJson(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
