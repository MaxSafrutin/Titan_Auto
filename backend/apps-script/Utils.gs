function nowIso() {
  return new Date().toISOString();
}

function cleanObject(value) {
  var result = {};
  Object.keys(value || {}).forEach(function (key) {
    var item = value[key];
    if (item !== undefined && item !== null) result[key] = item;
  });
  return result;
}

function requireFields(payload, fields) {
  fields.forEach(function (field) {
    if (String((payload || {})[field] || '').trim() === '') {
      throw apiError('VALIDATION_ERROR', 'Заполните обязательное поле: ' + field);
    }
  });
}

function apiError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function jsonParse(value, fallback) {
  try { return JSON.parse(value || ''); } catch (error) { return fallback; }
}

function sha256(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { var n = byte < 0 ? byte + 256 : byte; return ('0' + n.toString(16)).slice(-2); }).join('');
}

function normalizeNumber(value) {
  if (value === '' || value === null || value === undefined) return '';
  var number = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return isNaN(number) ? '' : number;
}

function publicVehicle(row) {
  return {
    vehicle_id: row.vehicle_id,
    brand: row.brand,
    model: row.model,
    generation: row.generation,
    year: row.year,
    mileage: row.mileage,
    engine_volume: row.engine_volume,
    engine_power: row.engine_power,
    fuel_type: row.fuel_type,
    transmission: row.transmission,
    drive_type: row.drive_type,
    body_type: row.body_type,
    color: row.color,
    sale_price: row.sale_price,
    stock_type: row.status === 'in_stock' ? 'in_stock' : 'virtual',
    description: row.description,
    cover_url: ''
  };
}

function sortNewest(rows) {
  return rows.sort(function (a, b) { return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')); });
}
