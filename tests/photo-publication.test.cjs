const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backend = path.join(__dirname, '..', 'backend', 'apps-script');
function contextFor(vehicles, files) {
  const sheets = { VEHICLES: vehicles, FILES: files };
  const context = vm.createContext({
    listRecordsLite: name => sheets[name] || [],
    findRecordLite: (name, key, value) => (sheets[name] || []).find(row => String(row[key]) === String(value)),
    sortNewest: rows => rows,
    publicVehicle: row => ({ vehicle_id: row.vehicle_id, cover_url: '', brand: row.brand }),
    companySettingsGet: () => ({ company: {} }),
    apiError: (code, message) => Object.assign(new Error(message), { code }),
  });
  for (const name of ['Files.gs', 'Vehicles.gs']) {
    vm.runInContext(fs.readFileSync(path.join(backend, name), 'utf8'), context, { filename: name });
  }
  return context;
}

test('public catalog exposes only explicitly marked photos', () => {
  const vehicles = [{ vehicle_id: 'TA-1', brand: 'Lada', status: 'in_stock', public_status: 'published', cover_file_id: 'private-photo' }];
  const files = [
    { file_id: 'F1', vehicle_id: 'TA-1', type: 'photos', drive_file_id: 'private-photo', description: '' },
    { file_id: 'F2', vehicle_id: 'TA-1', type: 'photos', drive_file_id: 'public-photo', description: '[PUBLIC] front' },
    { file_id: 'F3', vehicle_id: 'TA-1', type: 'documents', drive_file_id: 'document', description: '[PUBLIC] contract' },
    { file_id: 'F4', vehicle_id: 'TA-1', type: 'photos', drive_file_id: 'deleted-photo', description: '[DELETED] [PUBLIC] side' },
  ];
  const context = contextFor(vehicles, files);
  const listing = context.publicVehicleList({});
  assert.equal(listing.length, 1);
  assert.match(listing[0].cover_url, /public-photo/);
  const details = context.publicVehicleGet('TA-1').vehicle;
  assert.equal(details.photos.length, 1);
  assert.match(details.photos[0], /public-photo/);
  assert.ok(!JSON.stringify(details).includes('private-photo'));
  assert.ok(!JSON.stringify(details).includes('document'));
});

test('file listing returns publication flag without changing descriptions', () => {
  const files = [
    { file_id: 'F1', vehicle_id: 'TA-1', type: 'photos', description: 'private' },
    { file_id: 'F2', vehicle_id: 'TA-1', type: 'photos', description: '[PUBLIC] approved' },
  ];
  const context = contextFor([], files);
  const result = context.fileList({ vehicle_id: 'TA-1' });
  assert.deepEqual(Array.from(result, row => row.public_photo), [false, true]);
  assert.equal(context.photoDescription('[PUBLIC] approved', false), 'approved');
  assert.equal(context.photoDescription('approved', true), '[PUBLIC] approved');
});
