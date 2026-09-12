import { Config } from './config.js';
import { AppState } from './state.js';

export class TitanApiError extends Error {
  constructor(code, message) {
    super(message || 'Не удалось выполнить операцию.');
    this.name = 'TitanApiError';
    this.code = code || 'UNKNOWN_ERROR';
  }
}

async function request(action, payload = {}) {
  if (!Config.apiUrl) throw new TitanApiError('API_NOT_CONFIGURED', 'Сначала подключите Google Apps Script в настройках.');
  if (!navigator.onLine) throw new TitanApiError('OFFLINE', 'Нет подключения к интернету. Введённые данные остались в форме.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Config.requestTimeoutMs);
  try {
    const response = await fetch(Config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, session: AppState.get('session'), origin: location.origin }),
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) throw new TitanApiError('NETWORK_ERROR', 'Сервис временно недоступен. Повторите попытку.');
    const envelope = await response.json();
    if (!envelope.ok) throw new TitanApiError(envelope.error?.code, envelope.error?.message);
    return envelope.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new TitanApiError('TIMEOUT', 'Сервис отвечает слишком долго. Повторите попытку.');
    if (error instanceof TitanApiError) throw error;
    console.error('TitanAPI request failed', action, error);
    throw new TitanApiError('NETWORK_ERROR', 'Не удалось связаться с TITAN AUTO. Проверьте интернет.');
  } finally {
    clearTimeout(timer);
  }
}

export const TitanAPI = Object.freeze({
  health: () => request('health'),
  auth: {
    login: (pin) => request('auth.login', { pin }),
    check: () => request('auth.check'),
    logout: () => request('auth.logout'),
  },
  dashboard: { stats: () => request('dashboard.stats') },
  settings: {
    get: () => request('settings.get'),
    update: (company) => request('settings.update', { company }),
  },
  vehicles: {
    list: (filters = {}) => request('vehicle.list', filters),
    publicList: (filters = {}) => request('vehicle.publicList', filters),
    get: (vehicleId) => request('vehicle.get', { vehicle_id: vehicleId }),
    create: (data) => request('vehicle.create', data),
    update: (vehicleId, data) => request('vehicle.update', { vehicle_id: vehicleId, data }),
    archive: (vehicleId) => request('vehicle.archive', { vehicle_id: vehicleId }),
    markSold: (vehicleId, data) => request('vehicle.markSold', { vehicle_id: vehicleId, ...data }),
  },
  leads: {
    list: (filters = {}) => request('lead.list', filters),
    get: (leadId) => request('lead.get', { lead_id: leadId }),
    create: (data) => request('lead.create', data),
    update: (leadId, data) => request('lead.update', { lead_id: leadId, data }),
  },
  contacts: {
    list: (filters) => request('contact.list', filters),
    create: (data) => request('contact.create', data),
  },
  valuations: {
    list: (vehicleId) => request('valuation.list', { vehicle_id: vehicleId }),
    create: (data) => request('valuation.create', data),
  },
  sales: {
    list: (filters = {}) => request('sale.list', filters),
    create: (data) => request('sale.create', data),
  },
  files: {
    list: (vehicleId) => request('file.list', { vehicle_id: vehicleId }),
    upload: (data) => request('file.upload', data),
    remove: (fileId) => request('file.delete', { file_id: fileId }),
    download: (fileId) => request('file.getDownload', { file_id: fileId }),
    getDownload: (fileId) => request('file.getDownload', { file_id: fileId }),
  },
  tasks: {
    list: (filters = {}) => request('task.list', filters),
    create: (data) => request('task.create', data),
    update: (taskId, data) => request('task.update', { task_id: taskId, data }),
  },
});
