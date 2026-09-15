import { Config } from './config.js';
import { AppState } from './state.js';

const READ_ACTIONS = new Set(['health','auth.check','dashboard.stats','workspace.snapshot','documents.snapshot','settings.get','user.list','counterparty.list','deal.list','template.list','vehicle.list','vehicle.publicList','vehicle.publicGet','vehicle.get','lead.list','lead.get','contact.list','valuation.list','sale.list','file.list','file.getDownload','task.list']);
const responseCache = new Map();
const CACHE_TTL_MS = 20000;

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
  const cacheable = READ_ACTIONS.has(action) && action !== 'file.getDownload';
  const cacheKey = cacheable ? `${action}:${JSON.stringify(payload)}:${AppState.get('session')}` : '';
  const cached = cacheable ? responseCache.get(cacheKey) : null;
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) { clearTimeout(timer); return cached.value; }
  if (!cacheable) responseCache.clear();
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
    if (cacheable) responseCache.set(cacheKey, { time: Date.now(), value: envelope.data });
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
  workspace: { snapshot: async () => {
    try { return await request('workspace.snapshot'); }
    catch (error) {
      if (error.code !== 'UNKNOWN_ACTION') throw error;
      const [vehicles, leads, sales, valuations, tasks] = await Promise.all([request('vehicle.list',{include_archived:true}),request('lead.list'),request('sale.list'),request('valuation.list'),request('task.list')]);
      return { vehicles, leads, sales, valuations, tasks };
    }
  } },
  documents: { snapshot: async () => {
    try { return await request('documents.snapshot'); }
    catch (error) {
      if (error.code !== 'UNKNOWN_ACTION') throw error;
      const [vehicles, counterparties, deals, settings, templates] = await Promise.all([request('vehicle.list',{include_archived:true}),request('counterparty.list'),request('deal.list'),request('settings.get'),request('template.list',{include_content:true})]);
      return { vehicles, counterparties, deals, settings, templates };
    }
  } },
  settings: {
    get: () => request('settings.get'),
    update: (company) => request('settings.update', { company }),
  },
  users: {
    list: () => request('user.list'),
    upsert: (data) => request('user.upsert', data),
  },
  counterparties: {
    list: (filters = {}) => request('counterparty.list', filters),
    create: (data) => request('counterparty.create', data),
    update: (id, data) => request('counterparty.update', { counterparty_id: id, data }),
  },
  deals: {
    list: (filters = {}) => request('deal.list', filters),
    create: (data) => request('deal.create', data),
    update: (id, data) => request('deal.update', { deal_id: id, data }),
  },
  templates: { list: (includeContent = false) => request('template.list', { include_content: includeContent }) },
  vehicles: {
    list: (filters = {}) => request('vehicle.list', filters),
    publicList: (filters = {}) => request('vehicle.publicList', filters),
    publicGet: (vehicleId) => request('vehicle.publicGet', { vehicle_id: vehicleId }),
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
    update: (saleId, data) => request('sale.update', { sale_id: saleId, data }),
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
